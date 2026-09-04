import React from 'react';

export const ClusterAuditLogsView: React.FC = () => {
    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8">
            <div className="max-w-[1324px] mx-auto">
                <div className="border-b border-[#262626] pb-6 mb-8">
                    <h1 className="text-3xl font-serif font-normal text-[#FFFFFF] m-0">Cluster Audit Logs</h1>
                    <p className="text-xs text-[#A0A0A0] mt-1.5 m-0">Immutable administrative actions, security trails, and infrastructure state changes</p>
                </div>

                <div className="bg-[#121212] border border-[#262626] rounded-md overflow-hidden">
                    <table className="w-full text-left text-xs text-[#F3F4F6]">
                        <thead className="bg-[#0A0A0A] border-b border-[#262626] text-[10px] font-mono uppercase text-[#656B6B]">
                            <tr>
                                <th className="py-3 px-4">Timestamp</th>
                                <th className="py-3 px-4">Actor</th>
                                <th className="py-3 px-4">Action Event</th>
                                <th className="py-3 px-4">Target Resource</th>
                                <th className="py-3 px-4">IP Address</th>
                                <th className="py-3 px-4 text-right">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#262626]">
                            <tr className="hover:bg-[#16161A]">
                                <td className="py-3 px-4 font-mono text-[#A0A0A0]">2026-09-03 01:10:07</td>
                                <td className="py-3 px-4 font-semibold text-[#FFFFFF]">stellaradmin</td>
                                <td className="py-3 px-4 text-[#FFFFFF]">Instance Power State Change (Start)</td>
                                <td className="py-3 px-4 font-mono text-[#A0A0A0]">Lunar Minecraft Server</td>
                                <td className="py-3 px-4 font-mono text-[#656B6B]">127.0.0.1</td>
                                <td className="py-3 px-4 text-right">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#062419] text-[#10B981] border border-[#064E3B]">Success</span>
                                </td>
                            </tr>
                            <tr className="hover:bg-[#16161A]">
                                <td className="py-3 px-4 font-mono text-[#A0A0A0]">2026-09-03 00:55:12</td>
                                <td className="py-3 px-4 font-semibold text-[#FFFFFF]">stellaradmin</td>
                                <td className="py-3 px-4 text-[#FFFFFF]">Security Token Authentication</td>
                                <td className="py-3 px-4 font-mono text-[#A0A0A0]">Web Client Session</td>
                                <td className="py-3 px-4 font-mono text-[#656B6B]">127.0.0.1</td>
                                <td className="py-3 px-4 text-right">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#062419] text-[#10B981] border border-[#064E3B]">Success</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
