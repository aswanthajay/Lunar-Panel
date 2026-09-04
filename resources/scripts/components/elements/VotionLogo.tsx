import React from 'react';

export interface VotionLogoProps {
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'badge' | 'text-only' | 'svg';
    style?: React.CSSProperties;
}

/**
 * Votion Logo with signature chromatic aberration (anaglyph / RGB split)
 * Crafted purely in CSS/SVG to match the Votion brand design without raster image artifacts.
 */
export const VotionLogo: React.FC<VotionLogoProps> = ({
    className = '',
    size = 'sm',
    variant = 'badge',
    style = {},
}) => {
    // Exact sizing profiles matching component dimensions
    const sizeConfig = {
        xs: {
            badge: 'px-1.5 py-0.5 border text-[11px]',
            text: 'text-[11px] leading-[1.1]',
            shadow: '-1px 0 0 #00f0ff, 1px 0 0 #ff3333',
            svgWidth: 72,
            svgHeight: 30,
        },
        sm: {
            badge: 'px-2.5 py-0.5 border text-sm',
            text: 'text-sm leading-[1.15]',
            shadow: '-1.25px 0 0 #00f0ff, 1.25px 0 0 #ff3333',
            svgWidth: 90,
            svgHeight: 38,
        },
        md: {
            badge: 'px-3.5 py-1 border-[1.5px] text-base',
            text: 'text-base leading-[1.2]',
            shadow: '-1.5px 0 0 #00f0ff, 1.5px 0 0 #ff3333',
            svgWidth: 108,
            svgHeight: 45,
        },
        lg: {
            badge: 'px-4 py-1.5 border-2 text-xl',
            text: 'text-xl leading-[1.2]',
            shadow: '-1.8px 0 0 #00f0ff, 1.8px 0 0 #ff3333',
            svgWidth: 126,
            svgHeight: 52,
        },
    }[size];

    if (variant === 'svg') {
        return (
            <svg
                width={sizeConfig.svgWidth}
                height={sizeConfig.svgHeight}
                viewBox="0 0 120 50"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`select-none shrink-0 ${className}`}
                style={style}
                aria-label="Votion"
                role="img"
            >
                <rect x="2.5" y="2.5" width="115" height="45" rx="3" fill="#000000" stroke="#404047" strokeWidth="2.5" />
                <text
                    x="58.5"
                    y="32.5"
                    textAnchor="middle"
                    fill="#00f6f6"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    fontSize="24"
                    fontWeight="900"
                    letterSpacing="-0.03em"
                >
                    votion
                </text>
                <text
                    x="61.5"
                    y="32.5"
                    textAnchor="middle"
                    fill="#f60000"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    fontSize="24"
                    fontWeight="900"
                    letterSpacing="-0.03em"
                >
                    votion
                </text>
                <text
                    x="60"
                    y="32.5"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    fontSize="24"
                    fontWeight="900"
                    letterSpacing="-0.03em"
                >
                    votion
                </text>
            </svg>
        );
    }

    if (variant === 'text-only') {
        return (
            <span
                className={`votion-chromatic-text font-black lowercase tracking-tight select-none ${sizeConfig.text} ${className}`}
                style={{
                    color: '#ffffff',
                    textShadow: sizeConfig.shadow,
                    ...style,
                }}
            >
                votion
            </span>
        );
    }

    return (
        <div
            className={`votion-logo-badge inline-flex items-center justify-center bg-[#000000] border-[#404047] rounded-[3px] select-none transition-colors duration-150 ${sizeConfig.badge} ${className}`}
            style={{
                backgroundColor: '#000000',
                ...style,
            }}
        >
            <span
                className={`votion-chromatic-text font-black lowercase tracking-tight ${sizeConfig.text}`}
                style={{
                    color: '#ffffff',
                    textShadow: sizeConfig.shadow,
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                }}
            >
                votion
            </span>
        </div>
    );
};

export default VotionLogo;
