import React from 'react';

export const NebulaBackground: React.FC = () => {
    return (
        <div
            className="nebula-bg-container fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
            aria-hidden="true"
        >
            {/* Pure deep black base */}
            <div className="absolute inset-0 bg-[#000000]" />

            {/* Glowing Cosmic Purple Nebula Mesh */}
            <div className="absolute inset-0 overflow-hidden">
                {/* 1. Primary High-Density Ultraviolet Radiant Core (Upper-Right & Center-Right) */}
                <div
                    className="absolute -top-[15%] -right-[8%] w-[1100px] sm:w-[1400px] lg:w-[1700px] xl:w-[2000px] h-[750px] sm:h-[950px] lg:h-[1150px] rounded-full animate-nebula-pulse"
                    style={{
                        background:
                            'radial-gradient(ellipse 65% 55% at 65% 30%, rgba(147, 51, 234, 0.48) 0%, rgba(126, 34, 206, 0.38) 25%, rgba(88, 28, 135, 0.25) 50%, rgba(59, 7, 100, 0.12) 72%, transparent 90%)',
                        filter: 'blur(80px)',
                    }}
                />

                {/* 2. Secondary Ambient Violet Atmospheric Cloud (Upper Center & Right) */}
                <div
                    className="absolute top-[2%] right-[10%] sm:right-[16%] w-[950px] sm:w-[1250px] lg:w-[1550px] xl:w-[1850px] h-[650px] sm:h-[850px] lg:h-[1050px] rounded-full animate-nebula-drift"
                    style={{
                        background:
                            'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(168, 85, 247, 0.32) 0%, rgba(109, 40, 217, 0.24) 30%, rgba(76, 29, 149, 0.15) 55%, rgba(46, 16, 101, 0.06) 75%, transparent 88%)',
                        filter: 'blur(95px)',
                    }}
                />

                {/* 3. Tertiary Ultraviolet Horizon Bleed (Top Navigation Edge) */}
                <div
                    className="absolute -top-[20%] right-[0%] sm:right-[5%] w-[1000px] sm:w-[1300px] lg:w-[1650px] h-[500px] sm:h-[650px] lg:h-[800px] rounded-full animate-nebula-float"
                    style={{
                        background:
                            'radial-gradient(ellipse 70% 45% at 60% 25%, rgba(192, 38, 211, 0.24) 0%, rgba(139, 92, 246, 0.22) 32%, rgba(88, 28, 135, 0.12) 60%, transparent 85%)',
                        filter: 'blur(105px)',
                    }}
                />

                {/* 4. Smooth Feathering: keeps lower page deep black without cutting off the horizontal spread */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.05) 35%, rgba(0, 0, 0, 0.5) 70%, #000000 100%)',
                    }}
                />
            </div>
        </div>
    );
};

export default NebulaBackground;
