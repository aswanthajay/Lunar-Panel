import React, { useMemo } from 'react';

export type ProductStatus =
    | 'active'
    | 'running'
    | 'offline'
    | 'stopped'
    | 'starting'
    | 'suspended'
    | 'provisioning';

export interface MetricEntry {
    label: string;
    current: number;
    limit?: number;
    unit?: string;
}

export interface CustomMetric {
    label: string;
    value: string | number;
    unit?: string;
}

export interface CardAction {
    label: string;
    onClick?: (event: React.MouseEvent, item: ProductItemData) => void;
    url?: string;
    isExternal?: boolean;
    isDisabled?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost';
}

export interface ProductItemData {
    id: string | number;
    name: string;
    description?: string;
    status?: ProductStatus;
    statusLabel?: string;
    icon?: React.ReactNode;
    url?: string;
    isExternal?: boolean;
    badge?: {
        label: string;
        variant?: 'current' | 'default';
    };
    connectionInfo?: {
        host?: string;
        port?: number | string;
    };
    metrics?: {
        cpu?: MetricEntry;
        memory?: MetricEntry;
        disk?: MetricEntry;
        custom?: CustomMetric[];
    };
    primaryAction?: CardAction;
    secondaryAction?: CardAction;
}

export interface ProductPanelCardProps {
    item: ProductItemData;
    onCardClick?: (item: ProductItemData) => void;
    className?: string;
}

const getStatusConfig = (status?: ProductStatus) => {
    switch (status) {
        case 'active':
        case 'running':
            return {
                dotColor: 'bg-[#10B981]',
                textColor: 'text-[#10B981]',
                bgColor: 'bg-[#062419]',
                borderColor: 'border-[#064E3B]',
                label: 'Running',
            };
        case 'starting':
        case 'provisioning':
            return {
                dotColor: 'bg-[#F59E0B]',
                textColor: 'text-[#F59E0B]',
                bgColor: 'bg-[#291B05]',
                borderColor: 'border-[#78350F]',
                label: 'Starting',
            };
        case 'suspended':
            return {
                dotColor: 'bg-[#EC4899]',
                textColor: 'text-[#EC4899]',
                bgColor: 'bg-[#260B18]',
                borderColor: 'border-[#831843]',
                label: 'Suspended',
            };
        case 'offline':
        case 'stopped':
        default:
            return {
                dotColor: 'bg-[#6B7280]',
                textColor: 'text-[#9CA3AF]',
                bgColor: 'bg-[#111318]',
                borderColor: 'border-[#1F242F]',
                label: 'Offline',
            };
    }
};

export const ProductPanelCard: React.FC<ProductPanelCardProps> = ({
    item,
    onCardClick,
    className = '',
}) => {
    const statusConfig = useMemo(() => getStatusConfig(item.status), [item.status]);

    const cpuPercent = useMemo(() => {
        if (!item.metrics?.cpu) return null;
        const { current, limit } = item.metrics.cpu;
        if (!limit || limit === 0) return Math.min(Math.round(current), 100);
        return Math.min(Math.round((current / limit) * 100), 100);
    }, [item.metrics?.cpu]);

    const memoryPercent = useMemo(() => {
        if (!item.metrics?.memory) return null;
        const { current, limit } = item.metrics.memory;
        if (!limit || limit === 0) return 0;
        return Math.min(Math.round((current / limit) * 100), 100);
    }, [item.metrics?.memory]);

    const handleCardClick = (e: React.MouseEvent) => {
        if (onCardClick) {
            onCardClick(item);
        }
    };

    return (
        <article
            onClick={handleCardClick}
            className={`group relative flex flex-col justify-between p-6 bg-[#000000] hover:bg-[#0a0a0a] border border-[#262626] hover:border-[#3f3f46] rounded-md transition-all duration-150 ease-in-out select-none ${
                onCardClick ? 'cursor-pointer' : ''
            } ${className}`}
        >
            <div>
                {/* 1. Card Top Bar: Icon, Title, Status & Current Badge */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-2.5 min-w-0">
                        {item.icon && (
                            <span className="w-5 h-5 text-[#5E5E67] group-hover:text-[#FFFFFF] transition-colors flex-shrink-0 flex items-center justify-center">
                                {item.icon}
                            </span>
                        )}

                        <h3 className="text-base font-medium text-[#FFFFFF] leading-snug truncate m-0">
                            {item.name}
                        </h3>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {item.status && (
                            <div
                                className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium leading-none ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor}`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                                <span>{item.statusLabel || statusConfig.label}</span>
                            </div>
                        )}

                        {item.badge && (
                            <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-medium leading-none whitespace-nowrap ${
                                    item.badge.variant === 'current'
                                        ? 'bg-[#FFFFFF] text-[#000000] border border-[#FFFFFF]'
                                        : 'bg-[#16161A] text-[#9A9AA2] border border-[#2B2B32]'
                                }`}
                            >
                                {item.badge.label}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Connection Info Host/Port */}
                {item.connectionInfo?.host && (
                    <div className="mt-1.5">
                        <span className="font-mono text-xs text-[#5E5E67] select-all">
                            {item.connectionInfo.host}
                            {item.connectionInfo.port ? `:${item.connectionInfo.port}` : ''}
                        </span>
                    </div>
                )}

                {/* 3. Card Description */}
                {item.description && (
                    <p className="text-xs text-[#9A9AA2] font-normal leading-relaxed mt-2.5 m-0 line-clamp-2">
                        {item.description}
                    </p>
                )}

                {/* 4. Telemetry / Resource Metrics Block */}
                {item.metrics && (
                    <div className="mt-4 pt-3 border-t border-[#1C1C20] space-y-2.5">
                        {item.metrics.cpu && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-[#5E5E67]">
                                    <span className="font-medium uppercase tracking-wider">{item.metrics.cpu.label}</span>
                                    <span className="font-mono text-[#FFFFFF]">
                                        {item.metrics.cpu.current}
                                        {item.metrics.cpu.unit || '%'}
                                        {item.metrics.cpu.limit ? ` / ${item.metrics.cpu.limit}${item.metrics.cpu.unit || '%'}` : ''}
                                    </span>
                                </div>
                                {cpuPercent !== null && (
                                    <div className="w-full h-1 bg-[#1C1C20] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-300 ${
                                                cpuPercent > 90
                                                    ? 'bg-[#EF4444]'
                                                    : cpuPercent > 75
                                                    ? 'bg-[#F59E0B]'
                                                    : 'bg-[#FFFFFF]'
                                            }`}
                                            style={{ width: `${cpuPercent}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {item.metrics.memory && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-[#5E5E67]">
                                    <span className="font-medium uppercase tracking-wider">{item.metrics.memory.label}</span>
                                    <span className="font-mono text-[#FFFFFF]">
                                        {item.metrics.memory.current}
                                        {item.metrics.memory.unit || 'MB'}
                                        {item.metrics.memory.limit ? ` / ${item.metrics.memory.limit}${item.metrics.memory.unit || 'MB'}` : ''}
                                    </span>
                                </div>
                                {memoryPercent !== null && (
                                    <div className="w-full h-1 bg-[#1C1C20] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-300 ${
                                                memoryPercent > 90
                                                    ? 'bg-[#EF4444]'
                                                    : memoryPercent > 75
                                                    ? 'bg-[#F59E0B]'
                                                    : 'bg-[#FFFFFF]'
                                            }`}
                                            style={{ width: `${memoryPercent}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {item.metrics.custom && item.metrics.custom.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                {item.metrics.custom.map((metric, idx) => (
                                    <div key={idx} className="flex flex-col">
                                        <span className="text-[10px] text-[#5E5E67] uppercase font-medium tracking-wider truncate">
                                            {metric.label}
                                        </span>
                                        <span className="text-xs font-mono text-[#FFFFFF] mt-0.5">
                                            {metric.value}
                                            {metric.unit ? ` ${metric.unit}` : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 5. Card Footer Actions */}
            {(item.primaryAction || item.secondaryAction || item.url) && (
                <div className="mt-5 pt-3 border-t border-[#1C1C20] flex items-center justify-between gap-2">
                    <div>
                        {item.secondaryAction ? (
                            <button
                                type="button"
                                disabled={item.secondaryAction.isDisabled}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    item.secondaryAction?.onClick?.(e, item);
                                }}
                                className="text-xs font-medium text-[#9A9AA2] hover:text-[#FFFFFF] transition-colors bg-transparent border-none p-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {item.secondaryAction.label}
                            </button>
                        ) : item.url ? (
                            <a
                                href={item.url}
                                target={item.isExternal ? '_blank' : undefined}
                                rel={item.isExternal ? 'noopener noreferrer' : undefined}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center space-x-1 text-xs font-medium text-[#9A9AA2] hover:text-[#FFFFFF] no-underline transition-colors"
                            >
                                <span>Manage</span>
                                <svg className="w-3 h-3 text-[#5E5E67]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                        ) : null}
                    </div>

                    {item.primaryAction && (
                        <button
                            type="button"
                            disabled={item.primaryAction.isDisabled}
                            onClick={(e) => {
                                e.stopPropagation();
                                item.primaryAction?.onClick?.(e, item);
                            }}
                            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                item.primaryAction.variant === 'primary'
                                    ? 'bg-[#FFFFFF] hover:bg-[#EAEAEA] text-[#000000] border border-[#FFFFFF]'
                                    : 'bg-[#16161A] hover:bg-[#222228] text-[#FFFFFF] border border-[#2B2B32] hover:border-[#4E4E5A]'
                            }`}
                        >
                            {item.primaryAction.label}
                        </button>
                    )}
                </div>
            )}
        </article>
    );
};
