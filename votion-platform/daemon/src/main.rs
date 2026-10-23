pub mod console;
pub mod monitor;
pub mod rpc;
pub mod runtime;

use clap::Parser;
use std::net::SocketAddr;
use std::sync::Arc;
use tonic::transport::Server;
use tracing::{error, info, Level};
use tracing_subscriber::FmtSubscriber;

use console::PtyWebSocketServer;
use monitor::HibernationManager;
use rpc::proto::node_service_server::NodeServiceServer;
use rpc::NodeServiceImpl;
use runtime::cgroups::CgroupsV2Manager;

#[derive(Parser, Debug)]
#[command(
    name = "votion-node",
    author = "Votion Team",
    version = "2.0.0",
    about = "Next-generation low-overhead host node daemon for game servers"
)]
struct Args {
    #[arg(short, long, default_value = "127.0.0.1")]
    host: String,

    #[arg(short = 'p', long, default_value_t = 50051)]
    grpc_port: u16,

    #[arg(short = 'w', long, default_value_t = 50052)]
    ws_port: u16,

    #[arg(long, default_value = "node-us-east-1")]
    node_id: String,

    #[arg(
        long,
        default_value = "0000000000000000000000000000000000000000000000000000000000000000"
    )]
    public_key_hex: String,
}

fn apply_mlockall() {
    #[cfg(target_os = "linux")]
    {
        unsafe {
            // MCL_CURRENT = 1, MCL_FUTURE = 2
            let ret = libc::mlockall(libc::MCL_CURRENT | libc::MCL_FUTURE);
            if ret == 0 {
                info!("Memory locked into RAM via mlockall(MCL_CURRENT | MCL_FUTURE)");
            } else {
                tracing::warn!("Failed to lock memory with mlockall (errno: {})", ret);
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set tracing subscriber");

    let args = Args::parse();

    info!("=======================================================");
    info!("   VOTION HOST NODE DAEMON (votion-node v2.0.0)");
    info!("   Architecture: crun + cgroups v2 + zero-player XDP");
    info!("=======================================================");

    // 2. Memory security lock
    apply_mlockall();

    // 3. Subsystem managers
    let cgroups = Arc::new(CgroupsV2Manager::new(None));
    if let Err(e) = cgroups.initialize_host_cgroup() {
        tracing::warn!("cgroups v2 initialization note: {}", e);
    }

    let hibernation = Arc::new(HibernationManager::new());

    // 4. Start WebSocket PTY Console Server
    let ws_addr: SocketAddr = format!("{}:{}", args.host, args.ws_port).parse()?;
    let ws_server = PtyWebSocketServer::new(ws_addr, args.public_key_hex);

    tokio::spawn(async move {
        if let Err(e) = ws_server.run().await {
            error!("PTY WebSocket server error: {}", e);
        }
    });

    // 5. Start gRPC NodeService
    let grpc_addr: SocketAddr = format!("{}:{}", args.host, args.grpc_port).parse()?;
    let node_service = NodeServiceImpl::new(args.node_id, Arc::clone(&cgroups), Arc::clone(&hibernation));

    info!("gRPC NodeService listening on {}", grpc_addr);

    Server::builder()
        .add_service(NodeServiceServer::new(node_service))
        .serve_with_shutdown(grpc_addr, async {
            tokio::signal::ctrl_c().await.ok();
            info!("Received shutdown signal. Stopping votion-node cleanly...");
        })
        .await?;

    Ok(())
}
