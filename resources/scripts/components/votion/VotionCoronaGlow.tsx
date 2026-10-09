import React from 'react';

/**
 * 1:1 Solar Corona / Radiant Torus Arch from Votion Cloud's main web (votioncloud.com)
 * Recreates the fiery amber glowing fiber ring arched over the hero section.
 */
export const VotionCoronaGlow: React.FC = () => {
    // Generate curved fiber lines for the radiant corona
    const fiberLines = Array.from({ length: 48 }, (_, i) => {
        const offset = (i - 24) * 14;
        const angle = (i / 48) * Math.PI;
        const x1 = 500 + Math.cos(angle) * 360;
        const y1 = 180 - Math.sin(angle) * 120;
        const x2 = 500 + offset * 1.6;
        const y2 = 420;
        const opacity = Math.sin(angle) * 0.55 + 0.15;
        const strokeColor = i % 2 === 0 ? 'rgba(255, 122, 24, ' + opacity + ')' : 'rgba(235, 80, 44, ' + opacity + ')';
        return { id: i, x1, y1, x2, y2, strokeColor };
    });

    return (
        <div
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1300px] h-[480px] overflow-hidden z-0 select-none"
            aria-hidden="true"
        >
            {/* 1. Deep fiery radial glow backdrop */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 60% 45% at 50% 12%, rgba(255, 85, 0, 0.42) 0%, rgba(235, 80, 44, 0.22) 32%, rgba(18, 10, 5, 0.1) 60%, rgba(0, 0, 0, 0) 80%)',
                }}
            />

            {/* 2. Secondary soft ambient horizontal corona bloom */}
            <div
                className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-[700px] h-[260px] blur-[60px]"
                style={{
                    background:
                        'radial-gradient(ellipse at center, rgba(255, 130, 20, 0.35) 0%, rgba(235, 70, 30, 0.15) 50%, transparent 80%)',
                }}
            />

            {/* 3. Arching Solar Torus Fibers SVG */}
            <svg
                viewBox="0 0 1000 480"
                className="absolute inset-0 w-full h-full mix-blend-screen"
                preserveAspectRatio="xMidYMin slice"
            >
                <defs>
                    {/* Glowing golden-orange gradient for the corona rim */}
                    <linearGradient id="coronaRimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#eb502c" stopOpacity="0.2" />
                        <stop offset="25%" stopColor="#ff5500" stopOpacity="0.9" />
                        <stop offset="50%" stopColor="#ffb066" stopOpacity="1" />
                        <stop offset="75%" stopColor="#ff5500" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#eb502c" stopOpacity="0.2" />
                    </linearGradient>

                    {/* Radial glow filter */}
                    <filter id="coronaGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Sweeping fibrous radial ribs */}
                <g filter="url(#coronaGlow)">
                    {fiberLines.map((line) => (
                        <path
                            key={line.id}
                            d={`M ${line.x1} ${line.y1} Q 500 ${line.y1 + 100} ${line.x2} ${line.y2}`}
                            fill="none"
                            stroke={line.strokeColor}
                            strokeWidth="1.2"
                            strokeLinecap="round"
                        />
                    ))}
                </g>

                {/* Primary arching corona ring */}
                <path
                    d="M 120 280 C 260 50, 740 50, 880 280"
                    fill="none"
                    stroke="url(#coronaRimGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#coronaGlow)"
                />

                {/* Secondary inner sharp ring */}
                <path
                    d="M 170 270 C 290 80, 710 80, 830 270"
                    fill="none"
                    stroke="rgba(255, 230, 180, 0.75)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />

                {/* Glowing ember dust dots matching the reference */}
                <circle cx="280" cy="190" r="1.5" fill="#ffaa40" opacity="0.8" />
                <circle cx="340" cy="140" r="2" fill="#ffd599" opacity="0.9" />
                <circle cx="420" cy="100" r="1" fill="#ff7a18" opacity="0.7" />
                <circle cx="580" cy="95" r="2" fill="#ffe2b3" opacity="0.9" />
                <circle cx="650" cy="130" r="1.5" fill="#ffaa40" opacity="0.8" />
                <circle cx="720" cy="180" r="1.8" fill="#ff7a18" opacity="0.75" />
                <circle cx="240" cy="240" r="1" fill="#eb502c" opacity="0.6" />
                <circle cx="760" cy="235" r="1.2" fill="#eb502c" opacity="0.65" />
            </svg>

            {/* Bottom feathering gradient to blend seamlessly into pure black */}
            <div
                className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
                style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000000 100%)',
                }}
            />
        </div>
    );
};

export default VotionCoronaGlow;
