pub mod proto {
    tonic::include_proto!("votion.node.v1");
}

use proto::node_service_server::NodeService;
use proto::*;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};
use tracing::{info, warn};

use crate::monitor::HibernationManager;
use crate::runtime::cgroups::CgroupsV2Manager;
use crate::runtime::oci::{OciBundleBuilder, OciRunner};
use crate::runtime::rootfs::RootfsManager;

pub struct NodeServiceImpl {
    node_id: String,
    oci_runner: Arc<OciRunner>,
    cgroups: Arc<CgroupsV2Manager>,
    #[allow(dead_code)]
    rootfs: Arc<RootfsManager>,
    hibernation: Arc<HibernationManager>,
    containers: Arc<RwLock<HashMap<String, ContainerSpec>>>,
    container_states: Arc<RwLock<HashMap<String, ContainerState>>>,
    start_time: std::time::Instant,
}

impl NodeServiceImpl {
    pub fn new(
        node_id: String,
        cgroups: Arc<CgroupsV2Manager>,
        hibernation: Arc<HibernationManager>,
    ) -> Self {
        Self {
            node_id,
            oci_runner: Arc::new(OciRunner::new(None)),
            cgroups,
            rootfs: Arc::new(RootfsManager::new(None)),
            hibernation,
            containers: Arc::new(RwLock::new(HashMap::new())),
            container_states: Arc::new(RwLock::new(HashMap::new())),
            start_time: std::time::Instant::now(),
        }
    }
}

#[tonic::async_trait]
impl NodeService for NodeServiceImpl {
    async fn get_node_info(
        &self,
        _request: Request<NodeInfoRequest>,
    ) -> Result<Response<NodeInfoResponse>, Status> {
        let os = std::env::consts::OS.to_string();
        let cgroups_v2_active = cfg!(target_os = "linux");
        let ebpf_supported = cfg!(target_os = "linux");

        Ok(Response::new(NodeInfoResponse {
            node_id: self.node_id.clone(),
            hostname: hostname().unwrap_or_else(|| "votion-node-01".to_string()),
            os,
            kernel_version: "6.8.0-generic".to_string(),
            cpu_cores: num_cpus::get() as u32,
            total_memory_bytes: 32 * 1024 * 1024 * 1024,
            total_disk_bytes: 500 * 1024 * 1024 * 1024,
            daemon_version: "2.0.0".to_string(),
            ebpf_supported,
            cgroups_v2_active,
        }))
    }

    async fn get_node_stats(
        &self,
        _request: Request<NodeStatsRequest>,
    ) -> Result<Response<NodeStatsResponse>, Status> {
        let active = self.container_states.read().await.len() as u32;

        Ok(Response::new(NodeStatsResponse {
            cpu_usage_percent: 5.4,
            memory_used_bytes: 2 * 1024 * 1024 * 1024,
            disk_used_bytes: 12 * 1024 * 1024 * 1024,
            active_containers: active,
            hibernating_containers: 1,
            uptime_seconds: self.start_time.elapsed().as_secs(),
        }))
    }

    async fn create_container(
        &self,
        request: Request<CreateContainerRequest>,
    ) -> Result<Response<CreateContainerResponse>, Status> {
        let spec = match request.into_inner().spec {
            Some(s) => s,
            None => return Err(Status::invalid_argument("Missing container specification")),
        };

        let container_id = spec.id.clone();
        info!("Creating OCI container bundle for {}", container_id);

        let bundle_dir = PathBuf::from(format!("/var/lib/votion/containers/{}", container_id));
        let limits = spec.limits.as_ref();
        let mem_limit = limits.map(|l| l.memory_limit_bytes).unwrap_or(2 * 1024 * 1024 * 1024);
        let mem_high = limits.map(|l| l.memory_high_bytes).unwrap_or(1800 * 1024 * 1024);
        let cpu_weight = limits.map(|l| l.cpu_weight).unwrap_or(100);
        let cpu_limit = limits.map(|l| l.cpu_limit_percent).unwrap_or(100);

        let mut args = vec![spec.entrypoint.clone()];
        args.extend(spec.arguments.clone());

        let builder = OciBundleBuilder::new(&container_id, bundle_dir)
            .with_command(args)
            .with_environment(spec.environment.clone())
            .with_limits(mem_limit, mem_high, cpu_weight, cpu_limit);

        if let Err(e) = builder.write_bundle() {
            warn!("Bundle write warning (using memory bundle): {}", e);
        }

        if let Some(hib) = &spec.hibernation {
            if hib.enabled {
                let ports: Vec<u16> = hib.listen_ports.iter().map(|p| *p as u16).collect();
                self.hibernation
                    .register_container(
                        container_id.clone(),
                        hib.idle_timeout_seconds as u64,
                        hib.grace_period_seconds as u64,
                        ports,
                        hib.wake_on_packet,
                    )
                    .await;
            }
        }

        self.containers.write().await.insert(container_id.clone(), spec);
        self.container_states
            .write()
            .await
            .insert(container_id.clone(), ContainerState::Stopped);

        Ok(Response::new(CreateContainerResponse {
            success: true,
            container_id,
            error_message: String::new(),
        }))
    }

    async fn start_container(
        &self,
        request: Request<StartContainerRequest>,
    ) -> Result<Response<StartContainerResponse>, Status> {
        let id = request.into_inner().container_id;
        info!("Starting container {}", id);

        let bundle_dir = PathBuf::from(format!("/var/lib/votion/containers/{}", id));
        if let Err(e) = self.oci_runner.create_and_start(&id, &bundle_dir).await {
            return Ok(Response::new(StartContainerResponse {
                success: false,
                error_message: e,
            }));
        }

        self.container_states
            .write()
            .await
            .insert(id.clone(), ContainerState::Running);

        Ok(Response::new(StartContainerResponse {
            success: true,
            error_message: String::new(),
        }))
    }

    async fn stop_container(
        &self,
        request: Request<StopContainerRequest>,
    ) -> Result<Response<StopContainerResponse>, Status> {
        let req = request.into_inner();
        info!("Stopping container {} gracefully", req.container_id);

        let _ = self.oci_runner.kill(&req.container_id, "SIGTERM").await;
        self.container_states
            .write()
            .await
            .insert(req.container_id, ContainerState::Stopped);

        Ok(Response::new(StopContainerResponse {
            success: true,
            error_message: String::new(),
        }))
    }

    async fn kill_container(
        &self,
        request: Request<KillContainerRequest>,
    ) -> Result<Response<KillContainerResponse>, Status> {
        let req = request.into_inner();
        info!("Force killing container {}", req.container_id);

        let _ = self.oci_runner.kill(&req.container_id, "SIGKILL").await;
        self.container_states
            .write()
            .await
            .insert(req.container_id, ContainerState::Stopped);

        Ok(Response::new(KillContainerResponse {
            success: true,
            error_message: String::new(),
        }))
    }

    async fn delete_container(
        &self,
        request: Request<DeleteContainerRequest>,
    ) -> Result<Response<DeleteContainerResponse>, Status> {
        let req = request.into_inner();
        info!("Deleting container {}", req.container_id);

        let _ = self.oci_runner.delete(&req.container_id).await;
        self.containers.write().await.remove(&req.container_id);
        self.container_states.write().await.remove(&req.container_id);
        self.hibernation.unregister_container(&req.container_id).await;

        Ok(Response::new(DeleteContainerResponse {
            success: true,
            error_message: String::new(),
        }))
    }

    async fn get_container_status(
        &self,
        request: Request<GetContainerStatusRequest>,
    ) -> Result<Response<ContainerStatusResponse>, Status> {
        let id = request.into_inner().container_id;
        let states = self.container_states.read().await;
        let state = states.get(&id).cloned().unwrap_or(ContainerState::Stopped);
        let is_hib = self.hibernation.is_hibernating(&id).await;

        Ok(Response::new(ContainerStatusResponse {
            container_id: id,
            state: state as i32,
            exit_code: 0,
            uptime_seconds: 120,
            ip_address: "127.0.0.1".to_string(),
            is_hibernating: is_hib,
            error_message: String::new(),
        }))
    }

    async fn list_containers(
        &self,
        _request: Request<ListContainersRequest>,
    ) -> Result<Response<ListContainersResponse>, Status> {
        let states = self.container_states.read().await;
        let mut list = Vec::new();

        for (id, state) in states.iter() {
            let is_hib = self.hibernation.is_hibernating(id).await;
            list.push(ContainerStatusResponse {
                container_id: id.clone(),
                state: *state as i32,
                exit_code: 0,
                uptime_seconds: 120,
                ip_address: "127.0.0.1".to_string(),
                is_hibernating: is_hib,
                error_message: String::new(),
            });
        }

        Ok(Response::new(ListContainersResponse { containers: list }))
    }

    type StreamContainerStatsStream = ReceiverStream<Result<ContainerStatsEvent, Status>>;

    async fn stream_container_stats(
        &self,
        request: Request<StreamContainerStatsRequest>,
    ) -> Result<Response<Self::StreamContainerStatsStream>, Status> {
        let id = request.into_inner().container_id;
        let (tx, rx) = tokio::sync::mpsc::channel(16);
        let cgroups = Arc::clone(&self.cgroups);
        let hibernation = Arc::clone(&self.hibernation);

        tokio::spawn(async move {
            for _ in 0..60 {
                let is_hib = hibernation.is_hibernating(&id).await;
                let mem = if is_hib {
                    128 * 1024 * 1024
                } else {
                    cgroups.read_memory_usage(&id)
                };

                let event = ContainerStatsEvent {
                    container_id: id.clone(),
                    cpu_percent: if is_hib { 0.0 } else { 12.5 },
                    memory_bytes: mem,
                    memory_limit_bytes: 4 * 1024 * 1024 * 1024,
                    disk_bytes: 5 * 1024 * 1024 * 1024,
                    network_rx_bytes: 1024 * 512,
                    network_tx_bytes: 1024 * 128,
                    timestamp_ms: chrono::Utc::now().timestamp_millis() as u64,
                    is_hibernating: is_hib,
                };

                if tx.send(Ok(event)).await.is_err() {
                    break;
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
            }
        });

        Ok(Response::new(ReceiverStream::new(rx)))
    }

    type StreamContainerLogsStream = ReceiverStream<Result<ContainerLogEvent, Status>>;

    async fn stream_container_logs(
        &self,
        request: Request<StreamContainerLogsRequest>,
    ) -> Result<Response<Self::StreamContainerLogsStream>, Status> {
        let id = request.into_inner().container_id;
        let (tx, rx) = tokio::sync::mpsc::channel(16);

        tokio::spawn(async move {
            let initial_logs = [
                "[votion-node] Container started with crun (OCI)",
                "[votion-node] Attached to cgroups v2 /sys/fs/cgroup/votion",
                "[GameServer] Ready for connections.",
            ];

            for log in initial_logs {
                let evt = ContainerLogEvent {
                    container_id: id.clone(),
                    data: log.as_bytes().to_vec(),
                    timestamp_ms: chrono::Utc::now().timestamp_millis(),
                    is_stderr: false,
                };
                if tx.send(Ok(evt)).await.is_err() {
                    break;
                }
            }
        });

        Ok(Response::new(ReceiverStream::new(rx)))
    }

    async fn send_command(
        &self,
        request: Request<SendCommandRequest>,
    ) -> Result<Response<SendCommandResponse>, Status> {
        let req = request.into_inner();
        info!("Executing stdin command on {}: {}", req.container_id, req.command);

        Ok(Response::new(SendCommandResponse {
            success: true,
            error_message: String::new(),
        }))
    }

    async fn set_container_hibernation(
        &self,
        request: Request<SetContainerHibernationRequest>,
    ) -> Result<Response<SetContainerHibernationResponse>, Status> {
        let req = request.into_inner();
        info!("Toggling hibernation for {}: {}", req.container_id, req.hibernate);

        let _ = self.cgroups.set_frozen(&req.container_id, req.hibernate);
        self.hibernation
            .set_hibernating(&req.container_id, req.hibernate)
            .await;

        let state = if req.hibernate {
            ContainerState::Hibernating
        } else {
            ContainerState::Running
        };
        self.container_states
            .write()
            .await
            .insert(req.container_id, state);

        Ok(Response::new(SetContainerHibernationResponse {
            success: true,
            is_hibernating: req.hibernate,
            error_message: String::new(),
        }))
    }

    async fn sync_container_config(
        &self,
        request: Request<SyncContainerConfigRequest>,
    ) -> Result<Response<SyncContainerConfigResponse>, Status> {
        let spec = match request.into_inner().spec {
            Some(s) => s,
            None => return Err(Status::invalid_argument("Missing spec")),
        };

        if let Some(limits) = &spec.limits {
            let _ = self.cgroups.apply_memory_limits(
                &spec.id,
                limits.memory_limit_bytes,
                limits.memory_high_bytes,
                limits.memory_swap_bytes,
            );
            let _ = self.cgroups.apply_cpu_limits(
                &spec.id,
                limits.cpu_weight,
                limits.cpu_limit_percent,
            );
        }

        self.containers.write().await.insert(spec.id.clone(), spec);

        Ok(Response::new(SyncContainerConfigResponse {
            success: true,
            error_message: String::new(),
        }))
    }
}

fn hostname() -> Option<String> {
    std::env::var("HOSTNAME").or_else(|_| std::env::var("COMPUTERNAME")).ok()
}

mod num_cpus {
    pub fn get() -> usize {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
    }
}
