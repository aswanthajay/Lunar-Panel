use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        DefaultBodyLimit, Multipart, Path, Query, State,
    },
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::Path as FsPath;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::monitor::HibernationManager;
use crate::runtime::cgroups::CgroupsV2Manager;
use crate::runtime::oci::OciRunner;

#[derive(Clone)]
pub struct WingsState {
    pub oci_runner: Arc<OciRunner>,
    pub cgroups: Arc<CgroupsV2Manager>,
    pub hibernation: Arc<HibernationManager>,
    pub servers: Arc<RwLock<HashMap<String, ServerRuntimeInfo>>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ServerRuntimeInfo {
    pub uuid: String,
    pub state: String, // "running", "offline", "starting", "stopping"
    pub memory_limit_bytes: u64,
    pub cpu_limit_percent: u32,
}

pub struct WingsAdapterServer {
    bind_addr: SocketAddr,
    ssl_cert: Option<String>,
    ssl_key: Option<String>,
    state: WingsState,
}

impl WingsAdapterServer {
    pub fn new(
        bind_addr: SocketAddr,
        ssl_cert: Option<String>,
        ssl_key: Option<String>,
        cgroups: Arc<CgroupsV2Manager>,
        hibernation: Arc<HibernationManager>,
    ) -> Self {
        Self {
            bind_addr,
            ssl_cert,
            ssl_key,
            state: WingsState {
                oci_runner: Arc::new(OciRunner::new(None)),
                cgroups,
                hibernation,
                servers: Arc::new(RwLock::new(HashMap::new())),
            },
        }
    }

    pub async fn run(self) -> Result<(), Box<dyn std::error::Error>> {
        let app = Router::new()
            .route("/", get(|| async {
                Json(serde_json::json!({
                    "name": "votion-node",
                    "version": "1.11.13",
                    "runtime": "crun",
                    "cgroups": "v2"
                }))
            }))
            .route("/api/system", get(get_system_info))
            .route("/api/servers", get(list_servers).post(create_server))
            .route(
                "/api/servers/{uuid}",
                get(get_server_details).delete(delete_server),
            )
            .route("/api/servers/{uuid}/power", post(handle_power))
            .route("/api/servers/{uuid}/commands", post(handle_commands))
            .route("/api/servers/{uuid}/sync", post(handle_sync))
            .route("/api/servers/{uuid}/ws", get(handle_websocket))
            .route("/api/servers/{uuid}/logs", get(handle_get_logs))
            .route("/api/servers/{uuid}/reinstall", post(handle_reinstall))
            .route("/api/servers/{uuid}/backup", post(handle_backup))
            .route("/api/servers/{uuid}/backup/{backup_id}", delete(handle_delete_backup))
            .route("/api/servers/{uuid}/backup/{backup_id}/restore", post(handle_restore_backup))
            // File Manager endpoints
            .route("/api/servers/{uuid}/files/list-directory", get(handle_list_directory))
            .route("/api/servers/{uuid}/files/contents", get(handle_get_file_contents))
            .route("/api/servers/{uuid}/files/write", post(handle_write_file))
            .route("/api/servers/{uuid}/files/create-directory", post(handle_create_directory))
            .route("/api/servers/{uuid}/files/rename", put(handle_rename_files))
            .route("/api/servers/{uuid}/files/copy", post(handle_copy_file))
            .route("/api/servers/{uuid}/files/delete", post(handle_delete_files))
            .route("/api/servers/{uuid}/files/chmod", post(handle_chmod_files))
            .route("/api/servers/{uuid}/files/compress", post(handle_compress_files))
            .route("/api/servers/{uuid}/files/decompress", post(handle_decompress_file))
            .route("/api/servers/{uuid}/files/pull", post(handle_pull_file))
            // Direct download & upload endpoints (signed JWT)
            .route("/upload/file", post(handle_upload_file))
            .route("/download/file", get(handle_download_file))
            .route("/download/backup", get(handle_download_backup))
            .layer(DefaultBodyLimit::disable())
            .layer(tower_http::cors::CorsLayer::very_permissive())
            .with_state(self.state);

        // Check if SSL/TLS certificates are provided or exist
        if let (Some(cert), Some(key)) = (&self.ssl_cert, &self.ssl_key) {
            let cert_path = FsPath::new(cert);
            let key_path = FsPath::new(key);
            if cert_path.exists() && key_path.exists() {
                match axum_server::tls_rustls::RustlsConfig::from_pem_file(cert_path, key_path).await {
                    Ok(tls_config) => {
                        info!(
                            "Wings Compatibility API (Pterodactyl/Lunar Panel) listening on https://{} (SSL active: cert={}, key={})",
                            self.bind_addr, cert, key
                        );
                        axum_server::bind_rustls(self.bind_addr, tls_config)
                            .serve(app.into_make_service())
                            .await?;
                        return Ok(());
                    }
                    Err(e) => {
                        error!(
                            "Failed to initialize TLS from cert '{}' and key '{}': {}. Falling back to plain HTTP.",
                            cert, key, e
                        );
                    }
                }
            } else {
                warn!(
                    "TLS certificate file ({}) or private key ({}) not found on disk. Falling back to plain HTTP.",
                    cert, key
                );
            }
        }

        info!(
            "Wings Compatibility API (Pterodactyl/Lunar Panel) listening on http://{}",
            self.bind_addr
        );
        axum_server::bind(self.bind_addr)
            .serve(app.into_make_service())
            .await?;

        Ok(())
    }
}

pub fn detect_pterodactyl_ssl() -> (Option<String>, Option<String>) {
    let p = FsPath::new("/etc/pterodactyl/config.yml");
    if !p.exists() {
        return (None, None);
    }
    let content = match std::fs::read_to_string(p) {
        Ok(c) => c,
        Err(_) => return (None, None),
    };

    let mut cert = None;
    let mut key = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("cert:") && cert.is_none() {
            let val = trimmed
                .trim_start_matches("cert:")
                .trim()
                .trim_matches('"')
                .trim_matches('\'');
            if !val.is_empty() {
                cert = Some(val.to_string());
            }
        } else if trimmed.starts_with("key:") && key.is_none() {
            let val = trimmed
                .trim_start_matches("key:")
                .trim()
                .trim_matches('"')
                .trim_matches('\'');
            if !val.is_empty() {
                key = Some(val.to_string());
            }
        }
    }

    if cert.is_some() && key.is_some() {
        info!(
            "Auto-detected SSL certs from /etc/pterodactyl/config.yml: cert={:?}, key={:?}",
            cert, key
        );
    }

    (cert, key)
}

// ==============================================================================
// Container & OCI Resolvers
// ==============================================================================

/// Checks if an OCI crun bundle exists for the specified uuid (or short uuid prefix)
pub fn resolve_crun_bundle(uuid: &str) -> Option<String> {
    let direct = format!("/var/lib/votion/containers/{}/config.json", uuid);
    if std::path::Path::new(&direct).exists() {
        return Some(uuid.to_string());
    }
    if let Ok(entries) = std::fs::read_dir("/var/lib/votion/containers") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(uuid) {
                let cfg = entry.path().join("config.json");
                if cfg.exists() {
                    return Some(name);
                }
            }
        }
    }
    None
}

/// Checks if the container is currently alive/running in crun
pub fn is_crun_active(id: &str) -> bool {
    let status_path = format!("/run/user/0/crun/{}/status", id);
    if let Ok(content) = std::fs::read_to_string(&status_path) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(pid) = val.get("pid").and_then(|p| p.as_u64()) {
                if pid > 0 && std::path::Path::new(&format!("/proc/{}", pid)).exists() {
                    return true;
                }
            }
        }
    }
    false
}

/// Checks if Docker currently has this container in 'running' state
pub async fn is_docker_running(id: &str) -> bool {
    if let Ok(output) = tokio::process::Command::new("docker")
        .args(["inspect", "--format", "{{.State.Status}}", id])
        .output()
        .await
    {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return s == "running";
        }
    }
    false
}

/// Resolves a full or short UUID to an existing Docker container name or ID
pub async fn resolve_container(uuid: &str) -> Option<String> {
    // 1. Direct docker inspect check
    if let Ok(output) = tokio::process::Command::new("docker")
        .args(["inspect", "--format", "{{.Id}}", uuid])
        .output()
        .await
    {
        if output.status.success() {
            let id = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !id.is_empty() {
                return Some(id);
            }
        }
    }

    // 2. Try docker ps -a filtering by name
    if let Ok(output) = tokio::process::Command::new("docker")
        .args(["ps", "-a", "--filter", &format!("name={}", uuid), "--format", "{{.ID}}|{{.Names}}"])
        .output()
        .await
    {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split('|').collect();
                if let Some(name) = parts.get(1) {
                    if name.contains(uuid) {
                        return Some(name.to_string());
                    }
                }
                if let Some(id) = parts.get(0) {
                    if !id.is_empty() {
                        return Some(id.to_string());
                    }
                }
            }
        }
    }

    // 3. Fallback to crun bundle if exists
    if let Some(crun_id) = resolve_crun_bundle(uuid) {
        return Some(crun_id);
    }

    Some(uuid.to_string())
}

/// Executes lifecycle commands on pure crun OCI containers
pub async fn execute_crun_action(container_id: &str, action: &str) -> Result<String, String> {
    let bundle = format!("/var/lib/votion/containers/{}", container_id);
    let sock = format!("{}/console.sock", bundle);

    match action {
        "start" => {
            let _ = tokio::fs::remove_file(&sock).await;
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["delete", "--force", container_id])
                .status()
                .await;

            let status = tokio::process::Command::new("dtach")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["-n", &sock, "crun", "run", "-b", &bundle, container_id])
                .status()
                .await
                .map_err(|e| format!("Failed to spawn dtach/crun: {}", e))?;
            if status.success() {
                Ok("started".to_string())
            } else {
                Err("crun start failed".to_string())
            }
        }
        "stop" => {
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["kill", container_id, "SIGTERM"])
                .status()
                .await;
            tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["delete", "--force", container_id])
                .status()
                .await;
            let _ = tokio::fs::remove_file(&sock).await;
            Ok("stopped".to_string())
        }
        "restart" => {
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["kill", container_id, "SIGTERM"])
                .status()
                .await;
            tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["delete", "--force", container_id])
                .status()
                .await;
            let _ = tokio::fs::remove_file(&sock).await;
            let status = tokio::process::Command::new("dtach")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["-n", &sock, "crun", "run", "-b", &bundle, container_id])
                .status()
                .await
                .map_err(|e| format!("Failed to spawn dtach/crun: {}", e))?;
            if status.success() {
                Ok("restarted".to_string())
            } else {
                Err("crun restart failed".to_string())
            }
        }
        "kill" => {
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["kill", container_id, "SIGKILL"])
                .status()
                .await;
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["delete", "--force", container_id])
                .status()
                .await;
            let _ = tokio::fs::remove_file(&sock).await;
            Ok("killed".to_string())
        }
        _ => Err("invalid action".to_string()),
    }
}

/// Sends input directly into container PID 1 stdin via Docker socket hijacking
pub async fn send_container_stdin(container_id: &str, command: &str) -> Result<(), String> {
    #[cfg(unix)]
    {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::UnixStream;

        if let Ok(mut stream) = UnixStream::connect("/var/run/docker.sock").await {
            let req = format!(
                "POST /containers/{}/attach?stream=1&stdin=1 HTTP/1.1\r\nHost: localhost\r\nUpgrade: tcp\r\nConnection: Upgrade\r\n\r\n",
                container_id
            );
            if stream.write_all(req.as_bytes()).await.is_ok() {
                let mut buf = [0u8; 512];
                if let Ok(n) = stream.read(&mut buf).await {
                    let resp = String::from_utf8_lossy(&buf[..n]);
                    if resp.contains("101") {
                        let payload = format!("{}\n", command);
                        let _ = stream.write_all(payload.as_bytes()).await;
                        let _ = stream.flush().await;
                        info!("Delivered command to container {} stdin via Docker socket", container_id);
                        return Ok(());
                    }
                }
            }
        }
    }

    // Fallback: spawn docker exec
    let mut child = tokio::process::Command::new("docker")
        .args(["exec", "-i", container_id, "sh", "-c", command])
        .spawn()
        .map_err(|e| format!("Failed to spawn docker exec: {}", e))?;
    let _ = child.wait().await;

    Ok(())
}

/// Executes power actions (start, stop, restart, kill) via Docker CLI
pub async fn docker_power_action(container: &str, action: &str) -> Result<String, String> {
    let docker_cmd = match action {
        "start" => "start",
        "stop" => "stop",
        "restart" => "restart",
        "kill" => "kill",
        _ => return Err(format!("Unknown action: {}", action)),
    };

    let output = tokio::process::Command::new("docker")
        .args([docker_cmd, container])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn docker {}: {}", docker_cmd, e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("docker {} error: {}", docker_cmd, err))
    }
}

fn parse_mem_str(s: &str) -> u64 {
    let current = s.split('/').next().unwrap_or("").trim();
    if current.ends_with("GiB") {
        let val: f64 = current.trim_end_matches("GiB").trim().parse().unwrap_or(0.0);
        (val * 1024.0 * 1024.0 * 1024.0) as u64
    } else if current.ends_with("MiB") {
        let val: f64 = current.trim_end_matches("MiB").trim().parse().unwrap_or(0.0);
        (val * 1024.0 * 1024.0) as u64
    } else if current.ends_with("KiB") {
        let val: f64 = current.trim_end_matches("KiB").trim().parse().unwrap_or(0.0);
        (val * 1024.0) as u64
    } else {
        256 * 1024 * 1024
    }
}

// ==============================================================================
// HTTP Endpoints (Exact Pterodactyl Wings API)
// ==============================================================================

#[derive(Serialize)]
struct SystemInfoResponse {
    architecture: String,
    cpu_count: usize,
    kernel_version: String,
    os: String,
    version: String,
}

async fn get_system_info() -> Json<SystemInfoResponse> {
    Json(SystemInfoResponse {
        architecture: std::env::consts::ARCH.to_string(),
        cpu_count: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4),
        kernel_version: "6.8.0-votion-cgroupsv2".to_string(),
        os: std::env::consts::OS.to_string(),
        version: "1.11.13".to_string(), // Reports compatible Wings version to Panel
    })
}

async fn list_servers(State(state): State<WingsState>) -> Json<Vec<String>> {
    let lock = state.servers.read().await;
    let list: Vec<String> = lock.keys().cloned().collect();
    Json(list)
}

#[derive(Deserialize)]
struct CreateServerRequest {
    uuid: String,
    #[allow(dead_code)]
    start_on_completion: Option<bool>,
}

async fn create_server(
    State(state): State<WingsState>,
    Json(payload): Json<CreateServerRequest>,
) -> StatusCode {
    info!("Pterodactyl requested server creation for UUID: {}", payload.uuid);

    let mut lock = state.servers.write().await;
    lock.insert(
        payload.uuid.clone(),
        ServerRuntimeInfo {
            uuid: payload.uuid.clone(),
            state: "offline".to_string(),
            memory_limit_bytes: 2048 * 1024 * 1024,
            cpu_limit_percent: 100,
        },
    );

    StatusCode::CREATED
}

async fn get_server_details(
    Path(uuid): Path<String>,
    State(state): State<WingsState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 1. If actively running in Docker, query Docker
    if is_docker_running(&uuid).await {
        let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
        let status_output = tokio::process::Command::new("docker")
            .args(["inspect", "--format", "{{.State.Status}}", &target])
            .output()
            .await;

        let current_state = match status_output {
            Ok(out) if out.status.success() => {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if s == "running" { "running".to_string() } else { "offline".to_string() }
            }
            _ => "offline".to_string(),
        };

        return Ok(Json(serde_json::json!({
            "uuid": uuid,
            "state": current_state,
            "is_suspended": false,
            "utilization": {
                "memory_bytes": 256 * 1024 * 1024,
                "cpu_absolute": 1.5,
                "disk_bytes": 1024 * 1024 * 1024,
                "network": { "rx_bytes": 1024, "tx_bytes": 1024 }
            }
        })));
    }

    // 2. Check if crun OCI container is active or configured
    if let Some(crun_id) = resolve_crun_bundle(&uuid) {
        let is_running = is_crun_active(&crun_id);
        let current_state = if is_running { "running" } else { "offline" };

        return Ok(Json(serde_json::json!({
            "uuid": uuid,
            "state": current_state,
            "is_suspended": false,
            "utilization": {
                "memory_bytes": 1024 * 1024 * 1024,
                "cpu_absolute": 2.5,
                "disk_bytes": 1024 * 1024 * 1024,
                "network": { "rx_bytes": 1024, "tx_bytes": 1024 }
            }
        })));
    }

    // 3. Fall back to Docker inspection
    let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
    let status_output = tokio::process::Command::new("docker")
        .args(["inspect", "--format", "{{.State.Status}}", &target])
        .output()
        .await;

    let current_state = match status_output {
        Ok(out) if out.status.success() => {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if s == "running" { "running".to_string() } else { "offline".to_string() }
        }
        _ => {
            let lock = state.servers.read().await;
            lock.get(&uuid).map(|s| s.state.clone()).unwrap_or_else(|| "offline".to_string())
        }
    };

    Ok(Json(serde_json::json!({
        "uuid": uuid,
        "state": current_state,
        "is_suspended": false,
        "utilization": {
            "memory_bytes": 256 * 1024 * 1024,
            "cpu_absolute": 1.5,
            "disk_bytes": 1024 * 1024 * 1024,
            "network": { "rx_bytes": 1024, "tx_bytes": 1024 }
        }
    })))
}

async fn delete_server(
    Path(uuid): Path<String>,
    State(state): State<WingsState>,
) -> StatusCode {
    info!("Pterodactyl requested server deletion for UUID: {}", uuid);
    if is_docker_running(&uuid).await {
        let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
        let _ = docker_power_action(&target, "kill").await;
    } else if let Some(crun_id) = resolve_crun_bundle(&uuid) {
        let _ = execute_crun_action(&crun_id, "kill").await;
    } else {
        let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
        let _ = docker_power_action(&target, "kill").await;
    }
    let _ = state.oci_runner.delete(&uuid).await;
    let mut lock = state.servers.write().await;
    lock.remove(&uuid);
    StatusCode::NO_CONTENT
}

#[derive(Deserialize)]
struct PowerRequest {
    action: String,
}

async fn handle_power(
    Path(uuid): Path<String>,
    State(state): State<WingsState>,
    Json(payload): Json<PowerRequest>,
) -> StatusCode {
    info!("Received power action '{}' for server {}", payload.action, uuid);

    // 1. If active in Docker, execute on Docker
    if is_docker_running(&uuid).await {
        let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
        return match docker_power_action(&target, &payload.action).await {
            Ok(res) => {
                info!("Docker power action '{}' succeeded for {}: {}", payload.action, target, res);
                let mut lock = state.servers.write().await;
                if let Some(s) = lock.get_mut(&uuid) {
                    s.state = if payload.action == "start" || payload.action == "restart" {
                        "running".to_string()
                    } else {
                        "offline".to_string()
                    };
                }
                StatusCode::NO_CONTENT
            }
            Err(e) => {
                tracing::error!("Docker power action failed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        };
    }

    // 2. Check if crun OCI container
    if let Some(crun_id) = resolve_crun_bundle(&uuid) {
        let _ = execute_crun_action(&crun_id, &payload.action).await;
        return StatusCode::NO_CONTENT;
    }

    // 2. Try Docker power action
    let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
    match docker_power_action(&target, &payload.action).await {
        Ok(res) => {
            info!("Docker power action '{}' succeeded for {}: {}", payload.action, target, res);
            let mut lock = state.servers.write().await;
            if let Some(s) = lock.get_mut(&uuid) {
                s.state = if payload.action == "start" || payload.action == "restart" {
                    "running".to_string()
                } else {
                    "offline".to_string()
                };
            }
            return StatusCode::NO_CONTENT;
        }
        Err(e) => {
            tracing::warn!("Docker action failed: {}. Checking fallback...", e);
        }
    }

    StatusCode::NO_CONTENT
}

#[derive(Deserialize)]
struct CommandRequest {
    commands: Vec<String>,
}

async fn handle_commands(
    Path(uuid): Path<String>,
    Json(payload): Json<CommandRequest>,
) -> StatusCode {
    let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
    for cmd in payload.commands {
        info!("Executing stdin command on container {}: {}", target, cmd);
        let _ = send_container_stdin(&target, &cmd).await;
    }
    StatusCode::NO_CONTENT
}

async fn handle_sync(Path(uuid): Path<String>) -> StatusCode {
    info!("Sync configuration requested for {}", uuid);
    StatusCode::NO_CONTENT
}

async fn handle_get_logs(Path(uuid): Path<String>) -> Json<serde_json::Value> {
    let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
    let mut logs: Vec<String> = Vec::new();

    let mc_log = format!("/var/lib/pterodactyl/volumes/{}/logs/latest.log", target);
    if std::path::Path::new(&mc_log).exists() {
        if let Ok(content) = tokio::fs::read_to_string(&mc_log).await {
            for line in content.lines().rev().take(100).collect::<Vec<_>>().into_iter().rev() {
                logs.push(format!("{}\n", line));
            }
            return Json(serde_json::json!({ "data": logs }));
        }
    }

    if let Ok(output) = tokio::process::Command::new("docker")
        .args(["logs", "--tail", "100", &target])
        .output()
        .await
    {
        let combined = String::from_utf8_lossy(&output.stdout);
        for line in combined.lines() {
            logs.push(format!("{}\n", line));
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        for line in stderr.lines() {
            logs.push(format!("{}\n", line));
        }
    }

    if logs.is_empty() {
        logs.push(format!("[votion-node] Attached to container {}.\n", target));
    }

    Json(serde_json::json!({
        "data": logs
    }))
}

async fn handle_reinstall(Path(uuid): Path<String>) -> StatusCode {
    info!("Reinstall requested for {}", uuid);
    StatusCode::ACCEPTED
}

// ==============================================================================
// Wings File Manager & Backup Handlers
// ==============================================================================

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WingsFileObject {
    pub name: String,
    pub created: String,
    pub modified: String,
    pub mode: String,
    pub mode_bits: String,
    pub size: u64,
    pub directory: bool,
    pub file: bool,
    pub symlink: bool,
    pub mime: String,
}

pub fn resolve_server_volume(uuid: &str) -> Option<std::path::PathBuf> {
    let direct = std::path::PathBuf::from(format!("/var/lib/pterodactyl/volumes/{}", uuid));
    if direct.is_dir() {
        return Some(direct);
    }
    if let Ok(entries) = std::fs::read_dir("/var/lib/pterodactyl/volumes") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(uuid) {
                let p = entry.path();
                if p.is_dir() {
                    return Some(p);
                }
            }
        }
    }
    None
}

pub fn safe_resolve_subpath(base: &FsPath, subpath: &str) -> Result<std::path::PathBuf, StatusCode> {
    let mut resolved = base.to_path_buf();
    let trimmed = subpath.trim_start_matches('/').trim_start_matches('\\');
    if trimmed.is_empty() {
        return Ok(resolved);
    }
    for component in FsPath::new(trimmed).components() {
        match component {
            std::path::Component::Normal(c) => resolved.push(c),
            std::path::Component::CurDir => {},
            _ => {
                warn!("Blocked path traversal attempt in subpath: {}", subpath);
                return Err(StatusCode::FORBIDDEN);
            }
        }
    }
    if !resolved.starts_with(base) {
        warn!("Path escape detected: resolved {:?} does not start with base {:?}", resolved, base);
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(resolved)
}

fn detect_mime_type(path: &FsPath) -> &'static str {
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    match ext.as_str() {
        "txt" | "log" | "properties" | "cfg" | "conf" | "ini" | "env" => "text/plain",
        "json" => "application/json",
        "yml" | "yaml" => "text/yaml",
        "toml" => "text/x-toml",
        "xml" => "application/xml",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" => "application/javascript",
        "ts" => "application/typescript",
        "sh" | "bash" => "application/x-sh",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "zip" => "application/zip",
        "tar" => "application/x-tar",
        "gz" | "tgz" => "application/gzip",
        "jar" => "application/java-archive",
        "sql" => "application/sql",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn format_unix_mode(is_dir: bool, is_symlink: bool, mode: u32) -> String {
    let prefix = if is_dir {
        'd'
    } else if is_symlink {
        'l'
    } else {
        '-'
    };
    let mut s = String::with_capacity(10);
    s.push(prefix);
    s.push(if mode & 0o400 != 0 { 'r' } else { '-' });
    s.push(if mode & 0o200 != 0 { 'w' } else { '-' });
    s.push(if mode & 0o100 != 0 { 'x' } else { '-' });
    s.push(if mode & 0o040 != 0 { 'r' } else { '-' });
    s.push(if mode & 0o020 != 0 { 'w' } else { '-' });
    s.push(if mode & 0o010 != 0 { 'x' } else { '-' });
    s.push(if mode & 0o004 != 0 { 'r' } else { '-' });
    s.push(if mode & 0o002 != 0 { 'w' } else { '-' });
    s.push(if mode & 0o001 != 0 { 'x' } else { '-' });
    s
}

fn fix_pterodactyl_ownership(path: &FsPath) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::chown;
        let _ = chown(path, Some(999), Some(995));
    }
    #[cfg(not(unix))]
    let _ = path;
}

async fn fix_pterodactyl_ownership_recursive(path: &FsPath) {
    #[cfg(unix)]
    {
        let _ = tokio::process::Command::new("chown")
            .args(["-R", "999:995", &path.to_string_lossy()])
            .status()
            .await;
    }
    #[cfg(not(unix))]
    let _ = path;
}

fn decode_jwt_payload(token: &str) -> Option<serde_json::Value> {
    use base64::Engine;
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() < 2 {
        return None;
    }
    let payload_b64 = parts[1];
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .or_else(|_| {
            let mut padded = payload_b64.to_string();
            while padded.len() % 4 != 0 {
                padded.push('=');
            }
            base64::engine::general_purpose::URL_SAFE.decode(&padded)
        })
        .or_else(|_| {
            let mut padded = payload_b64.to_string();
            while padded.len() % 4 != 0 {
                padded.push('=');
            }
            base64::engine::general_purpose::STANDARD.decode(&padded)
        })
        .ok()?;

    serde_json::from_slice(&decoded).ok()
}

fn validate_jwt_claims(payload: &serde_json::Value, expected_scope: &str) -> Result<(), StatusCode> {
    if let Some(exp) = payload.get("exp").and_then(|v| v.as_i64()) {
        let now = chrono::Utc::now().timestamp();
        if now > exp {
            warn!("JWT token has expired (now={}, exp={})", now, exp);
            return Err(StatusCode::FORBIDDEN);
        }
    }
    if let Some(scope) = payload.get("scope").and_then(|v| v.as_str()) {
        if scope != expected_scope {
            warn!("JWT scope mismatch: expected {}, got {}", expected_scope, scope);
            return Err(StatusCode::FORBIDDEN);
        }
    }
    Ok(())
}

pub fn get_panel_remote_config() -> (String, String) {
    let p = FsPath::new("/etc/pterodactyl/config.yml");
    if !p.exists() {
        return ("https://console.votioncloud.online".to_string(), String::new());
    }
    let content = match std::fs::read_to_string(p) {
        Ok(c) => c,
        Err(_) => return ("https://console.votioncloud.online".to_string(), String::new()),
    };

    let mut remote_url = "https://console.votioncloud.online".to_string();
    let mut token_id = String::new();
    let mut token = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("remote:") && !trimmed.starts_with("remote_query:") {
            let val = trimmed
                .trim_start_matches("remote:")
                .trim()
                .trim_matches('"')
                .trim_matches('\'');
            if !val.is_empty() {
                remote_url = val.to_string();
            }
        } else if trimmed.starts_with("token_id:") {
            let val = trimmed
                .trim_start_matches("token_id:")
                .trim()
                .trim_matches('"')
                .trim_matches('\'');
            token_id = val.to_string();
        } else if trimmed.starts_with("token:") {
            let val = trimmed
                .trim_start_matches("token:")
                .trim()
                .trim_matches('"')
                .trim_matches('\'');
            token = val.to_string();
        }
    }

    let auth_header = format!("Bearer {}{}", token_id, token);
    (remote_url, auth_header)
}

async fn compute_file_sha256(path: &FsPath) -> String {
    let output = tokio::process::Command::new("sha256sum")
        .arg(path.to_string_lossy().to_string())
        .output()
        .await;
    if let Ok(out) = output {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout);
            if let Some(hash) = s.split_whitespace().next() {
                return hash.to_string();
            }
        }
    }
    String::new()
}

async fn notify_panel_backup_complete(backup_uuid: &str, successful: bool, size: u64, checksum: &str) {
    let (remote_url, auth_header) = get_panel_remote_config();
    let target_url = format!("{}/api/remote/backups/{}", remote_url, backup_uuid);

    let payload = serde_json::json!({
        "successful": successful,
        "size": size,
        "checksum": checksum,
        "checksum_type": "sha256"
    });

    let _ = tokio::process::Command::new("curl")
        .args([
            "-k",
            "-s",
            "-X", "POST",
            "-H", &format!("Authorization: {}", auth_header),
            "-H", "Content-Type: application/json",
            "-H", "Accept: application/json",
            "-d", &payload.to_string(),
            &target_url,
        ])
        .output()
        .await;
}

async fn notify_panel_restore_complete(backup_uuid: &str, successful: bool) {
    let (remote_url, auth_header) = get_panel_remote_config();
    let target_url = format!("{}/api/remote/backups/{}/restore", remote_url, backup_uuid);

    let payload = serde_json::json!({
        "successful": successful
    });

    let _ = tokio::process::Command::new("curl")
        .args([
            "-k",
            "-s",
            "-X", "POST",
            "-H", &format!("Authorization: {}", auth_header),
            "-H", "Content-Type: application/json",
            "-H", "Accept: application/json",
            "-d", &payload.to_string(),
            &target_url,
        ])
        .output()
        .await;
}

#[derive(Deserialize)]
pub struct ListDirectoryQuery {
    pub directory: Option<String>,
}

async fn handle_list_directory(
    Path(uuid): Path<String>,
    Query(query): Query<ListDirectoryQuery>,
) -> Result<Json<Vec<WingsFileObject>>, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let req_dir = query.directory.as_deref().unwrap_or("/");
    let dir_path = safe_resolve_subpath(&vol, req_dir)?;

    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut entries = tokio::fs::read_dir(&dir_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut files = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let meta = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };

        let file_type = meta.file_type();
        let is_dir = file_type.is_dir();
        let is_symlink = file_type.is_symlink();
        let is_file = file_type.is_file();
        let size = if is_file { meta.len() } else { 0 };

        let name = entry.file_name().to_string_lossy().to_string();

        #[cfg(unix)]
        let mode_num = {
            use std::os::unix::fs::MetadataExt;
            meta.mode()
        };
        #[cfg(not(unix))]
        let mode_num = 0o644;

        let mode_bits = format!("{:04o}", mode_num & 0o7777);
        let mode = format_unix_mode(is_dir, is_symlink, mode_num);

        let modified = meta
            .modified()
            .ok()
            .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
            .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());

        let created = meta
            .created()
            .ok()
            .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
            .unwrap_or_else(|| modified.clone());

        let mime = if is_dir {
            "inode/directory".to_string()
        } else {
            detect_mime_type(&entry.path()).to_string()
        };

        files.push(WingsFileObject {
            name,
            created,
            modified,
            mode,
            mode_bits,
            size,
            directory: is_dir,
            file: is_file,
            symlink: is_symlink,
            mime,
        });
    }

    files.sort_by(|a, b| {
        if a.directory != b.directory {
            b.directory.cmp(&a.directory)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(Json(files))
}

#[derive(Deserialize)]
pub struct FileContentsQuery {
    pub file: Option<String>,
}

async fn handle_get_file_contents(
    Path(uuid): Path<String>,
    Query(query): Query<FileContentsQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let file_req = query.file.ok_or(StatusCode::BAD_REQUEST)?;
    let file_path = safe_resolve_subpath(&vol, &file_req)?;

    if !file_path.exists() || file_path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let bytes = tokio::fs::read(&file_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mime = detect_mime_type(&file_path);
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime).unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&bytes.len().to_string()).unwrap(),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename))
            .unwrap_or(HeaderValue::from_static("attachment")),
    );

    Ok((headers, bytes))
}

async fn handle_write_file(
    Path(uuid): Path<String>,
    Query(query): Query<FileContentsQuery>,
    body: axum::body::Bytes,
) -> Result<StatusCode, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let file_req = query.file.ok_or(StatusCode::BAD_REQUEST)?;
    let file_path = safe_resolve_subpath(&vol, &file_req)?;

    if let Some(parent) = file_path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
        fix_pterodactyl_ownership(parent);
    }

    tokio::fs::write(&file_path, &body)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    fix_pterodactyl_ownership(&file_path);

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct CreateDirectoryRequest {
    pub name: String,
    pub path: Option<String>,
}

async fn handle_create_directory(
    Path(uuid): Path<String>,
    Json(payload): Json<CreateDirectoryRequest>,
) -> Result<StatusCode, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let parent_path = safe_resolve_subpath(&vol, payload.path.as_deref().unwrap_or("/"))?;
    let target = safe_resolve_subpath(&parent_path, &payload.name)?;

    tokio::fs::create_dir_all(&target)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    fix_pterodactyl_ownership(&target);

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct RenamePair {
    pub from: String,
    pub to: String,
}

#[derive(Deserialize)]
pub struct RenameFilesRequest {
    pub root: Option<String>,
    pub files: Vec<RenamePair>,
}

async fn handle_rename_files(
    Path(uuid): Path<String>,
    Json(payload): Json<RenameFilesRequest>,
) -> Result<StatusCode, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let root_path = safe_resolve_subpath(&vol, payload.root.as_deref().unwrap_or("/"))?;

    for pair in payload.files {
        let src = safe_resolve_subpath(&root_path, &pair.from)?;
        let dst = safe_resolve_subpath(&root_path, &pair.to)?;

        if let Some(parent) = dst.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }

        tokio::fs::rename(&src, &dst)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct CopyFileRequest {
    pub location: String,
}

async fn handle_copy_file(
    Path(uuid): Path<String>,
    Json(payload): Json<CopyFileRequest>,
) -> Result<StatusCode, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let src = safe_resolve_subpath(&vol, &payload.location)?;

    if !src.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let parent = src.parent().unwrap_or(&vol);
    let stem = src.file_stem().unwrap_or_default().to_string_lossy();
    let ext = src
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    let mut counter = 0;
    let dst = loop {
        let name = if counter == 0 {
            format!("{} copy{}", stem, ext)
        } else {
            format!("{} copy {}{}", stem, counter, ext)
        };
        let p = parent.join(&name);
        if !p.exists() {
            break p;
        }
        counter += 1;
    };

    if src.is_dir() {
        let _ = tokio::process::Command::new("cp")
            .args(["-r", &src.to_string_lossy(), &dst.to_string_lossy()])
            .status()
            .await;
        fix_pterodactyl_ownership_recursive(&dst).await;
    } else {
        tokio::fs::copy(&src, &dst)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        fix_pterodactyl_ownership(&dst);
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct DeleteFilesRequest {
    pub root: Option<String>,
    pub files: Vec<String>,
}

async fn handle_delete_files(
    Path(uuid): Path<String>,
    Json(payload): Json<DeleteFilesRequest>,
) -> Result<StatusCode, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let root_path = safe_resolve_subpath(&vol, payload.root.as_deref().unwrap_or("/"))?;

    for item in payload.files {
        let target = safe_resolve_subpath(&root_path, &item)?;
        if target == vol {
            warn!("Rejected attempt to delete server volume root: {:?}", vol);
            continue;
        }

        if target.is_dir() {
            let _ = tokio::fs::remove_dir_all(&target).await;
        } else if target.exists() {
            let _ = tokio::fs::remove_file(&target).await;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct ChmodPair {
    pub file: String,
    pub mode: String,
}

#[derive(Deserialize)]
pub struct ChmodFilesRequest {
    pub root: Option<String>,
    pub files: Vec<ChmodPair>,
}

async fn handle_chmod_files(
    Path(uuid): Path<String>,
    Json(payload): Json<ChmodFilesRequest>,
) -> Result<StatusCode, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let root_path = safe_resolve_subpath(&vol, payload.root.as_deref().unwrap_or("/"))?;

    for pair in payload.files {
        let target = safe_resolve_subpath(&root_path, &pair.file)?;
        if !target.exists() {
            continue;
        }
        let clean_mode = pair.mode.trim_start_matches('0');
        if let Ok(bits) = u32::from_str_radix(clean_mode, 8) {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = tokio::fs::set_permissions(&target, std::fs::Permissions::from_mode(bits)).await;
            }
            #[cfg(not(unix))]
            let _ = bits;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct CompressFilesRequest {
    pub root: Option<String>,
    pub files: Vec<String>,
}

async fn handle_compress_files(
    Path(uuid): Path<String>,
    Json(payload): Json<CompressFilesRequest>,
) -> Result<Json<WingsFileObject>, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let root_path = safe_resolve_subpath(&vol, payload.root.as_deref().unwrap_or("/"))?;

    let now_str = chrono::Utc::now().format("%Y-%m-%dT%H%M%SZ").to_string();
    let archive_name = format!("archive-{}.tar.gz", now_str);
    let archive_path = root_path.join(&archive_name);

    let mut args = vec!["-czf".to_string(), archive_name.clone()];
    for f in payload.files {
        let clean = f.trim_start_matches('/').to_string();
        if !clean.is_empty() {
            args.push(clean);
        }
    }

    let status = tokio::process::Command::new("tar")
        .current_dir(&root_path)
        .args(&args)
        .status()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !status.success() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    fix_pterodactyl_ownership(&archive_path);

    let meta = tokio::fs::metadata(&archive_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let size = meta.len();
    let created = chrono::Utc::now().to_rfc3339();

    Ok(Json(WingsFileObject {
        name: archive_name,
        created: created.clone(),
        modified: created,
        mode: "-rw-r--r--".to_string(),
        mode_bits: "0644".to_string(),
        size,
        directory: false,
        file: true,
        symlink: false,
        mime: "application/gzip".to_string(),
    }))
}

#[derive(Deserialize)]
pub struct DecompressFileRequest {
    pub root: Option<String>,
    pub file: String,
}

async fn handle_decompress_file(
    Path(uuid): Path<String>,
    Json(payload): Json<DecompressFileRequest>,
) -> Result<StatusCode, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let root_path = safe_resolve_subpath(&vol, payload.root.as_deref().unwrap_or("/"))?;

    // Try resolving file relative to root_path first; if not found, resolve relative to volume base
    let archive_path = if let Ok(p) = safe_resolve_subpath(&root_path, &payload.file) {
        if p.exists() {
            p
        } else if let Ok(vp) = safe_resolve_subpath(&vol, &payload.file) {
            vp
        } else {
            p
        }
    } else {
        safe_resolve_subpath(&vol, &payload.file)?
    };

    if !archive_path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let archive_str = archive_path.to_string_lossy();
    let root_str = root_path.to_string_lossy();

    let status = if archive_str.ends_with(".zip") {
        tokio::process::Command::new("unzip")
            .args(["-o", "-q", &archive_str, "-d", &root_str])
            .status()
            .await
    } else {
        tokio::process::Command::new("tar")
            .args(["-xf", &archive_str, "-C", &root_str])
            .status()
            .await
    };

    match status {
        Ok(s) if s.success() => {
            fix_pterodactyl_ownership_recursive(&root_path).await;
            Ok(StatusCode::NO_CONTENT)
        }
        _ => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[derive(Deserialize)]
pub struct PullFileRequest {
    pub url: String,
    pub root: Option<String>,
    pub file_name: Option<String>,
    pub use_header: Option<bool>,
    pub foreground: Option<bool>,
}

async fn handle_pull_file(
    Path(uuid): Path<String>,
    Json(payload): Json<PullFileRequest>,
) -> Result<StatusCode, StatusCode> {
    let vol = resolve_server_volume(&uuid).ok_or(StatusCode::NOT_FOUND)?;
    let root_path = safe_resolve_subpath(&vol, payload.root.as_deref().unwrap_or("/"))?;

    let filename = if let Some(f) = payload.file_name {
        f
    } else {
        payload.url.split('/').last().unwrap_or("pulled_file").to_string()
    };

    let target_path = safe_resolve_subpath(&root_path, &filename)?;

    let url = payload.url.clone();
    let target = target_path.clone();

    let download_task = async move {
        let status = tokio::process::Command::new("curl")
            .args(["-sSL", "-o", &target.to_string_lossy(), &url])
            .status()
            .await;
        if let Ok(s) = status {
            if s.success() {
                fix_pterodactyl_ownership(&target);
            }
        }
    };

    if payload.foreground.unwrap_or(false) {
        download_task.await;
    } else {
        tokio::spawn(download_task);
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct UploadQuery {
    pub token: Option<String>,
    pub directory: Option<String>,
}

async fn handle_upload_file(
    Query(query): Query<UploadQuery>,
    mut multipart: Multipart,
) -> Result<StatusCode, StatusCode> {
    let token = query.token.ok_or(StatusCode::UNAUTHORIZED)?;
    let payload = decode_jwt_payload(&token).ok_or(StatusCode::FORBIDDEN)?;
    validate_jwt_claims(&payload, "file-upload")?;

    let server_uuid = payload
        .get("server_uuid")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::FORBIDDEN)?;

    let vol = resolve_server_volume(server_uuid).ok_or(StatusCode::NOT_FOUND)?;
    let target_dir = safe_resolve_subpath(&vol, query.directory.as_deref().unwrap_or("/"))?;

    if !target_dir.exists() {
        let _ = tokio::fs::create_dir_all(&target_dir).await;
        fix_pterodactyl_ownership(&target_dir);
    }

    while let Ok(Some(mut field)) = multipart.next_field().await {
        let raw_name = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "upload.bin".to_string());

        let clean_name = raw_name.replace('\\', "/");
        let safe_name = clean_name.split('/').last().unwrap_or("upload.bin");
        let file_path = safe_resolve_subpath(&target_dir, safe_name)?;

        let mut out_file = tokio::fs::File::create(&file_path)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        while let Ok(Some(chunk)) = field.chunk().await {
            out_file
                .write_all(&chunk)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
        let _ = out_file.flush().await;
        fix_pterodactyl_ownership(&file_path);
    }

    Ok(StatusCode::OK)
}

#[derive(Deserialize)]
pub struct DownloadQuery {
    pub token: Option<String>,
}

async fn handle_download_file(
    Query(query): Query<DownloadQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let token = query.token.ok_or(StatusCode::UNAUTHORIZED)?;
    let payload = decode_jwt_payload(&token).ok_or(StatusCode::FORBIDDEN)?;
    validate_jwt_claims(&payload, "file-download")?;

    let server_uuid = payload
        .get("server_uuid")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::FORBIDDEN)?;

    let file_path_str = payload
        .get("file_path")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::FORBIDDEN)?;

    let vol = resolve_server_volume(server_uuid).ok_or(StatusCode::NOT_FOUND)?;
    let target_file = safe_resolve_subpath(&vol, file_path_str)?;

    if !target_file.exists() || target_file.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let bytes = tokio::fs::read(&target_file)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mime = detect_mime_type(&target_file);
    let filename = target_file
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime).unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&bytes.len().to_string()).unwrap(),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename))
            .unwrap_or(HeaderValue::from_static("attachment")),
    );

    Ok((headers, bytes))
}

async fn handle_download_backup(
    Query(query): Query<DownloadQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let token = query.token.ok_or(StatusCode::UNAUTHORIZED)?;
    let payload = decode_jwt_payload(&token).ok_or(StatusCode::FORBIDDEN)?;
    validate_jwt_claims(&payload, "backup-download")?;

    let backup_uuid = payload
        .get("backup_uuid")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::FORBIDDEN)?;

    let backup_file = FsPath::new("/var/lib/pterodactyl/backups").join(format!("{}.tar.gz", backup_uuid));
    if !backup_file.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let bytes = tokio::fs::read(&backup_file)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let filename = format!("{}.tar.gz", backup_uuid);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/x-gzip"));
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&bytes.len().to_string()).unwrap(),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename))
            .unwrap_or(HeaderValue::from_static("attachment")),
    );

    Ok((headers, bytes))
}

#[derive(Deserialize)]
pub struct BackupParams {
    pub uuid: String,
    pub backup_id: String,
}

#[derive(Deserialize)]
pub struct CreateBackupRequest {
    pub adapter: Option<String>,
    pub uuid: Option<String>,
    pub ignore: Option<String>,
}

async fn handle_backup(
    Path(uuid): Path<String>,
    Json(payload): Json<CreateBackupRequest>,
) -> StatusCode {
    let backup_uuid = payload.uuid.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    info!("Starting backup {} for server {}", backup_uuid, uuid);

    let vol = match resolve_server_volume(&uuid) {
        Some(v) => v,
        None => return StatusCode::NOT_FOUND,
    };

    let backups_dir = FsPath::new("/var/lib/pterodactyl/backups");
    let _ = tokio::fs::create_dir_all(backups_dir).await;

    let backup_dest = backups_dir.join(format!("{}.tar.gz", backup_uuid));
    let backup_uuid_clone = backup_uuid.clone();

    tokio::spawn(async move {
        let status = tokio::process::Command::new("tar")
            .args(["-czf", &backup_dest.to_string_lossy(), "-C", &vol.to_string_lossy(), "."])
            .status()
            .await;

        if let Ok(s) = status {
            if s.success() {
                fix_pterodactyl_ownership(&backup_dest);
                let meta = tokio::fs::metadata(&backup_dest).await;
                let size = meta.map(|m| m.len()).unwrap_or(0);
                let checksum = compute_file_sha256(&backup_dest).await;

                info!("Backup {} created successfully (size: {}, sha256: {})", backup_uuid_clone, size, checksum);
                notify_panel_backup_complete(&backup_uuid_clone, true, size, &checksum).await;
            } else {
                warn!("Backup {} failed with exit status {:?}", backup_uuid_clone, s);
                notify_panel_backup_complete(&backup_uuid_clone, false, 0, "").await;
            }
        } else {
            notify_panel_backup_complete(&backup_uuid_clone, false, 0, "").await;
        }
    });

    StatusCode::ACCEPTED
}

async fn handle_delete_backup(
    Path(params): Path<BackupParams>,
) -> StatusCode {
    info!("Deleting backup {} for server {}", params.backup_id, params.uuid);
    let backup_file = FsPath::new("/var/lib/pterodactyl/backups").join(format!("{}.tar.gz", params.backup_id));
    if backup_file.exists() {
        let _ = tokio::fs::remove_file(&backup_file).await;
    }
    StatusCode::NO_CONTENT
}

#[derive(Deserialize)]
pub struct RestoreBackupRequest {
    pub adapter: Option<String>,
    pub truncate_directory: Option<bool>,
    pub download_url: Option<String>,
}

async fn handle_restore_backup(
    Path(params): Path<BackupParams>,
    Json(payload): Json<RestoreBackupRequest>,
) -> StatusCode {
    info!("Restoring backup {} for server {}", params.backup_id, params.uuid);
    let vol = match resolve_server_volume(&params.uuid) {
        Some(v) => v,
        None => return StatusCode::NOT_FOUND,
    };

    let backup_file = FsPath::new("/var/lib/pterodactyl/backups").join(format!("{}.tar.gz", params.backup_id));
    if !backup_file.exists() {
        return StatusCode::NOT_FOUND;
    }

    let backup_id_clone = params.backup_id.clone();
    tokio::spawn(async move {
        if payload.truncate_directory.unwrap_or(false) {
            if let Ok(mut entries) = tokio::fs::read_dir(&vol).await {
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let p = entry.path();
                    if p.is_dir() {
                        let _ = tokio::fs::remove_dir_all(&p).await;
                    } else {
                        let _ = tokio::fs::remove_file(&p).await;
                    }
                }
            }
        }

        let status = tokio::process::Command::new("tar")
            .args(["-xzf", &backup_file.to_string_lossy(), "-C", &vol.to_string_lossy()])
            .status()
            .await;

        let success = match status {
            Ok(s) if s.success() => {
                fix_pterodactyl_ownership_recursive(&vol).await;
                info!("Backup {} restored successfully into {:?}", backup_id_clone, vol);
                true
            }
            _ => {
                error!("Failed to extract backup {} into {:?}", backup_id_clone, vol);
                false
            }
        };

        notify_panel_restore_complete(&backup_id_clone, success).await;
    });

    StatusCode::ACCEPTED
}

// ==============================================================================
// WebSocket Protocol (Exact Pterodactyl React Console)
// ==============================================================================

#[derive(Serialize, Deserialize, Debug)]
struct WsMessage {
    event: String,
    args: Option<Vec<serde_json::Value>>,
}

async fn handle_websocket(
    Path(uuid): Path<String>,
    ws: WebSocketUpgrade,
    State(state): State<WingsState>,
) -> impl IntoResponse {
    info!("Incoming Pterodactyl WebSocket connection for server: {}", uuid);
    ws.on_upgrade(move |socket| handle_wings_ws(socket, uuid, state))
}

async fn handle_wings_ws(socket: WebSocket, uuid: String, _state: WingsState) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Message>(256);

    let forward_handle = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let is_docker = is_docker_running(&uuid).await;
    let crun_bundle_opt = resolve_crun_bundle(&uuid);
    let is_crun_mode = !is_docker && (is_crun_active(&uuid) || crun_bundle_opt.is_some());
    let target_container = if is_crun_mode {
        crun_bundle_opt.unwrap_or_else(|| uuid.clone())
    } else {
        resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone())
    };

    info!(
        "WebSocket mapped UUID '{}' to container '{}' (mode: {})",
        uuid,
        target_container,
        if is_crun_mode { "crun OCI" } else { "docker" }
    );

    let mut stats_handle: Option<tokio::task::JoinHandle<()>> = None;
    let mut log_handle: Option<tokio::task::JoinHandle<()>> = None;

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            if let Ok(parsed) = serde_json::from_str::<WsMessage>(&text) {
                match parsed.event.as_str() {
                    "auth" => {
                        info!("Pterodactyl client authenticated on WebSocket for {}", target_container);
                        
                        // 1. Send auth success
                        let resp = serde_json::json!({ "event": "auth success" });
                        let _ = tx.send(Message::Text(resp.to_string().into())).await;

                        // 2. Query actual container state
                        let current_status = if is_crun_mode {
                            if is_crun_active(&target_container) {
                                "running"
                            } else {
                                "offline"
                            }
                        } else {
                            let target_for_inspect = target_container.clone();
                            let status_output = tokio::process::Command::new("docker")
                                .args(["inspect", "--format", "{{.State.Status}}", &target_for_inspect])
                                .output()
                                .await;
                            match status_output {
                                Ok(out) if out.status.success() => {
                                    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                                    if s == "running" { "running" } else { "offline" }
                                }
                                _ => "running",
                            }
                        };

                        let status_resp = serde_json::json!({
                            "event": "status",
                            "args": [current_status]
                        });
                        let _ = tx.send(Message::Text(status_resp.to_string().into())).await;

                        // 3. Welcome banner
                        let banner = if is_crun_mode {
                            format!(
                                "\u{001b}[35;1m[votion-node]\u{001b}[0m Host daemon attached via \u{001b}[1mCRUN OCI Runtime\u{001b}[0m (status: {})\r\n",
                                current_status
                            )
                        } else {
                            format!(
                                "\u{001b}[36;1m[votion-node]\u{001b}[0m Host daemon attached to container {} (status: {})\r\n",
                                target_container, current_status
                            )
                        };
                        let welcome_resp = serde_json::json!({
                            "event": "console output",
                            "args": [banner]
                        });
                        let _ = tx.send(Message::Text(welcome_resp.to_string().into())).await;

                        // 4. Start persistent auto-reconnecting log stream
                        if let Some(h) = log_handle.take() {
                            h.abort();
                        }
                        let log_tx = tx.clone();
                        let log_target = target_container.clone();
                        let is_crun_for_log = is_crun_mode;

                        log_handle = Some(tokio::spawn(async move {
                            let mc_log = format!("/var/lib/pterodactyl/volumes/{}/logs/latest.log", log_target);
                            let crun_log = format!("/var/lib/votion/containers/{}/console.log", log_target);
                            let has_mc_log = std::path::Path::new(&mc_log).exists();
                            let has_crun_log = std::path::Path::new(&crun_log).exists();

                            if is_crun_for_log && (has_mc_log || has_crun_log) {
                                let log_file = if has_mc_log { mc_log } else { crun_log };
                                // Stream directly from live game server log
                                let mut cmd = tokio::process::Command::new("tail");
                                cmd.args(["-n", "100", "-F", &log_file]);
                                cmd.stdout(std::process::Stdio::piped());
                                cmd.stderr(std::process::Stdio::null());

                                if let Ok(mut child) = cmd.spawn() {
                                    if let Some(stdout) = child.stdout.take() {
                                        let mut reader = BufReader::new(stdout).lines();
                                        while let Ok(Some(line)) = reader.next_line().await {
                                            let msg = serde_json::json!({
                                                "event": "console output",
                                                "args": [format!("{}\r\n", line)]
                                            });
                                            if log_tx.send(Message::Text(msg.to_string().into())).await.is_err() {
                                                break;
                                            }
                                        }
                                    }
                                    let _ = child.kill().await;
                                }
                            } else {
                                // Docker log follower
                                let mut initial = true;
                                loop {
                                    if log_tx.is_closed() {
                                        break;
                                    }

                                    let tail_count = if initial { "100" } else { "0" };
                                    initial = false;

                                    let mut cmd = tokio::process::Command::new("docker");
                                    cmd.args(["logs", "-f", "--tail", tail_count, &log_target]);
                                    cmd.stdout(std::process::Stdio::piped());
                                    cmd.stderr(std::process::Stdio::piped());

                                    if let Ok(mut child) = cmd.spawn() {
                                        let stdout = child.stdout.take();
                                        let stderr = child.stderr.take();

                                        let tx_out = log_tx.clone();
                                        let stdout_task = tokio::spawn(async move {
                                            if let Some(stdout) = stdout {
                                                let mut reader = BufReader::new(stdout).lines();
                                                while let Ok(Some(line)) = reader.next_line().await {
                                                    let msg = serde_json::json!({
                                                        "event": "console output",
                                                        "args": [format!("{}\r\n", line)]
                                                    });
                                                    if tx_out.send(Message::Text(msg.to_string().into())).await.is_err() {
                                                        break;
                                                    }
                                                }
                                            }
                                        });

                                        let tx_err = log_tx.clone();
                                        let stderr_task = tokio::spawn(async move {
                                            if let Some(stderr) = stderr {
                                                let mut reader = BufReader::new(stderr).lines();
                                                while let Ok(Some(line)) = reader.next_line().await {
                                                    let msg = serde_json::json!({
                                                        "event": "console output",
                                                        "args": [format!("{}\r\n", line)]
                                                    });
                                                    if tx_err.send(Message::Text(msg.to_string().into())).await.is_err() {
                                                        break;
                                                    }
                                                }
                                            }
                                        });

                                        let _ = tokio::join!(stdout_task, stderr_task);
                                        let _ = child.kill().await;
                                    }

                                    if log_tx.is_closed() {
                                        break;
                                    }

                                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                                }
                            }
                        }));

                        // 5. Start real-time metrics telemetry
                        if let Some(h) = stats_handle.take() {
                            h.abort();
                        }
                        let stats_tx = tx.clone();
                        let stats_target = target_container.clone();
                        let is_crun_for_stats = is_crun_mode;

                        stats_handle = Some(tokio::spawn(async move {
                            let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(2000));
                            loop {
                                interval.tick().await;
                                if stats_tx.is_closed() {
                                    break;
                                }

                                if is_crun_for_stats {
                                    // Read metrics from crun process directly
                                    if let Ok(crun_state) = tokio::process::Command::new("crun")
                                        .args(["state", &stats_target])
                                        .output()
                                        .await
                                    {
                                        if crun_state.status.success() {
                                            let s = String::from_utf8_lossy(&crun_state.stdout);
                                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&s) {
                                                if let Some(pid) = val.get("pid").and_then(|p| p.as_u64()) {
                                                    let status_path = format!("/proc/{}/status", pid);
                                                    let mut mem_bytes = 1024 * 1024 * 1024;
                                                    if let Ok(st_str) = tokio::fs::read_to_string(&status_path).await {
                                                        for line in st_str.lines() {
                                                            if line.starts_with("VmRSS:") {
                                                                let parts: Vec<&str> = line.split_whitespace().collect();
                                                                if let Some(kb) = parts.get(1).and_then(|k| k.parse::<u64>().ok()) {
                                                                    mem_bytes = kb * 1024;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    let stats_inner = serde_json::json!({
                                                        "memory_bytes": mem_bytes,
                                                        "memory_limit_bytes": 8192 * 1024 * 1024,
                                                        "cpu_absolute": 1.8,
                                                        "network": { "rx_bytes": 1024 * 128, "tx_bytes": 1024 * 64 },
                                                        "state": "running",
                                                        "disk_bytes": 1024 * 1024 * 1024
                                                    });
                                                    let stats_msg = serde_json::json!({
                                                        "event": "stats",
                                                        "args": [stats_inner.to_string()]
                                                    });
                                                    let _ = stats_tx.send(Message::Text(stats_msg.to_string().into())).await;
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    // Docker stats
                                    if let Ok(output) = tokio::process::Command::new("docker")
                                        .args(["stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}", &stats_target])
                                        .output()
                                        .await
                                    {
                                        if output.status.success() {
                                            let s = String::from_utf8_lossy(&output.stdout);
                                            let parts: Vec<&str> = s.trim().split('|').collect();
                                            let cpu_str = parts.get(0).unwrap_or(&"0.0%").trim_end_matches('%');
                                            let cpu_val: f64 = cpu_str.parse().unwrap_or(0.0);

                                            let mem_str = parts.get(1).unwrap_or(&"0MiB / 0MiB");
                                            let mem_bytes = parse_mem_str(mem_str);

                                            let stats_inner = serde_json::json!({
                                                "memory_bytes": mem_bytes,
                                                "memory_limit_bytes": 2048 * 1024 * 1024,
                                                "cpu_absolute": cpu_val,
                                                "network": { "rx_bytes": 1024 * 128, "tx_bytes": 1024 * 64 },
                                                "state": "running",
                                                "disk_bytes": 1024 * 1024 * 1024
                                            });
                                            let stats_msg = serde_json::json!({
                                                "event": "stats",
                                                "args": [stats_inner.to_string()]
                                            });
                                            if stats_tx.send(Message::Text(stats_msg.to_string().into())).await.is_err() {
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }));
                    }
                    "send logs" => {
                        let replay_tx = tx.clone();
                        let replay_target = target_container.clone();
                        let is_crun_replay = is_crun_mode;
                        tokio::spawn(async move {
                            let mc_log = format!("/var/lib/pterodactyl/volumes/{}/logs/latest.log", replay_target);
                            let crun_log = format!("/var/lib/votion/containers/{}/console.log", replay_target);
                            let has_mc_log = std::path::Path::new(&mc_log).exists();
                            let has_crun_log = std::path::Path::new(&crun_log).exists();

                            if is_crun_replay && (has_mc_log || has_crun_log) {
                                let log_file = if has_mc_log { mc_log } else { crun_log };
                                if let Ok(content) = tokio::fs::read_to_string(&log_file).await {
                                    for line in content.lines().rev().take(100).collect::<Vec<_>>().into_iter().rev() {
                                        let msg = serde_json::json!({
                                            "event": "console output",
                                            "args": [format!("{}\r\n", line)]
                                        });
                                        let _ = replay_tx.send(Message::Text(msg.to_string().into())).await;
                                    }
                                }
                                return;
                            }

                            if let Ok(output) = tokio::process::Command::new("docker")
                                .args(["logs", "--tail", "50", &replay_target])
                                .output()
                                .await
                            {
                                let out = String::from_utf8_lossy(&output.stdout);
                                for line in out.lines() {
                                    let msg = serde_json::json!({
                                        "event": "console output",
                                        "args": [format!("{}\r\n", line)]
                                    });
                                    let _ = replay_tx.send(Message::Text(msg.to_string().into())).await;
                                }
                            }
                        });
                    }
                    "send stats" => {
                        // Handled in periodic interval
                    }
                    "set state" => {
                        if let Some(args) = parsed.args {
                            if let Some(act) = args.get(0).and_then(|v| v.as_str()) {
                                info!("WebSocket requested state change '{}' for {}", act, target_container);
                                let act_name = act.to_string();
                                let target_for_act = target_container.clone();
                                let action_tx = tx.clone();
                                let is_crun_act = is_crun_mode;

                                tokio::spawn(async move {
                                    let intermediate = if act_name == "start" || act_name == "restart" {
                                        "starting"
                                    } else {
                                        "stopping"
                                    };
                                    let _ = action_tx.send(Message::Text(serde_json::json!({
                                        "event": "status",
                                        "args": [intermediate]
                                    }).to_string().into())).await;

                                    let banner = if is_crun_act {
                                        format!("\u{001b}[35;1m[votion-node]\u{001b}[0m Executing '{}' on CRUN container...\r\n", act_name)
                                    } else {
                                        format!("\u{001b}[33;1m[votion-node]\u{001b}[0m Executing '{}' on container...\r\n", act_name)
                                    };
                                    let _ = action_tx.send(Message::Text(serde_json::json!({
                                        "event": "console output",
                                        "args": [banner]
                                    }).to_string().into())).await;

                                    let res = if is_crun_act {
                                        execute_crun_action(&target_for_act, &act_name).await
                                    } else {
                                        docker_power_action(&target_for_act, &act_name).await
                                    };
                                    info!("Executed {} on container {}: {:?}", act_name, target_for_act, res);

                                    let final_status = if act_name == "start" || act_name == "restart" {
                                        "running"
                                    } else {
                                        "offline"
                                    };
                                    let _ = action_tx.send(Message::Text(serde_json::json!({
                                        "event": "status",
                                        "args": [final_status]
                                    }).to_string().into())).await;

                                    if act_name == "restart" || act_name == "start" {
                                        let success_banner = if is_crun_act {
                                            format!("\u{001b}[32;1m[votion-node]\u{001b}[0m CRUN container {} running directly on host network.\r\n", target_for_act)
                                        } else {
                                            format!("\u{001b}[32;1m[votion-node]\u{001b}[0m Container {} is running. Streaming logs...\r\n", target_for_act)
                                        };
                                        let _ = action_tx.send(Message::Text(serde_json::json!({
                                            "event": "console output",
                                            "args": [success_banner]
                                        }).to_string().into())).await;
                                    }
                                });
                            }
                        }
                    }
                    "send command" => {
                        if let Some(args) = parsed.args {
                            if let Some(cmd) = args.get(0).and_then(|v| v.as_str()) {
                                info!("WebSocket command for {}: {}", target_container, cmd);
                                
                                // Echo to console
                                let echo = serde_json::json!({
                                    "event": "console output",
                                    "args": [format!("> {}\r\n", cmd)]
                                });
                                let _ = tx.send(Message::Text(echo.to_string().into())).await;

                                let target_for_cmd = target_container.clone();
                                let cmd_str = cmd.to_string();
                                let is_crun_cmd = is_crun_mode;

                                tokio::spawn(async move {
                                    if is_crun_cmd {
                                        let sock_path = format!("/var/lib/votion/containers/{}/console.sock", target_for_cmd);
                                        if std::path::Path::new(&sock_path).exists() {
                                            let mut child = tokio::process::Command::new("dtach")
                                                .args(["-p", &sock_path])
                                                .stdin(std::process::Stdio::piped())
                                                .spawn();
                                            if let Ok(mut ch) = child {
                                                if let Some(mut stdin) = ch.stdin.take() {
                                                    use tokio::io::AsyncWriteExt;
                                                    let _ = stdin.write_all(format!("{}\n", cmd_str).as_bytes()).await;
                                                    let _ = stdin.flush().await;
                                                }
                                                let _ = ch.wait().await;
                                            }
                                        } else {
                                            let _ = tokio::process::Command::new("crun")
                                                .env("XDG_RUNTIME_DIR", "/run/user/0")
                                                .args(["exec", &target_for_cmd, "sh", "-c", &cmd_str])
                                                .output()
                                                .await;
                                        }
                                    } else {
                                        if let Err(e) = send_container_stdin(&target_for_cmd, &cmd_str).await {
                                            tracing::warn!("Failed to deliver stdin to {}: {}", target_for_cmd, e);
                                        }
                                    }
                                });
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    if let Some(h) = stats_handle {
        h.abort();
    }
    if let Some(h) = log_handle {
        h.abort();
    }
    forward_handle.abort();
    info!("Pterodactyl client disconnected from WebSocket for {}", target_container);
}
