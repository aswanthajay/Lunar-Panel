use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};

use crate::monitor::HibernationManager;
use crate::runtime::cgroups::CgroupsV2Manager;

static IS_BACKGROUND_PAUSED: AtomicBool = AtomicBool::new(false);
static IS_CPU_THROTTLED: AtomicBool = AtomicBool::new(false);

/// Returns whether background tasks (storage deduplication, backups) should pause
pub fn is_background_paused() -> bool {
    IS_BACKGROUND_PAUSED.load(Ordering::Relaxed)
}

/// Returns whether container CPU shares are currently throttled due to memory pressure
pub fn is_cpu_throttled() -> bool {
    IS_CPU_THROTTLED.load(Ordering::Relaxed)
}

#[derive(Debug, Default, Clone)]
pub struct MemoryPsiMetrics {
    pub some_avg10: f64,
    pub some_avg60: f64,
    pub some_avg300: f64,
    pub full_avg10: f64,
    pub full_avg60: f64,
    pub full_avg300: f64,
}

/// Reads and parses /proc/pressure/memory
pub fn read_memory_psi() -> Option<MemoryPsiMetrics> {
    #[cfg(target_os = "linux")]
    {
        let content = fs::read_to_string("/proc/pressure/memory").ok()?;
        let mut metrics = MemoryPsiMetrics::default();

        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("some ") {
                for token in line.split_whitespace().skip(1) {
                    if let Some((k, v)) = token.split_once('=') {
                        let num = v.parse::<f64>().unwrap_or(0.0);
                        match k {
                            "avg10" => metrics.some_avg10 = num,
                            "avg60" => metrics.some_avg60 = num,
                            "avg300" => metrics.some_avg300 = num,
                            _ => {}
                        }
                    }
                }
            } else if line.starts_with("full ") {
                for token in line.split_whitespace().skip(1) {
                    if let Some((k, v)) = token.split_once('=') {
                        let num = v.parse::<f64>().unwrap_or(0.0);
                        match k {
                            "avg10" => metrics.full_avg10 = num,
                            "avg60" => metrics.full_avg60 = num,
                            "avg300" => metrics.full_avg300 = num,
                            _ => {}
                        }
                    }
                }
            }
        }
        Some(metrics)
    }
    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}

/// Starts proactive PSI (Pressure Stall Information) Watcher task
pub fn start_psi_watcher(
    cgroups: Arc<CgroupsV2Manager>,
    hibernation: Arc<HibernationManager>,
) {
    info!("Starting Proactive PSI (Pressure Stall Information) Watcher background engine...");

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));

        loop {
            interval.tick().await;

            let metrics = match read_memory_psi() {
                Some(m) => m,
                None => continue,
            };

            // 1. Threshold: > 20% pressure -> Pause background deduplication & backups
            if metrics.some_avg10 > 20.0 || metrics.full_avg10 > 10.0 {
                if !IS_BACKGROUND_PAUSED.swap(true, Ordering::SeqCst) {
                    warn!(
                        "Memory PSI pressure alert: some avg10={:.2}% (>20%), full avg10={:.2}%. Pausing background storage deduplication and backups.",
                        metrics.some_avg10, metrics.full_avg10
                    );
                }
            } else if metrics.some_avg10 < 15.0 && metrics.full_avg10 < 8.0 {
                if IS_BACKGROUND_PAUSED.swap(false, Ordering::SeqCst) {
                    info!(
                        "Memory PSI pressure normalized: some avg10={:.2}%, full avg10={:.2}%. Resuming background tasks.",
                        metrics.some_avg10, metrics.full_avg10
                    );
                }
            }

            // 2. Threshold: > 40% pressure -> Throttle CPU shares
            if metrics.some_avg10 > 40.0 || metrics.full_avg10 > 25.0 {
                if !IS_CPU_THROTTLED.swap(true, Ordering::SeqCst) {
                    warn!(
                        "Memory PSI high pressure: some avg10={:.2}% (>40%). Throttling container CPU shares to prioritize kernel memory reclaim and zswap.",
                        metrics.some_avg10
                    );
                    cgroups.set_all_containers_cpu_weight(50);
                }
            } else if metrics.some_avg10 < 30.0 && metrics.full_avg10 < 15.0 {
                if IS_CPU_THROTTLED.swap(false, Ordering::SeqCst) {
                    info!(
                        "Memory PSI pressure dropped below 30% (avg10={:.2}%). Restoring normal container CPU shares.",
                        metrics.some_avg10
                    );
                    cgroups.set_all_containers_cpu_weight(100);
                }
            }

            // 3. Threshold: > 70% pressure -> Hibernate idle instances to immediately liberate memory pages
            if metrics.some_avg10 > 70.0 || metrics.full_avg10 > 50.0 {
                warn!(
                    "Memory PSI critical stall: some avg10={:.2}% (>70%), full avg10={:.2}%. Triggering proactive hibernation on idle containers!",
                    metrics.some_avg10, metrics.full_avg10
                );
                let cg_clone = Arc::clone(&cgroups);
                hibernation
                    .check_hibernation_candidates(move |container_id, freeze| {
                        let _ = cg_clone.set_frozen(container_id, freeze);
                    })
                    .await;
            }
        }
    });
}
