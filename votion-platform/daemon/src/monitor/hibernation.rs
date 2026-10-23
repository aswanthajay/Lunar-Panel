use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::info;

#[derive(Debug, Clone)]
pub struct ContainerHibernationPolicy {
    pub container_id: String,
    pub idle_timeout: Duration,
    pub grace_period: Duration,
    pub wake_on_packet: bool,
    pub listen_ports: Vec<u16>,
    pub is_frozen: bool,
    pub last_activity: Instant,
    pub active_connections: usize,
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

    /// Registers a container for zero-player network monitoring
    pub async fn register_container(
        &self,
        container_id: String,
        idle_timeout_seconds: u64,
        grace_period_seconds: u64,
        listen_ports: Vec<u16>,
        wake_on_packet: bool,
    ) {
        let policy = ContainerHibernationPolicy {
            container_id: container_id.clone(),
            idle_timeout: Duration::from_secs(idle_timeout_seconds),
            grace_period: Duration::from_secs(grace_period_seconds),
            wake_on_packet,
            listen_ports,
            is_frozen: false,
            last_activity: Instant::now(),
            active_connections: 0,
        };

        let mut lock = self.containers.write().await;
        lock.insert(container_id.clone(), policy);
        info!(
            "Registered container {} for Zero-Player Hibernation (timeout: {}s, wake_on_packet: {})",
            container_id, idle_timeout_seconds, wake_on_packet
        );
    }

    /// Unregisters container when stopped or destroyed
    pub async fn unregister_container(&self, container_id: &str) {
        let mut lock = self.containers.write().await;
        lock.remove(container_id);
    }

    /// Records traffic packet or player activity
    pub async fn record_activity(&self, container_id: &str) {
        let mut lock = self.containers.write().await;
        if let Some(policy) = lock.get_mut(container_id) {
            policy.last_activity = Instant::now();
            if policy.is_frozen {
                info!("Activity detected on sleeping container {}; triggering instant thaw", container_id);
                policy.is_frozen = false;
            }
        }
    }

    /// Updates active connection count
    pub async fn update_connection_count(&self, container_id: &str, count: usize) {
        let mut lock = self.containers.write().await;
        if let Some(policy) = lock.get_mut(container_id) {
            policy.active_connections = count;
            if count > 0 {
                policy.last_activity = Instant::now();
            }
        }
    }

    /// Periodic background tick checking for idle containers to freeze
    pub async fn check_hibernation_candidates<F>(&self, mut freeze_callback: F)
    where
        F: FnMut(&str, bool),
    {
        let mut lock = self.containers.write().await;
        let now = Instant::now();

        for (id, policy) in lock.iter_mut() {
            if !policy.is_frozen && policy.active_connections == 0 {
                let elapsed = now.duration_since(policy.last_activity);
                if elapsed >= (policy.idle_timeout + policy.grace_period) {
                    info!(
                        "Container {} has been idle for {:?}. Freezing cgroups v2 (Hibernating)...",
                        id, elapsed
                    );
                    policy.is_frozen = true;
                    freeze_callback(id, true);
                }
            }
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
}
