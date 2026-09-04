import React from 'react';

export const SystemSettingsView: React.FC = () => {
    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8">
            <div className="max-w-[1324px] mx-auto">
                <div className="border-b border-[#262626] pb-6 mb-8">
                    <h1 className="text-3xl font-serif font-normal text-[#FFFFFF] m-0">System Settings</h1>
                    <p className="text-xs text-[#A0A0A0] mt-1.5 m-0">Global cluster configuration, telemetry polling intervals, and security policies</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                        <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">Cluster Orchestration</h3>
                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Cluster Display Name</label>
                                <input type="text" defaultValue="Stellar Primary Cluster" className="w-full bg-[#0A0A0A] border border-[#262626] p-2 rounded text-xs text-white" />
                            </div>
                            <div>
                                <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Telemetry Sync Interval (seconds)</label>
                                <input type="number" defaultValue={15} className="w-full bg-[#0A0A0A] border border-[#262626] p-2 rounded text-xs text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                        <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">Security &amp; API Policies</h3>
                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Session Inactivity Timeout</label>
                                <input type="text" defaultValue="2 hours" className="w-full bg-[#0A0A0A] border border-[#262626] p-2 rounded text-xs text-white" />
                            </div>
                            <div>
                                <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">SSL Certificate Expiry Warning</label>
                                <input type="text" defaultValue="14 days prior" className="w-full bg-[#0A0A0A] border border-[#262626] p-2 rounded text-xs text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
