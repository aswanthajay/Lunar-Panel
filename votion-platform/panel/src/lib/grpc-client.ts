/**
 * Votion Platform - Tonic / Node gRPC Client Bridge
 * 
 * High-performance gRPC client bridge connecting TypeScript Control Plane (Next.js / Hono)
 * with the distributed Rust host node daemon (votion-node).
 */

import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const PROTO_PATH = path.resolve(process.cwd(), "../proto/votion.proto");

export interface ClientConfig {
  host: string; // e.g. "127.0.0.1:50051"
  useTls?: boolean;
  apiKey?: string;
}

export class VotionGrpcClient {
  private client: any;
  private readonly address: string;

  constructor(config: ClientConfig) {
    this.address = config.host;

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
    const NodeService = protoDescriptor.votion.node.v1.NodeService;

    const credentials = config.useTls
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    // Setup client options with keepalives
    const options: grpc.ChannelOptions = {
      "grpc.keepalive_time_ms": 15000,
      "grpc.keepalive_timeout_ms": 5000,
      "grpc.keepalive_permit_without_calls": 1,
      "grpc.max_receive_message_length": 64 * 1024 * 1024, // 64 MB
    };

    this.client = new NodeService(this.address, credentials, options);
  }

  /**
   * Promisify generic unary gRPC calls
   */
  private invoke<TRequest, TResponse>(method: string, request: TRequest): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      this.client[method](request, (err: grpc.ServiceError | null, response: TResponse) => {
        if (err) {
          return reject(err);
        }
        resolve(response);
      });
    });
  }

  // --- Host Node Telemetry ---

  public async getNodeInfo(): Promise<any> {
    return this.invoke("GetNodeInfo", {});
  }

  public async getNodeStats(): Promise<any> {
    return this.invoke("GetNodeStats", {});
  }

  // --- Container Lifecycle ---

  public async createContainer(spec: any): Promise<any> {
    return this.invoke("CreateContainer", { spec });
  }

  public async startContainer(containerId: string): Promise<any> {
    return this.invoke("StartContainer", { container_id: containerId });
  }

  public async stopContainer(containerId: string, timeoutSeconds: number = 30): Promise<any> {
    return this.invoke("StopContainer", {
      container_id: containerId,
      timeout_seconds: timeoutSeconds,
    });
  }

  public async killContainer(containerId: string, signal: string = "SIGKILL"): Promise<any> {
    return this.invoke("KillContainer", {
      container_id: containerId,
      signal,
    });
  }

  public async deleteContainer(containerId: string, removeData: boolean = false): Promise<any> {
    return this.invoke("DeleteContainer", {
      container_id: containerId,
      remove_data: removeData,
    });
  }

  public async getContainerStatus(containerId: string): Promise<any> {
    return this.invoke("GetContainerStatus", { container_id: containerId });
  }

  public async listContainers(): Promise<any> {
    return this.invoke("ListContainers", {});
  }

  public async sendCommand(containerId: string, command: string): Promise<any> {
    return this.invoke("SendCommand", {
      container_id: containerId,
      command,
    });
  }

  public async setContainerHibernation(containerId: string, hibernate: boolean): Promise<any> {
    return this.invoke("SetContainerHibernation", {
      container_id: containerId,
      hibernate,
    });
  }

  public async syncContainerConfig(spec: any): Promise<any> {
    return this.invoke("SyncContainerConfig", { spec });
  }

  // --- Streaming Interfaces ---

  public streamContainerStats(
    containerId: string,
    intervalMs: number = 1000,
    onData: (data: any) => void,
    onError?: (err: Error) => void
  ): () => void {
    const stream = this.client.StreamContainerStats({
      container_id: containerId,
      interval_ms: intervalMs,
    });

    stream.on("data", onData);
    if (onError) {
      stream.on("error", onError);
    }

    return () => stream.cancel();
  }

  public streamContainerLogs(
    containerId: string,
    tailLines: number = 100,
    follow: boolean = true,
    onLog: (chunk: { data: Buffer; timestamp_ms: number; is_stderr: boolean }) => void,
    onError?: (err: Error) => void
  ): () => void {
    const stream = this.client.StreamContainerLogs({
      container_id: containerId,
      tail_lines: tailLines,
      follow,
    });

    stream.on("data", onLog);
    if (onError) {
      stream.on("error", onError);
    }

    return () => stream.cancel();
  }

  public close(): void {
    this.client.close();
  }
}
