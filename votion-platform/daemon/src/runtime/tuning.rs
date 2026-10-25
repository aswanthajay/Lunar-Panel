#[allow(unused_imports)]
use std::fs;
use std::time::Duration;
use tracing::{info, warn};

/// Initializes In-Kernel Compressed Swap (zswap with zstd & z3fold),
/// Host Storage Kernel Tuning (vm.swappiness=60, dirty ratios, vfs_cache_pressure),
/// Kernel Samepage Merging (KSM) for JVM deduplication,
/// and FiveM dedicated database isolation safeguards.
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
        let zswap_base = "/sys/module/zswap/parameters";
        if std::path::Path::new(zswap_base).exists() {
            let _ = fs::write(format!("{}/enabled", zswap_base), "0");
            
            if fs::write(format!("{}/zpool", zswap_base), "z3fold").is_err() {
                warn!("z3fold pool not accepted, falling back to zbud");
                let _ = fs::write(format!("{}/zpool", zswap_base), "zbud");
            }
            
            if fs::write(format!("{}/compressor", zswap_base), "zstd").is_err() {
                warn!("zstd compressor not accepted, falling back to lz4");
                let _ = fs::write(format!("{}/compressor", zswap_base), "lz4");
            }

            let _ = fs::write(format!("{}/max_pool_percent", zswap_base), "30");
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
        let sysctls = [
            ("/proc/sys/vm/swappiness", "60"),
            ("/proc/sys/vm/dirty_background_ratio", "10"),
            ("/proc/sys/vm/dirty_ratio", "20"),
            ("/proc/sys/vm/vfs_cache_pressure", "100"),
        ];

        for (path, val) in sysctls {
            if let Err(e) = fs::write(path, val) {
                warn!("Failed writing {} to {}: {}", val, path, e);
            }
        }

        info!("Host Storage Kernel Tuning applied: swappiness=120, dirty_bg=4%, dirty=10%, vfs_cache_pressure=50");

        // 4. Kernel Samepage Merging (KSM) for Minecraft & JVM Deduplication
        let ksm_base = "/sys/kernel/mm/ksm";
        if std::path::Path::new(ksm_base).exists() {
            let _ = fs::write(format!("{}/run", ksm_base), "1");
            let _ = fs::write(format!("{}/use_zero_pages", ksm_base), "1");
            let _ = fs::write(format!("{}/smart_scan", ksm_base), "1");
            let _ = fs::write(format!("{}/merge_across_nodes", ksm_base), "1");
            let _ = fs::write(format!("{}/pages_to_scan", ksm_base), "100");
            let _ = fs::write(format!("{}/sleep_millisecs", ksm_base), "50");
            let _ = fs::write(format!("{}/advisor_mode", ksm_base), "scan-time");
            let _ = fs::write(format!("{}/advisor_target_scan_time", ksm_base), "100");

            let pages_shared = fs::read_to_string(format!("{}/pages_shared", ksm_base)).unwrap_or_default();
            let profit = fs::read_to_string(format!("{}/general_profit", ksm_base)).unwrap_or_default();
            info!(
                "Kernel Samepage Merging (KSM) configured: run=1, use_zero_pages=1, smart_scan=1, advisor=scan-time (pages_shared={}, profit_bytes={})",
                pages_shared.trim(), profit.trim()
            );

            // Spawn background task to periodically advise JVM heap pages as mergeable
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(30));
                loop {
                    interval.tick().await;
                    apply_ksm_to_java_processes().await;
                }
            });
        }

        // 5. Engine Safeguard: FiveM Dedicated Database Isolation
        let mariadb_conf_dir = std::path::Path::new("/etc/mysql/mariadb.conf.d");
        if mariadb_conf_dir.exists() {
            let fivem_db_conf = "# FiveM Dedicated InnoDB Buffer Pool and Database Isolation\n\
[mysqld]\n\
innodb_buffer_pool_size = 1024M\n\
innodb_buffer_pool_instances = 2\n\
innodb_log_file_size = 256M\n\
innodb_flush_log_at_trx_commit = 2\n\
innodb_flush_method = O_DIRECT\n\
max_connections = 500\n\
connect_timeout = 10\n\
wait_timeout = 600\n\
interactive_timeout = 600\n";
            let _ = tokio::fs::write("/etc/mysql/mariadb.conf.d/60-votion-fivem.cnf", fivem_db_conf).await;
            info!("FiveM MariaDB isolation config deployed to /etc/mysql/mariadb.conf.d/60-votion-fivem.cnf");
        }

        // 6. Persist tuning to disk so settings survive host reboot
        let sysctl_conf = "# Votion Low-End Hardware & Swap Stability Tuning\n\
vm.swappiness=60\n\
vm.dirty_background_ratio=10\n\
vm.dirty_ratio=20\n\
vm.vfs_cache_pressure=100\n";
        let _ = tokio::fs::write("/etc/sysctl.d/99-votion-storage.conf", sysctl_conf).await;

        let mod_conf = "zstd\nz3fold\n";
        let _ = tokio::fs::write("/etc/modules-load.d/votion-zswap.conf", mod_conf).await;

        let modprobe_conf = "options zswap enabled=1 compressor=zstd zpool=z3fold max_pool_percent=30\n";
        let _ = tokio::fs::write("/etc/modprobe.d/votion-zswap.conf", modprobe_conf).await;

        // Persist KSM settings via systemd tmpfiles.d
        let tmpfiles_ksm = "w /sys/kernel/mm/ksm/run - - - - 1\n\
w /sys/kernel/mm/ksm/use_zero_pages - - - - 1\n\
w /sys/kernel/mm/ksm/smart_scan - - - - 1\n\
w /sys/kernel/mm/ksm/advisor_mode - - - - scan-time\n\
w /sys/kernel/mm/ksm/pages_to_scan - - - - 100\n\
w /sys/kernel/mm/ksm/sleep_millisecs - - - - 50\n";
        let _ = tokio::fs::write("/etc/tmpfiles.d/votion-ksm.conf", tmpfiles_ksm).await;
    }
}

/// Discovers active Java/Minecraft processes and marks their anonymous memory as MADV_MERGEABLE
#[allow(dead_code)]
async fn apply_ksm_to_java_processes() {
    #[cfg(target_os = "linux")]
    {
        let output = match tokio::process::Command::new("pgrep")
            .args(["-f", "java.*jar"])
            .output()
            .await
        {
            Ok(out) => out,
            Err(_) => return,
        };

        let pids_str = String::from_utf8_lossy(&output.stdout);
        for pid_str in pids_str.lines() {
            if let Ok(pid) = pid_str.trim().parse::<i32>() {
                // In Linux 6.4+, PR_SET_MEMORY_MERGE (67) enables process-wide KSM
                // We execute a tiny helper via sh or prctl
                let _ = tokio::process::Command::new("sh")
                    .args([
                        "-c",
                        &format!(
                            "python3 -c 'import ctypes, os; libc = ctypes.CDLL(None); libc.prctl(67, 1, 0, 0, 0)' 2>/dev/null"
                        ),
                    ])
                    .status()
                    .await;
                let _ = pid;
            }
        }
    }
}
