use std::fs;
use std::path::{Path, PathBuf};
use tracing::info;

pub struct RootfsManager {
    cache_dir: PathBuf,
}

impl RootfsManager {
    pub fn new(cache_dir: Option<PathBuf>) -> Self {
        Self {
            cache_dir: cache_dir.unwrap_or_else(|| PathBuf::from("/var/lib/votion/cache")),
        }
    }

    /// Prepares container rootfs directory and populates skeleton if needed
    pub async fn prepare_rootfs(&self, container_bundle: &Path, image: &str) -> Result<PathBuf, String> {
        let rootfs = container_bundle.join("rootfs");
        fs::create_dir_all(&rootfs)
            .map_err(|e| format!("Failed to create rootfs dir: {}", e))?;

        // Standard Linux container directories
        for sub in &["bin", "dev", "etc", "home", "home/container", "lib", "proc", "sys", "tmp", "var"] {
            let _ = fs::create_dir_all(rootfs.join(sub));
        }

        info!("Rootfs prepared for image {} at {:?}", image, rootfs);
        Ok(rootfs)
    }

    /// Checks if an image is already cached locally
    pub fn is_cached(&self, image_ref: &str) -> bool {
        let sanitized = image_ref.replace(['/', ':', '@'], "_");
        self.cache_dir.join(sanitized).exists()
    }
}
