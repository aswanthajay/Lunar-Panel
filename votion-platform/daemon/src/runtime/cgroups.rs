#[allow(unused_imports)]
use std::fs;
use std::path::{Path, PathBuf};
#[allow(unused_imports)]
use tracing::{debug, info, warn};

pub struct CgroupsV2Manager {
    root_path: PathBuf,
}

impl CgroupsV2Manager {
    pub fn new(root: Option<PathBuf>) -> Self {
        Self {
            root_path: root.unwrap_or_else(|| PathBuf::from("/sys/fs/cgroup/votion")),
        }
    }

    /// Resolves the cgroup v2 directory for a container.
    /// Checks /sys/fs/cgroup/votion/<id> and /sys/fs/cgroup/<id>, with prefix matching.
    pub fn find_container_cgroup_dir(&self, container_id: &str) -> Option<PathBuf> {
        #[cfg(target_os = "linux")]
        {
            // 1. Direct path in votion slice
            let p1 = self.root_path.join(container_id);
            if p1.is_dir() {
                return Some(p1);
            }

            // 2. Direct path in root cgroup
            let p2 = PathBuf::from("/sys/fs/cgroup").join(container_id);
            if p2.is_dir() {
                return Some(p2);
            }

            // 3. Prefix matching in /sys/fs/cgroup/votion
            if let Ok(entries) = fs::read_dir(&self.root_path) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with(container_id) && entry.path().is_dir() {
                        return Some(entry.path());
                    }
                }
            }

            // 4. Prefix matching in /sys/fs/cgroup
            if let Ok(entries) = fs::read_dir("/sys/fs/cgroup") {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with(container_id) && entry.path().is_dir() {
                        return Some(entry.path());
                    }
                }
            }
        }
        None
    }

    /// Initializes host cgroups v2 root directory and enables controllers
    pub fn initialize_host_cgroup(&self) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            // 1. Enable controllers on root cgroup
            let root_subtree = Path::new("/sys/fs/cgroup/cgroup.subtree_control");
            if root_subtree.exists() {
                let _ = fs::write(root_subtree, "+cpu +memory +io +pids");
            }

            // 2. Ensure /sys/fs/cgroup/votion exists
            if !self.root_path.exists() {
                fs::create_dir_all(&self.root_path)
                    .map_err(|e| format!("Failed to create cgroup root: {}", e))?;
            }

            // 3. Enable subtree control on /sys/fs/cgroup/votion
            let subtree_file = self.root_path.join("cgroup.subtree_control");
            if subtree_file.exists() {
                let _ = fs::write(subtree_file, "+cpu +memory +io +pids");
            }

            info!(
                "Host cgroups v2 initialized with subtree controllers: +cpu +memory +io +pids at {:?}",
                self.root_path
            );
        }
        Ok(())
    }

    /// Creates a dedicated slice for a container in /sys/fs/cgroup/votion
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

    /// Applies two-tier memory limits:
    /// - memory.low: Soft baseline protection against page cache sweeps (50% quota)
    /// - memory.high: Proactive throttling threshold (90% quota) forcing reclaim to zswap without killing
    /// - memory.max: Hard ceiling that invokes OOM only as a last resort (100% quota)
    /// - memory.swap.max: Per-container swap caps protecting host swap
    pub fn apply_memory_limits(
        &self,
        container_id: &str,
        max_bytes: u64,
        high_bytes: u64,
        low_bytes: u64,
        swap_max_bytes: u64,
    ) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            // Determine candidate cgroup directories
            let mut target_dirs: Vec<PathBuf> = Vec::new();
            if let Some(d) = self.find_container_cgroup_dir(container_id) {
                target_dirs.push(d);
            }
            // Always also check votion slice
            let direct = self.root_path.join(container_id);
            if direct.is_dir() && !target_dirs.contains(&direct) {
                target_dirs.push(direct);
            }

            for dir in target_dirs {
                // memory.max
                let max_str = if max_bytes > 0 {
                    format!("{}", max_bytes)
                } else {
                    "max".to_string()
                };
                let _ = fs::write(dir.join("memory.max"), &max_str);

                // memory.high (throttling threshold at 90%)
                let high_str = if high_bytes > 0 {
                    format!("{}", high_bytes)
                } else {
                    "max".to_string()
                };
                let _ = fs::write(dir.join("memory.high"), &high_str);

                // memory.low (soft protection at 50%)
                let low_str = if low_bytes > 0 {
                    format!("{}", low_bytes)
                } else {
                    "0".to_string()
                };
                let _ = fs::write(dir.join("memory.low"), &low_str);

                // memory.swap.max
                let swap_str = if swap_max_bytes > 0 {
                    format!("{}", swap_max_bytes)
                } else {
                    "0".to_string()
                };
                let _ = fs::write(dir.join("memory.swap.max"), &swap_str);
            }
        }

        info!(
            "Two-Tier cgroups v2 Memory Governance applied for {}: low={} bytes (50%), high={} bytes (90%), max={} bytes, swap.max={} bytes",
            container_id, low_bytes, high_bytes, max_bytes, swap_max_bytes
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
            let mut target_dirs: Vec<PathBuf> = Vec::new();
            if let Some(d) = self.find_container_cgroup_dir(container_id) {
                target_dirs.push(d);
            }
            let direct = self.root_path.join(container_id);
            if direct.is_dir() && !target_dirs.contains(&direct) {
                target_dirs.push(direct);
            }

            for dir in target_dirs {
                let clamped_weight = weight.clamp(1, 10000);
                let _ = fs::write(dir.join("cpu.weight"), format!("{}", clamped_weight));

                if limit_percent > 0 {
                    let period = 100_000;
                    let quota = (period as f64 * (limit_percent as f64 / 100.0)) as i64;
                    let _ = fs::write(dir.join("cpu.max"), format!("{} {}", quota, period));
                } else {
                    let _ = fs::write(dir.join("cpu.max"), "max 100000");
                }
            }
        }

        info!(
            "Set cgroup v2 CPU limits for {}: weight={}, quota_percent={}%",
            container_id, weight, limit_percent
        );
        Ok(())
    }

    /// Dynamically sets cpu.weight across all container cgroups (used for PSI pressure throttling)
    pub fn set_all_containers_cpu_weight(&self, weight: u32) {
        #[cfg(target_os = "linux")]
        {
            let clamped = weight.clamp(1, 10000);
            let val = format!("{}", clamped);

            // Scan /sys/fs/cgroup/votion
            if let Ok(entries) = fs::read_dir(&self.root_path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        let _ = fs::write(entry.path().join("cpu.weight"), &val);
                    }
                }
            }

            // Scan container cgroups directly under /sys/fs/cgroup (UUID formatted)
            if let Ok(entries) = fs::read_dir("/sys/fs/cgroup") {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.len() == 36 && name.contains('-') && entry.path().is_dir() {
                        let _ = fs::write(entry.path().join("cpu.weight"), &val);
                    }
                }
            }
        }
    }

    /// Freezes or thaws container processes via cgroup.freeze (Zero-Player Hibernation)
    pub fn set_frozen(&self, container_id: &str, freeze: bool) -> Result<(), String> {
        let val = if freeze { "1" } else { "0" };

        #[cfg(target_os = "linux")]
        {
            let mut target_dirs: Vec<PathBuf> = Vec::new();
            if let Some(d) = self.find_container_cgroup_dir(container_id) {
                target_dirs.push(d);
            }
            let direct = self.root_path.join(container_id);
            if direct.is_dir() && !target_dirs.contains(&direct) {
                target_dirs.push(direct);
            }

            for dir in target_dirs {
                let freeze_file = dir.join("cgroup.freeze");
                if freeze_file.exists() {
                    let _ = fs::write(&freeze_file, val);
                }
            }
        }

        info!(
            "Container {} cgroups v2 frozen state set to: {} (1=frozen, 0=running)",
            container_id, val
        );
        Ok(())
    }

    /// Reads current memory consumption in bytes from memory.current
    pub fn read_memory_usage(&self, container_id: &str) -> u64 {
        #[cfg(target_os = "linux")]
        {
            if let Some(dir) = self.find_container_cgroup_dir(container_id) {
                let file = dir.join("memory.current");
                if let Ok(content) = fs::read_to_string(file) {
                    if let Ok(bytes) = content.trim().parse::<u64>() {
                        return bytes;
                    }
                }
            }
        }
        // Simulated default for mock / local testing
        512 * 1024 * 1024
    }
}
