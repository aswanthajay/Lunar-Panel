use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciSpec {
    pub oci_version: String,
    pub process: OciProcess,
    pub root: OciRoot,
    pub mounts: Vec<OciMount>,
    pub linux: Option<OciLinux>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciProcess {
    pub terminal: bool,
    pub user: OciUser,
    pub args: Vec<String>,
    pub env: Vec<String>,
    pub cwd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciUser {
    pub uid: u32,
    pub gid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciRoot {
    pub path: String,
    pub readonly: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciMount {
    pub destination: String,
    pub r#type: String,
    pub source: String,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciLinux {
    pub namespaces: Vec<OciNamespace>,
    pub resources: Option<OciResources>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciNamespace {
    pub r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciResources {
    pub memory: Option<OciMemory>,
    pub cpu: Option<OciCpu>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciMemory {
    pub limit: Option<i64>,
    pub reservation: Option<i64>,
    pub swap: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OciCpu {
    pub shares: Option<u64>,
    pub quota: Option<i64>,
    pub period: Option<u64>,
}

pub struct OciBundleBuilder {
    container_id: String,
    bundle_path: PathBuf,
    command: Vec<String>,
    environment: HashMap<String, String>,
    working_dir: String,
    memory_limit: u64,
    memory_high: u64,
    cpu_weight: u32,
    cpu_limit_percent: u32,
}

impl OciBundleBuilder {
    pub fn new(container_id: &str, bundle_path: PathBuf) -> Self {
        Self {
            container_id: container_id.to_string(),
            bundle_path,
            command: vec!["/bin/sh".to_string()],
            environment: HashMap::new(),
            working_dir: "/home/container".to_string(),
            memory_limit: 1024 * 1024 * 1024,
            memory_high: 900 * 1024 * 1024,
            cpu_weight: 100,
            cpu_limit_percent: 100,
        }
    }

    pub fn with_command(mut self, cmd: Vec<String>) -> Self {
        self.command = cmd;
        self
    }

    pub fn with_environment(mut self, env: HashMap<String, String>) -> Self {
        self.environment = env;
        self
    }

    pub fn with_limits(
        mut self,
        memory_limit: u64,
        memory_high: u64,
        cpu_weight: u32,
        cpu_limit_percent: u32,
    ) -> Self {
        self.memory_limit = memory_limit;
        self.memory_high = memory_high;
        self.cpu_weight = cpu_weight;
        self.cpu_limit_percent = cpu_limit_percent;
        self
    }

    /// Generates standard OCI config.json inside the bundle path
    pub fn build_spec(&self) -> OciSpec {
        let env_vec: Vec<String> = self
            .environment
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect();

        // Calculate CPU quota based on period 100,000us (100ms)
        let period: u64 = 100_000;
        let quota = if self.cpu_limit_percent > 0 {
            Some(((period as f64) * (self.cpu_limit_percent as f64 / 100.0)) as i64)
        } else {
            None
        };

        OciSpec {
            oci_version: "1.0.2".to_string(),
            process: OciProcess {
                terminal: true,
                user: OciUser { uid: 1000, gid: 1000 },
                args: self.command.clone(),
                env: env_vec,
                cwd: self.working_dir.clone(),
            },
            root: OciRoot {
                path: "rootfs".to_string(),
                readonly: false,
            },
            mounts: vec![
                OciMount {
                    destination: "/proc".to_string(),
                    r#type: "proc".to_string(),
                    source: "proc".to_string(),
                    options: vec!["nosuid".to_string(), "noexec".to_string(), "nodev".to_string()],
                },
                OciMount {
                    destination: "/dev".to_string(),
                    r#type: "tmpfs".to_string(),
                    source: "tmpfs".to_string(),
                    options: vec!["nosuid".to_string(), "strictatime".to_string(), "mode=755".to_string()],
                },
                OciMount {
                    destination: "/sys".to_string(),
                    r#type: "sysfs".to_string(),
                    source: "sysfs".to_string(),
                    options: vec!["nosuid".to_string(), "noexec".to_string(), "nodev".to_string(), "ro".to_string()],
                },
            ],
            linux: Some(OciLinux {
                namespaces: vec![
                    OciNamespace { r#type: "pid".to_string() },
                    OciNamespace { r#type: "network".to_string() },
                    OciNamespace { r#type: "ipc".to_string() },
                    OciNamespace { r#type: "uts".to_string() },
                    OciNamespace { r#type: "mount".to_string() },
                ],
                resources: Some(OciResources {
                    memory: Some(OciMemory {
                        limit: Some(self.memory_limit as i64),
                        reservation: Some(self.memory_high as i64),
                        swap: Some(0),
                    }),
                    cpu: Some(OciCpu {
                        shares: Some(self.cpu_weight as u64),
                        quota,
                        period: Some(period),
                    }),
                }),
            }),
        }
    }

    /// Writes bundle config.json to disk
    pub fn write_bundle(&self) -> Result<PathBuf, std::io::Error> {
        fs::create_dir_all(&self.bundle_path)?;
        let rootfs_path = self.bundle_path.join("rootfs");
        fs::create_dir_all(&rootfs_path)?;

        let spec = self.build_spec();
        let config_file = self.bundle_path.join("config.json");
        let json = serde_json::to_string_pretty(&spec)?;
        fs::write(&config_file, json)?;

        info!(
            "Generated OCI bundle for container {} at {:?}",
            self.container_id, config_file
        );
        Ok(config_file)
    }
}

/// OCI Runtime Engine (executes `crun` commands or local mock runner)
pub struct OciRunner {
    #[allow(dead_code)]
    crun_path: String,
}

impl OciRunner {
    pub fn new(crun_path: Option<String>) -> Self {
        Self {
            crun_path: crun_path.unwrap_or_else(|| "crun".to_string()),
        }
    }

    pub async fn create_and_start(&self, id: &str, bundle: &Path) -> Result<(), String> {
        info!("Starting OCI container {} via bundle {:?}", id, bundle);

        #[cfg(target_os = "linux")]
        {
            let status = tokio::process::Command::new(&self.crun_path)
                .args(["run", "-d", "--bundle", bundle.to_str().unwrap(), id])
                .status()
                .await
                .map_err(|e| format!("Failed to spawn crun: {}", e))?;

            if !status.success() {
                return Err(format!("crun exited with error code: {:?}", status.code()));
            }
        }

        #[cfg(not(target_os = "linux"))]
        {
            // Cross-platform mock mode for local testing
            info!("Running in local development simulation mode for container {}", id);
        }

        Ok(())
    }

    pub async fn kill(&self, id: &str, signal: &str) -> Result<(), String> {
        info!("Sending signal {} to container {}", signal, id);

        #[cfg(target_os = "linux")]
        {
            let status = tokio::process::Command::new(&self.crun_path)
                .args(["kill", id, signal])
                .status()
                .await
                .map_err(|e| format!("Failed to send kill via crun: {}", e))?;

            if !status.success() {
                return Err(format!("crun kill failed: {:?}", status.code()));
            }
        }

        #[cfg(not(target_os = "linux"))]
        {
            info!("Mock: container {} received signal {}", id, signal);
        }

        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<(), String> {
        info!("Deleting OCI container {}", id);

        #[cfg(target_os = "linux")]
        {
            let _ = tokio::process::Command::new(&self.crun_path)
                .args(["delete", "--force", id])
                .status()
                .await;
        }

        #[cfg(not(target_os = "linux"))]
        {
            info!("Mock: container {} deleted", id);
        }

        Ok(())
    }
}
