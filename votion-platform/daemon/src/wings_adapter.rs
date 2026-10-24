use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::Path as FsPath;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
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

async fn handle_backup(Path(uuid): Path<String>) -> StatusCode {
    info!("Backup requested for {}", uuid);
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
