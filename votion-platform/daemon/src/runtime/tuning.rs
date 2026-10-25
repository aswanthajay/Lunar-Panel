#[allow(unused_imports)]
use std::fs;
use tracing::{info, warn};

/// Initializes In-Kernel Compressed Swap (zswap with zstd & z3fold)
/// and Host Storage Kernel Tuning (vm.swappiness=120, dirty ratios, vfs_cache_pressure)
pub async fn init_low_end_hardware_and_swap_tuning() {
    #[cfg(target_os = "linux")]
    {
        info!("=======================================================");
        info!("   INIT: LOW-END HARDWARE & SWAP STABILITY ENGINE");
        info!("=======================================================");

        // 1. Load kernel modules for zswap compression
        for module in ["zstd", "z3fold"] {
            match tokio::process::Command::new("modprobe").arg(module).status().await {
                Ok(status) if status.success() => {
                    info!("Kernel module loaded: {}", module);
                }
                Ok(status) => {
                    warn!("modprobe {} exited with status {:?}", module, status);
                }
                Err(e) => {
                    warn!("Failed to execute modprobe {}: {}", module, e);
                }
            }
        }

        // 2. Configure In-Kernel Compressed Swap (zswap)
        // Some kernels require zswap to be toggled off before changing pool or compressor
        let zswap_base = "/sys/module/zswap/parameters";
        if std::path::Path::new(zswap_base).exists() {
            let _ = fs::write(format!("{}/enabled", zswap_base), "0");
            
            // Try z3fold allocator; fallback to zbud if z3fold is not available
            if fs::write(format!("{}/zpool", zswap_base), "z3fold").is_err() {
                warn!("z3fold pool not accepted, falling back to zbud");
                let _ = fs::write(format!("{}/zpool", zswap_base), "zbud");
            }
            
            // Try zstd compressor; fallback to lz4 if zstd not available
            if fs::write(format!("{}/compressor", zswap_base), "zstd").is_err() {
                warn!("zstd compressor not accepted, falling back to lz4");
                let _ = fs::write(format!("{}/compressor", zswap_base), "lz4");
            }

            // Set max pool percent to 30% of total physical RAM
            let _ = fs::write(format!("{}/max_pool_percent", zswap_base), "30");

            // Re-enable zswap
            let _ = fs::write(format!("{}/enabled", zswap_base), "1");

            let enabled = fs::read_to_string(format!("{}/enabled", zswap_base)).unwrap_or_default();
            let pool = fs::read_to_string(format!("{}/zpool", zswap_base)).unwrap_or_default();
            let comp = fs::read_to_string(format!("{}/compressor", zswap_base)).unwrap_or_default();
            let max_pool = fs::read_to_string(format!("{}/max_pool_percent", zswap_base)).unwrap_or_default();

            info!(
                "In-Kernel Compressed Swap (zswap) active: enabled={}, compressor={}, zpool={}, max_pool_percent={}%",
                enabled.trim(), comp.trim(), pool.trim(), max_pool.trim()
            );
        } else {
            warn!("zswap parameters path not found: {}", zswap_base);
        }

        // 3. Host Storage Kernel Tuning
        // - vm.swappiness = 120 (proactively pages cold data to zswap early)
        // - vm.dirty_background_ratio = 4 & vm.dirty_ratio = 10 (prevents dirty bursts from locking up slow SATA/HDDs)
        // - vm.vfs_cache_pressure = 50 (protects directory and inode caches)
        let sysctls = [
            ("/proc/sys/vm/swappiness", "120"),
            ("/proc/sys/vm/dirty_background_ratio", "4"),
            ("/proc/sys/vm/dirty_ratio", "10"),
            ("/proc/sys/vm/vfs_cache_pressure", "50"),
        ];

        for (path, val) in sysctls {
            if let Err(e) = fs::write(path, val) {
                warn!("Failed writing {} to {}: {}", val, path, e);
            }
        }

        info!("Host Storage Kernel Tuning applied: swappiness=120, dirty_bg=4%, dirty=10%, vfs_cache_pressure=50");

        // 4. Persist tuning to disk so settings survive host reboot
        let sysctl_conf = "# Votion Low-End Hardware & Swap Stability Tuning\n\
vm.swappiness=120\n\
vm.dirty_background_ratio=4\n\
vm.dirty_ratio=10\n\
vm.vfs_cache_pressure=50\n";
        let _ = tokio::fs::write("/etc/sysctl.d/99-votion-storage.conf", sysctl_conf).await;

        let mod_conf = "zstd\nz3fold\n";
        let _ = tokio::fs::write("/etc/modules-load.d/votion-zswap.conf", mod_conf).await;

        let modprobe_conf = "options zswap enabled=1 compressor=zstd zpool=z3fold max_pool_percent=30\n";
        let _ = tokio::fs::write("/etc/modprobe.d/votion-zswap.conf", modprobe_conf).await;
    }
}
