import React from 'react';

export const ProxmoxConnectionsView: React.FC = () => {
    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8">
            <div className="max-w-[1324px] mx-auto">
                <div className="border-b border-[#262626] pb-6 mb-8">
                    <h1 className="text-3xl font-serif font-normal text-[#FFFFFF] m-0">Daemon Nodes &amp; Wings Clusters</h1>
                    <p className="text-xs text-[#A0A0A0] mt-1.5 m-0">High-performance Wings game daemons, node clusters, and storage pools</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-[#FFFFFF]">Lunar Local Node</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#062419] text-[#10B981] border border-[#064E3B]">Online</span>
                        </div>
                        <div className="space-y-2 text-xs font-mono text-[#A0A0A0]">
                            <div className="flex justify-between">
                                <span>Daemon Protocol</span>
                                <span className="text-[#FFFFFF]">Wings Daemon v1.11.8</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Storage Pool</span>
                                <span className="text-[#FFFFFF]">ZFS NVMe-0 (Healthy)</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Endpoint</span>
                                <span className="text-[#FFFFFF]">127.0.0.1:8088</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
