import Link from "next/link";
import { 
  Server, 
  Cpu, 
  HardDrive, 
  Activity, 
  Zap, 
  Moon, 
  Play, 
  Square, 
  RotateCw,
  ExternalLink,
  ShieldAlert
} from "lucide-react";

export default function DashboardPage() {
  const mockServers = [
    {
      id: "srv-8f192b01",
      name: "Minecraft Survival SMP",
      game: "Paper 1.20.4",
      node: "node-us-east-1",
      ip: "192.168.1.100:25565",
      status: "RUNNING",
      cpu: "14.2%",
      memory: "2.1 GB / 4.0 GB",
      disk: "5.4 GB / 20 GB",
      hibernation: "Armed (Auto-freeze on 0 players)",
    },
    {
      id: "srv-4c781a99",
      name: "Votion Code Studio",
      game: "VS Code Cloud",
      node: "node-us-east-1",
      ip: "192.168.1.100:8443",
      status: "HIBERNATING",
      cpu: "0.0%",
      memory: "128 MB / 2.0 GB (Frozen)",
      disk: "1.2 GB / 10 GB",
      hibernation: "Z-P Snoozed (Wakes on HTTP SYN)",
    },
    {
      id: "srv-99a32c45",
      name: "Rust Vanilla Community",
      game: "Rust Dedicated",
      node: "node-eu-central-1",
      ip: "10.0.0.15:28015",
      status: "STOPPED",
      cpu: "0.0%",
      memory: "0 MB / 8.0 GB",
      disk: "12.8 GB / 50 GB",
      hibernation: "Disabled",
    },
  ];

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
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time cgroups v2 telemetry & low-overhead container virtualization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/servers/create"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Deploy Server
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#0b0f19] border border-[#1a2234] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total Servers</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">3 Active</div>
          <div className="text-xs text-emerald-400 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            100% Host Uptime
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0b0f19] border border-[#1a2234] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Host CPU (cgroups v2)</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">4.8%</div>
          <div className="w-full bg-[#151c2e] h-1.5 rounded-full overflow-hidden">
            <div className="bg-cyan-400 h-full w-[4.8%]"></div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0b0f19] border border-[#1a2234] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Allocated Memory</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">2.23 GB</div>
          <div className="text-xs text-slate-400 font-mono">of 32.0 GB Host Pool</div>
        </div>

        <div className="p-5 rounded-xl bg-[#0b0f19] border border-cyan-500/20 bg-gradient-to-br from-[#0b0f19] to-cyan-950/20 space-y-2">
          <div className="flex items-center justify-between text-xs text-cyan-300 font-medium">
            <span>Zero-Player Savings</span>
            <Moon className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-white">1 Frozen</div>
          <div className="text-xs text-cyan-300/80 font-mono">
            ~1.87 GB RAM freed to host
          </div>
        </div>
      </div>

      {/* Server Fleet Table */}
      <div className="rounded-xl border border-[#1a2234] bg-[#0b0f19] overflow-hidden">
        <div className="p-4 border-b border-[#1a2234] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Server Fleet</h2>
          <span className="text-xs text-slate-500 font-mono">Fast crun / OCI Runtime</span>
        </div>

        <div className="divide-y divide-[#1a2234]">
          {mockServers.map((s) => (
            <div
              key={s.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#0f1424] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    s.status === "RUNNING"
                      ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                      : s.status === "HIBERNATING"
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
                    <span>{s.game}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-400">{s.ip}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs font-mono">
                <div>
                  <div className="text-slate-500 text-[10px]">CPU</div>
                  <div className="text-slate-200">{s.cpu}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">MEMORY</div>
                  <div className="text-slate-200">{s.memory}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">HIBERNATION</div>
                  <div className="text-cyan-400">{s.hibernation}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/servers/${s.id}`}
                  className="px-3 py-1.5 rounded-md bg-[#151c2e] hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 text-xs font-medium transition-colors"
                >
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
