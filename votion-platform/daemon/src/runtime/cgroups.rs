#[allow(unused_imports)]
use std::fs;
use std::path::PathBuf;
#[allow(unused_imports)]
use tracing::{debug, info, warn};

pub struct CgroupsV2Manager {
    #[allow(dead_code)]
    root_path: PathBuf,
}

impl CgroupsV2Manager {
    pub fn new(root: Option<PathBuf>) -> Self {
        Self {
            root_path: root.unwrap_or_else(|| PathBuf::from("/sys/fs/cgroup/votion")),
        }
    }

    /// Initializes host cgroups v2 root directory and enables controllers
    pub fn initialize_host_cgroup(&self) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            if !self.root_path.exists() {
                fs::create_dir_all(&self.root_path)
                    .map_err(|e| format!("Failed to create cgroup root: {}", e))?;
            }

            // Enable subtree control for cpu and memory
            let subtree_file = self.root_path.join("cgroup.subtree_control");
            if subtree_file.exists() {
                let _ = fs::write(subtree_file, "+cpu +memory +io");
            }
        }
        Ok(())
    }

    /// Creates a dedicated slice for a container
    pub fn create_container_cgroup(&self, container_id: &str) -> Result<PathBuf, String> {
        let path = self.root_path.join(container_id);

        #[cfg(target_os = "linux")]
        {
            if !path.exists() {
                fs::create_dir_all(&path)
                    .map_err(|e| format!("Failed to create container cgroup: {}", e))?;
            }
        }

        debug!("Initialized cgroup v2 for container {} at {:?}", container_id, path);
        Ok(path)
    }

    /// Applies memory limits: memory.max and memory.high
    pub fn apply_memory_limits(
        &self,
        container_id: &str,
        max_bytes: u64,
        high_bytes: u64,
        _swap_bytes: u64,
    ) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            let cgroup_dir = self.root_path.join(container_id);
            if cgroup_dir.exists() {
                let _ = fs::write(cgroup_dir.join("memory.max"), format!("{}", max_bytes));
                if high_bytes > 0 {
                    let _ = fs::write(cgroup_dir.join("memory.high"), format!("{}", high_bytes));
                }
                let _ = fs::write(cgroup_dir.join("memory.swap.max"), format!("{}", _swap_bytes));
            }
        }

        info!(
            "Set cgroup v2 memory limits for {}: max={} bytes, high={} bytes",
            container_id, max_bytes, high_bytes
        );
        Ok(())
    }

    /// Applies CPU weight (1 - 10000) and CPU quota
    pub fn apply_cpu_limits(
        &self,
        container_id: &str,
        weight: u32,
        limit_percent: u32,
    ) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            let cgroup_dir = self.root_path.join(container_id);
            if cgroup_dir.exists() {
                let clamped_weight = weight.clamp(1, 10000);
                let _ = fs::write(cgroup_dir.join("cpu.weight"), format!("{}", clamped_weight));

                if limit_percent > 0 {
                    let period = 100_000;
                    let quota = (period as f64 * (limit_percent as f64 / 100.0)) as i64;
                    let _ = fs::write(cgroup_dir.join("cpu.max"), format!("{} {}", quota, period));
                } else {
                    let _ = fs::write(cgroup_dir.join("cpu.max"), "max 100000");
                }
            }
        }

        info!(
            "Set cgroup v2 CPU limits for {}: weight={}, quota_percent={}%",
            container_id, weight, limit_percent
        );
        Ok(())
    }

    /// Freezes or thaws container processes via cgroup.freeze (Zero-Player Hibernation)
    pub fn set_frozen(&self, container_id: &str, freeze: bool) -> Result<(), String> {
        let val = if freeze { "1" } else { "0" };

        #[cfg(target_os = "linux")]
        {
            let cgroup_dir = self.root_path.join(container_id);
            let freeze_file = cgroup_dir.join("cgroup.freeze");
            if freeze_file.exists() {
                fs::write(freeze_file, val)
                    .map_err(|e| format!("Failed to write cgroup.freeze: {}", e))?;
            }
        }

        info!(
            "Container {} cgroups v2 frozen state set to: {} (1=frozen, 0=running)",
            container_id, val
        );
        Ok(())
    }

    /// Reads current memory consumption in bytes from memory.current
    pub fn read_memory_usage(&self, _container_id: &str) -> u64 {
        #[cfg(target_os = "linux")]
        {
            let file = self.root_path.join(_container_id).join("memory.current");
            if let Ok(content) = fs::read_to_string(file) {
                if let Ok(bytes) = content.trim().parse::<u64>() {
                    return bytes;
                }
            }
        }
        // Simulated default for mock / local testing
        512 * 1024 * 1024
    }
}
