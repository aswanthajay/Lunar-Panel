import { Hono } from "hono";
import { handle } from "hono/vercel";
import { TokenSigner } from "@/lib/token-signer";
import { EggParser } from "@/lib/egg-parser";

const app = new Hono().basePath("/api");

// Temporary in-memory keypair for developer convenience / demo testing
// In production, loaded from environment variables
const keyPair = TokenSigner.generateKeyPair();

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    version: "2.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/nodes", (c) => {
  return c.json({
    nodes: [
      {
        id: "node-us-east-1",
        name: "US East (Host Node 1)",
        fqdn: "127.0.0.1",
        daemonPort: 50051,
        wsPort: 50052,
        cgroupsV2: true,
        crunAvailable: true,
        ebpfAvailable: true,
      },
    ],
  });
});

app.post("/servers/:id/token", (c) => {
  const serverId = c.req.param("id");
  const ticket = TokenSigner.signTicket(
    {
      server_id: serverId,
      user_id: "usr_admin",
      permissions: ["console.read", "console.write", "server.power"],
    },
    keyPair.privateKeyHex,
    120 // 2 minutes valid
  );

  return c.json({
    ticket,
    publicKey: keyPair.publicKeyHex,
    expiresIn: 120,
    wsUrl: `ws://127.0.0.1:50052/console?ticket=${ticket}`,
  });
});

app.post("/eggs/parse", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = EggParser.parse(body);
    const compiled = EggParser.compile(parsed, {
      systemVariables: {
        serverMemoryMb: 2048,
        serverPort: 25565,
        serverIp: "0.0.0.0",
      },
    });

    return c.json({
      success: true,
      egg: parsed,
      compiled,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 400);
  }
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
