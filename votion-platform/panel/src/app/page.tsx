"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Server, 
  Cpu, 
  Activity, 
  Zap, 
  Moon, 
  ExternalLink,
  Plus,
  RefreshCw,
  X
} from "lucide-react";

interface ServerItem {
  id: string;
  identifier: string;
  name: string;
  dockerImage: string;
  state: "RUNNING" | "STOPPED" | "HIBERNATING";
  memoryMb: number;
  cpuLimitPercent: number;
  diskMb: number;
  primaryPort: string;
}

interface NodeLiveStats {
  connected: boolean;
  error?: string;
  info: {
    hostname: string;
    os: string;
    kernel: string;
    cpuCores: number;
  };
  stats: {
    cpuUsagePercent: number;
    memoryUsedBytes: string;
    activeContainers: number;
    hibernatingContainers: number;
  };
}

export default function DashboardPage() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [nodeData, setNodeData] = useState<NodeLiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [serverName, setServerName] = useState("My Paper Minecraft");
  const [dockerImage, setDockerImage] = useState("ghcr.io/pterodactyl/yolks:java_17");
  const [memoryMb, setMemoryMb] = useState(2048);
  const [port, setPort] = useState(25565);

  const fetchData = async () => {
    try {
      const [serversRes, nodeRes] = await Promise.all([
        fetch("/api/servers").then((r) => r.json()),
        fetch("/api/nodes/live").then((r) => r.json()),
      ]);

      if (serversRes.servers) {
        setServers(serversRes.servers);
      }
      setNodeData(nodeRes);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serverName,
          dockerImage,
          memoryMb: Number(memoryMb),
          port: Number(port),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDeployModalOpen(false);
        await fetchData();
      } else {
        alert("Failed to deploy: " + (data.error || "Unknown error"));
      }
    } catch (err: unknown) {
      alert("Error deploying: " + String(err));
    } finally {
      setCreating(false);
    }
  };

  const memoryUsedGb = nodeData?.stats?.memoryUsedBytes
    ? (Number(nodeData.stats.memoryUsedBytes) / (1024 * 1024 * 1024)).toFixed(2)
    : "0.00";

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1a2234] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Fleet Overview
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              votion-node 2.0
            </span>
            {nodeData && !nodeData.connected && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                Daemon Connecting...
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time cgroups v2 telemetry & low-overhead container virtualization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-[#151c2e] hover:bg-[#1e2740] text-slate-300 border border-[#222d47] transition-colors"
            title="Refresh Fleet"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeployModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Deploy Server
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#0b0f19] border border-[#1a2234] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total Servers</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{servers.length} Registered</div>
          <div className="text-xs text-emerald-400 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Host: {nodeData?.info?.hostname || "votion-node-01"}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0b0f19] border border-[#1a2234] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Host CPU (cgroups v2)</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {nodeData?.stats?.cpuUsagePercent ? `${nodeData.stats.cpuUsagePercent.toFixed(1)}%` : "0.0%"}
          </div>
          <div className="w-full bg-[#151c2e] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-400 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, nodeData?.stats?.cpuUsagePercent || 0))}%` }}
            ></div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0b0f19] border border-[#1a2234] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Host RAM Consumed</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{memoryUsedGb} GB</div>
          <div className="text-xs text-slate-400 font-mono">cgroups memory.current</div>
        </div>

        <div className="p-5 rounded-xl bg-[#0b0f19] border border-cyan-500/20 bg-gradient-to-br from-[#0b0f19] to-cyan-950/20 space-y-2">
          <div className="flex items-center justify-between text-xs text-cyan-300 font-medium">
            <span>Zero-Player Hibernation</span>
            <Moon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {nodeData?.stats?.hibernatingContainers || 0} Frozen
          </div>
          <div className="text-xs text-cyan-300/80 font-mono">Wake-on-Packet XDP armed</div>
        </div>
      </div>

      {/* Server Fleet List */}
      <div className="rounded-xl border border-[#1a2234] bg-[#0b0f19] overflow-hidden">
        <div className="p-4 border-b border-[#1a2234] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Server Fleet</h2>
          <span className="text-xs text-slate-500 font-mono">Native crun / OCI Runtime</span>
        </div>

        {servers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Server className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm text-slate-300 font-medium">No servers created yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click &quot;Deploy Server&quot; to launch your first game container, or import your existing Pterodactyl database records.
            </p>
            <button
              onClick={() => setDeployModalOpen(true)}
              className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Deploy Your First Server
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1a2234]">
            {servers.map((s) => (
              <div
                key={s.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#0f1424] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      s.state === "RUNNING"
                        ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                        : s.state === "HIBERNATING"
                        ? "bg-cyan-400 shadow-sm shadow-cyan-400/50 animate-pulse"
                        : "bg-slate-600"
                    }`}
                  />
                  <div>
                    <Link
                      href={`/servers/${s.id}`}
                      className="text-sm font-semibold text-white hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                    >
                      {s.name}
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </Link>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-slate-500">{s.identifier}</span>
                      <span>•</span>
                      <span className="font-mono text-cyan-400">{s.primaryPort}</span>
                      <span>•</span>
                      <span className="text-slate-500 truncate max-w-xs">{s.dockerImage}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs font-mono">
                  <div>
                    <div className="text-slate-500 text-[10px]">CPU LIMIT</div>
                    <div className="text-slate-200">{s.cpuLimitPercent}%</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">MEMORY</div>
                    <div className="text-slate-200">{(s.memoryMb / 1024).toFixed(1)} GB</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">STATE</div>
                    <div className={s.state === "RUNNING" ? "text-emerald-400" : s.state === "HIBERNATING" ? "text-cyan-400" : "text-slate-400"}>
                      {s.state}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/servers/${s.id}`}
                    className="px-3 py-1.5 rounded-md bg-[#151c2e] hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 text-xs font-medium transition-colors"
                  >
                    Console & Power
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deploy Server Modal */}
      {deployModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-[#1a2234] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1a2234] pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" /> Deploy New Server
              </h3>
              <button
                onClick={() => setDeployModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateServer} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Server Name</label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  required
                  className="w-full bg-[#151c2e] border border-[#222d47] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Docker/OCI Image</label>
                <input
                  type="text"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  required
                  className="w-full bg-[#151c2e] border border-[#222d47] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Memory (MB)</label>
                  <input
                    type="number"
                    value={memoryMb}
                    onChange={(e) => setMemoryMb(Number(e.target.value))}
                    required
                    min={256}
                    step={256}
                    className="w-full bg-[#151c2e] border border-[#222d47] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    required
                    min={1024}
                    max={65535}
                    className="w-full bg-[#151c2e] border border-[#222d47] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeployModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {creating ? "Deploying..." : "Launch Container"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
