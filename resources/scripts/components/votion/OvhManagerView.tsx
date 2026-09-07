import React from 'react';

export const OvhManagerView: React.FC = () => {
    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8">
            <div className="max-w-[1324px] mx-auto">
                <div className="border-b border-[#262626] pb-6 mb-8">
                    <h1 className="text-3xl font-serif font-normal text-[#FFFFFF] m-0">Anti-DDoS &amp; Game Network Allocations</h1>
                    <p className="text-xs text-[#A0A0A0] mt-1.5 m-0">Low-latency UDP game routing, anti-DDoS mitigation, and dedicated port allocations</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                    <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#656B6B] block mb-1">Mitigation Mode</span>
                        <div className="text-xl font-mono font-semibold text-[#10B981]">Automatic Scrubbing</div>
                        <span className="text-xs text-[#A0A0A0] mt-1 block font-mono">BGP Shield Active</span>
                    </div>

                    <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#656B6B] block mb-1">Edge Throughput</span>
                        <div className="text-xl font-mono font-semibold text-[#FFFFFF]">420.5 Mbps</div>
                        <span className="text-xs text-[#A0A0A0] mt-1 block font-mono">0 dropped packets</span>
                    </div>

                    <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#656B6B] block mb-1">Carrier Network</span>
                        <div className="text-xl font-mono font-semibold text-[#FFFFFF]">Tier-1 Game Upstream</div>
                        <span className="text-xs text-[#A0A0A0] mt-1 block font-mono">Lunar Shield + Anycast BGP</span>
                    </div>
                </div>

                <div className="bg-[#121212] border border-[#262626] rounded-md p-6">
                    <h3 className="text-sm font-semibold text-[#FFFFFF] mb-2">Live Scrubbing Status</h3>
                    <p className="text-xs text-[#A0A0A0] leading-relaxed">
                        All edge points of presence are operational. Real-time SYN, UDP flood, and volumetric layer-7 inspections are running cleanly without latency penalty.
                    </p>
                </div>
            </div>
        </div>
    );
};
