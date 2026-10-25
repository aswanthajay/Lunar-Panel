use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::info;

use crate::runtime::cgroups::CgroupsV2Manager;

#[derive(Debug, Clone)]
pub struct ContainerHibernationPolicy {
    pub container_id: String,
    pub enabled: bool,
    pub idle_timeout: Duration,
    pub is_frozen: bool,
    pub last_activity: Instant,
    pub active_connections: usize,
    pub last_rx_packets: u64,
}

pub struct HibernationManager {
    containers: Arc<RwLock<HashMap<String, ContainerHibernationPolicy>>>,
}

impl HibernationManager {
    pub fn new() -> Self {
        Self {
            containers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Registers a container for Autonomous Zero-Player Hibernation (default 15 minutes = 900s)
    /// NOTE: Autonomous Zero-Player Hibernation is strictly reserved for Minecraft servers.
    pub async fn register_container(
        &self,
        container_id: String,
        idle_timeout_seconds: u64,
        _grace_period_seconds: u64,
        _listen_ports: Vec<u16>,
        _wake_on_packet: bool,
    ) {
        if !is_minecraft_server(&container_id) {
            info!(
                "Skipping Autonomous Zero-Player Hibernation for non-Minecraft container {} (hibernation is exclusive to Minecraft servers)",
                container_id
            );
            return;
        }

        let timeout_secs = if idle_timeout_seconds == 0 { 900 } else { idle_timeout_seconds };
        let short_id: String = container_id.chars().take(8).collect();
        let initial_rx = read_veth_rx_packets(&short_id);
        let enabled = is_hibernation_enabled_on_disk(&container_id);

        let policy = ContainerHibernationPolicy {
            container_id: container_id.clone(),
            enabled,
            idle_timeout: Duration::from_secs(timeout_secs),
            is_frozen: false,
            last_activity: Instant::now(),
            active_connections: 0,
            last_rx_packets: initial_rx,
        };

        let mut lock = self.containers.write().await;
        lock.insert(container_id.clone(), policy);
        info!(
            "Registered Minecraft container {} for Autonomous Zero-Player Hibernation (enabled: {}, timeout: {}s, wake-on-packet active)",
            container_id, enabled, timeout_secs
        );
    }

    pub async fn register_container_simple(&self, container_id: String, idle_timeout_seconds: u64) {
        self.register_container(container_id, idle_timeout_seconds, 0, Vec::new(), true).await;
    }

    /// Enables or disables Autonomous Zero-Player Hibernation for a specific container
    pub async fn set_enabled(&self, container_id: &str, enabled: bool, cgroups: &CgroupsV2Manager) {
        if enabled && !is_minecraft_server(container_id) {
            info!(
                "Ignored request to enable Autonomous Zero-Player Hibernation for container {} - hibernation is exclusive to Minecraft servers",
                container_id
            );
            return;
        }

        let mut lock = self.containers.write().await;
        if let Some(policy) = lock.get_mut(container_id) {
            policy.enabled = enabled;
            if !enabled && policy.is_frozen {
                policy.is_frozen = false;
                policy.last_activity = Instant::now();
                let _ = cgroups.set_frozen(container_id, false);
                info!(
                    "Autonomous Zero-Player Hibernation disabled for container {}; unfroze cgroup immediately",
                    container_id
                );
            }
        } else {
            let short_id: String = container_id.chars().take(8).collect();
            let initial_rx = read_veth_rx_packets(&short_id);
            lock.insert(container_id.to_string(), ContainerHibernationPolicy {
                container_id: container_id.to_string(),
                enabled,
                idle_timeout: Duration::from_secs(900),
                is_frozen: false,
                last_activity: Instant::now(),
                active_connections: 0,
                last_rx_packets: initial_rx,
            });
        }

        persist_hibernation_setting(container_id, enabled);
        info!(
            "Updated Autonomous Zero-Player Hibernation for container {}: enabled={}",
            container_id, enabled
        );
    }

    /// Returns current hibernation status: (enabled, is_frozen, active_connections)
    pub async fn get_status(&self, container_id: &str) -> (bool, bool, usize) {
        let lock = self.containers.read().await;
        if let Some(policy) = lock.get(container_id) {
            (policy.enabled, policy.is_frozen, policy.active_connections)
        } else {
            let enabled = is_hibernation_enabled_on_disk(container_id);
            (enabled, false, 0)
        }
    }

    /// Unregisters container when stopped or destroyed
    pub async fn unregister_container(&self, container_id: &str) {
        let mut lock = self.containers.write().await;
        lock.remove(container_id);
    }

    /// Records player activity or connection packet
    pub async fn record_activity(&self, container_id: &str) {
        let mut lock = self.containers.write().await;
        if let Some(policy) = lock.get_mut(container_id) {
            policy.last_activity = Instant::now();
            policy.is_frozen = false;
        }
    }

    pub async fn is_hibernating(&self, container_id: &str) -> bool {
        let lock = self.containers.read().await;
        lock.get(container_id).map(|p| p.is_frozen).unwrap_or(false)
    }

    pub async fn set_hibernating(&self, container_id: &str, freeze: bool) {
        let mut lock = self.containers.write().await;
        if let Some(policy) = lock.get_mut(container_id) {
            policy.is_frozen = freeze;
            if !freeze {
                policy.last_activity = Instant::now();
            }
        }
    }

    /// Periodic background tick checking for idle containers to freeze.
    /// Strictly ignores and unfreezes non-Minecraft containers.
    pub async fn check_hibernation_candidates<F>(&self, mut freeze_callback: F)
    where
        F: FnMut(&str, bool),
    {
        let mut lock = self.containers.write().await;
        let now = Instant::now();

        for (id, policy) in lock.iter_mut() {
            // Autonomous Zero-Player Hibernation is strictly reserved for Minecraft
            if !is_minecraft_server(id) {
                if policy.enabled {
                    policy.enabled = false;
                }
                if policy.is_frozen {
                    policy.is_frozen = false;
                    freeze_callback(id, false);
                    info!("Unfroze non-Minecraft container {} as hibernation is exclusive to Minecraft servers", id);
                }
                continue;
            }

            if policy.enabled && !policy.is_frozen && policy.active_connections == 0 {
                let elapsed = now.duration_since(policy.last_activity);
                if elapsed >= policy.idle_timeout {
                    info!(
                        "Autonomous Zero-Player Hibernation: Minecraft container {} has had 0 players for {:?}. Freezing cgroups v2...",
                        id, elapsed
                    );
                    policy.is_frozen = true;
                    freeze_callback(id, true);
                }
            }
        }
    }

    /// Starts the background Zero-Player Network Monitor and Wake-on-Packet Engine
    pub fn start_autonomous_hibernation_engine(
        self: &Arc<Self>,
        cgroups: Arc<CgroupsV2Manager>,
    ) {
        info!("Starting Autonomous Zero-Player Hibernation engine with Wake-on-Packet...");

        let mgr_clone1 = Arc::clone(self);
        let cg_clone1 = Arc::clone(&cgroups);

        // 1. Connection Audit & Auto-Hibernation Task (runs every 10 seconds)
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(10));
            loop {
                interval.tick().await;

                // Auto-register active running crun containers (Minecraft only)
                #[cfg(target_os = "linux")]
                {
                    if let Ok(entries) = fs::read_dir("/var/lib/votion/containers") {
                        let mut lock = mgr_clone1.containers.write().await;
                        for entry in entries.flatten() {
                            if let Ok(ft) = entry.file_type() {
                                if ft.is_dir() {
                                    let uuid = entry.file_name().to_string_lossy().to_string();

                                    // Non-Minecraft containers must NEVER hibernate
                                    if !is_minecraft_server(&uuid) {
                                        if let Some(p) = lock.get_mut(&uuid) {
                                            p.enabled = false;
                                            if p.is_frozen {
                                                p.is_frozen = false;
                                                let _ = cg_clone1.set_frozen(&uuid, false);
                                                info!("Thawed non-Minecraft container {} (hibernation is exclusive to Minecraft)", uuid);
                                            }
                                        }
                                        continue;
                                    }

                                    if !lock.contains_key(&uuid) {
                                        let enabled = is_hibernation_enabled_on_disk(&uuid);
                                        let short_id: String = uuid.chars().take(8).collect();
                                        let rx = read_veth_rx_packets(&short_id);
                                        lock.insert(
                                            uuid.clone(),
                                            ContainerHibernationPolicy {
                                                container_id: uuid.clone(),
                                                enabled,
                                                idle_timeout: Duration::from_secs(900),
                                                is_frozen: false,
                                                last_activity: Instant::now(),
                                                active_connections: 0,
                                                last_rx_packets: rx,
                                            },
                                        );
                                        info!(
                                            "Auto-registered active Minecraft container {} for Autonomous Zero-Player Hibernation (enabled: {})",
                                            uuid, enabled
                                        );
                                    }
                                }
                            }
                        }
                    }
                }

                // Audit player connections for each container
                {
                    let mut lock = mgr_clone1.containers.write().await;
                    for (id, policy) in lock.iter_mut() {
                        if !policy.enabled {
                            continue;
                        }

                        let active_conns = count_container_established_conns(id, &cg_clone1);
                        policy.active_connections = active_conns;

                        if active_conns > 0 {
                            policy.last_activity = Instant::now();
                            if policy.is_frozen {
                                info!("Active player connection detected on frozen Minecraft container {}; thawing instantly", id);
                                policy.is_frozen = false;
                                let _ = cg_clone1.set_frozen(id, false);
                            }
                        }
                    }
                }

                // Freeze idle containers (>15 minutes)
                let cg_freeze = Arc::clone(&cg_clone1);
                mgr_clone1.check_hibernation_candidates(move |container_id, freeze| {
                    let _ = cg_freeze.set_frozen(container_id, freeze);
                }).await;
            }
        });

        // 2. High-Frequency Wake-on-Packet Sniffer Task (runs every 100ms)
        let mgr_clone2 = Arc::clone(self);
        let cg_clone2 = Arc::clone(&cgroups);

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(100));
            loop {
                interval.tick().await;

                let mut to_thaw: Vec<String> = Vec::new();

                {
                    let mut lock = mgr_clone2.containers.write().await;
                    for (id, policy) in lock.iter_mut() {
                        if policy.is_frozen {
                            let short_id: String = id.chars().take(8).collect();
                            let current_rx = read_veth_rx_packets(&short_id);

                            if current_rx > policy.last_rx_packets {
                                info!(
                                    "Inbound packet sniffed on veth for frozen container {} (rx {} -> {}). Waking instantaneously (<200ms)!",
                                    id, policy.last_rx_packets, current_rx
                                );
                                policy.is_frozen = false;
                                policy.last_activity = Instant::now();
                                policy.last_rx_packets = current_rx;
                                to_thaw.push(id.clone());
                            } else {
                                policy.last_rx_packets = current_rx;
                            }
                        }
                    }
                }

                for id in to_thaw {
                    let _ = cg_clone2.set_frozen(&id, false);
                }
            }
        });
    }
}

/// Checks whether hibernation is enabled for container from persistent disk files.
/// Strictly returns false if the container is not a Minecraft server.
pub fn is_hibernation_enabled_on_disk(container_id: &str) -> bool {
    // Autonomous Zero-Player Hibernation is strictly reserved for Minecraft servers
    if !is_minecraft_server(container_id) {
        return false;
    }

    let bundle_file = format!("/var/lib/votion/containers/{}/hibernation.json", container_id);
    if let Ok(content) = fs::read_to_string(&bundle_file) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(en) = val.get("enabled").and_then(|v| v.as_bool()) {
                return en;
            }
        }
    }

    let etc_file = format!("/etc/votion/hibernation/{}.json", container_id);
    if let Ok(content) = fs::read_to_string(&etc_file) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(en) = val.get("enabled").and_then(|v| v.as_bool()) {
                return en;
            }
        }
    }

    true // Default enabled for Minecraft instances
}

/// Determines whether a container/server is a Minecraft instance.
/// Checks the server filesystem volume, bundle configuration environment, and image metadata.
pub fn is_minecraft_server(container_id: &str) -> bool {
    let clean_id = container_id.trim();
    if clean_id.is_empty() {
        return false;
    }

    // 1. Check server volume directory on host
    let vol_dirs = [
        format!("/var/lib/pterodactyl/volumes/{}", clean_id),
        format!("/var/lib/votion/volumes/{}", clean_id),
    ];
    for vol in &vol_dirs {
        let p = std::path::Path::new(vol);
        if p.is_dir() {
            if p.join("server.properties").exists()
                || p.join("spigot.yml").exists()
                || p.join("paper.yml").exists()
                || p.join("purpur.yml").exists()
                || p.join("bungeecord.yml").exists()
                || p.join("velocity.toml").exists()
                || p.join("eula.txt").exists()
                || p.join("bedrock_server").exists()
                || p.join("server.jar").exists()
                || p.join("paper.jar").exists()
                || p.join("purpur.jar").exists()
            {
                return true;
            }
        }
    }

    // 1b. Check prefix matching in volumes if UUID is short (>= 8 chars)
    if clean_id.len() >= 8 {
        if let Ok(entries) = fs::read_dir("/var/lib/pterodactyl/volumes") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with(clean_id) || clean_id.starts_with(&name) {
                    let p = entry.path();
                    if p.join("server.properties").exists()
                        || p.join("spigot.yml").exists()
                        || p.join("paper.yml").exists()
                        || p.join("purpur.yml").exists()
                        || p.join("bungeecord.yml").exists()
                        || p.join("velocity.toml").exists()
                        || p.join("eula.txt").exists()
                        || p.join("bedrock_server").exists()
                        || p.join("server.jar").exists()
                        || p.join("paper.jar").exists()
                        || p.join("purpur.jar").exists()
                    {
                        return true;
                    }
                }
            }
        }
    }

    // 2. Check OCI bundle config.json environment variables and image
    let config_path = format!("/var/lib/votion/containers/{}/config.json", clean_id);
    if let Ok(content) = fs::read_to_string(&config_path) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(envs) = val.pointer("/process/env").and_then(|v| v.as_array()) {
                for env in envs {
                    if let Some(s) = env.as_str() {
                        let upper = s.to_uppercase();
                        if upper.starts_with("SERVER_JARFILE=")
                            || upper.starts_with("MINECRAFT_VERSION=")
                            || upper.starts_with("VANILLA_VERSION=")
                            || upper.starts_with("BEDROCK_VERSION=")
                            || upper.starts_with("FABRIC_VERSION=")
                            || upper.starts_with("FORGE_VERSION=")
                            || upper.starts_with("NEOFORGE_VERSION=")
                            || upper.starts_with("BUNGEE_VERSION=")
                            || upper.starts_with("VELOCITY_VERSION=")
                            || upper.starts_with("SPONGE_VERSION=")
                            || upper.starts_with("PAPER_VERSION=")
                            || upper.starts_with("PURPUR_VERSION=")
                        {
                            return true;
                        }
                    }
                }
            }
            if let Some(img) = val.pointer("/annotations/org.opencontainers.image.name").and_then(|v| v.as_str()) {
                let lower = img.to_lowercase();
                if lower.contains("minecraft") || lower.contains("paper") || lower.contains("purpur") || lower.contains("bedrock") {
                    return true;
                }
            }
        }
    }

    // 3. Check wings/pterodactyl server configuration if present
    let server_cfg = format!("/var/lib/pterodactyl/containers/{}.json", clean_id);
    if let Ok(content) = fs::read_to_string(&server_cfg) {
        let lower = content.to_lowercase();
        if lower.contains("minecraft") || lower.contains("server.properties") {
            return true;
        }
    }

    false
}

/// Persists hibernation enabled state to disk
pub fn persist_hibernation_setting(container_id: &str, enabled: bool) {
    let payload = serde_json::json!({
        "container_id": container_id,
        "enabled": enabled,
        "updated_at": chrono::Utc::now().to_rfc3339()
    });

    let bundle_file = format!("/var/lib/votion/containers/{}/hibernation.json", container_id);
    if let Some(parent) = std::path::Path::new(&bundle_file).parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&bundle_file, payload.to_string());

    let _ = fs::create_dir_all("/etc/votion/hibernation");
    let etc_file = format!("/etc/votion/hibernation/{}.json", container_id);
    let _ = fs::write(&etc_file, payload.to_string());
}

/// Reads rx_packets from sysfs for the container veth interface
fn read_veth_rx_packets(short_id: &str) -> u64 {
    #[cfg(target_os = "linux")]
    {
        let veth_stat = format!("/sys/class/net/veth_h_{}/statistics/rx_packets", short_id);
        if let Ok(content) = fs::read_to_string(&veth_stat) {
            if let Ok(v) = content.trim().parse::<u64>() {
                return v;
            }
        }
    }
    0
}

/// Counts established TCP connections (state 01) inside container network namespace
fn count_container_established_conns(container_id: &str, cgroups: &CgroupsV2Manager) -> usize {
    #[cfg(target_os = "linux")]
    {
        if let Some(dir) = cgroups.find_container_cgroup_dir(container_id) {
            if let Ok(procs_str) = fs::read_to_string(dir.join("cgroup.procs")) {
                if let Some(first_pid) = procs_str.lines().next().and_then(|l| l.trim().parse::<u64>().ok()) {
                    let mut total = 0;
                    for f in ["/proc", &format!("/proc/{}", first_pid)] {
                        let tcp_path = format!("{}/net/tcp", f);
                        if let Ok(content) = fs::read_to_string(tcp_path) {
                            for line in content.lines().skip(1) {
                                let parts: Vec<&str> = line.split_whitespace().collect();
                                // parts[3] is connection state: "01" is TCP_ESTABLISHED
                                if parts.get(3).copied() == Some("01") {
                                    total += 1;
                                }
                            }
                        }
                    }
                    return total;
                }
            }
        }
    }
    0
}
