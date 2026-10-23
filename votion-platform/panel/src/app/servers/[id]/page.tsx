"use client";

import { useState, use } from "react";
import Link from "next/link";
import { 
  Play, 
  Square, 
  RotateCw, 
  AlertOctagon, 
  Moon, 
  Terminal as TerminalIcon, 
  Activity, 
  HardDrive, 
  Cpu, 
  ArrowLeft,
  Copy,
  Check,
  Send
} from "lucide-react";

export default function ServerConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const serverId = resolvedParams.id;
  const [serverState, setServerState] = useState<"RUNNING" | "STOPPED" | "HIBERNATING">("RUNNING");
  const [commandInput, setCommandInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[votion-node] Starting OCI container srv-8f192b01 with crun v1.14...",
    "[votion-node] Attached to cgroups v2 /sys/fs/cgroup/votion/srv-8f192b01",
    "[votion-node] Configured memory.high=3.8GB, memory.max=4.0GB, cpu.weight=100",
    "[Paper] Loading libraries, please wait...",
    "[Paper] Starting minecraft server version 1.20.4",
    "[Paper] Loading recipes and datapacks...",
    "[Paper] Preparing level 'world'...",
    "[Paper] Time elapsed: 4812 ms",
    "[Paper] Done (5.102s)! For help, type \"help\"",
    "[votion-ebpf] XDP sniffer active on port 25565 - Zero-Player Hibernation armed.",
  ]);

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    setLogs((prev) => [...prev, `> ${commandInput}`, `[Server] Executed '${commandInput}'`]);
    setCommandInput("");
  };

  const copyIp = () => {
    navigator.clipboard.writeText("192.168.1.100:25565");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-white flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Fleet
        </Link>
        <span>/</span>
        <span className="text-slate-200">srv-8f192b01</span>
      </div>

      {/* Server Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1a2234] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Minecraft Survival SMP</h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                serverState === "RUNNING"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : serverState === "HIBERNATING"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              {serverState}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            <span className="font-mono">srv-8f192b01</span>
            <span>•</span>
            <button
              onClick={copyIp}
              className="flex items-center gap-1 text-slate-300 hover:text-white font-mono transition-colors"
            >
              192.168.1.100:25565
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
            </button>
            <span>•</span>
            <span className="text-slate-500">Node: node-us-east-1 (crun/Linux)</span>
          </div>
        </div>

        {/* Power Actions */}
        <div className="flex items-center gap-2">
          {serverState === "STOPPED" ? (
            <button
              onClick={() => setServerState("RUNNING")}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setLogs((prev) => [...prev, "[votion-node] Sent SIGTERM to container process."]);
                  setServerState("STOPPED");
                }}
                className="px-3.5 py-2 rounded-lg bg-[#151c2e] hover:bg-rose-950/40 text-rose-300 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Square className="w-3.5 h-3.5 text-rose-400" /> Stop
              </button>

              <button
                onClick={() => {
                  setLogs((prev) => [...prev, "[votion-node] Restarting container..."]);
                }}
                className="px-3.5 py-2 rounded-lg bg-[#151c2e] hover:bg-[#1e2740] text-slate-200 border border-[#222d47] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-400" /> Restart
              </button>

              <button
                onClick={() => {
                  if (serverState === "RUNNING") {
                    setLogs((prev) => [...prev, "[votion-node] Freezing cgroup v2 (Instant Hibernation)..."]);
                    setServerState("HIBERNATING");
                  } else {
                    setLogs((prev) => [...prev, "[votion-node] Thawing cgroup v2 (Woke up)..."]);
                    setServerState("RUNNING");
                  }
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  serverState === "HIBERNATING"
                    ? "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500"
                    : "bg-[#151c2e] hover:bg-cyan-950/40 text-cyan-300 border-cyan-500/20"
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
                {serverState === "HIBERNATING" ? "Thaw / Wake" : "Freeze / Hibernate"}
              </button>

              <button
                onClick={() => {
                  setLogs((prev) => [...prev, "[votion-node] Sent SIGKILL (Force Kill)"]);
                  setServerState("STOPPED");
                }}
                className="p-2 rounded-lg bg-[#151c2e] hover:bg-rose-900/40 text-rose-400 border border-rose-500/20 transition-colors"
                title="Force Kill"
              >
                <AlertOctagon className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live Telemetry Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1a2234]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>CPU Usage</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {serverState === "RUNNING" ? "14.2%" : "0.0%"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Limit: 200% (2 Cores)</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1a2234]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Memory (cgroups v2)</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {serverState === "RUNNING" ? "2.14 GB" : serverState === "HIBERNATING" ? "128 MB (Frozen)" : "0 MB"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Max: 4.00 GB</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1a2234]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Disk Usage</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">5.42 GB</div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Quota: 20.00 GB</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1a2234]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Zero-Player XDP</span>
            <Moon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
            {serverState === "HIBERNATING" ? "Sleeping" : "Armed (0/20)"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Idle Timeout: 300s</div>
        </div>
      </div>

      {/* Interactive Terminal PTY */}
      <div className="rounded-xl border border-[#1a2234] bg-[#07090e] overflow-hidden shadow-2xl flex flex-col h-[460px]">
        {/* Terminal Header */}
        <div className="h-10 bg-[#0c101a] border-b border-[#1a2234] px-4 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-mono text-slate-300 font-medium">Terminal PTY Console</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Ed25519 Verified
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500">crun /dev/pts/0</div>
        </div>

        {/* Terminal Output Stream */}
        <div className="flex-1 p-4 font-mono text-xs text-slate-300 overflow-y-auto space-y-1 select-text bg-[#070a10]">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`${
                log.startsWith(">")
                  ? "text-cyan-400 font-semibold"
                  : log.includes("votion-node")
                  ? "text-indigo-400"
                  : log.includes("votion-ebpf")
                  ? "text-cyan-300"
                  : "text-slate-300"
              }`}
            >
              {log}
            </div>
          ))}
        </div>

        {/* Command Input Box */}
        <form
          onSubmit={handleSendCommand}
          className="h-12 bg-[#0c101a] border-t border-[#1a2234] px-3 flex items-center gap-2"
        >
          <span className="text-xs font-mono text-indigo-400 font-bold pl-2">&gt;</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type a server command (e.g. 'say Hello', 'op admin', 'list')..."
            className="flex-1 bg-transparent border-0 text-xs font-mono text-white placeholder-slate-600 focus:outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono flex items-center gap-1 transition-colors"
          >
            <Send className="w-3 h-3" /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
