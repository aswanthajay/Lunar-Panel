import React from 'react';

export const NebulaBackground: React.FC = () => {
    return (
        <div
            className="nebula-bg-container absolute inset-0 pointer-events-none overflow-hidden select-none z-0"
            aria-hidden="true"
        >
            {/* Deep space base */}
            <div className="absolute inset-0 bg-[#000000]" />

            {/* Glowing Purple Nebula Mesh */}
            <div className="absolute inset-0 overflow-hidden">
                {/* 1. Primary Radiant Purple Core (Upper Right) */}
                <div
                    className="absolute -top-[12%] -right-[6%] w-[680px] h-[580px] sm:w-[850px] sm:h-[720px] lg:w-[1100px] lg:h-[900px] rounded-full animate-nebula-pulse"
                    style={{
                        background:
                            'radial-gradient(circle at 65% 35%, rgba(147, 51, 234, 0.45) 0%, rgba(126, 34, 206, 0.35) 25%, rgba(88, 28, 135, 0.24) 50%, rgba(59, 7, 100, 0.12) 70%, transparent 85%)',
                        filter: 'blur(85px)',
                    }}
                />

                {/* 2. Secondary Ambient Violet Drift (Upper-Right / Center) */}
                <div
                    className="absolute top-[6%] right-[10%] w-[550px] h-[480px] sm:w-[700px] sm:h-[600px] lg:w-[900px] lg:h-[700px] rounded-full animate-nebula-drift"
                    style={{
                        background:
                            'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.3) 0%, rgba(109, 40, 217, 0.22) 35%, rgba(67, 24, 114, 0.14) 60%, transparent 80%)',
                        filter: 'blur(95px)',
                    }}
                />

                {/* 3. Tertiary Deep Ultraviolet Glow (Top Horizon) */}
                <div
                    className="absolute -top-[18%] right-[8%] sm:right-[20%] w-[600px] h-[380px] lg:w-[950px] lg:h-[480px] rounded-full animate-nebula-float"
                    style={{
                        background:
                            'radial-gradient(ellipse at 60% 30%, rgba(192, 38, 211, 0.18) 0%, rgba(124, 58, 237, 0.2) 35%, rgba(76, 29, 149, 0.12) 65%, transparent 85%)',
                        filter: 'blur(105px)',
                    }}
                />

                {/* 4. Soft Vignette: feathers bottom into pure black and maintains solid dark contrast on the left */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.15) 45%, rgba(0, 0, 0, 0.75) 85%, #000000 100%), linear-gradient(to right, rgba(0, 0, 0, 0.6) 0%, transparent 35%)',
                    }}
                />
            </div>
        </div>
    );
};

export default NebulaBackground;
