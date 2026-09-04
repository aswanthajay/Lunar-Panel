import React from 'react';

export interface VotionLogoProps {
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'badge' | 'text-only' | 'svg';
    theme?: 'dark' | 'light';
    style?: React.CSSProperties;
}

/**
 * Votion Logo Component
 * 1:1 pixel-perfect match with the authentic reference from Votion frontend folder
 * (theme-brand-logo / logo-box-frame).
 */
export const VotionLogo: React.FC<VotionLogoProps> = ({
    className = '',
    size = 'sm',
    variant = 'badge',
    theme = 'dark',
    style = {},
}) => {
    const isDark = theme === 'dark';

    // Sizing profiles matching exact padding & typography from votion-frontend
    const sizeConfig = {
        xs: {
            badge: 'px-2 py-0.5 border text-xs',
            text: 'text-[11px] leading-tight',
            svgWidth: 70,
            svgHeight: 26,
            fontSize: 14,
        },
        sm: {
            badge: 'px-2.5 py-0.5 border-[1.5px] text-sm',
            text: 'text-xs sm:text-[13px] leading-tight',
            svgWidth: 84,
            svgHeight: 30,
            fontSize: 16,
        },
        md: {
            badge: 'px-3 py-0.5 border-2 text-base',
            text: 'text-sm sm:text-base leading-tight',
            svgWidth: 100,
            svgHeight: 36,
            fontSize: 19,
        },
        lg: {
            badge: 'px-4 py-1 border-2 text-xl',
            text: 'text-lg sm:text-xl leading-tight',
            svgWidth: 120,
            svgHeight: 44,
            fontSize: 22,
        },
    }[size];

    const textColor = isDark ? '#ededed' : '#111111';
    const bgColor = isDark ? '#0a0a0a' : '#ffffff';
    const borderColor = isDark ? '#3f3f46' : '#111111';

    if (variant === 'svg') {
        return (
            <svg
                width={sizeConfig.svgWidth}
                height={sizeConfig.svgHeight}
                viewBox="0 0 120 44"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`select-none shrink-0 ${className}`}
                style={style}
                aria-label="votion"
                role="img"
            >
                <rect x="2" y="2" width="116" height="40" rx="3" fill={bgColor} stroke={borderColor} strokeWidth="2" />
                <text
                    x="60"
                    y="28"
                    textAnchor="middle"
                    fill={textColor}
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    fontSize={sizeConfig.fontSize}
                    fontWeight="800"
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
                className={`votion-logo-text font-extrabold lowercase tracking-tight select-none ${sizeConfig.text} ${className}`}
                style={{
                    color: textColor,
                    ...style,
                }}
            >
                votion
            </span>
        );
    }

    return (
        <div
            className={`theme-brand-logo votion-logo-badge inline-flex items-center justify-center rounded-[3px] select-none transition-colors duration-150 ${sizeConfig.badge} ${className}`}
            style={{
                backgroundColor: bgColor,
                borderColor: borderColor,
                color: textColor,
                boxShadow: isDark ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.04)' : 'none',
                ...style,
            }}
        >
            <span
                className={`votion-logo-text font-extrabold lowercase tracking-tight ${sizeConfig.text}`}
                style={{
                    color: textColor,
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                }}
            >
                votion
            </span>
        </div>
    );
};

export default VotionLogo;
