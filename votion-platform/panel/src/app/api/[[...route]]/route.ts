import { Hono } from "hono";
import { handle } from "hono/vercel";
import { TokenSigner } from "@/lib/token-signer";
import { EggParser } from "@/lib/egg-parser";
import { VotionGrpcClient } from "@/lib/grpc-client";
import { prisma } from "@/lib/prisma";

const app = new Hono().basePath("/api");

const keyPair = TokenSigner.generateKeyPair();
let grpcClient: VotionGrpcClient | null = null;

function getGrpcClient(): VotionGrpcClient {
  if (!grpcClient) {
    grpcClient = new VotionGrpcClient({
      host: process.env.DAEMON_HOST || "127.0.0.1:50051",
    });
  }
  return grpcClient;
}

// -------------------------------------------------------------
// Health & Daemon Host Status
// -------------------------------------------------------------
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    version: "2.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/nodes/live", async (c) => {
  try {
    const client = getGrpcClient();
    const info = await client.getNodeInfo();
    const stats = await client.getNodeStats();

    return c.json({
      connected: true,
      info: {
        nodeId: info.node_id,
        hostname: info.hostname,
        os: info.os,
        kernel: info.kernel_version,
        cpuCores: info.cpu_cores,
        totalMemoryBytes: String(info.total_memory_bytes),
        totalDiskBytes: String(info.total_disk_bytes),
        daemonVersion: info.daemon_version,
        ebpfSupported: info.ebpf_supported,
        cgroupsV2Active: info.cgroups_v2_active,
      },
      stats: {
        cpuUsagePercent: stats.cpu_usage_percent,
        memoryUsedBytes: String(stats.memory_used_bytes),
        diskUsedBytes: String(stats.disk_used_bytes),
        activeContainers: stats.active_containers,
        hibernatingContainers: stats.hibernating_containers,
        uptimeSeconds: stats.uptime_seconds,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({
      connected: false,
      error: `Could not reach votion-node on 127.0.0.1:50051 (${msg})`,
      info: {
        nodeId: "local-node",
        hostname: "localhost",
        os: "linux",
        kernel: "6.8.0",
        cpuCores: 4,
        totalMemoryBytes: "17179869184",
        daemonVersion: "2.0.0",
        ebpfSupported: true,
        cgroupsV2Active: true,
      },
      stats: {
        cpuUsagePercent: 0,
        memoryUsedBytes: "0",
        activeContainers: 0,
        hibernatingContainers: 0,
      },
    });
  }
});

// -------------------------------------------------------------
// Servers List & Details
// -------------------------------------------------------------
app.get("/servers", async (c) => {
  try {
    const dbServers = await prisma.server.findMany({
      include: {
        node: true,
        egg: true,
        allocations: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Also attempt live status query from daemon
    let daemonContainers: any[] = [];
    try {
      const client = getGrpcClient();
      const res = await client.listContainers();
      daemonContainers = res.containers || [];
    } catch {
      // Daemon might be offline or starting
    }

    const stateMap = new Map<string, any>();
    for (const c of daemonContainers) {
      stateMap.set(c.container_id, c);
    }

    const servers = dbServers.map((s) => {
      const live = stateMap.get(s.id);
      return {
        id: s.id,
        identifier: s.identifier,
        name: s.name,
        description: s.description,
        dockerImage: s.dockerImage,
        state: live ? (live.is_hibernating ? "HIBERNATING" : live.state === 3 ? "RUNNING" : "STOPPED") : s.state,
        memoryMb: Number(s.memoryLimitBytes / BigInt(1024 * 1024)),
        cpuLimitPercent: s.cpuLimitPercent,
        diskMb: Number(s.diskLimitBytes / BigInt(1024 * 1024)),
        ports: s.allocations.map((a) => `${a.ip}:${a.port}`),
        primaryPort: s.allocations[0] ? `${s.allocations[0].ip}:${s.allocations[0].port}` : "0.0.0.0:25565",
        hibernationEnabled: s.hibernationEnabled,
        createdAt: s.createdAt,
      };
    });

    return c.json({ servers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ servers: [], error: msg });
  }
});

// -------------------------------------------------------------
// Deploy / Create Server
// -------------------------------------------------------------
app.post("/servers", async (c) => {
  try {
    const body = await c.req.json();
    const {
      name,
      dockerImage = "ghcr.io/pterodactyl/yolks:java_17",
      startupCommand = "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar",
      memoryMb = 2048,
      cpuLimitPercent = 100,
      diskMb = 10240,
      port = 25565,
    } = body;

    // Ensure default node and user exist
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "admin@votion.app",
          username: "admin",
          passwordHash: "$2b$10$votionDefaultAdminHashPlaceHolderOnly123456",
          role: "ADMIN",
        },
      });
    }

    let node = await prisma.node.findFirst();
    if (!node) {
      node = await prisma.node.create({
        data: {
          name: "Default Host Node",
          fqdn: "127.0.0.1",
          daemonPort: 50051,
          wsPort: 50052,
          memoryLimitBytes: BigInt(32 * 1024) * BigInt(1024 * 1024),
          diskLimitBytes: BigInt(500 * 1024) * BigInt(1024 * 1024),
          cpuCores: 4,
          apiKey: "votion-node-key-01",
        },
      });
    }

    let egg = await prisma.egg.findFirst();
    if (!egg) {
      egg = await prisma.egg.create({
        data: {
          name: "Generic Container",
          author: "support@votion.app",
          dockerImages: { Default: dockerImage },
          startup: startupCommand,
          variables: [],
        },
      });
    }

    const shortId = Math.random().toString(16).substring(2, 10);
    const newServer = await prisma.server.create({
      data: {
        name,
        identifier: shortId,
        ownerId: user.id,
        nodeId: node.id,
        eggId: egg.id,
        dockerImage,
        startupCommand,
        memoryLimitBytes: BigInt(memoryMb) * BigInt(1024 * 1024),
        memoryHighBytes: BigInt(Math.floor(memoryMb * 0.9)) * BigInt(1024 * 1024),
        memorySwapBytes: BigInt(0),
        cpuLimitPercent,
        cpuWeight: 100,
        diskLimitBytes: BigInt(diskMb) * BigInt(1024 * 1024),
        ioWeight: 500,
        state: "STOPPED",
        allocations: {
          create: {
            nodeId: node.id,
            ip: "0.0.0.0",
            port,
            isPrimary: true,
          },
        },
      },
      include: {
        allocations: true,
      },
    });

    // Notify live Rust daemon via gRPC
    try {
      const client = getGrpcClient();
      await client.createContainer({
        id: newServer.id,
        name: newServer.name,
        image: newServer.dockerImage,
        entrypoint: "/bin/sh",
        arguments: ["-c", startupCommand.replace("{{SERVER_MEMORY}}", String(memoryMb))],
        working_dir: "/home/container",
        environment: {
          SERVER_MEMORY: String(memoryMb),
          SERVER_PORT: String(port),
          SERVER_IP: "0.0.0.0",
        },
        limits: {
          cpu_weight: 100,
          cpu_limit_percent: cpuLimitPercent,
          memory_limit_bytes: Number(newServer.memoryLimitBytes),
          memory_high_bytes: Number(newServer.memoryHighBytes),
          memory_swap_bytes: 0,
          disk_limit_bytes: Number(newServer.diskLimitBytes),
          io_weight: 500,
          network_bandwidth_kbps: 0,
        },
        ports: [
          {
            host_ip: "0.0.0.0",
            host_port: port,
            container_port: port,
            protocol: "tcp",
          },
        ],
        hibernation: {
          enabled: true,
          idle_timeout_seconds: 300,
          wake_on_packet: true,
          listen_ports: [port],
          grace_period_seconds: 10,
        },
        stop_signal: "SIGTERM",
        stop_timeout_seconds: 30,
      });
    } catch (daemonErr) {
      console.warn("Daemon notify note (is votion-node running?):", daemonErr);
    }

    return c.json({
      success: true,
      server: newServer,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: msg }, 500);
  }
});

// -------------------------------------------------------------
// Power Controls (Start, Stop, Restart, Kill, Hibernate)
// -------------------------------------------------------------
app.post("/servers/:id/power", async (c) => {
  const id = c.req.param("id");
  const { action } = await c.req.json();

  try {
    const client = getGrpcClient();

    switch (action) {
      case "start":
        await client.startContainer(id);
        break;
      case "stop":
        await client.stopContainer(id, 30);
        break;
      case "kill":
        await client.killContainer(id, "SIGKILL");
        break;
      case "hibernate":
        await client.setContainerHibernation(id, true);
        break;
      case "thaw":
        await client.setContainerHibernation(id, false);
        break;
      case "restart":
        await client.stopContainer(id, 15);
        await client.startContainer(id);
        break;
      default:
        return c.json({ error: "Invalid power action" }, 400);
    }

    return c.json({ success: true, action });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: msg }, 500);
  }
});

// -------------------------------------------------------------
// Terminal PTY Ticket Generation
// -------------------------------------------------------------
app.post("/servers/:id/token", (c) => {
  const serverId = c.req.param("id");
  const ticket = TokenSigner.signTicket(
    {
      server_id: serverId,
      user_id: "usr_admin",
      permissions: ["console.read", "console.write", "server.power"],
    },
    keyPair.privateKeyHex,
    300 // 5 minutes valid
  );

  return c.json({
    ticket,
    publicKey: keyPair.publicKeyHex,
    expiresIn: 300,
    wsUrl: `ws://127.0.0.1:50052/console?ticket=${ticket}`,
  });
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
