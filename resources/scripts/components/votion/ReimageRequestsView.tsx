import React from 'react';

export const ReimageRequestsView: React.FC = () => {
    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8">
            <div className="max-w-[1324px] mx-auto">
                <div className="border-b border-[#262626] pb-6 mb-8">
                    <h1 className="text-3xl font-serif font-normal text-[#FFFFFF] m-0">Server Reinstall Queue</h1>
                    <p className="text-xs text-[#A0A0A0] mt-1.5 m-0">Automated game server reinstallation requests, egg template switches, and disk wipe queue</p>
                </div>

                <div className="bg-[#121212] border border-[#262626] rounded-md p-8 text-center">
                    <p className="text-xs text-[#A0A0A0] m-0">No pending server reinstall requests in queue.</p>
                </div>
            </div>
        </div>
    );
};
