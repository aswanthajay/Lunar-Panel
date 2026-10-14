import React from 'react';

export type StatusType =
    | 'running'
    | 'starting'
    | 'restarting'
    | 'stopping'
    | 'offline'
    | 'installing'
    | 'suspended'
    | 'syncing'
    | string
    | null;

export interface StatusConfig {
    label: string;
    border: string;
    text: string;
    accent: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
    running: {
        label: 'RUNNING',
        border: 'border-[#059669]',
        text: 'text-[#10B981]',
        accent: '#10B981',
    },
    starting: {
        label: 'STARTING',
        border: 'border-[#047857]',
        text: 'text-[#34D399]',
        accent: '#34D399',
    },
    restarting: {
        label: 'RESTARTING',
        border: 'border-[#b45309]',
        text: 'text-[#f97316]',
        accent: '#f97316',
    },
    stopping: {
        label: 'STOPPING',
        border: 'border-[#be123c]',
        text: 'text-[#fb7185]',
        accent: '#fb7185',
    },
    offline: {
        label: 'STOPPED',
        border: 'border-[#3f3f46]',
        text: 'text-[#a1a1aa]',
        accent: '#71717a',
    },
    stopped: {
        label: 'STOPPED',
        border: 'border-[#3f3f46]',
        text: 'text-[#a1a1aa]',
        accent: '#71717a',
    },
    crashed: {
        label: 'CRASHED',
        border: 'border-[#991b1b]',
        text: 'text-[#ef4444]',
        accent: '#ef4444',
    },
    error: {
        label: 'ERROR',
        border: 'border-[#991b1b]',
        text: 'text-[#ef4444]',
        accent: '#ef4444',
    },
    installing: {
        label: 'INSTALLING',
        border: 'border-[#1d4ed8]',
        text: 'text-[#60a5fa]',
        accent: '#60a5fa',
    },
    suspended: {
        label: 'SUSPENDED',
        border: 'border-[#7f1d1d]',
        text: 'text-[#ef4444]',
        accent: '#ef4444',
    },
    syncing: {
        label: 'SYNCING…',
        border: 'border-[#3f3f46]',
        text: 'text-[#a1a1aa]',
        accent: '#71717a',
    },
};

interface Props {
    status: StatusType;
    isRestarting?: boolean;
    customLabel?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
}

export const ServerStatusBox: React.FC<Props> = ({
    status,
    isRestarting = false,
    customLabel,
    size = 'medium',
    className = '',
}) => {
    let key = isRestarting ? 'restarting' : (status || 'offline').toLowerCase();
    if (key === 'stopped') key = 'offline';

    const config = STATUS_CONFIG[key] || STATUS_CONFIG.offline;
    const label = customLabel || config.label;

    const sizeClasses = {
        small: 'px-2.5 py-0.5 text-[10px]',
        medium: 'px-3 py-1 text-xs',
        large: 'px-3.5 py-1.5 text-sm',
    }[size];

    return (
        <span
            className={`inline-flex items-center justify-center border-2 bg-[#000000] font-mono font-semibold uppercase tracking-[0.08em] select-none shrink-0 ${config.border} ${config.text} ${sizeClasses} ${className}`}
            style={{ borderRadius: '0px', fontFamily: 'var(--font-mono)' }}
        >
            {label}
        </span>
    );
};

export default ServerStatusBox;
