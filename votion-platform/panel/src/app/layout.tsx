import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { 
  Server, 
  Cpu, 
  Layers, 
  Terminal, 
  ShieldCheck, 
  Activity,
  HardDrive
} from "lucide-react";

export const metadata: Metadata = {
  title: "Votion Platform | Control Plane 2.0",
  description: "Next-generation cloud game server control plane powered by Rust & crun",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07090e] text-[#f1f5f9] flex antialiased">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#1a2234] bg-[#0b0f19] flex flex-col shrink-0 select-none">
          <div className="h-16 flex items-center px-6 border-b border-[#1a2234] gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              V
            </div>
            <div>
              <div className="font-semibold text-sm tracking-wide text-white">VOTION</div>
              <div className="text-[10px] text-cyan-400 font-mono font-medium">CONTROL PLANE 2.0</div>
            </div>
          </div>

          <nav className="p-4 space-y-1.5 flex-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              Management
            </div>
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-[#151c2e] transition-colors"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              Fleet Overview
            </Link>
            <Link
              href="/servers"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-[#151c2e] transition-colors"
            >
              <Server className="w-4 h-4 text-indigo-400" />
              Servers
            </Link>
            <Link
              href="/nodes"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-[#151c2e] transition-colors"
            >
              <Cpu className="w-4 h-4 text-emerald-400" />
              Daemon Nodes
            </Link>
            <Link
              href="/eggs"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-[#151c2e] transition-colors"
            >
              <Layers className="w-4 h-4 text-amber-400" />
              Egg Templates
            </Link>

            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 pt-6 mb-2">
              Infrastructure
            </div>
            <div className="px-3 py-2 rounded-lg text-xs font-mono text-slate-400 bg-[#0f1422] border border-[#1a2234] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Daemon
                </span>
                <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate">votion-node v2.0 (crun/cgroups)</div>
            </div>
          </nav>

          <div className="p-4 border-t border-[#1a2234]">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-[#0e1322] border border-[#1a2234]">
              <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/40">
                A
              </div>
              <div className="flex-1 truncate">
                <div className="text-xs font-medium text-slate-200 truncate">Administrator</div>
                <div className="text-[10px] text-slate-500 truncate">admin@votion.app</div>
              </div>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
