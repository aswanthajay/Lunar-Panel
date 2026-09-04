import React from 'react';
import tw from 'twin.macro';

export default () => {
    return (
        <div className={'grid grid-cols-1 md:grid-cols-2 gap-3 w-full font-sans'}>
            <div className={'bg-[#000000] border border-[#1F1F1F] rounded-md overflow-hidden'}>
                <div className={'py-2.5 px-4 bg-[#050505] border-b border-[#1A1A1A]'}>
                    <span className={'text-[10px] font-mono uppercase tracking-wider text-[#A0A0A0]'}>Examples</span>
                </div>
                <div className={'divide-y divide-[#141414] text-xs'}>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>*/5 * * * *</div>
                        <div className={'w-1/2 text-[#737373]'}>every 5 minutes</div>
                    </div>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>0 */1 * * *</div>
                        <div className={'w-1/2 text-[#737373]'}>every hour</div>
                    </div>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>0 8-12 * * *</div>
                        <div className={'w-1/2 text-[#737373]'}>hour range</div>
                    </div>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>0 0 * * *</div>
                        <div className={'w-1/2 text-[#737373]'}>once a day</div>
                    </div>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>0 0 * * MON</div>
                        <div className={'w-1/2 text-[#737373]'}>every Monday</div>
                    </div>
                </div>
            </div>

            <div className={'bg-[#000000] border border-[#1F1F1F] rounded-md overflow-hidden'}>
                <div className={'py-2.5 px-4 bg-[#050505] border-b border-[#1A1A1A]'}>
                    <span className={'text-[10px] font-mono uppercase tracking-wider text-[#A0A0A0]'}>Special Characters</span>
                </div>
                <div className={'divide-y divide-[#141414] text-xs'}>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>*</div>
                        <div className={'w-1/2 text-[#737373]'}>any value</div>
                    </div>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>,</div>
                        <div className={'w-1/2 text-[#737373]'}>value list separator</div>
                    </div>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>-</div>
                        <div className={'w-1/2 text-[#737373]'}>range values</div>
                    </div>
                    <div className={'flex py-2 px-4 hover:bg-[#0A0A0A] transition-colors'}>
                        <div className={'w-1/2 font-mono text-[#FFFFFF]'}>/</div>
                        <div className={'w-1/2 text-[#737373]'}>step values</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
