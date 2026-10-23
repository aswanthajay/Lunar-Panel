pub mod cgroups;
pub mod oci;
pub mod rootfs;

use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub data_dir: PathBuf,
    pub crun_binary: PathBuf,
    pub cgroup_root: PathBuf,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            data_dir: PathBuf::from("/var/lib/votion"),
            crun_binary: PathBuf::from("crun"),
            cgroup_root: PathBuf::from("/sys/fs/cgroup/votion"),
        }
    }
}
