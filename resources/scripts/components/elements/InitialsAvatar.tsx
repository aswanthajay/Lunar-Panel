import React, { useMemo } from 'react';

interface Props {
    name?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    shape?: 'circle' | 'rounded';
    className?: string;
    twoChars?: boolean;
}

const PALETTES = [
    { bg: '#1E1B4B', border: '#3730A3', text: '#C7D2FE' }, // Deep Indigo
    { bg: '#064E3B', border: '#065F46', text: '#A7F3D0' }, // Deep Emerald
    { bg: '#3B0764', border: '#581C87', text: '#E9D5FF' }, // Deep Purple
    { bg: '#1E293B', border: '#334155', text: '#CBD5E1' }, // Deep Slate
    { bg: '#4C0519', border: '#881337', text: '#FECDD3' }, // Deep Rose
    { bg: '#082F49', border: '#075985', text: '#BAE6FD' }, // Deep Sky
    { bg: '#451A03', border: '#78350F', text: '#FDE68A' }, // Deep Amber
    { bg: '#14532D', border: '#166534', text: '#BBF7D0' }, // Deep Green
    { bg: '#500724', border: '#831843', text: '#FBCFE8' }, // Deep Pink
    { bg: '#134E4A', border: '#115E59', text: '#99F6E4' }, // Deep Teal
    { bg: '#172554', border: '#1E40AF', text: '#BFDBFE' }, // Deep Blue
    { bg: '#2E1065', border: '#4C1D95', text: '#DDD6FE' }, // Deep Violet
];

function getHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function extractInitials(name?: string, twoChars = false): string {
    if (!name || typeof name !== 'string') return 'U';
    const clean = name.includes('@') ? name.split('@')[0] : name;
    const parts = clean.trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (twoChars && clean.length >= 2) {
        return clean.slice(0, 2).toUpperCase();
    }
    return clean.slice(0, 1).toUpperCase() || 'U';
}

const SIZE_STYLES = {
    xs: { dim: 'w-5 h-5', text: 'text-[9px]' },
    sm: { dim: 'w-7 h-7', text: 'text-xs' },
    md: { dim: 'w-10 h-10', text: 'text-sm font-semibold' },
    lg: { dim: 'w-12 h-12', text: 'text-base font-bold' },
    xl: { dim: 'w-16 h-16', text: 'text-xl font-bold' },
};

export const InitialsAvatar: React.FC<Props> = ({
    name = 'User',
    size = 'md',
    shape = 'circle',
    className = '',
    twoChars = false,
}) => {
    const initials = useMemo(() => extractInitials(name, twoChars), [name, twoChars]);
    const palette = useMemo(() => {
        const hash = getHash(name || 'User');
        return PALETTES[hash % PALETTES.length];
    }, [name]);

    const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md;
    const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';

    return (
        <div
            className={`inline-flex items-center justify-center shrink-0 select-none transition-all shadow-sm ${sizeStyle.dim} ${sizeStyle.text} ${roundedClass} ${className}`}
            style={{
                backgroundColor: palette.bg,
                borderColor: palette.border,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: palette.text,
            }}
            title={name}
            aria-label={name}
        >
            <span className="leading-none">{initials}</span>
        </div>
    );
};

export default InitialsAvatar;
