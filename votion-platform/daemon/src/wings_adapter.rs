use axum::{
    body::Body,
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
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncSeekExt, AsyncWriteExt, BufReader, BufWriter};
use tokio::sync::RwLock;
use tokio_util::io::ReaderStream;
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
            .route("/api/servers/{uuid}/hibernation", get(handle_get_hibernation).post(handle_set_hibernation))
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
            .layer(
                tower_http::cors::CorsLayer::very_permissive()
                    .expose_headers([
                        header::CONTENT_DISPOSITION,
                        header::CONTENT_LENGTH,
                        header::CONTENT_RANGE,
                        header::ACCEPT_RANGES,
                    ]),
            )
            .with_state(self.state);

        // Spawn background storage optimizer to guarantee minimal disk footprint
        tokio::spawn(async move {
            run_periodic_storage_optimizer().await;
        });

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
    let trimmed = uuid.trim();
    if trimmed.len() < 8 {
        return None;
    }
    let direct = format!("/var/lib/votion/containers/{}/config.json", trimmed);
    if std::path::Path::new(&direct).exists() {
        return Some(trimmed.to_string());
    }
    if let Ok(entries) = std::fs::read_dir("/var/lib/votion/containers") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(trimmed) {
                let cfg = entry.path().join("config.json");
                if cfg.exists() {
                    return Some(name);
                }
            }
        }
    }
    // Auto-resolve any server volume so crun bundle can be created dynamically
    if let Some(vol) = resolve_server_volume(trimmed) {
        if let Some(name) = vol.file_name().and_then(|n| n.to_str()) {
            return Some(name.to_string());
        }
    }
    None
}

/// Checks if the container is currently alive/running in crun
pub fn is_crun_active(id: &str) -> bool {
    let direct_path = format!("/run/user/0/crun/{}/status", id);
    let status_path = if std::path::Path::new(&direct_path).exists() {
        Some(direct_path)
    } else if let Ok(entries) = std::fs::read_dir("/run/user/0/crun") {
        let mut found = None;
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(id) {
                let st = entry.path().join("status");
                if st.exists() {
                    found = Some(st.to_string_lossy().to_string());
                    break;
                }
            }
        }
        found
    } else {
        None
    };

    if let Some(ref p) = status_path {
        if let Ok(content) = std::fs::read_to_string(p) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(pid) = val.get("pid").and_then(|p| p.as_u64()) {
                    if pid > 0 && std::path::Path::new(&format!("/proc/{}", pid)).exists() {
                        return true;
                    }
                }
            }
        }
    }
    // Also check crun state CLI as fallback
    if let Ok(output) = std::process::Command::new("crun")
        .args(["--root", "/run/user/0/crun", "state", id])
        .output()
    {
        if output.status.success() {
            if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                if let Some(status) = val.get("status").and_then(|s| s.as_str()) {
                    return status == "running" || status == "created";
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

/// Checks if Docker currently knows/manages a container for this ID/UUID
pub async fn is_docker_managed(id: &str) -> bool {
    if let Ok(output) = tokio::process::Command::new("docker")
        .args(["inspect", "--format", "{{.Id}}", id])
        .output()
        .await
    {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return !s.is_empty();
        }
    }
    false
}

/// Resolves a full or short UUID to an existing Docker container name or ID
pub async fn resolve_container(uuid: &str) -> Option<String> {
    let trimmed = uuid.trim();
    if trimmed.len() < 8 {
        return None;
    }
    // 1. Direct docker inspect check
    if let Ok(output) = tokio::process::Command::new("docker")
        .args(["inspect", "--format", "{{.Id}}", trimmed])
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
                    if name.contains(trimmed) {
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

    None
}

/// Runs periodic storage optimization to ensure Votion continuously consumes less storage than Docker
pub async fn run_periodic_storage_optimizer() {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(4 * 3600)); // Every 4 hours
    // Skip immediate first tick
    interval.tick().await;

    loop {
        interval.tick().await;
        info!("Running periodic storage optimizer for /var/lib/votion/images...");

        // 1. Query panel database for all currently used server images to prune unreferenced images
        let mysql_out = tokio::process::Command::new("mysql")
            .args([
                "-u", "pterodactyl",
                "-pvotion123!",
                "panel",
                "-N", "-s",
                "-e", "SELECT DISTINCT image FROM servers"
            ])
            .output()
            .await;

        if let Ok(out) = mysql_out {
            if out.status.success() {
                let stdout_str = String::from_utf8_lossy(&out.stdout);
                let mut used_safe_names: std::collections::HashSet<String> = std::collections::HashSet::new();
                for line in stdout_str.lines() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        let safe: String = trimmed.chars().map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' { c } else { '_' }).collect();
                        used_safe_names.insert(safe);
                    }
                }
                // Protected installer & base images
                used_safe_names.insert("alpine_latest".to_string());
                used_safe_names.insert("ghcr_io_pterodactyl_installers_alpine".to_string());
                used_safe_names.insert("ghcr_io_pterodactyl_installers_debian".to_string());
                used_safe_names.insert("ghcr_io_parkervcp_installers_alpine".to_string());
                used_safe_names.insert("ghcr_io_parkervcp_installers_debian".to_string());

                if let Ok(mut entries) = tokio::fs::read_dir("/var/lib/votion/images").await {
                    while let Ok(Some(entry)) = entries.next_entry().await {
                        if let Ok(file_type) = entry.file_type().await {
                            if file_type.is_dir() {
                                let name = entry.file_name().to_string_lossy().to_string();
                                if !used_safe_names.contains(&name) {
                                    info!("Storage optimizer: pruning unreferenced image folder: {}", name);
                                    let _ = tokio::fs::remove_dir_all(entry.path()).await;
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Proactive PSI check: pause deduplication if host memory pressure is elevated (>20%)
        if crate::monitor::psi::is_background_paused() {
            info!("Storage optimizer: pausing background hardlink deduplication while memory PSI is elevated (>20%)");
            continue;
        }

        // 2b. Hardlink deduplication across all extracted rootfs trees (pinned to Overcommit Worker Pool cores 8-11)
        let _ = tokio::process::Command::new("taskset")
            .args(["-c", "8-11", "hardlink", "-q", "/var/lib/votion/images"])
            .status()
            .await;

        // 3. Prune dangling Docker image layers (pinned to Overcommit Worker Pool cores 8-11)
        let _ = tokio::process::Command::new("taskset")
            .args(["-c", "8-11", "docker", "image", "prune", "-a", "-f"])
            .status()
            .await;
    }
}

/// Initializes base host networking for Votion containers (bridge, IP forwarding, iptables chains)
pub async fn init_base_networking() {
    // 1. Enable IPv4 forwarding in kernel
    let _ = tokio::process::Command::new("sysctl")
        .args(["-w", "net.ipv4.ip_forward=1"])
        .status()
        .await;

    // 2. Ensure pterodactyl0 bridge exists
    let _ = tokio::process::Command::new("ip")
        .args(["link", "add", "name", "pterodactyl0", "type", "bridge"])
        .status()
        .await;
    let _ = tokio::process::Command::new("ip")
        .args(["addr", "add", "172.18.0.1/16", "dev", "pterodactyl0"])
        .status()
        .await;
    let _ = tokio::process::Command::new("ip")
        .args(["link", "set", "pterodactyl0", "up"])
        .status()
        .await;

    // 3. Ensure masquerading for pterodactyl0 bridge subnet exists
    let chk_masq = tokio::process::Command::new("iptables")
        .args(["-t", "nat", "-C", "POSTROUTING", "-s", "172.18.0.0/16", "!", "-o", "pterodactyl0", "-j", "MASQUERADE"])
        .status()
        .await;
    if !chk_masq.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-t", "nat", "-A", "POSTROUTING", "-s", "172.18.0.0/16", "!", "-o", "pterodactyl0", "-j", "MASQUERADE"])
            .status()
            .await;
    }

    // 4. Ensure FORWARD chain permits traffic for pterodactyl0
    let chk_fwd_in = tokio::process::Command::new("iptables")
        .args(["-C", "FORWARD", "-i", "pterodactyl0", "-j", "ACCEPT"])
        .status()
        .await;
    if !chk_fwd_in.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-I", "FORWARD", "1", "-i", "pterodactyl0", "-j", "ACCEPT"])
            .status()
            .await;
    }

    let chk_fwd_out = tokio::process::Command::new("iptables")
        .args(["-C", "FORWARD", "-o", "pterodactyl0", "-j", "ACCEPT"])
        .status()
        .await;
    if !chk_fwd_out.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-I", "FORWARD", "1", "-o", "pterodactyl0", "-j", "ACCEPT"])
            .status()
            .await;
    }

    // 5. Create VOTION-NAT chain in nat table and hook into PREROUTING and OUTPUT
    let _ = tokio::process::Command::new("iptables")
        .args(["-t", "nat", "-N", "VOTION-NAT"])
        .status()
        .await;

    let chk_pre = tokio::process::Command::new("iptables")
        .args(["-t", "nat", "-C", "PREROUTING", "-j", "VOTION-NAT"])
        .status()
        .await;
    if !chk_pre.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-t", "nat", "-I", "PREROUTING", "1", "-j", "VOTION-NAT"])
            .status()
            .await;
    }

    let chk_out = tokio::process::Command::new("iptables")
        .args(["-t", "nat", "-C", "OUTPUT", "-j", "VOTION-NAT"])
        .status()
        .await;
    if !chk_out.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-t", "nat", "-I", "OUTPUT", "1", "-j", "VOTION-NAT"])
            .status()
            .await;
    }

    // 6. Create VOTION-ISOLATE chain in filter table to protect host internal services
    let _ = tokio::process::Command::new("iptables")
        .args(["-N", "VOTION-ISOLATE"])
        .status()
        .await;

    let chk_iso = tokio::process::Command::new("iptables")
        .args(["-C", "INPUT", "-i", "pterodactyl0", "-j", "VOTION-ISOLATE"])
        .status()
        .await;
    if !chk_iso.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-I", "INPUT", "1", "-i", "pterodactyl0", "-j", "VOTION-ISOLATE"])
            .status()
            .await;
    }

    let chk_rel = tokio::process::Command::new("iptables")
        .args(["-C", "VOTION-ISOLATE", "-m", "conntrack", "--ctstate", "ESTABLISHED,RELATED", "-j", "ACCEPT"])
        .status()
        .await;
    if !chk_rel.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-A", "VOTION-ISOLATE", "-m", "conntrack", "--ctstate", "ESTABLISHED,RELATED", "-j", "ACCEPT"])
            .status()
            .await;
    }

    let chk_dns_u = tokio::process::Command::new("iptables")
        .args(["-C", "VOTION-ISOLATE", "-p", "udp", "--dport", "53", "-j", "ACCEPT"])
        .status()
        .await;
    if !chk_dns_u.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-A", "VOTION-ISOLATE", "-p", "udp", "--dport", "53", "-j", "ACCEPT"])
            .status()
            .await;
    }
    let chk_dns_t = tokio::process::Command::new("iptables")
        .args(["-C", "VOTION-ISOLATE", "-p", "tcp", "--dport", "53", "-j", "ACCEPT"])
        .status()
        .await;
    if !chk_dns_t.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-A", "VOTION-ISOLATE", "-p", "tcp", "--dport", "53", "-j", "ACCEPT"])
            .status()
            .await;
    }

    let chk_drop = tokio::process::Command::new("iptables")
        .args(["-C", "VOTION-ISOLATE", "-p", "tcp", "-m", "multiport", "--dports", "22,3306,8080", "-j", "DROP"])
        .status()
        .await;
    if !chk_drop.map(|s| s.success()).unwrap_or(false) {
        let _ = tokio::process::Command::new("iptables")
            .args(["-A", "VOTION-ISOLATE", "-p", "tcp", "-m", "multiport", "--dports", "22,3306,8080", "-j", "DROP"])
            .status()
            .await;
    }
}

/// Allocates or reuses a static private IP in 172.18.10.2 - 172.18.250.254 for a container
pub async fn allocate_container_ip(container_id: &str) -> String {
    let network_file = format!("/var/lib/votion/containers/{}/network.json", container_id);
    if let Ok(content) = tokio::fs::read_to_string(&network_file).await {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(ip) = v.get("ip").and_then(|i| i.as_str()) {
                if ip.starts_with("172.18.") {
                    return ip.to_string();
                }
            }
        }
    }

    // Collect all assigned IPs across existing containers
    let mut used_ips = std::collections::HashSet::new();
    if let Ok(mut entries) = tokio::fs::read_dir("/var/lib/votion/containers").await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path().join("network.json");
            if let Ok(content) = tokio::fs::read_to_string(&path).await {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(ip) = v.get("ip").and_then(|i| i.as_str()) {
                        used_ips.insert(ip.to_string());
                    }
                }
            }
        }
    }

    for b in 10..250 {
        for c in 2..254 {
            let candidate = format!("172.18.{}.{}", b, c);
            if !used_ips.contains(&candidate) {
                return candidate;
            }
        }
    }

    "172.18.10.2".to_string()
}

/// Applies iptables DNAT rules in VOTION-NAT for all allocated ports (both TCP and UDP)
async fn apply_container_nat_rules(container_ip: &str, ports: &[(String, u16)]) {
    for (bind_ip, port) in ports {
        let dest = format!("{}:{}", container_ip, port);
        let port_str = port.to_string();

        for proto in &["tcp", "udp"] {
            if !bind_ip.is_empty() && bind_ip != "0.0.0.0" {
                let chk = tokio::process::Command::new("iptables")
                    .args([
                        "-t", "nat", "-C", "VOTION-NAT",
                        "-d", bind_ip,
                        "-p", proto,
                        "--dport", &port_str,
                        "-j", "DNAT",
                        "--to-destination", &dest,
                    ])
                    .status()
                    .await;
                if !chk.map(|s| s.success()).unwrap_or(false) {
                    let _ = tokio::process::Command::new("iptables")
                        .args([
                            "-t", "nat", "-A", "VOTION-NAT",
                            "-d", bind_ip,
                            "-p", proto,
                            "--dport", &port_str,
                            "-j", "DNAT",
                            "--to-destination", &dest,
                        ])
                        .status()
                        .await;
                }
            } else {
                let chk = tokio::process::Command::new("iptables")
                    .args([
                        "-t", "nat", "-C", "VOTION-NAT",
                        "-p", proto,
                        "--dport", &port_str,
                        "-j", "DNAT",
                        "--to-destination", &dest,
                    ])
                    .status()
                    .await;
                if !chk.map(|s| s.success()).unwrap_or(false) {
                    let _ = tokio::process::Command::new("iptables")
                        .args([
                            "-t", "nat", "-A", "VOTION-NAT",
                            "-p", proto,
                            "--dport", &port_str,
                            "-j", "DNAT",
                            "--to-destination", &dest,
                        ])
                        .status()
                        .await;
                }
            }
        }
    }
}

/// Prepares isolated network namespace, veth pair, bridge attachment, and port forwards
pub async fn setup_container_networking(
    container_id: &str,
    settings: &serde_json::Value,
) -> Result<String, String> {
    let short_id = if container_id.len() >= 8 {
        &container_id[..8]
    } else {
        container_id
    };
    let netns_name = format!("votion_{}", short_id);
    let veth_host = format!("veth_h_{}", short_id);
    let veth_guest = format!("veth_c_{}", short_id);
    let netns_path = format!("/var/run/netns/{}", netns_name);

    init_base_networking().await;

    let ip = allocate_container_ip(container_id).await;

    let mut allocated_ports: Vec<(String, u16)> = Vec::new();
    if let Some(alloc_obj) = settings.get("allocations") {
        if let Some(def) = alloc_obj.get("default") {
            let def_ip = def.get("ip").and_then(|i| i.as_str()).unwrap_or("").to_string();
            if let Some(p) = def.get("port").and_then(|p| p.as_u64()) {
                allocated_ports.push((def_ip, p as u16));
            }
        }
        if let Some(mappings) = alloc_obj.get("mappings").and_then(|m| m.as_object()) {
            for (map_ip, ports_val) in mappings {
                if let Some(arr) = ports_val.as_array() {
                    for p_val in arr {
                        if let Some(p) = p_val.as_u64() {
                            let entry = (map_ip.clone(), p as u16);
                            if !allocated_ports.contains(&entry) {
                                allocated_ports.push(entry);
                            }
                        }
                    }
                }
            }
        }
    }

    let bundle_path = format!("/var/lib/votion/containers/{}", container_id);
    let network_file = format!("{}/network.json", bundle_path);
    let network_data = serde_json::json!({
        "container_id": container_id,
        "netns": netns_name,
        "ip": ip,
        "veth_host": veth_host,
        "veth_guest": veth_guest,
        "ports": allocated_ports
    });
    let _ = tokio::fs::write(&network_file, network_data.to_string().as_bytes()).await;

    // Create container hosts file
    let hosts_path = format!("{}/hosts", bundle_path);
    let hosts_content = format!("127.0.0.1 localhost\n::1 localhost ip6-localhost ip6-loopback\n{} {}\n", ip, short_id);
    let _ = tokio::fs::write(&hosts_path, hosts_content.as_bytes()).await;

    // If crun is running and netns already exists, keep interface alive
    let netns_exists = std::path::Path::new(&netns_path).exists();
    if is_crun_active(container_id) && netns_exists {
        apply_container_nat_rules(&ip, &allocated_ports).await;
        return Ok(netns_name);
    }

    // Clean up any stale link / netns
    let _ = tokio::process::Command::new("ip").args(["link", "del", &veth_host]).status().await;
    let _ = tokio::process::Command::new("ip").args(["netns", "del", &netns_name]).status().await;

    // Create netns
    let st = tokio::process::Command::new("ip").args(["netns", "add", &netns_name]).status().await;
    if !st.map(|s| s.success()).unwrap_or(false) {
        return Err(format!("Failed to create netns {}", netns_name));
    }

    // Create veth pair
    let _ = tokio::process::Command::new("ip")
        .args(["link", "add", &veth_host, "type", "veth", "peer", "name", &veth_guest])
        .status()
        .await;

    // Move guest veth to netns
    let _ = tokio::process::Command::new("ip")
        .args(["link", "set", &veth_guest, "netns", &netns_name])
        .status()
        .await;

    // Attach host veth to pterodactyl0 and bring up
    let _ = tokio::process::Command::new("ip")
        .args(["link", "set", &veth_host, "master", "pterodactyl0", "up"])
        .status()
        .await;

    // Rename guest veth to eth0 in netns
    let _ = tokio::process::Command::new("ip")
        .args(["netns", "exec", &netns_name, "ip", "link", "set", &veth_guest, "name", "eth0"])
        .status()
        .await;

    // Assign IP and subnet
    let cidr = format!("{}/16", ip);
    let _ = tokio::process::Command::new("ip")
        .args(["netns", "exec", &netns_name, "ip", "addr", "add", &cidr, "dev", "eth0"])
        .status()
        .await;

    // Bring up eth0 and lo
    let _ = tokio::process::Command::new("ip")
        .args(["netns", "exec", &netns_name, "ip", "link", "set", "eth0", "up"])
        .status()
        .await;
    let _ = tokio::process::Command::new("ip")
        .args(["netns", "exec", &netns_name, "ip", "link", "set", "lo", "up"])
        .status()
        .await;

    // Default route
    let _ = tokio::process::Command::new("ip")
        .args(["netns", "exec", &netns_name, "ip", "route", "add", "default", "via", "172.18.0.1"])
        .status()
        .await;

    // Apply NAT port forwarding
    apply_container_nat_rules(&ip, &allocated_ports).await;

    info!("Container {} networking established: IP={}, NetNS={}, Ports={:?}", container_id, ip, netns_name, allocated_ports);
    Ok(netns_name)
}

/// Tears down container network namespace, veth pair, and iptables rules
pub async fn teardown_container_networking(container_id: &str) {
    let short_id = if container_id.len() >= 8 {
        &container_id[..8]
    } else {
        container_id
    };
    let netns_name = format!("votion_{}", short_id);
    let veth_host = format!("veth_h_{}", short_id);
    let bundle_path = format!("/var/lib/votion/containers/{}", container_id);
    let network_file = format!("{}/network.json", bundle_path);

    // Remove DNAT rules in VOTION-NAT for this container's IP
    if let Ok(content) = tokio::fs::read_to_string(&network_file).await {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(container_ip) = v.get("ip").and_then(|i| i.as_str()) {
                if let Ok(out) = tokio::process::Command::new("iptables")
                    .args(["-t", "nat", "-S", "VOTION-NAT"])
                    .output()
                    .await
                {
                    let raw = String::from_utf8_lossy(&out.stdout);
                    let target = format!("--to-destination {}:", container_ip);
                    for line in raw.lines() {
                        if line.contains(&target) {
                            let parts: Vec<&str> = line.split_whitespace().collect();
                            if parts.len() > 2 && parts[0] == "-A" && parts[1] == "VOTION-NAT" {
                                let mut del_args = vec!["-t", "nat", "-D", "VOTION-NAT"];
                                del_args.extend_from_slice(&parts[2..]);
                                let _ = tokio::process::Command::new("iptables").args(&del_args).status().await;
                            }
                        }
                    }
                }
            }
        }
    }

    // Remove host veth interface and netns
    let _ = tokio::process::Command::new("ip").args(["link", "del", &veth_host]).status().await;
    let _ = tokio::process::Command::new("ip").args(["netns", "del", &netns_name]).status().await;

    info!("Container {} networking torn down (netns: {})", container_id, netns_name);
}

/// Engine-Specific Safeguards: Optimizes Minecraft Entity Activation Ranges and Async Chunks
async fn optimize_minecraft_configs(server_vol: &str) {
    let vol_path = std::path::Path::new(server_vol);
    if !vol_path.exists() {
        return;
    }

    // 1. Spigot entity activation ranges
    let spigot_path = vol_path.join("spigot.yml");
    if spigot_path.exists() {
        if let Ok(content) = tokio::fs::read_to_string(&spigot_path).await {
            if content.contains("entity-activation-range:") && content.contains("animals: 32") {
                let optimized = content
                    .replace("animals: 32", "animals: 16")
                    .replace("monsters: 32", "monsters: 24")
                    .replace("misc: 16", "misc: 8")
                    .replace("tick-inactive-villagers: true", "tick-inactive-villagers: false");
                let _ = tokio::fs::write(&spigot_path, optimized).await;
                info!("Applied Minecraft entity activation range optimization to {:?}", spigot_path);
            }
        }
    }

    // 2. Paper / Purpur entity activation & async chunk loading
    for p in ["paper.yml", "config/paper-world-defaults.yml", "purpur.yml"] {
        let paper_path = vol_path.join(p);
        if paper_path.exists() {
            if let Ok(content) = tokio::fs::read_to_string(&paper_path).await {
                let mut modified = false;
                let mut opt = content;
                if opt.contains("animals: 32") {
                    opt = opt.replace("animals: 32", "animals: 16");
                    modified = true;
                }
                if opt.contains("monsters: 32") {
                    opt = opt.replace("monsters: 32", "monsters: 24");
                    modified = true;
                }
                if opt.contains("tick-inactive-villagers: true") {
                    opt = opt.replace("tick-inactive-villagers: true", "tick-inactive-villagers: false");
                    modified = true;
                }
                if modified {
                    let _ = tokio::fs::write(&paper_path, opt).await;
                    info!("Applied Paper/Purpur entity activation optimization to {:?}", paper_path);
                }
            }
        }
    }
}

/// Automatically syncs image rootfs and environment variables from Lunar Panel
pub async fn sync_crun_container_config(container_id: &str) {
    let bundle_path = format!("/var/lib/votion/containers/{}", container_id);
    let config_path = format!("{}/config.json", bundle_path);
    let is_empty = match tokio::fs::metadata(&config_path).await {
        Ok(m) => m.len() == 0,
        Err(_) => true,
    };
    if !std::path::Path::new(&config_path).exists() || is_empty {
        let _ = tokio::fs::remove_file(&config_path).await;
        let _ = tokio::fs::create_dir_all(&bundle_path).await;
        let _ = tokio::process::Command::new("crun")
            .args(["spec"])
            .current_dir(&bundle_path)
            .status()
            .await;
    }

    let (remote_url, auth_header) = get_panel_remote_config();
    let target_url = format!("{}/api/remote/servers/{}", remote_url, container_id);

    let output = match tokio::process::Command::new("curl")
        .args([
            "-k",
            "-s",
            "-H",
            &format!("Authorization: {}", auth_header),
            "-H",
            "Accept: application/json",
            &target_url,
        ])
        .output()
        .await
    {
        Ok(out) => out,
        Err(e) => {
            warn!("Failed to fetch server details from panel: {}", e);
            return;
        }
    };

    if !output.status.success() {
        warn!("Curl failed fetching server details for {}", container_id);
        return;
    }

    let body = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to parse panel response for {}: {}", container_id, e);
            return;
        }
    };

    let settings = match parsed.get("settings") {
        Some(s) => {
            if let Some(hib_enabled) = s.get("hibernation_enabled").and_then(|v| v.as_bool())
                .or_else(|| s.get("build").and_then(|b| b.get("hibernation_enabled")).and_then(|v| v.as_bool()))
            {
                crate::monitor::persist_hibernation_setting(container_id, hib_enabled);
            }
            s
        },
        None => return,
    };

    // Read current config.json (or newly generated spec)
    let config_raw = match tokio::fs::read_to_string(&config_path).await {
        Ok(s) => s,
        Err(e) => {
            warn!("Failed to read {}: {}", config_path, e);
            return;
        }
    };

    let mut spec: serde_json::Value = match serde_json::from_str(&config_raw) {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to parse {}: {}, regenerating baseline spec...", config_path, e);
            let _ = tokio::fs::remove_file(&config_path).await;
            let _ = tokio::process::Command::new("crun")
                .args(["spec"])
                .current_dir(&bundle_path)
                .status()
                .await;
            if let Ok(fresh) = tokio::fs::read_to_string(&config_path).await {
                serde_json::from_str(&fresh).unwrap_or(serde_json::json!({}))
            } else {
                return;
            }
        }
    };

    // Baseline OCI spec setup (user 999:995, cwd /home/container, volume mounts, host networking)
    let server_vol = resolve_server_volume(container_id)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("/var/lib/pterodactyl/volumes/{}", container_id));

    // Ensure server volume exists and has correct ownership and permissions for container UID 999
    if std::path::Path::new(&server_vol).exists() {
        let _ = tokio::process::Command::new("chown")
            .args(["-R", "999:995", &server_vol])
            .status()
            .await;
        let _ = tokio::process::Command::new("chmod")
            .args(["-R", "u+rwX,go+rX", &server_vol])
            .status()
            .await;
    }

    if let Some(proc_obj) = spec.get_mut("process") {
        if let Some(user_obj) = proc_obj.get_mut("user") {
            user_obj["uid"] = serde_json::json!(999);
            user_obj["gid"] = serde_json::json!(995);
        }
        proc_obj["cwd"] = serde_json::json!("/home/container");
        proc_obj["args"] = serde_json::json!(["/entrypoint.sh"]);
        proc_obj["terminal"] = serde_json::json!(false);

        // Ensure container UID 999 retains net capabilities for binding and ping
        if let Some(caps) = proc_obj.get_mut("capabilities").and_then(|c| c.as_object_mut()) {
            for (_, cap_list) in caps.iter_mut() {
                if let Some(arr) = cap_list.as_array_mut() {
                    for req in ["CAP_NET_BIND_SERVICE", "CAP_NET_RAW"] {
                        let json_val = serde_json::Value::String(req.to_string());
                        if !arr.contains(&json_val) {
                            arr.push(json_val);
                        }
                    }
                }
            }
        }
    }
    if let Some(root_obj) = spec.get_mut("root") {
        root_obj["readonly"] = serde_json::json!(true);
    }
    if let Some(mounts) = spec.get_mut("mounts").and_then(|m| m.as_array_mut()) {
        mounts.retain(|m| {
            let dst = m.get("destination").and_then(|d| d.as_str()).unwrap_or("");
            dst != "/home/container" && dst != "/etc/resolv.conf" && dst != "/etc/hosts" && dst != "/tmp"
        });
        mounts.push(serde_json::json!({
            "destination": "/home/container",
            "type": "bind",
            "source": server_vol,
            "options": ["rbind", "rprivate", "rw"]
        }));
        mounts.push(serde_json::json!({
            "destination": "/etc/resolv.conf",
            "type": "bind",
            "source": "/etc/resolv.conf",
            "options": ["rbind", "ro"]
        }));
        let hosts_path = format!("{}/hosts", bundle_path);
        let hosts_source = if std::path::Path::new(&hosts_path).exists() {
            hosts_path
        } else {
            "/etc/hosts".to_string()
        };
        mounts.push(serde_json::json!({
            "destination": "/etc/hosts",
            "type": "bind",
            "source": hosts_source,
            "options": ["rbind", "ro"]
        }));
        mounts.push(serde_json::json!({
            "destination": "/tmp",
            "type": "tmpfs",
            "source": "tmpfs",
            "options": ["nosuid", "nodev", "mode=1777"]
        }));
    }
    // Configure isolated network namespace and port forwarding
    if let Ok(netns_name) = setup_container_networking(container_id, settings).await {
        if let Some(linux_obj) = spec.get_mut("linux") {
            if let Some(namespaces) = linux_obj.get_mut("namespaces").and_then(|ns| ns.as_array_mut()) {
                namespaces.retain(|ns| {
                    ns.get("type").and_then(|t| t.as_str()) != Some("network")
                });
                namespaces.push(serde_json::json!({
                    "type": "network",
                    "path": format!("/var/run/netns/{}", netns_name)
                }));
            }
        }
    }

    // Two-Tier cgroups v2 Memory & CPU Governance
    let build_opt = settings.get("build");
    let mem_limit_mb = build_opt
        .and_then(|b| b.get("memory_limit").or_else(|| b.get("memory")))
        .and_then(|m| m.as_u64())
        .unwrap_or(0);

    let swap_mb = build_opt
        .and_then(|b| b.get("swap"))
        .and_then(|s| s.as_i64())
        .unwrap_or(0);

    let cpu_limit_pct = build_opt
        .and_then(|b| b.get("cpu_limit").or_else(|| b.get("cpu")))
        .and_then(|c| c.as_u64())
        .unwrap_or(0);

    let io_weight = build_opt
        .and_then(|b| b.get("io_weight").or_else(|| b.get("io")))
        .and_then(|i| i.as_u64())
        .unwrap_or(500);

    let max_bytes = mem_limit_mb * 1024 * 1024;
    let high_bytes = if max_bytes > 0 { (max_bytes * 90) / 100 } else { 0 };
    let low_bytes = if max_bytes > 0 { (max_bytes * 50) / 100 } else { 0 };
    let swap_bytes = if swap_mb > 0 {
        swap_mb as u64 * 1024 * 1024
    } else if swap_mb < 0 {
        if max_bytes > 0 { max_bytes } else { 2 * 1024 * 1024 * 1024 }
    } else {
        0
    };

    if let Some(linux_obj) = spec.get_mut("linux") {
        linux_obj["cgroupsPath"] = serde_json::json!(format!("/votion/{}", container_id));

        let mut res = linux_obj.get("resources").cloned().unwrap_or(serde_json::json!({}));
        let mut mem_res = serde_json::Map::new();
        if max_bytes > 0 {
            mem_res.insert("limit".to_string(), serde_json::json!(max_bytes));
            mem_res.insert("swap".to_string(), serde_json::json!(max_bytes + swap_bytes));
            if low_bytes > 0 {
                mem_res.insert("reservation".to_string(), serde_json::json!(low_bytes));
            }
        }
        res["memory"] = serde_json::Value::Object(mem_res);

        let mut cpu_res = serde_json::Map::new();
        let cpu_shares = io_weight.clamp(100, 10000);
        cpu_res.insert("shares".to_string(), serde_json::json!(cpu_shares));
        cpu_res.insert("cpus".to_string(), serde_json::json!("0-7")); // VIP Game Loop Pool (cores 0-7)
        if cpu_limit_pct > 0 {
            let period = 100_000;
            // Proportional CPU Bursting: allow 2x burst ceiling to eliminate tick hitching
            let burst_limit = (cpu_limit_pct * 2).clamp(100, 1200);
            let quota = (period as f64 * (burst_limit as f64 / 100.0)) as i64;
            cpu_res.insert("quota".to_string(), serde_json::json!(quota));
            cpu_res.insert("period".to_string(), serde_json::json!(period));
        }
        res["cpu"] = serde_json::Value::Object(cpu_res);

        // Dynamic Disk I/O Throttling in OCI spec
        let mut block_io = serde_json::Map::new();
        block_io.insert("weight".to_string(), serde_json::json!(io_weight.clamp(100, 1000)));
        res["blockIO"] = serde_json::Value::Object(block_io);

        linux_obj["resources"] = res;
    }

    let cgroups_mgr = CgroupsV2Manager::new(None);
    let _ = cgroups_mgr.create_container_cgroup(container_id);
    let _ = cgroups_mgr.apply_memory_limits(container_id, max_bytes, high_bytes, low_bytes, swap_bytes);
    cgroups_mgr.apply_cpuset_pool(container_id, true); // Assign to VIP Game Loop Pool (cores 0-7)
    let _ = cgroups_mgr.apply_cpu_limits(container_id, io_weight as u32, cpu_limit_pct as u32);
    cgroups_mgr.apply_io_limits(container_id, io_weight as u32, 157286400, 78643200); // 150MB/s read, 75MB/s write

    // 1. Sync Image / rootfs
    let mut image_rootfs_opt: Option<String> = None;
    let mut image_name_opt: Option<String> = None;
    let mut safe_name_opt: Option<String> = None;

    if let Some(image) = settings
        .get("container")
        .and_then(|c| c.get("image"))
        .and_then(|i| i.as_str())
    {
        image_name_opt = Some(image.to_string());
        let safe_name: String = image
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        safe_name_opt = Some(safe_name.clone());
        let image_rootfs = format!("/var/lib/votion/images/{}/rootfs", safe_name);

        // If the rootfs does not exist yet, attempt auto-export
        if !std::path::Path::new(&image_rootfs).exists() {
            info!(
                "Rootfs {} not found, attempting auto-export for image {}...",
                image_rootfs, image
            );
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let safe_prefix: String = safe_name.chars().take(8).collect();
            let tmp_c = format!("crun_auto_{}_{}", safe_prefix, ts);

            let _ = tokio::process::Command::new("docker")
                .args(["pull", image])
                .status()
                .await;
            let _ = tokio::process::Command::new("mkdir")
                .args(["-p", &image_rootfs])
                .status()
                .await;
            if let Ok(create_status) = tokio::process::Command::new("docker")
                .args(["create", "--name", &tmp_c, image])
                .status()
                .await
            {
                if create_status.success() {
                    let export_cmd = format!("docker export {} | tar -xf - -C {}", tmp_c, image_rootfs);
                    let _ = tokio::process::Command::new("sh")
                        .args(["-c", &export_cmd])
                        .status()
                        .await;
                    let _ = tokio::process::Command::new("docker")
                        .args(["rm", "-f", &tmp_c])
                        .status()
                        .await;
                    // Immediately delete Docker image layers to guarantee 0 double storage
                    let _ = tokio::process::Command::new("docker")
                        .args(["rmi", "-f", image])
                        .status()
                        .await;
                    // Immediately deduplicate the newly extracted rootfs against all existing images
                    let _ = tokio::process::Command::new("hardlink")
                        .args(["-q", "/var/lib/votion/images"])
                        .status()
                        .await;
                }
            }
        }

        if std::path::Path::new(&image_rootfs).exists() {
            image_rootfs_opt = Some(image_rootfs.clone());
            if let Some(root_obj) = spec.get_mut("root") {
                if root_obj.get("path").and_then(|p| p.as_str()) != Some(&image_rootfs) {
                    info!("Updating rootfs for {} to {}", container_id, image_rootfs);
                    root_obj["path"] = serde_json::Value::String(image_rootfs.clone());
                }
            }

            // Ensure universal entrypoint.sh exists in image_rootfs for all egg images
            let ep_path = format!("{}/entrypoint.sh", image_rootfs);
            if !std::path::Path::new(&ep_path).exists() {
                let default_ep = "#!/bin/sh\nTZ=${TZ:-UTC}\nexport TZ\nINTERNAL_IP=$(ip route get 1 2>/dev/null | awk '{print $(NF-2);exit}')\nexport INTERNAL_IP\ncd /home/container || exit 1\nPARSED=$(echo \"$STARTUP\" | sed -e 's/{{/${/g' -e 's/}}/}/g')\neval \"$PARSED\"\n";
                let _ = tokio::fs::write(&ep_path, default_ep.as_bytes()).await;
                info!("Injected universal entrypoint.sh into {}", image_rootfs);
            }

            // Guarantee execute and search permissions on entrypoint, rootfs, and image directory for UID 999
            let _ = tokio::process::Command::new("chmod")
                .args(["755", &ep_path])
                .status()
                .await;
            let _ = tokio::process::Command::new("chmod")
                .args(["755", &image_rootfs])
                .status()
                .await;
            let image_parent = format!("/var/lib/votion/images/{}", safe_name);
            let _ = tokio::process::Command::new("chmod")
                .args(["755", &image_parent])
                .status()
                .await;
        }
    }

    // 2. Sync Environment Variables
    if let Some(proc_obj) = spec.get_mut("process") {
        let mut final_envs: std::collections::BTreeMap<String, String> = std::collections::BTreeMap::new();

        // 2a. Base environment from Docker image inspect / cache
        if let (Some(image), Some(safe_name)) = (image_name_opt.as_deref(), safe_name_opt.as_deref()) {
            let env_cache_path = format!("/var/lib/votion/images/{}/env.json", safe_name);
            let mut image_envs: Vec<String> = Vec::new();
            if let Ok(content) = tokio::fs::read_to_string(&env_cache_path).await {
                if let Ok(arr) = serde_json::from_str::<Vec<String>>(&content) {
                    image_envs = arr;
                }
            }
            if image_envs.is_empty() {
                if let Ok(out) = tokio::process::Command::new("docker")
                    .args(["inspect", "--format", "{{json .Config.Env}}", image])
                    .output()
                    .await
                {
                    if out.status.success() {
                        let raw = String::from_utf8_lossy(&out.stdout);
                        if let Ok(arr) = serde_json::from_str::<Vec<String>>(&raw) {
                            image_envs = arr;
                            let _ = tokio::fs::write(&env_cache_path, raw.as_bytes()).await;
                        }
                    }
                }
            }
            for item in image_envs {
                if let Some((k, v)) = item.split_once('=') {
                    final_envs.insert(k.to_string(), v.to_string());
                }
            }
        }

        // 2b. Existing config env if any (don't overwrite already parsed image env)
        if let Some(existing_env) = proc_obj.get("env").and_then(|e| e.as_array()) {
            for item in existing_env {
                if let Some(s) = item.as_str() {
                    if let Some((k, v)) = s.split_once('=') {
                        final_envs.entry(k.to_string()).or_insert_with(|| v.to_string());
                    }
                }
            }
        }

        // 2c. Server environment variables from Lunar Panel settings
        if let Some(env_map) = settings.get("environment").and_then(|e| e.as_object()) {
            for (k, v) in env_map {
                let val_str = match v {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    _ => String::new(),
                };
                final_envs.insert(k.clone(), val_str);
            }
        }

        // 2d. Ensure essential paths & Java / Python support
        let mut path_val = final_envs.get("PATH").cloned().unwrap_or_else(|| {
            "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin".to_string()
        });

        if let Some(ref rfs) = image_rootfs_opt {
            let java_bin = format!("{}/opt/java/openjdk/bin", rfs);
            if std::path::Path::new(&java_bin).exists() && !path_val.contains("/opt/java/openjdk/bin") {
                path_val = format!("/opt/java/openjdk/bin:{}", path_val);
                final_envs.entry("JAVA_HOME".to_string()).or_insert_with(|| "/opt/java/openjdk".to_string());
            }
        }

        if !path_val.contains("/home/container/.local/bin") {
            path_val = format!("/home/container/.local/bin:{}", path_val);
        }
        final_envs.insert("PATH".to_string(), path_val);

        final_envs.insert("HOME".to_string(), "/home/container".to_string());
        final_envs.insert("USER".to_string(), "container".to_string());

        if !final_envs.contains_key("PYTHONPATH") {
            final_envs.insert("PYTHONPATH".to_string(), "/home/container/.local/lib/python3.12/site-packages:/home/container/.local/lib/python3.11/site-packages:/home/container/.local/lib/python3.10/site-packages:/home/container/.local/lib/python3.9/site-packages:/home/container/.local/lib/python3.8/site-packages:/home/container/.local/lib/python3.7/site-packages:/home/container/.local/lib/python2.7/site-packages".to_string());
        }

        // Dynamic JVM Memory Reclamation for Java / Minecraft engines
        let is_java_or_mc = image_name_opt
            .as_ref()
            .map(|i| {
                let lower = i.to_lowercase();
                lower.contains("java")
                    || lower.contains("minecraft")
                    || lower.contains("paper")
                    || lower.contains("purpur")
                    || lower.contains("forge")
                    || lower.contains("fabric")
                    || lower.contains("sponge")
                    || lower.contains("bungee")
                    || lower.contains("velocity")
            })
            .unwrap_or(false)
            || final_envs.contains_key("SERVER_JARFILE")
            || final_envs.get("STARTUP").map(|s| s.contains("java")).unwrap_or(false);

        if is_java_or_mc {
            let jvm_flags = "-XX:+UseG1GC -XX:G1PeriodicGCInterval=15000 -XX:+UnlockExperimentalVMOptions -XX:G1PeriodicGCSystemLoadThreshold=0 -XX:+UseStringDeduplication";
            final_envs.insert("_JAVA_OPTIONS".to_string(), jvm_flags.to_string());
            final_envs.insert("JAVA_TOOL_OPTIONS".to_string(), "-XX:+UseG1GC -XX:G1PeriodicGCInterval=15000 -XX:+UnlockExperimentalVMOptions -XX:G1PeriodicGCSystemLoadThreshold=0".to_string());

            if let Some(startup_cmd) = final_envs.get_mut("STARTUP") {
                if startup_cmd.contains("java ") && !startup_cmd.contains("G1PeriodicGCInterval") {
                    *startup_cmd = startup_cmd.replacen("java ", "java -XX:+UseG1GC -XX:G1PeriodicGCInterval=15000 ", 1);
                }
            }
            info!("Injected Dynamic JVM Memory Reclamation flags into container {}", container_id);
        }

        let env_array: Vec<String> = final_envs.into_iter().map(|(k, v)| format!("{}={}", k, v)).collect();
        proc_obj["env"] = serde_json::json!(env_array);
    }

    // Write updated spec back to config.json atomically
    if let Ok(updated_raw) = serde_json::to_string_pretty(&spec) {
        if !updated_raw.trim().is_empty() {
            let tmp_path = format!("{}/config.json.tmp", bundle_path);
            if tokio::fs::write(&tmp_path, updated_raw.as_bytes()).await.is_ok() {
                let _ = tokio::fs::rename(&tmp_path, &config_path).await;
                info!("Successfully synced latest container configuration for {}", container_id);
            }
        }
    }

    // Engine-Specific Safeguards: Minecraft Entity Activation Range & Chunk Loading Optimization
    optimize_minecraft_configs(&server_vol).await;
}

/// Executes lifecycle commands on pure crun OCI containers
pub async fn execute_crun_action(container_id: &str, action: &str) -> Result<String, String> {
    let bundle = format!("/var/lib/votion/containers/{}", container_id);
    let sock = format!("{}/console.sock", bundle);
    let log_path = format!("{}/console.log", bundle);

    match action {
        "start" => {
            // 0. Auto-sync latest image and startup variables from panel
            sync_crun_container_config(container_id).await;

            // Ensure bundle directory and config.json are accessible
            let _ = tokio::process::Command::new("chmod")
                .args(["755", &bundle])
                .status()
                .await;

            // 0b. Validate config.json integrity before launching crun
            let config_path = format!("{}/config.json", bundle);
            let is_valid = match tokio::fs::read_to_string(&config_path).await {
                Ok(content) => content.len() > 50 && serde_json::from_str::<serde_json::Value>(&content).is_ok(),
                Err(_) => false,
            };
            if !is_valid {
                warn!("config.json missing or invalid for {}, regenerating baseline spec...", container_id);
                let _ = tokio::fs::remove_file(&config_path).await;
                let _ = tokio::process::Command::new("crun")
                    .args(["spec"])
                    .current_dir(&bundle)
                    .status()
                    .await;
                sync_crun_container_config(container_id).await;
            }

            // Ensure rootfs entrypoint is executable
            if let Ok(content) = tokio::fs::read_to_string(&config_path).await {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(rfs) = v.get("root").and_then(|r| r.get("path")).and_then(|p| p.as_str()) {
                        let ep = format!("{}/entrypoint.sh", rfs);
                        let _ = tokio::process::Command::new("chmod").args(["755", &ep]).status().await;
                    }
                }
            }

            // Force cleanup any previous dangling process or crun state
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["kill", "-a", container_id, "SIGKILL"])
                .status()
                .await;

            let _ = tokio::process::Command::new("pkill")
                .args(["-9", "-f", &format!("dtach -n {}", sock)])
                .status()
                .await;

            let _ = tokio::fs::remove_file(&sock).await;
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["delete", "--force", container_id])
                .status()
                .await;

            // Pipeline: crun run with stdout and stderr piped to tee -a console.log
            let crun_pipeline = format!(
                "crun run -b {} {} 2>&1 | tee -a {}",
                bundle, container_id, log_path
            );

            let status = tokio::process::Command::new("dtach")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["-n", &sock, "bash", "-c", &crun_pipeline])
                .status()
                .await
                .map_err(|e| format!("Failed to spawn dtach/crun: {}", e))?;

            if status.success() {
                // Short check to automatically catch and remediate any "open executable: Permission denied"
                tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
                if let Ok(log_content) = tokio::fs::read_to_string(&log_path).await {
                    if log_content.contains("open executable: Permission denied") && !is_crun_active(container_id) {
                        warn!("Container {} failed with 'open executable: Permission denied'. Auto-fixing permissions and retrying...", container_id);
                        if let Ok(content) = tokio::fs::read_to_string(&config_path).await {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                                if let Some(rfs) = v.get("root").and_then(|r| r.get("path")).and_then(|p| p.as_str()) {
                                    let ep = format!("{}/entrypoint.sh", rfs);
                                    let _ = tokio::process::Command::new("chmod").args(["755", &ep]).status().await;
                                    let _ = tokio::process::Command::new("chmod").args(["-R", "a+rX", rfs]).status().await;
                                }
                            }
                        }
                        if let Some(vol) = resolve_server_volume(container_id) {
                            let _ = tokio::process::Command::new("chown").args(["-R", "999:995", &vol.to_string_lossy()]).status().await;
                            let _ = tokio::process::Command::new("chmod").args(["-R", "u+rwX,go+rX", &vol.to_string_lossy()]).status().await;
                        }
                        let _ = tokio::process::Command::new("crun")
                            .env("XDG_RUNTIME_DIR", "/run/user/0")
                            .args(["delete", "--force", container_id])
                            .status()
                            .await;
                        let _ = tokio::process::Command::new("dtach")
                            .env("XDG_RUNTIME_DIR", "/run/user/0")
                            .args(["-n", &sock, "bash", "-c", &crun_pipeline])
                            .status()
                            .await;
                    }
                }
                Ok("started".to_string())
            } else {
                Err("crun start failed".to_string())
            }
        }
        "stop" => {
            // First send graceful SIGTERM to all processes in container cgroup
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["kill", "-a", container_id, "SIGTERM"])
                .status()
                .await;

            // Wait up to 3 seconds for graceful shutdown
            for _ in 0..12 {
                tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
                if !is_crun_active(container_id) {
                    break;
                }
            }

            // If still active, send SIGKILL to all processes
            if is_crun_active(container_id) {
                let _ = tokio::process::Command::new("crun")
                    .env("XDG_RUNTIME_DIR", "/run/user/0")
                    .args(["kill", "-a", container_id, "SIGKILL"])
                    .status()
                    .await;
            }

            let _ = tokio::process::Command::new("pkill")
                .args(["-9", "-f", &format!("dtach -n {}", sock)])
                .status()
                .await;

            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["delete", "--force", container_id])
                .status()
                .await;

            let _ = tokio::fs::remove_file(&sock).await;
            teardown_container_networking(container_id).await;
            Ok("stopped".to_string())
        }
        "restart" => {
            let _ = Box::pin(execute_crun_action(container_id, "stop")).await;
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            Box::pin(execute_crun_action(container_id, "start")).await
        }
        "kill" => {
            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["kill", "-a", container_id, "SIGKILL"])
                .status()
                .await;

            let _ = tokio::process::Command::new("pkill")
                .args(["-9", "-f", &format!("dtach -n {}", sock)])
                .status()
                .await;

            let _ = tokio::process::Command::new("crun")
                .env("XDG_RUNTIME_DIR", "/run/user/0")
                .args(["delete", "--force", container_id])
                .status()
                .await;

            let _ = tokio::fs::remove_file(&sock).await;
            teardown_container_networking(container_id).await;
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

fn parse_byte_str(s: &str) -> u64 {
    let s = s.trim();
    if s.ends_with("GiB") || s.ends_with("GB") {
        let val: f64 = s.trim_end_matches("GiB").trim_end_matches("GB").trim().parse().unwrap_or(0.0);
        (val * 1024.0 * 1024.0 * 1024.0) as u64
    } else if s.ends_with("MiB") || s.ends_with("MB") {
        let val: f64 = s.trim_end_matches("MiB").trim_end_matches("MB").trim().parse().unwrap_or(0.0);
        (val * 1024.0 * 1024.0) as u64
    } else if s.ends_with("KiB") || s.ends_with("kB") || s.ends_with("KB") {
        let val: f64 = s.trim_end_matches("KiB").trim_end_matches("kB").trim_end_matches("KB").trim().parse().unwrap_or(0.0);
        (val * 1024.0) as u64
    } else if s.ends_with('B') {
        s.trim_end_matches('B').trim().parse::<u64>().unwrap_or(0)
    } else {
        s.parse::<u64>().unwrap_or(0)
    }
}

fn parse_net_io(s: &str) -> (u64, u64) {
    let parts: Vec<&str> = s.split('/').collect();
    let rx = parts.get(0).map(|x| parse_byte_str(x)).unwrap_or(0);
    let tx = parts.get(1).map(|x| parse_byte_str(x)).unwrap_or(0);
    (rx, tx)
}

async fn get_server_disk_usage(container_id: &str, cache: &mut (u64, tokio::time::Instant)) -> u64 {
    if cache.1.elapsed() < tokio::time::Duration::from_secs(15) && cache.0 > 0 {
        return cache.0;
    }
    let vol_path = resolve_server_volume(container_id)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("/var/lib/pterodactyl/volumes/{}", container_id));

    if let Ok(out) = tokio::process::Command::new("du")
        .args(["-sb", &vol_path])
        .output()
        .await
    {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout);
            if let Some(bytes) = s.split_whitespace().next().and_then(|b| b.parse::<u64>().ok()) {
                *cache = (bytes, tokio::time::Instant::now());
                return bytes;
            }
        }
    }
    cache.0
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

pub async fn run_server_installer(uuid: String, start_on_completion: bool) {
    info!("Starting egg installation pipeline for server {}", uuid);
    let vol_dir = format!("/var/lib/pterodactyl/volumes/{}", uuid);
    let _ = tokio::fs::create_dir_all(&vol_dir).await;
    let _ = tokio::process::Command::new("chown")
        .args(["-R", "999:995", &vol_dir])
        .status()
        .await;

    let (remote_url, auth_header) = get_panel_remote_config();

    // 1. Fetch install data from panel remote API
    let install_url = format!("{}/api/remote/servers/{}/install", remote_url, uuid);
    let install_res = tokio::process::Command::new("curl")
        .args([
            "-k", "-s",
            "-H", &format!("Authorization: {}", auth_header),
            "-H", "Accept: application/json",
            &install_url,
        ])
        .output()
        .await;

    let install_json: Option<serde_json::Value> = install_res.ok().and_then(|out| {
        serde_json::from_slice(&out.stdout).ok()
    });

    let script = install_json
        .as_ref()
        .and_then(|j| j.get("script"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .replace("\r\n", "\n")
        .replace('\r', "\n");

    // 2. Fetch server environment variables
    let server_url = format!("{}/api/remote/servers/{}", remote_url, uuid);
    let server_res = tokio::process::Command::new("curl")
        .args([
            "-k", "-s",
            "-H", &format!("Authorization: {}", auth_header),
            "-H", "Accept: application/json",
            &server_url,
        ])
        .output()
        .await;

    let server_json: Option<serde_json::Value> = server_res.ok().and_then(|out| {
        serde_json::from_slice(&out.stdout).ok()
    });

    let mut install_success = true;

    if !script.trim().is_empty() {
        info!("Executing egg install script for server {}", uuid);
        let script_path = format!("/tmp/install_{}.sh", uuid);
        let _ = tokio::fs::write(&script_path, script.as_bytes()).await;
        let _ = tokio::process::Command::new("chmod")
            .args(["755", &script_path])
            .status()
            .await;

        let container_image = install_json
            .as_ref()
            .and_then(|j| j.get("container_image"))
            .and_then(|s| s.as_str())
            .unwrap_or("ghcr.io/pterodactyl/installers:alpine");

        let entrypoint = install_json
            .as_ref()
            .and_then(|j| j.get("entrypoint"))
            .and_then(|s| s.as_str())
            .unwrap_or("bash");

        info!(
            "Running installer for {} using container image: {} with entrypoint: {}",
            uuid, container_image, entrypoint
        );

        let mut dcmd = tokio::process::Command::new("docker");
        dcmd.args(["run", "--rm"]);
        dcmd.args(["-v", &format!("{}:/mnt/server", vol_dir)]);
        dcmd.args(["-v", &format!("{}:/tmp/install_script.sh", script_path)]);
        dcmd.args(["-w", "/mnt/server"]);

        if let Some(env_map) = server_json
            .as_ref()
            .and_then(|j| j.get("settings"))
            .and_then(|s| s.get("environment"))
            .and_then(|e| e.as_object())
        {
            for (k, v) in env_map {
                let val_str = match v {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    _ => String::new(),
                };
                dcmd.args(["-e", &format!("{}={}", k, val_str)]);
            }
        }

        dcmd.arg(container_image);
        dcmd.args([entrypoint, "/tmp/install_script.sh"]);

        let mut docker_succeeded = match dcmd.status().await {
            Ok(st) => st.success(),
            Err(e) => {
                warn!("Docker installer launch failed: {}", e);
                false
            }
        };

        if !docker_succeeded {
            warn!("Docker installer execution failed or image unavailable, attempting host fallback for {}", uuid);
            let _ = tokio::fs::create_dir_all("/mnt").await;
            let _ = tokio::process::Command::new("rm").args(["-rf", "/mnt/server"]).status().await;
            let _ = tokio::process::Command::new("ln").args(["-s", &vol_dir, "/mnt/server"]).status().await;

            let mut hcmd = tokio::process::Command::new("bash");
            hcmd.arg(&script_path).current_dir(&vol_dir);
            if let Some(env_map) = server_json
                .as_ref()
                .and_then(|j| j.get("settings"))
                .and_then(|s| s.get("environment"))
                .and_then(|e| e.as_object())
            {
                for (k, v) in env_map {
                    let val_str = match v {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Number(n) => n.to_string(),
                        serde_json::Value::Bool(b) => b.to_string(),
                        _ => String::new(),
                    };
                    hcmd.env(k, val_str);
                }
            }
            if let Ok(hst) = hcmd.status().await {
                if hst.success() {
                    docker_succeeded = true;
                }
            }
        }

        install_success = docker_succeeded;

        let _ = tokio::fs::remove_file(&script_path).await;
        let _ = tokio::process::Command::new("chown")
            .args(["-R", "999:995", &vol_dir])
            .status()
            .await;
        let _ = tokio::process::Command::new("chmod")
            .args(["-R", "u+rwX,go+rX", &vol_dir])
            .status()
            .await;
    }

    // 3. Confirm install completion with panel
    let notify_url = format!("{}/api/remote/servers/{}/install", remote_url, uuid);
    let body = serde_json::json!({ "successful": install_success }).to_string();
    let _ = tokio::process::Command::new("curl")
        .args([
            "-k", "-s",
            "-H", &format!("Authorization: {}", auth_header),
            "-H", "Content-Type: application/json",
            "-X", "POST",
            &notify_url,
            "-d", &body,
        ])
        .status()
        .await;

    info!("Notified panel of install completion for {} (success: {})", uuid, install_success);

    // 4. Pre-sync crun container configuration
    sync_crun_container_config(&uuid).await;

    // 5. Start container if requested
    if start_on_completion && install_success {
        info!("Auto-starting container {} after successful installation", uuid);
        let _ = execute_crun_action(&uuid, "start").await;
    }
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

    let uuid_for_installer = payload.uuid.clone();
    let start_on_comp = payload.start_on_completion.unwrap_or(false);
    tokio::spawn(async move {
        run_server_installer(uuid_for_installer, start_on_comp).await;
    });

    StatusCode::CREATED
}

async fn get_server_details(
    Path(uuid): Path<String>,
    State(state): State<WingsState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let crun_bundle_opt = resolve_crun_bundle(&uuid);
    let is_docker_mgr = is_docker_managed(&uuid).await;
    let is_crun_mode = !is_docker_mgr || is_crun_active(&uuid) || crun_bundle_opt.is_some();

    if is_crun_mode {
        let crun_id = crun_bundle_opt.unwrap_or_else(|| uuid.clone());
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

    // Fall back to Docker inspection
    if let Some(target) = resolve_container(&uuid).await {
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

    let lock = state.servers.read().await;
    let fallback_state = lock.get(&uuid).map(|s| s.state.clone()).unwrap_or_else(|| "offline".to_string());
    Ok(Json(serde_json::json!({
        "uuid": uuid,
        "state": fallback_state,
        "is_suspended": false,
        "utilization": {
            "memory_bytes": 0,
            "cpu_absolute": 0.0,
            "disk_bytes": 0,
            "network": { "rx_bytes": 0, "tx_bytes": 0 }
        }
    })))
}

async fn delete_server(
    Path(uuid): Path<String>,
    State(state): State<WingsState>,
) -> StatusCode {
    info!("Pterodactyl requested server deletion for UUID: {}", uuid);
    if let Some(crun_id) = resolve_crun_bundle(&uuid) {
        let _ = execute_crun_action(&crun_id, "kill").await;
        teardown_container_networking(&crun_id).await;
        let _ = tokio::fs::remove_file(format!("/var/lib/votion/containers/{}/network.json", crun_id)).await;
    } else if let Some(target) = resolve_container(&uuid).await {
        let _ = docker_power_action(&target, "kill").await;
    }
    teardown_container_networking(&uuid).await;
    let _ = tokio::fs::remove_file(format!("/var/lib/votion/containers/{}/network.json", uuid)).await;
    let _ = state.oci_runner.delete(&uuid).await;
    let mut lock = state.servers.write().await;
    lock.remove(&uuid);
    StatusCode::NO_CONTENT
}

#[derive(Deserialize)]
struct PowerRequest {
    action: String,
}

#[derive(Deserialize)]
struct SetHibernationPayload {
    enabled: bool,
}

async fn handle_get_hibernation(
    Path(uuid): Path<String>,
    State(state): State<WingsState>,
) -> Json<serde_json::Value> {
    let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
    let (enabled, is_frozen, active_conns) = state.hibernation.get_status(&target).await;
    Json(serde_json::json!({
        "container_id": target,
        "enabled": enabled,
        "is_frozen": is_frozen,
        "active_connections": active_conns,
    }))
}

async fn handle_set_hibernation(
    Path(uuid): Path<String>,
    State(state): State<WingsState>,
    Json(payload): Json<SetHibernationPayload>,
) -> Json<serde_json::Value> {
    let target = resolve_container(&uuid).await.unwrap_or_else(|| uuid.clone());
    state.hibernation.set_enabled(&target, payload.enabled, &state.cgroups).await;
    Json(serde_json::json!({
        "container_id": target,
        "success": true,
        "enabled": payload.enabled,
    }))
}

async fn handle_power(
    Path(uuid): Path<String>,
    State(state): State<WingsState>,
    Json(payload): Json<PowerRequest>,
) -> StatusCode {
    info!("Received power action '{}' for server {}", payload.action, uuid);

    let crun_bundle_opt = resolve_crun_bundle(&uuid);
    let is_docker_mgr = is_docker_managed(&uuid).await;
    let is_crun_mode = !is_docker_mgr || is_crun_active(&uuid) || crun_bundle_opt.is_some();

    if is_crun_mode {
        let crun_id = crun_bundle_opt.unwrap_or_else(|| uuid.clone());
        let res = execute_crun_action(&crun_id, &payload.action).await;
        let mut lock = state.servers.write().await;
        if let Some(s) = lock.get_mut(&uuid) {
            s.state = if payload.action == "start" || payload.action == "restart" {
                "running".to_string()
            } else {
                "offline".to_string()
            };
        }
        return match res {
            Ok(_) => StatusCode::NO_CONTENT,
            Err(e) => {
                error!("CRUN power action '{}' failed for {}: {}", payload.action, crun_id, e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        };
    }

    if let Some(target) = resolve_container(&uuid).await {
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

    StatusCode::NOT_FOUND
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
    let uuid_for_installer = uuid.clone();
    tokio::spawn(async move {
        run_server_installer(uuid_for_installer, false).await;
    });
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
    let trimmed = uuid.trim();
    if trimmed.len() < 8 {
        return None;
    }
    let direct = std::path::PathBuf::from(format!("/var/lib/pterodactyl/volumes/{}", trimmed));
    if direct.is_dir() {
        return Some(direct);
    }
    if let Ok(entries) = std::fs::read_dir("/var/lib/pterodactyl/volumes") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(trimmed) {
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
            std::path::Component::ParentDir => {
                if resolved.starts_with(base) && resolved != base {
                    resolved.pop();
                } else {
                    warn!("Blocked path traversal attempt escaping base directory: {}", subpath);
                    return Err(StatusCode::FORBIDDEN);
                }
            }
            _ => {
                warn!("Blocked invalid path component in subpath: {}", subpath);
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
    let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();

    // Check special filenames without extensions or leading dots
    match filename.as_str() {
        "dockerfile" | "containerfile" | "makefile" | "procfile" | "license" | "licence" | "readme"
        | ".env" | ".gitignore" | ".gitattributes" | ".gitmodules" | ".dockerignore"
        | ".editorconfig" | ".npmrc" | ".yarnrc" | ".bashrc" | ".profile" => return "text/plain",
        _ => {}
    }

    match ext.as_str() {
        // Text & Documentation
        "txt" | "log" | "properties" | "cfg" | "conf" | "ini" | "env" | "cnf" | "inf" => "text/plain",
        "csv" | "tsv" => "text/csv",
        "md" | "markdown" | "rst" | "tex" | "asciidoc" | "adoc" => "text/markdown",

        // Python
        "py" | "pyw" | "pyx" | "pxd" | "pyi" => "text/x-python",

        // JavaScript & TypeScript
        "js" | "mjs" | "cjs" | "jsx" => "application/javascript",
        "ts" | "mts" | "cts" | "tsx" => "application/typescript",

        // Web & Styling
        "html" | "htm" => "text/html",
        "css" | "scss" | "sass" | "less" => "text/css",
        "vue" | "svelte" => "text/html",

        // Shell & Scripts
        "sh" | "bash" | "zsh" | "fish" | "bat" | "cmd" | "ps1" | "psm1" | "psd1" => "application/x-sh",

        // Other Programming Languages
        "java" | "jsp" => "text/x-java",
        "c" | "cpp" | "cc" | "cxx" | "h" | "hpp" | "hh" | "hxx" | "inl" => "text/x-c",
        "rs" => "text/rust",
        "go" => "text/x-go",
        "php" | "phtml" | "php3" | "php4" | "php5" | "php7" | "php8" => "text/x-php",
        "rb" | "erb" | "gemspec" => "text/x-ruby",
        "lua" => "text/x-lua",
        "pl" | "pm" => "text/x-perl",
        "cs" | "csproj" | "sln" | "fs" | "vb" => "text/x-csharp",
        "kt" | "kts" => "text/x-kotlin",
        "swift" => "text/x-swift",
        "dart" => "text/x-dart",
        "sql" => "application/sql",
        "r" => "text/plain",
        "s" | "asm" => "text/plain",
        "lock" | "sum" => "text/plain",

        // Config & Structured Data
        "json" | "json5" | "jsonc" => "application/json",
        "yml" | "yaml" => "text/yaml",
        "toml" => "text/x-toml",
        "xml" => "application/xml",

        // Images
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "webp" => "image/webp",
        "bmp" => "image/bmp",

        // Audio & Video
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",

        // Archives
        "zip" => "application/zip",
        "tar" => "application/x-tar",
        "gz" | "tgz" => "application/gzip",
        "bz2" => "application/x-bzip2",
        "xz" => "application/x-xz",
        "7z" => "application/x-7z-compressed",
        "rar" => "application/x-rar-compressed",
        "jar" | "war" | "ear" => "application/java-archive",

        // Documents
        "pdf" => "application/pdf",

        // Explicit binaries
        "exe" | "dll" | "so" | "dylib" | "bin" | "dat" | "db" | "sqlite" | "sqlite3" | "session"
        | "session-journal" => "application/octet-stream",

        // Fallback: sniff first 512 bytes for plain text / valid UTF-8
        _ => {
            if let Ok(mut file) = std::fs::File::open(path) {
                use std::io::Read;
                let mut buf = [0u8; 512];
                if let Ok(n) = file.read(&mut buf) {
                    if n > 0 && !buf[..n].contains(&0) {
                        return "text/plain";
                    }
                }
            }
            "application/octet-stream"
        }
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

    let auth_header = format!("Bearer {}.{}", token_id, token);
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
    let _filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut headers = HeaderMap::new();
    let content_type = if mime.starts_with("text/")
        || mime == "application/json"
        || mime == "application/javascript"
        || mime == "application/typescript"
        || mime == "application/xml"
        || mime == "application/sql"
        || mime == "application/x-sh"
    {
        format!("{mime}; charset=utf-8")
    } else {
        mime.to_string()
    };
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&content_type)
            .unwrap_or(HeaderValue::from_static("text/plain; charset=utf-8")),
    );
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&bytes.len().to_string()).unwrap(),
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
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let token = query.token.ok_or((StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Missing token" }))))?;
    let payload = decode_jwt_payload(&token).ok_or((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Invalid token" }))))?;
    validate_jwt_claims(&payload, "file-upload").map_err(|st| (st, Json(serde_json::json!({ "error": "Token claim mismatch or expired" }))))?;

    let server_uuid = payload
        .get("server_uuid")
        .and_then(|v| v.as_str())
        .ok_or((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Missing server_uuid in claims" }))))?;

    let vol = resolve_server_volume(server_uuid).ok_or((StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Server volume not found" }))))?;

    let raw_directory = query.directory.as_deref().unwrap_or("/");
    let target_dir = safe_resolve_subpath(&vol, raw_directory).map_err(|st| (st, Json(serde_json::json!({ "error": "Invalid directory path" }))))?;

    if !target_dir.exists() {
        let _ = tokio::fs::create_dir_all(&target_dir).await;
        fix_pterodactyl_ownership(&target_dir);
    }

    let mut uploaded_files = 0;
    while let Ok(Some(mut field)) = multipart.next_field().await {
        let raw_name = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "upload.bin".to_string());

        let clean_name = raw_name.replace('\\', "/");
        let safe_name = clean_name.split('/').filter(|s| !s.is_empty()).last().unwrap_or("upload.bin");
        let file_path = match safe_resolve_subpath(&target_dir, safe_name) {
            Ok(p) => p,
            Err(st) => return Err((st, Json(serde_json::json!({ "error": "Invalid filename path" })))),
        };

        if let Some(parent) = file_path.parent() {
            if !parent.exists() {
                let _ = tokio::fs::create_dir_all(parent).await;
                fix_pterodactyl_ownership(parent);
            }
        }

        let out_file = tokio::fs::File::create(&file_path)
            .await
            .map_err(|e| {
                error!("Failed to create upload file {:?}: {}", file_path, e);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed to create target file" })))
            })?;

        let mut writer = BufWriter::with_capacity(65536, out_file);

        while let Ok(Some(chunk)) = field.chunk().await {
            writer
                .write_all(&chunk)
                .await
                .map_err(|e| {
                    error!("Failed to write chunk to {:?}: {}", file_path, e);
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed writing file chunk" })))
                })?;
        }
        let _ = writer.flush().await;
        fix_pterodactyl_ownership(&file_path);

        let _ = tokio::process::Command::new("chmod")
            .args(["u+rw,go+r", &file_path.to_string_lossy()])
            .status()
            .await;

        uploaded_files += 1;
        info!("Successfully uploaded file to server {}: {:?}", server_uuid, file_path);
    }

    info!("Completed upload request for server {}: {} files written to {:?}", server_uuid, uploaded_files, target_dir);
    Ok(StatusCode::OK)
}

#[derive(Deserialize)]
pub struct DownloadQuery {
    pub token: Option<String>,
}

/// Helper to stream a file response supporting full downloads and HTTP 206 Partial Content (Range header)
async fn stream_file_response(
    path: &FsPath,
    filename: &str,
    mime: &str,
    range_header: Option<&str>,
) -> Result<impl IntoResponse, StatusCode> {
    let meta = tokio::fs::metadata(path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total_size = meta.len();
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut headers = HeaderMap::new();
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime).unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename))
            .unwrap_or(HeaderValue::from_static("attachment")),
    );

    // Support resuming interrupted downloads with HTTP 206 Partial Content
    if let Some(range_val) = range_header {
        if let Some(range_spec) = range_val.strip_prefix("bytes=") {
            let parts: Vec<&str> = range_spec.split('-').collect();
            let start = parts.first().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
            let end = parts
                .get(1)
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(total_size.saturating_sub(1));

            if start < total_size {
                let actual_end = std::cmp::min(end, total_size.saturating_sub(1));
                let length = actual_end.saturating_sub(start) + 1;

                if file.seek(std::io::SeekFrom::Start(start)).await.is_ok() {
                    let take_file = file.take(length);
                    let stream = ReaderStream::new(take_file);
                    let body = Body::from_stream(stream);

                    headers.insert(
                        header::CONTENT_RANGE,
                        HeaderValue::from_str(&format!("bytes {}-{}/{}", start, actual_end, total_size)).unwrap(),
                    );
                    headers.insert(
                        header::CONTENT_LENGTH,
                        HeaderValue::from_str(&length.to_string()).unwrap(),
                    );

                    return Ok((StatusCode::PARTIAL_CONTENT, headers, body));
                }
            }
        }
    }

    // Default full file streaming (zero-RAM copy directly to TCP socket)
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&total_size.to_string()).unwrap(),
    );
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Ok((StatusCode::OK, headers, body))
}

async fn handle_download_file(
    headers: HeaderMap,
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

    // 1. Try direct safe subpath resolution
    let mut target_file_opt = safe_resolve_subpath(&vol, file_path_str).ok();

    // 2. If not found or resolved to a directory, search for the target filename in volume
    if target_file_opt.as_ref().map(|p| !p.exists() || p.is_dir()).unwrap_or(true) {
        let clean_filename = FsPath::new(file_path_str)
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or(file_path_str);

        let root_alt = vol.join(clean_filename);
        if root_alt.exists() && root_alt.is_file() {
            target_file_opt = Some(root_alt);
        } else {
            let mut search_queue = vec![vol.clone()];
            let mut found_file = None;
            for _ in 0..4 {
                let mut next_queue = Vec::new();
                for dir in search_queue {
                    if let Ok(entries) = std::fs::read_dir(&dir) {
                        for entry in entries.flatten() {
                            let p = entry.path();
                            if p.is_file() && p.file_name().and_then(|f| f.to_str()) == Some(clean_filename) {
                                found_file = Some(p);
                                break;
                            } else if p.is_dir() {
                                next_queue.push(p);
                            }
                        }
                    }
                    if found_file.is_some() {
                        break;
                    }
                }
                if found_file.is_some() {
                    break;
                }
                search_queue = next_queue;
            }
            if let Some(f) = found_file {
                target_file_opt = Some(f);
            }
        }
    }

    let target_file = target_file_opt.ok_or(StatusCode::NOT_FOUND)?;
    if !target_file.exists() || target_file.is_dir() {
        warn!("Download file not found on server {}: {}", server_uuid, file_path_str);
        return Err(StatusCode::NOT_FOUND);
    }

    let mime = detect_mime_type(&target_file);
    let filename = target_file
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let content_type = if mime.starts_with("text/")
        || mime == "application/json"
        || mime == "application/javascript"
        || mime == "application/typescript"
        || mime == "application/xml"
        || mime == "application/sql"
        || mime == "application/x-sh"
    {
        format!("{mime}; charset=utf-8")
    } else {
        mime.to_string()
    };

    let range_header = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    info!("Streaming download for server {}: file={}, range={:?}", server_uuid, filename, range_header);

    stream_file_response(&target_file, &filename, &content_type, range_header).await
}

async fn handle_download_backup(
    headers: HeaderMap,
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
        warn!("Backup archive not found: {:?}", backup_file);
        return Err(StatusCode::NOT_FOUND);
    }

    let filename = format!("{}.tar.gz", backup_uuid);
    let range_header = headers.get(header::RANGE).and_then(|v| v.to_str().ok());

    info!("Streaming backup download: uuid={}, range={:?}", backup_uuid, range_header);
    stream_file_response(&backup_file, &filename, "application/gzip", range_header).await
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
        while crate::monitor::psi::is_background_paused() {
            warn!("Memory pressure elevated (>20% PSI). Delaying backup archive creation for {}...", backup_uuid_clone);
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        }

        let status = tokio::process::Command::new("taskset")
            .args(["-c", "8-11", "tar", "-czf", &backup_dest.to_string_lossy(), "-C", &vol.to_string_lossy(), "."])
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

    let crun_bundle_opt = resolve_crun_bundle(&uuid);
    let is_docker_mgr = is_docker_managed(&uuid).await;
    let is_crun_mode = !is_docker_mgr || is_crun_active(&uuid) || crun_bundle_opt.is_some();
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
                        let mut authenticated = true;
                        if let Some(token) = parsed.args.as_ref().and_then(|a| a.get(0)).and_then(|v| v.as_str()) {
                            if let Some(claims) = decode_jwt_payload(token) {
                                if let Some(server_uuid) = claims.get("server_uuid").and_then(|v| v.as_str()) {
                                    if !uuid.starts_with(server_uuid) && !server_uuid.starts_with(&uuid) {
                                        warn!("WebSocket JWT server_uuid mismatch: token claims '{}', socket uuid '{}'", server_uuid, uuid);
                                        let err_resp = serde_json::json!({
                                            "event": "daemon error",
                                            "args": ["Authentication token server mismatch"]
                                        });
                                        let _ = tx.send(Message::Text(err_resp.to_string().into())).await;
                                        authenticated = false;
                                    }
                                }
                                if let Some(exp) = claims.get("exp").and_then(|v| v.as_i64()) {
                                    let now = chrono::Utc::now().timestamp();
                                    if now > exp {
                                        warn!("WebSocket JWT expired: now={}, exp={}", now, exp);
                                        let err_resp = serde_json::json!({
                                            "event": "jwt error",
                                            "args": ["jwt: exp claim is invalid"]
                                        });
                                        let _ = tx.send(Message::Text(err_resp.to_string().into())).await;
                                        authenticated = false;
                                    }
                                }
                            }
                        }
                        if !authenticated {
                            break;
                        }

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

                            if is_crun_for_log {
                                let mut initial = true;
                                loop {
                                    if log_tx.is_closed() {
                                        break;
                                    }

                                    let log_file = if std::path::Path::new(&mc_log).exists() {
                                        mc_log.clone()
                                    } else {
                                        let bundle_dir = format!("/var/lib/votion/containers/{}", log_target);
                                        let _ = std::fs::create_dir_all(&bundle_dir);
                                        let _ = std::fs::OpenOptions::new()
                                            .create(true)
                                            .append(true)
                                            .open(&crun_log);
                                        crun_log.clone()
                                    };

                                    let tail_count = if initial { "100" } else { "0" };
                                    initial = false;

                                    // Stream directly from live container/game log
                                    let mut cmd = tokio::process::Command::new("tail");
                                    cmd.args(["-n", tail_count, "-F", &log_file]);
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

                                    if log_tx.is_closed() {
                                        break;
                                    }

                                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
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

                        // 5. Start real-time metrics telemetry and active state watcher
                        if let Some(h) = stats_handle.take() {
                            h.abort();
                        }
                        let stats_tx = tx.clone();
                        let stats_target = target_container.clone();
                        let is_crun_for_stats = is_crun_mode;

                        stats_handle = Some(tokio::spawn(async move {
                            let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(2000));
                            let mut last_status: Option<&'static str> = None;
                            let mut last_cpu_usec: u64 = 0;
                            let mut last_cpu_time = tokio::time::Instant::now();
                            let mut disk_cache: (u64, tokio::time::Instant) = (0, tokio::time::Instant::now() - tokio::time::Duration::from_secs(60));

                            loop {
                                interval.tick().await;
                                if stats_tx.is_closed() {
                                    break;
                                }

                                let is_running = if is_crun_for_stats {
                                    is_crun_active(&stats_target)
                                } else {
                                    is_docker_running(&stats_target).await
                                };

                                let current_status = if is_running { "running" } else { "offline" };

                                // Active state reconciliation: continuously broadcast status whenever state transitions
                                if last_status != Some(current_status) {
                                    last_status = Some(current_status);
                                    let status_msg = serde_json::json!({
                                        "event": "status",
                                        "args": [current_status]
                                    });
                                    if stats_tx.send(Message::Text(status_msg.to_string().into())).await.is_err() {
                                        break;
                                    }
                                }

                                if is_crun_for_stats {
                                    if is_running {
                                        // Read metrics directly from crun status file or crun state
                                        let direct_status = format!("/run/user/0/crun/{}/status", stats_target);
                                        let mut target_pid: Option<u64> = None;
                                        let mut created_dt_ms: Option<u64> = None;

                                        if let Ok(content) = tokio::fs::read_to_string(&direct_status).await {
                                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                                                target_pid = val.get("pid").and_then(|p| p.as_u64());
                                                if let Some(created_str) = val.get("created").and_then(|c| c.as_str()) {
                                                    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(created_str) {
                                                        let now_utc = chrono::Utc::now();
                                                        let dur = now_utc.signed_duration_since(dt.with_timezone(&chrono::Utc));
                                                        created_dt_ms = Some(dur.num_milliseconds().max(0) as u64);
                                                    }
                                                }
                                            }
                                        }

                                        if target_pid.is_none() {
                                            if let Ok(crun_state) = tokio::process::Command::new("crun")
                                                .args(["--root", "/run/user/0/crun", "state", &stats_target])
                                                .output()
                                                .await
                                            {
                                                if crun_state.status.success() {
                                                    let s = String::from_utf8_lossy(&crun_state.stdout);
                                                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&s) {
                                                        target_pid = val.get("pid").and_then(|p| p.as_u64());
                                                    }
                                                }
                                            }
                                        }

                                        // Collect all PIDs in container cgroup
                                        let mut cgroup_dir = format!("/sys/fs/cgroup/votion/{}", stats_target);
                                        if !std::path::Path::new(&cgroup_dir).is_dir() {
                                            cgroup_dir = format!("/sys/fs/cgroup/{}", stats_target);
                                        }
                                        if !std::path::Path::new(&cgroup_dir).is_dir() {
                                            if let Ok(entries) = std::fs::read_dir("/sys/fs/cgroup/votion") {
                                                for entry in entries.flatten() {
                                                    let name = entry.file_name().to_string_lossy().to_string();
                                                    if name.starts_with(&stats_target) {
                                                        let p = entry.path();
                                                        if p.is_dir() {
                                                            cgroup_dir = p.to_string_lossy().to_string();
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        if !std::path::Path::new(&cgroup_dir).is_dir() {
                                            if let Ok(entries) = std::fs::read_dir("/sys/fs/cgroup") {
                                                for entry in entries.flatten() {
                                                    let name = entry.file_name().to_string_lossy().to_string();
                                                    if name.starts_with(&stats_target) {
                                                        let p = entry.path();
                                                        if p.is_dir() {
                                                            cgroup_dir = p.to_string_lossy().to_string();
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        let mut cgroup_pids: Vec<u64> = Vec::new();
                                        if let Ok(procs_str) = tokio::fs::read_to_string(format!("{}/cgroup.procs", cgroup_dir)).await {
                                            for line in procs_str.lines() {
                                                if let Ok(p) = line.trim().parse::<u64>() {
                                                    cgroup_pids.push(p);
                                                }
                                            }
                                        }
                                        if cgroup_pids.is_empty() {
                                            if let Some(p) = target_pid {
                                                cgroup_pids.push(p);
                                            }
                                        }
                                        if target_pid.is_none() {
                                            target_pid = cgroup_pids.first().copied();
                                        }

                                        // 1. Memory usage
                                        let mut mem_bytes: u64 = 0;
                                        if let Ok(m_str) = tokio::fs::read_to_string(format!("{}/memory.current", cgroup_dir)).await {
                                            if let Ok(v) = m_str.trim().parse::<u64>() {
                                                mem_bytes = v;
                                            }
                                        }
                                        if mem_bytes == 0 {
                                            for pid in &cgroup_pids {
                                                if let Ok(st_str) = tokio::fs::read_to_string(format!("/proc/{}/status", pid)).await {
                                                    for line in st_str.lines() {
                                                        if line.starts_with("VmRSS:") {
                                                            let parts: Vec<&str> = line.split_whitespace().collect();
                                                            if let Some(kb) = parts.get(1).and_then(|k| k.parse::<u64>().ok()) {
                                                                mem_bytes += kb * 1024;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // Memory limit
                                        let mut mem_limit_bytes: u64 = 0;
                                        if let Ok(lim_str) = tokio::fs::read_to_string(format!("{}/memory.max", cgroup_dir)).await {
                                            if let Ok(v) = lim_str.trim().parse::<u64>() {
                                                mem_limit_bytes = v;
                                            }
                                        }

                                        // 2. CPU usage calculation (delta over elapsed microseconds)
                                        let mut current_cpu_usec: u64 = 0;
                                        if let Ok(cpu_stat) = tokio::fs::read_to_string(format!("{}/cpu.stat", cgroup_dir)).await {
                                            for line in cpu_stat.lines() {
                                                if line.starts_with("usage_usec") {
                                                    if let Some(u) = line.split_whitespace().nth(1).and_then(|x| x.parse::<u64>().ok()) {
                                                        current_cpu_usec = u;
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                        let now = tokio::time::Instant::now();
                                        let delta_time_us = now.duration_since(last_cpu_time).as_micros() as f64;
                                        let cpu_absolute = if last_cpu_usec > 0 && current_cpu_usec >= last_cpu_usec && delta_time_us > 0.0 {
                                            let delta_cpu_us = (current_cpu_usec - last_cpu_usec) as f64;
                                            let pct = (delta_cpu_us / delta_time_us) * 100.0;
                                            (pct * 10.0).round() / 10.0
                                        } else {
                                            0.0
                                        };
                                        last_cpu_usec = current_cpu_usec;
                                        last_cpu_time = now;

                                        // 3. Disk bytes (live cached volume size)
                                        let disk_bytes = get_server_disk_usage(&stats_target, &mut disk_cache).await;

                                        // 4. Uptime (milliseconds)
                                        let mut uptime_ms = created_dt_ms.unwrap_or(0);
                                        if uptime_ms == 0 {
                                            if let Some(pid) = target_pid {
                                                if let (Ok(stat_str), Ok(up_str)) = (
                                                    tokio::fs::read_to_string(format!("/proc/{}/stat", pid)).await,
                                                    tokio::fs::read_to_string("/proc/uptime").await,
                                                ) {
                                                    let sys_uptime_sec = up_str.split_whitespace().next().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                                                    let parts: Vec<&str> = stat_str.split_whitespace().collect();
                                                    if let Some(start_ticks) = parts.get(21).and_then(|t| t.parse::<f64>().ok()) {
                                                        let proc_uptime_sec = (sys_uptime_sec - (start_ticks / 100.0)).max(0.0);
                                                        uptime_ms = (proc_uptime_sec * 1000.0) as u64;
                                                    }
                                                }
                                            }
                                        }

                                        // 5. Network rx/tx
                                        let mut rx_bytes: u64 = 0;
                                        let mut tx_bytes: u64 = 0;
                                        let mut found_netns = false;
                                        if let Some(pid) = target_pid {
                                            if let Ok(net_dev) = tokio::fs::read_to_string(format!("/proc/{}/net/dev", pid)).await {
                                                for line in net_dev.lines() {
                                                    let parts: Vec<&str> = line.split_whitespace().collect();
                                                    if let Some(iface) = parts.get(0) {
                                                        if iface.starts_with("eth0") {
                                                            if let (Some(rx), Some(tx)) = (
                                                                parts.get(1).and_then(|x| x.parse::<u64>().ok()),
                                                                parts.get(9).and_then(|x| x.parse::<u64>().ok()),
                                                            ) {
                                                                rx_bytes = rx;
                                                                tx_bytes = tx;
                                                                found_netns = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        if !found_netns {
                                            for pid in &cgroup_pids {
                                                if let Ok(io_str) = tokio::fs::read_to_string(format!("/proc/{}/io", pid)).await {
                                                    for line in io_str.lines() {
                                                        if line.starts_with("rchar:") {
                                                            if let Some(v) = line.split_whitespace().nth(1).and_then(|x| x.parse::<u64>().ok()) {
                                                                rx_bytes += v;
                                                            }
                                                        } else if line.starts_with("wchar:") {
                                                            if let Some(v) = line.split_whitespace().nth(1).and_then(|x| x.parse::<u64>().ok()) {
                                                                tx_bytes += v;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        let stats_inner = serde_json::json!({
                                            "memory_bytes": mem_bytes,
                                            "memory_limit_bytes": mem_limit_bytes,
                                            "cpu_absolute": cpu_absolute,
                                            "network": { "rx_bytes": rx_bytes, "tx_bytes": tx_bytes },
                                            "state": "running",
                                            "disk_bytes": disk_bytes,
                                            "uptime": uptime_ms
                                        });
                                        let stats_msg = serde_json::json!({
                                            "event": "stats",
                                            "args": [stats_inner.to_string()]
                                        });
                                        let _ = stats_tx.send(Message::Text(stats_msg.to_string().into())).await;
                                    } else {
                                        let disk_bytes = get_server_disk_usage(&stats_target, &mut disk_cache).await;
                                        let stats_inner = serde_json::json!({
                                            "memory_bytes": 0,
                                            "memory_limit_bytes": 0,
                                            "cpu_absolute": 0.0,
                                            "network": { "rx_bytes": 0, "tx_bytes": 0 },
                                            "state": "offline",
                                            "disk_bytes": disk_bytes,
                                            "uptime": 0
                                        });
                                        let stats_msg = serde_json::json!({
                                            "event": "stats",
                                            "args": [stats_inner.to_string()]
                                        });
                                        let _ = stats_tx.send(Message::Text(stats_msg.to_string().into())).await;
                                    }
                                } else {
                                    // Docker stats
                                    if is_running {
                                        let mut cpu_val: f64 = 0.0;
                                        let mut mem_bytes: u64 = 0;
                                        let mut rx_bytes: u64 = 0;
                                        let mut tx_bytes: u64 = 0;

                                        if let Ok(output) = tokio::process::Command::new("docker")
                                            .args(["stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}", &stats_target])
                                            .output()
                                            .await
                                        {
                                            if output.status.success() {
                                                let s = String::from_utf8_lossy(&output.stdout);
                                                let parts: Vec<&str> = s.trim().split('|').collect();
                                                let cpu_str = parts.get(0).unwrap_or(&"0.0%").trim_end_matches('%');
                                                cpu_val = cpu_str.parse().unwrap_or(0.0);

                                                let mem_str = parts.get(1).unwrap_or(&"0MiB / 0MiB");
                                                mem_bytes = parse_mem_str(mem_str);

                                                if let Some(net_str) = parts.get(2) {
                                                    let (rx, tx) = parse_net_io(net_str);
                                                    rx_bytes = rx;
                                                    tx_bytes = tx;
                                                }
                                            }
                                        }

                                        let mut uptime_ms: u64 = 0;
                                        if let Ok(inspect_out) = tokio::process::Command::new("docker")
                                            .args(["inspect", "--format", "{{.State.StartedAt}}", &stats_target])
                                            .output()
                                            .await
                                        {
                                            if inspect_out.status.success() {
                                                let start_str = String::from_utf8_lossy(&inspect_out.stdout).trim().to_string();
                                                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&start_str) {
                                                    let now_utc = chrono::Utc::now();
                                                    let dur = now_utc.signed_duration_since(dt.with_timezone(&chrono::Utc));
                                                    uptime_ms = dur.num_milliseconds().max(0) as u64;
                                                }
                                            }
                                        }

                                        let disk_bytes = get_server_disk_usage(&stats_target, &mut disk_cache).await;

                                        let stats_inner = serde_json::json!({
                                            "memory_bytes": mem_bytes,
                                            "memory_limit_bytes": 0,
                                            "cpu_absolute": cpu_val,
                                            "network": { "rx_bytes": rx_bytes, "tx_bytes": tx_bytes },
                                            "state": "running",
                                            "disk_bytes": disk_bytes,
                                            "uptime": uptime_ms
                                        });
                                        let stats_msg = serde_json::json!({
                                            "event": "stats",
                                            "args": [stats_inner.to_string()]
                                        });
                                        if stats_tx.send(Message::Text(stats_msg.to_string().into())).await.is_err() {
                                            break;
                                        }
                                    } else {
                                        let disk_bytes = get_server_disk_usage(&stats_target, &mut disk_cache).await;
                                        let stats_inner = serde_json::json!({
                                            "memory_bytes": 0,
                                            "memory_limit_bytes": 0,
                                            "cpu_absolute": 0.0,
                                            "network": { "rx_bytes": 0, "tx_bytes": 0 },
                                            "state": "offline",
                                            "disk_bytes": disk_bytes,
                                            "uptime": 0
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

                            if is_crun_replay {
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

                                    let final_status = if is_crun_act {
                                        if act_name == "start" || act_name == "restart" {
                                            // Poll up to 5 seconds (25 * 200ms) for crun container to become active
                                            let mut active = false;
                                            for _ in 0..25 {
                                                if is_crun_active(&target_for_act) {
                                                    active = true;
                                                    break;
                                                }
                                                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                                            }
                                            if active { "running" } else { "offline" }
                                        } else {
                                            // For stop or kill, wait up to 3 seconds for it to cease
                                            for _ in 0..15 {
                                                if !is_crun_active(&target_for_act) {
                                                    break;
                                                }
                                                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                                            }
                                            if is_crun_active(&target_for_act) { "running" } else { "offline" }
                                        }
                                    } else {
                                        if act_name == "start" || act_name == "restart" {
                                            let mut active = false;
                                            for _ in 0..25 {
                                                if is_docker_running(&target_for_act).await {
                                                    active = true;
                                                    break;
                                                }
                                                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                                            }
                                            if active { "running" } else { "offline" }
                                        } else {
                                            "offline"
                                        }
                                    };
                                    let _ = action_tx.send(Message::Text(serde_json::json!({
                                        "event": "status",
                                        "args": [final_status]
                                    }).to_string().into())).await;

                                    if (act_name == "restart" || act_name == "start") && final_status == "running" {
                                        let success_banner = if is_crun_act {
                                            format!("\u{001b}[32;1m[votion-node]\u{001b}[0m CRUN container {} is running.\r\n", target_for_act)
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
                                            let child = tokio::process::Command::new("dtach")
                                                .args(["-p", &sock_path])
                                                .stdin(std::process::Stdio::piped())
                                                .spawn();
                                            if let Ok(mut ch) = child {
                                                if let Some(mut stdin) = ch.stdin.take() {
                                                    use tokio::io::AsyncWriteExt;
                                                    let _ = stdin.write_all(format!("{}\n", cmd_str).as_bytes()).await;
                                                    let _ = stdin.flush().await;
                                                    drop(stdin);
                                                }
                                                let _ = ch.wait().await;
                                            }
                                        } else {
                                            let _ = tokio::process::Command::new("crun")
                                                .env("XDG_RUNTIME_DIR", "/run/user/0")
                                                .args(["--root", "/run/user/0/crun", "exec", &target_for_cmd, "sh", "-c", &cmd_str])
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
