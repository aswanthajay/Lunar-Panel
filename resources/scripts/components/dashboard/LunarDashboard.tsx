import React, { useState, useMemo, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useUserRole } from '@/plugins/useUserRole';
import { useHistory } from 'react-router-dom';
import http, { PaginatedResult } from '@/api/http';
import { Server } from '@/api/server/getServer';
import getServers, { getFleetStats, FleetStats, NodeStats } from '@/api/getServers';
import { getTickets, Ticket } from '@/api/tickets';
import { formatDistanceToNow } from 'date-fns';
import { useStoreState } from '@/state/hooks';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString } from '@/lib/formatters';
import AdminInfrastructureMap from '@/components/dashboard/AdminInfrastructureMap';
import VotionCoronaGlow from '@/components/votion/VotionCoronaGlow';
import VotionDeployModal from '@/components/votion/VotionDeployModal';
import '@/assets/votioncloud-dashboard.css';

const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
        return timestamp;
    }
};

const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString || dateString.toLowerCase() === 'never') return 'None pending';
    try {
        const clean = dateString.includes('T') ? dateString.split('T')[0] : dateString;
        const [yyyy, mm, dd] = clean.split('-');
        if (yyyy && mm && dd) {
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
        return dateString;
    } catch {
        return dateString;
    }
};

const formatEventName = (event?: string, description?: string | null) => {
    if (description) return description;
    if (!event) return 'Activity logged';
    const eventMap: Record<string, string> = {
        'auth:login': 'Account logged in',
        'auth:success': 'Authentication successful',
        'auth:checkpoint': 'Two-factor checkpoint passed',
        'auth:register': 'New account registered',
        'server:power.start': 'Server instance started',
        'server:power.stop': 'Server instance stopped',
        'server:power.restart': 'Server instance restarted',
        'server:power.kill': 'Server instance killed',
        'server:file.upload': 'File uploaded to server',
        'server:file.delete': 'File deleted from server',
        'server:file.write': 'File edited on server',
        'server:backup.create': 'Server backup created',
        'server:backup.delete': 'Server backup deleted',
        'server:command': 'Console command executed',
        'server:reinstall': 'Server reinstalled',
        'account:profile.update': 'Profile updated',
        'account:password.update': 'Password changed',
        'account:email.update': 'Email address changed',
        'account:api-key.create': 'API credential generated',
        'account:api-key.delete': 'API credential revoked',
    };
    if (eventMap[event]) return eventMap[event];
    return event.replace(/[:._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Votion reference SVG icons
const VcIcons = {
    server: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="7" rx="1" />
            <rect x="3" y="14" width="18" height="7" rx="1" />
            <path d="M7 6h.1M7 17h.1M12 6h5M12 17h5" />
        </svg>
    ),
    layers: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 10 6-10 6L2 9Zm-10 10 10 6 10-6M2 17l10 6 10-6" />
        </svg>
    ),
    user: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="7" r="4" />
            <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
        </svg>
    ),
    bill: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18M7 15h4" />
        </svg>
    ),
    ticket: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4h16v12H9l-5 4Z" />
            <path d="M8 8h8M8 12h5" />
        </svg>
    ),
    cycle: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 7a8 8 0 1 0 0 10M20 3v5h-5" />
        </svg>
    ),
    log: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="3" width="14" height="18" />
            <path d="M8 7h8M8 11h8M8 15h6" />
        </svg>
    ),
};

interface Props {
    servers: PaginatedResult<Server>;
    page?: number;
    onPageSelect?: (page: number) => void;
    rootAdmin?: boolean;
    showOnlyAdmin?: boolean;
    setShowOnlyAdmin?: any;
}

interface ServerCardProps {
    server: Server;
    currentStatus?: string;
    onOpenDetails: (server: Server) => void;
    onCopyAddress: (address: string) => void;
    onStatusUpdate?: (uuid: string, status: ServerPowerState | 'suspended' | 'installing' | 'offline') => void;
}

const LunarServerCard: React.FC<ServerCardProps> = ({
    server,
    currentStatus,
    onOpenDetails,
    onCopyAddress,
    onStatusUpdate,
}) => {
    const history = useHistory();
    const primaryAlloc = server.allocations?.[0];
    const host = primaryAlloc?.alias || primaryAlloc?.ip;
    const port = primaryAlloc?.port;
    const isSuspended = server.status === 'suspended' || server.isNodeUnderMaintenance;
    const isInstalling = server.status === 'installing' || server.status === 'restoring_backup';

    const [stats, setStats] = useState<ServerStats | null>(null);

    useEffect(() => {
        if (isSuspended) {
            onStatusUpdate?.(server.uuid, 'suspended');
            return;
        }
        if (isInstalling) {
            onStatusUpdate?.(server.uuid, 'installing');
            return;
        }

        let isMounted = true;
        getServerResourceUsage(server.uuid)
            .then((data) => {
                if (isMounted) {
                    setStats(data);
                    const effectiveStatus =
                        data.status === 'running' || (data.status === 'starting' && data.memoryUsageInBytes > 0)
                            ? 'running'
                            : data.status;
                    onStatusUpdate?.(server.uuid, effectiveStatus);
                }
            })
            .catch(() => {
                if (isMounted) {
                    onStatusUpdate?.(server.uuid, 'offline');
                }
            });

        const timer = setInterval(() => {
            getServerResourceUsage(server.uuid)
                .then((data) => {
                    if (isMounted) {
                        setStats(data);
                        const effectiveStatus =
                            data.status === 'running' || (data.status === 'starting' && data.memoryUsageInBytes > 0)
                                ? 'running'
                                : data.status;
                        onStatusUpdate?.(server.uuid, effectiveStatus);
                    }
                })
                .catch(() => {});
        }, 20000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [server.uuid, isSuspended, isInstalling]);

    const activeStatus = stats?.status || currentStatus;

    let statusKey = 'offline';
    let statusLabel = 'STOPPED';
    let footerState = 'Stopped';
    let isRunning = false;

    if (isSuspended || activeStatus === 'suspended') {
        statusKey = 'suspended';
        statusLabel = 'SUSPENDED';
        footerState = 'Suspended';
    } else if (isInstalling || activeStatus === 'installing') {
        statusKey = 'installing';
        statusLabel = 'INSTALLING';
        footerState = 'Provisioning';
    } else if (activeStatus === 'running' || (activeStatus === 'starting' && (stats?.memoryUsageInBytes ?? 0) > 0)) {
        statusKey = 'running';
        statusLabel = 'RUNNING';
        footerState = 'Operational';
        isRunning = true;
    } else if (activeStatus === 'starting') {
        statusKey = 'running';
        statusLabel = 'STARTING';
        footerState = 'Booting Engine';
        isRunning = true;
    } else if (activeStatus === 'restarting') {
        statusKey = 'running';
        statusLabel = 'RESTARTING';
        footerState = 'Restarting';
        isRunning = true;
    } else if (activeStatus === 'stopping') {
        statusKey = 'offline';
        statusLabel = 'STOPPING';
        footerState = 'Shutting Down';
    } else {
        statusKey = 'offline';
        statusLabel = 'STOPPED';
        footerState = 'Stopped';
    }

    const cpuDisplay = isRunning && stats ? `${stats.cpuUsagePercent.toFixed(1)}%` : '0.0%';
    const cpuBar = isRunning && stats ? Math.min(100, (stats.cpuUsagePercent / (server.limits.cpu || 100)) * 100) : 0;

    const memoryDisplay = isRunning && stats ? bytesToString(stats.memoryUsageInBytes) : '0 MiB';
    const memoryBar =
        isRunning && stats ? Math.min(100, (stats.memoryUsageInBytes / (server.limits.memory * 1024 * 1024 || 1)) * 100) : 0;

    const diskDisplay =
        stats && stats.diskUsageInBytes > 0
            ? bytesToString(stats.diskUsageInBytes)
            : server.limits.disk > 0
            ? `${server.limits.disk} MB`
            : '0 MB';
    const diskBar =
        stats && server.limits.disk > 0
            ? Math.min(100, (stats.diskUsageInBytes / (server.limits.disk * 1024 * 1024)) * 100)
            : 0;

    return (
        <article className="card">
            <div>
                <div className="cardhead">
                    <h3 title={server.name}>{server.name}</h3>
                    <span className={`status ${isRunning ? '' : statusKey === 'suspended' ? 'suspended' : statusKey === 'installing' ? 'installing' : 'off'}`}>
                        ● {statusLabel}
                    </span>
                </div>

                <p className="node mono">
                    Node: {server.node || 'Primary Node'} · {server.id}
                </p>

                {host && (
                    <button
                        type="button"
                        className="ip"
                        onClick={() => onCopyAddress(`${host}:${port}`)}
                        title="Click to copy address"
                    >
                        <span>{host}:{port}</span>
                        <span aria-hidden="true">⧉</span>
                    </button>
                )}

                <div className="usage">
                    <div>
                        <span className="vc-label">CPU LOAD</span>
                        <strong>{cpuDisplay}</strong>
                        <div className="track">
                            <span style={{ width: `${Math.max(isRunning ? 4 : 0, cpuBar)}%` }} />
                        </div>
                    </div>
                    <div>
                        <span className="vc-label">MEMORY</span>
                        <strong>{memoryDisplay}</strong>
                        <div className="track">
                            <span style={{ width: `${Math.max(isRunning ? 4 : 0, memoryBar)}%` }} />
                        </div>
                    </div>
                    <div>
                        <span className="vc-label">STORAGE</span>
                        <strong>{diskDisplay}</strong>
                        <div className="track">
                            <span style={{ width: `${Math.max(diskBar, 0)}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="cardfoot">
                <span className="vc-meta">
                    <span
                        className="live-dot"
                        style={{ color: isRunning ? 'var(--green)' : 'var(--muted)' }}
                    >
                        ●
                    </span>
                    {footerState}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {server.isFiveM && (server as any).txadminUrl && (
                        <a
                            href={(server as any).txadminUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                padding: '8px 11px',
                                fontSize: '11px',
                                border: '1px solid #10b981',
                                color: '#10b981',
                                borderRadius: '3px',
                                textDecoration: 'none',
                                fontWeight: 500,
                            }}
                            title={`Open txAdmin web panel on port ${(server as any).txadminPort || 40120}`}
                        >
                            txAdmin ↗
                        </a>
                    )}
                    <button type="button" onClick={() => onOpenDetails(server)}>
                        Details
                    </button>
                    <button
                        type="button"
                        className="solid"
                        onClick={() => history.push(`/server/${server.id}`)}
                    >
                        Console →
                    </button>
                </div>
            </div>
        </article>
    );
};

interface ServerTableRowProps {
    server: Server;
    currentStatus?: string;
    onOpenDetails: (server: Server) => void;
    onCopyAddress: (address: string) => void;
    onStatusUpdate?: (uuid: string, status: ServerPowerState | 'suspended' | 'installing' | 'offline') => void;
}

const LunarServerTableRow: React.FC<ServerTableRowProps> = ({
    server,
    currentStatus,
    onOpenDetails,
    onCopyAddress,
    onStatusUpdate,
}) => {
    const history = useHistory();
    const primaryAlloc = server.allocations?.[0];
    const host = primaryAlloc?.alias || primaryAlloc?.ip;
    const port = primaryAlloc?.port;
    const isSuspended = server.status === 'suspended' || server.isNodeUnderMaintenance;
    const isInstalling = server.status === 'installing' || server.status === 'restoring_backup';

    const [stats, setStats] = useState<ServerStats | null>(null);

    useEffect(() => {
        if (isSuspended) {
            onStatusUpdate?.(server.uuid, 'suspended');
            return;
        }
        if (isInstalling) {
            onStatusUpdate?.(server.uuid, 'installing');
            return;
        }

        let isMounted = true;
        getServerResourceUsage(server.uuid)
            .then((data) => {
                if (isMounted) {
                    setStats(data);
                    const effectiveStatus =
                        data.status === 'running' || (data.status === 'starting' && data.memoryUsageInBytes > 0)
                            ? 'running'
                            : data.status;
                    onStatusUpdate?.(server.uuid, effectiveStatus);
                }
            })
            .catch(() => {
                if (isMounted) {
                    onStatusUpdate?.(server.uuid, 'offline');
                }
            });

        const timer = setInterval(() => {
            getServerResourceUsage(server.uuid)
                .then((data) => {
                    if (isMounted) {
                        setStats(data);
                        const effectiveStatus =
                            data.status === 'running' || (data.status === 'starting' && data.memoryUsageInBytes > 0)
                                ? 'running'
                                : data.status;
                        onStatusUpdate?.(server.uuid, effectiveStatus);
                    }
                })
                .catch(() => {});
        }, 20000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [server.uuid, isSuspended, isInstalling]);

    const activeStatus = stats?.status || currentStatus;
    const isRunning = activeStatus === 'running' || (activeStatus === 'starting' && (stats?.memoryUsageInBytes ?? 0) > 0);

    let statusLabel = 'STOPPED';
    let statusClass = 'off';
    if (isSuspended || activeStatus === 'suspended') {
        statusLabel = 'SUSPENDED';
        statusClass = 'suspended';
    } else if (isInstalling || activeStatus === 'installing') {
        statusLabel = 'INSTALLING';
        statusClass = 'installing';
    } else if (isRunning) {
        statusLabel = 'RUNNING';
        statusClass = '';
    }

    const cpuDisplay = isRunning && stats ? `${stats.cpuUsagePercent.toFixed(1)}%` : '0.0%';
    const memoryDisplay = isRunning && stats ? bytesToString(stats.memoryUsageInBytes) : '0 MiB';

    return (
        <tr>
            <td style={{ fontWeight: 600 }}>{server.name}</td>
            <td>
                <span className={`status ${statusClass}`}>
                    ● {statusLabel}
                </span>
            </td>
            <td className="mono">
                {host ? (
                    <button
                        type="button"
                        onClick={() => onCopyAddress(`${host}:${port}`)}
                        className="ip"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        title="Click to copy address"
                    >
                        <span>{host}:{port}</span>
                        <span>⧉</span>
                    </button>
                ) : (
                    '—'
                )}
            </td>
            <td className="mono">{cpuDisplay}</td>
            <td className="mono">{memoryDisplay}</td>
            <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => onOpenDetails(server)}
                        style={{ padding: '5px 10px', fontSize: '11px' }}
                    >
                        Details
                    </button>
                    <button
                        type="button"
                        className="solid"
                        onClick={() => history.push(`/server/${server.id}`)}
                        style={{ padding: '5px 10px', fontSize: '11px' }}
                    >
                        Console →
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default ({ servers, page = 1, onPageSelect, rootAdmin }: Props) => {
    const { isAdmin } = useUserRole();
    const history = useHistory();
    const user = useStoreState((state) => state.user.data);

    const [adminDisplayMode, setAdminDisplayMode] = useState<'instances' | 'map'>('instances');
    const [isDeployOpen, setIsDeployOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'' | 'RUNNING' | 'STOPPED' | 'SUSPENDED' | 'INSTALLING'>('');
    const [serverStatuses, setServerStatuses] = useState<Record<string, string>>({});
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastTimeout, setToastTimeout] = useState<any>(null);

    const showToast = useCallback((msg: string) => {
        if (toastTimeout) clearTimeout(toastTimeout);
        setToastMessage(msg);
        const t = setTimeout(() => {
            setToastMessage(null);
        }, 2400);
        setToastTimeout(t);
    }, [toastTimeout]);

    const handleCopyAddress = useCallback((addr: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(addr).then(() => {
                showToast('Address copied');
            }).catch(() => {
                showToast(`Address: ${addr}`);
            });
        } else {
            showToast(`Address: ${addr}`);
        }
    }, [showToast]);

    const handleStatusUpdate = useCallback((uuid: string, status: string) => {
        setServerStatuses((prev) => {
            if (prev[uuid] === status) return prev;
            return { ...prev, [uuid]: status };
        });
    }, []);

    // 1. Live Fleet Stats Endpoint
    const { data: fleetStats } = useSWR<FleetStats>(
        '/api/client/fleet-stats',
        () => getFleetStats(),
        { refreshInterval: 15000, revalidateOnFocus: true }
    );

    // 2. Live Support Tickets Endpoint
    const { data: tickets } = useSWR<Ticket[]>(
        '/api/client/tickets',
        () => getTickets(),
        { revalidateOnFocus: false }
    );

    // 3. Complete server fleet catalog for accurate cluster aggregates
    const { data: fullServersData } = useSWR<PaginatedResult<Server>>(
        isAdmin ? ['/api/client/servers', 'full-fleet-votion'] : null,
        () => getServers({ page: 1, perPage: 100, type: 'admin-all' }),
        { revalidateOnFocus: false }
    );

    // 4. Cluster activity logs
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    useEffect(() => {
        let isMounted = true;
        http.get('/api/client/activity')
            .then(({ data }) => {
                if (isMounted) setActivityLogs(data.data?.slice(0, 4) || []);
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, []);

    const serverList = servers?.items || [];
    const pagination = servers?.pagination;
    const fullServerList = fullServersData?.items || serverList;

    // Seed server statuses from fleetStats when available
    useEffect(() => {
        if (fleetStats?.statuses) {
            setServerStatuses((prev) => ({ ...prev, ...fleetStats.statuses }));
        }
    }, [fleetStats?.statuses]);

    const openTickets = useMemo(() => {
        return (tickets || []).filter((t) => t.status !== 'closed');
    }, [tickets]);

    const suspendedServers = useMemo(() => {
        return serverList.filter((s) => s.status === 'suspended');
    }, [serverList]);

    const telemetry = useMemo(() => {
        let totalCpu = fleetStats?.cpu ?? 0;
        let totalMemory = fleetStats?.memory ?? 0;
        let totalDisk = fleetStats?.disk ?? 0;

        if (!fleetStats) {
            fullServerList.forEach((server) => {
                totalCpu += server.limits.cpu || 0;
                totalMemory += server.limits.memory || 0;
                totalDisk += server.limits.disk || 0;
            });
        }

        const runningUuids = new Set<string>();
        if (fleetStats?.statuses) {
            Object.entries(fleetStats.statuses).forEach(([uuid, status]) => {
                if (status === 'running' || status === 'starting') {
                    runningUuids.add(uuid);
                }
            });
        }

        Object.entries(serverStatuses).forEach(([uuid, status]) => {
            if (status === 'running' || status === 'starting') {
                runningUuids.add(uuid);
            } else if (status === 'offline' || status === 'stopped' || status === 'suspended') {
                runningUuids.delete(uuid);
            }
        });

        const runningCount = Math.max(runningUuids.size, fleetStats?.running ?? 0);
        const totalInstances = fleetStats?.total ?? pagination?.total ?? fullServerList.length;

        return {
            totalInstances,
            runningCount,
            totalCpu,
            totalMemory,
            totalDisk,
        };
    }, [fullServerList, serverStatuses, fleetStats, pagination]);

    const clusterNodes: NodeStats[] = useMemo(() => {
        if (fleetStats?.nodes && fleetStats.nodes.length > 0) {
            return fleetStats.nodes.map((node) => {
                if (node.status === 'online') return node;
                const hasRunningServer = fullServerList.some(
                    (s) =>
                        (s.node === node.name || (s as any).node_id === node.id) &&
                        (serverStatuses[s.uuid] === 'running' || serverStatuses[s.uuid] === 'starting')
                );
                if (hasRunningServer) {
                    return { ...node, status: 'online' as const };
                }
                return node;
            });
        }
        const nodeMap = new Map<string, { id: number; name: string; servers_count: number }>();
        fullServerList.forEach((s) => {
            const name = s.node || 'Primary Node';
            if (!nodeMap.has(name)) {
                nodeMap.set(name, { id: nodeMap.size + 1, name, servers_count: 0 });
            }
            nodeMap.get(name)!.servers_count += 1;
        });
        return Array.from(nodeMap.values()).map((n) => ({
            id: n.id,
            name: n.name,
            fqdn: n.name,
            scheme: 'https',
            location: 'Cluster',
            status: 'online' as const,
            maintenance_mode: false,
            servers_count: n.servers_count,
            memory: 0,
            disk: 0,
        }));
    }, [fleetStats?.nodes, fullServerList, serverStatuses]);

    const nodesOnlineCount = clusterNodes.filter((n) => n.status === 'online').length;
    const nodesTotalCount = Math.max(clusterNodes.length, 1);

    const fleetTotalServers = fleetStats?.total ?? pagination?.total ?? fullServerList.length;
    const fleetRunningServers = telemetry.runningCount;
    const fleetSuspendedServers = fleetStats?.suspended ?? suspendedServers.length;
    const fleetInstallingServers = fleetStats?.installing ?? fullServerList.filter((s) => s.status === 'installing').length;
    const fleetOfflineServers = Math.max(0, fleetTotalServers - fleetRunningServers - fleetSuspendedServers - fleetInstallingServers);

    // Filtering by search AND status filter
    const filteredServers = useMemo(() => {
        let result = serverList;

        if (statusFilter) {
            result = result.filter((s) => {
                const effective = serverStatuses[s.uuid] || s.status || 'offline';
                if (statusFilter === 'RUNNING') {
                    return effective === 'running' || effective === 'starting' || effective === 'restarting';
                }
                if (statusFilter === 'STOPPED') {
                    return effective === 'offline' || effective === 'stopped' || effective === 'stopping';
                }
                if (statusFilter === 'SUSPENDED') {
                    return effective === 'suspended';
                }
                if (statusFilter === 'INSTALLING') {
                    return effective === 'installing';
                }
                return true;
            });
        }

        if (!searchQuery.trim()) return result;
        const q = searchQuery.toLowerCase();
        return result.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.id.toLowerCase().includes(q) ||
                (s.node && s.node.toLowerCase().includes(q)) ||
                s.allocations?.some((a) => (a.alias || a.ip).includes(q) || String(a.port).includes(q))
        );
    }, [serverList, searchQuery, statusFilter, serverStatuses]);

    // Telemetry metric values
    const onlinePct = fleetTotalServers > 0 ? Math.round((fleetRunningServers / fleetTotalServers) * 100) : 0;
    const allocatedCores = telemetry.totalCpu / 100;
    const allocatedCoresFormatted = allocatedCores >= 10 ? Math.round(allocatedCores) : allocatedCores.toFixed(1);
    const clusterVcpus = Math.max(12, nodesTotalCount * 12);
    const cpuFillPercent = Math.min(100, Math.round((telemetry.totalCpu / (clusterVcpus * 100)) * 100));

    const totalNodeRamMb = clusterNodes.reduce((acc, n) => acc + (n.memory || 0), 0);
    const rawUsedRamGb = telemetry.totalMemory / 1024;
    let maxRamGb = totalNodeRamMb > 0 ? Math.round(totalNodeRamMb / 1024) : 0;
    if (maxRamGb < rawUsedRamGb) {
        const ramTiers = [16, 32, 64, 128, 256, 512, 1024];
        maxRamGb = ramTiers.find((t) => t > rawUsedRamGb) || Math.ceil(rawUsedRamGb / 64) * 64;
    }
    const usedRamGbFormatted = rawUsedRamGb.toFixed(1);
    const ramFillPercent = Math.min(100, Math.round((rawUsedRamGb / maxRamGb) * 100));

    const totalNodeDiskMb = clusterNodes.reduce((acc, n) => acc + (n.disk || 0), 0);
    const rawUsedDiskGb = telemetry.totalDisk / 1024;
    let maxDiskGb = totalNodeDiskMb > 0 ? Math.round(totalNodeDiskMb / 1024) : 0;
    if (maxDiskGb < rawUsedDiskGb) {
        const diskTiers = [500, 1000, 1024, 2000, 2048, 4000, 8000];
        maxDiskGb = diskTiers.find((t) => t > rawUsedDiskGb) || Math.ceil(rawUsedDiskGb / 500) * 500;
    }
    const usedDiskGbFormatted = rawUsedDiskGb.toFixed(1);
    const maxDiskGbFormatted = maxDiskGb.toLocaleString();
    const diskFillPercent = Math.min(100, Math.round((rawUsedDiskGb / maxDiskGb) * 100));

    // Reset filters
    const handleResetFilters = () => {
        setStatusFilter('');
        setSearchQuery('');
    };

    // CSV Export
    const handleDownloadCsv = () => {
        const rows = (filteredServers.length > 0 ? filteredServers : serverList).map((s) => {
            const alloc = s.allocations?.[0];
            const addr = alloc ? `${alloc.alias || alloc.ip}:${alloc.port}` : 'None';
            const st = serverStatuses[s.uuid] || s.status || 'unknown';
            return `"${s.name.replace(/"/g, '""')}","${st.toUpperCase()}","${addr}","${s.limits.cpu}%","${s.limits.memory} MB","${s.limits.disk} MB"`;
        });
        const csv = 'Name,Status,Address,CPU,Memory,Storage\n' + rows.join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `votioncloud-instances-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Instances CSV downloaded');
    };

    const primaryNode = clusterNodes[0] || {
        name: 'Hetzner–64GB 12500 Series DE',
        fqdn: window.location.hostname,
        servers_count: fleetTotalServers,
    };

    return (
        <div className="votion-dash -m-4 sm:-m-6 lg:-m-8">
            {/* Top Toolbar / Mode Switcher if Admin */}
            {isAdmin && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 26px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setAdminDisplayMode('instances')}
                            className={adminDisplayMode === 'instances' ? 'solid' : ''}
                            style={{ fontSize: '11px', padding: '4px 10px' }}
                        >
                            Infrastructure Overview
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdminDisplayMode('map')}
                            className={adminDisplayMode === 'map' ? 'solid' : ''}
                            style={{ fontSize: '11px', padding: '4px 10px' }}
                        >
                            Cluster World Map
                        </button>
                    </div>
                </div>
            )}

            {adminDisplayMode === 'map' && isAdmin ? (
                <div style={{ padding: '24px' }}>
                    <AdminInfrastructureMap
                        fleet={fleetStats}
                        onViewInstances={() => setAdminDisplayMode('instances')}
                    />
                </div>
            ) : (
                <div className="votion-layout relative overflow-hidden">
                    {/* Top Ambient Radiant Corona / Fiber Arch (1:1 Votion Cloud web) */}
                    <VotionCoronaGlow />

                    {/* ========== CENTER: MAIN FLEET OVERVIEW ========== */}
                    <main id="main" className="votion-main relative z-10">
                        {/* 1:1 Votion Cloud Performance Hero Section */}
                        <div className="pt-8 pb-12 sm:pt-12 sm:pb-16 text-center max-w-4xl mx-auto px-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-orange-400 mb-5 backdrop-blur-md shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                <span>VOTION CLOUD · HIGH-FREQUENCY COMPUTE</span>
                            </div>

                            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight leading-none mb-4 select-none">
                                Performance
                            </h1>

                            <p className="text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed font-sans mb-8 font-normal">
                                Votion Cloud delivers high-frequency bare metal, unmetered NVMe cloud VPS, and proprietary LunarShield DDoS mitigation engineered for absolute scale.
                            </p>

                            <div className="flex items-center justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsDeployOpen(true)}
                                    className="px-7 py-3 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all shadow-xl hover:shadow-orange-500/20 active:scale-95 cursor-pointer whitespace-nowrap"
                                >
                                    Deploy server now
                                </button>
                            </div>
                        </div>

                        {/* Telemetry Metrics: 4 Columns */}
                        <section className="metrics" aria-label="Cluster telemetry">
                            <div className="metric">
                                <div className="vc-label">Online instances</div>
                                <strong>
                                    {fleetRunningServers} <small>/ {fleetTotalServers}</small>
                                </strong>
                                <div className="track">
                                    <span style={{ width: `${onlinePct}%` }} />
                                </div>
                                <div className="vc-meta">{onlinePct}% verified online</div>
                            </div>

                            <div className="metric">
                                <div className="vc-label">Allocated CPU</div>
                                <strong>{allocatedCoresFormatted} Cores</strong>
                                <div className="track">
                                    <span style={{ width: `${cpuFillPercent}%` }} />
                                </div>
                                <div className="vc-meta">({cpuFillPercent}% of {clusterVcpus} vCPUs)</div>
                            </div>

                            <div className="metric">
                                <div className="vc-label">Committed RAM</div>
                                <strong>
                                    {usedRamGbFormatted} / {maxRamGb} <small>GB</small>
                                </strong>
                                <div className="track">
                                    <span style={{ width: `${ramFillPercent}%` }} />
                                </div>
                                <div className="vc-meta">Dedicated ({ramFillPercent}% ceiling)</div>
                            </div>

                            <div className="metric">
                                <div className="vc-label">Storage pool</div>
                                <strong>
                                    {usedDiskGbFormatted} / {maxDiskGbFormatted} <small>GB</small>
                                </strong>
                                <div className="track">
                                    <span style={{ width: `${diskFillPercent}%`, background: 'var(--accent)' }} />
                                </div>
                                <div className="vc-meta">NVMe / ZFS ({diskFillPercent}% ceiling)</div>
                            </div>
                        </section>

                        {/* Section Bar: Instances & Bots */}
                        <section aria-label="Instances and bots">
                            <div className="sectionbar">
                                <h2>Instances & bots</h2>
                                <span className="vc-meta">
                                    {statusFilter ? `${statusFilter} • ` : ''}
                                    {filteredServers.length} total · {fleetRunningServers} online
                                </span>

                                <label className="search">
                                    <span aria-hidden="true" style={{ color: 'var(--muted)', fontSize: '13px' }}>⌕</span>
                                    <input
                                        id="search"
                                        type="search"
                                        placeholder="Search servers, bots, nodes…"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        aria-label="Search instances"
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={handleDownloadCsv}
                                    style={{ fontSize: '12px', padding: '7px 11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                    title="Export fleet to CSV"
                                >
                                    <span>↓</span>
                                    <span>Downloads</span>
                                </button>

                                <div className="views">
                                    <button
                                        type="button"
                                        className={viewMode === 'grid' ? 'active' : ''}
                                        onClick={() => setViewMode('grid')}
                                        aria-pressed={viewMode === 'grid'}
                                    >
                                        ▦ Grid
                                    </button>
                                    <button
                                        type="button"
                                        className={viewMode === 'table' ? 'active' : ''}
                                        onClick={() => setViewMode('table')}
                                        aria-pressed={viewMode === 'table'}
                                    >
                                        ☰ Table
                                    </button>
                                </div>
                            </div>

                            {/* Instances Display */}
                            {filteredServers.length === 0 ? (
                                <div className="empty">
                                    <p style={{ margin: '0 0 10px', fontSize: '14px' }}>
                                        No instances match the current search or status filter.
                                    </p>
                                    <button type="button" onClick={handleResetFilters}>
                                        Clear filters
                                    </button>
                                </div>
                            ) : viewMode === 'table' ? (
                                <div className="tablewrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>INSTANCE</th>
                                                <th>STATUS</th>
                                                <th>ADDRESS</th>
                                                <th>CPU</th>
                                                <th>MEMORY</th>
                                                <th>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredServers.map((server) => (
                                                <LunarServerTableRow
                                                    key={server.uuid}
                                                    server={server}
                                                    currentStatus={serverStatuses[server.uuid]}
                                                    onOpenDetails={(s) => setSelectedServer(s)}
                                                    onCopyAddress={handleCopyAddress}
                                                    onStatusUpdate={handleStatusUpdate}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="cards">
                                    {filteredServers.map((server) => (
                                        <LunarServerCard
                                            key={server.uuid}
                                            server={server}
                                            currentStatus={serverStatuses[server.uuid]}
                                            onOpenDetails={(s) => setSelectedServer(s)}
                                            onCopyAddress={handleCopyAddress}
                                            onStatusUpdate={handleStatusUpdate}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {pagination && pagination.totalPages > 1 && onPageSelect && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
                                    <button
                                        type="button"
                                        onClick={() => onPageSelect(Math.max(1, pagination.currentPage - 1))}
                                        disabled={pagination.currentPage <= 1}
                                        style={{ fontSize: '11px', padding: '6px 12px', opacity: pagination.currentPage <= 1 ? 0.35 : 1, cursor: pagination.currentPage <= 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        ← Previous
                                    </button>
                                    <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)', padding: '0 8px' }}>
                                        Page {pagination.currentPage} / {pagination.totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => onPageSelect(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                                        disabled={pagination.currentPage >= pagination.totalPages}
                                        style={{ fontSize: '11px', padding: '6px 12px', opacity: pagination.currentPage >= pagination.totalPages ? 0.35 : 1, cursor: pagination.currentPage >= pagination.totalPages ? 'not-allowed' : 'pointer' }}
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}

                            <p className="demo">
                                VOTIONCLOUD TELEMETRY / Live connected cluster infrastructure with automated daemon synchronization and telemetry pipelines.
                            </p>
                        </section>
                    </main>

                    {/* ========== RIGHT: OPERATIONS RAIL ========== */}
                    <aside className="votion-right" aria-label="Operations">
                        {/* Support Queue Card */}
                        <div>
                            <div className="vc-label">Operations</div>
                            <button
                                type="button"
                                className="support"
                                onClick={() => history.push('/support')}
                            >
                                <span style={{ fontSize: '16px' }}>☏</span>
                                <div>
                                    <strong>Support queue</strong>
                                    <small>{openTickets.length} pending</small>
                                </div>
                                <span style={{ marginLeft: 'auto', fontSize: '14px', color: 'var(--muted)' }}>›</span>
                            </button>
                        </div>

                        {/* Cluster Section */}
                        <section>
                            <div className="righthead">
                                <span className="vc-label">Cluster</span>
                                <button
                                    type="button"
                                    className="textbutton"
                                    onClick={() => {
                                        if (isAdmin) history.push('/admin/nodes');
                                        else history.push('/instances');
                                    }}
                                >
                                    Nodes →
                                </button>
                            </div>
                            <p className="online mono">● {nodesOnlineCount} / {nodesTotalCount} online</p>
                            <div className="nodebox">
                                <span style={{ fontSize: '15px' }}>▤</span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {primaryNode.name}
                                    </strong>
                                    <small style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {primaryNode.fqdn}
                                    </small>
                                </div>
                                <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                                    <strong>{primaryNode.servers_count || fleetTotalServers}</strong>
                                    <small>SERVERS</small>
                                </div>
                            </div>
                            <div className="health mono">
                                <span>Cluster health</span>
                                <span>{nodesTotalCount > 0 ? Math.round((nodesOnlineCount / nodesTotalCount) * 100) : 100}%</span>
                            </div>
                            <div className="track">
                                <span style={{ width: `${nodesTotalCount > 0 ? (nodesOnlineCount / nodesTotalCount) * 100 : 100}%` }} />
                            </div>
                        </section>

                        {/* Fleet Status Section with interactive filter buttons */}
                        <section>
                            <div className="righthead">
                                <span className="vc-label">Fleet status</span>
                                <button type="button" className="textbutton" id="reset" onClick={handleResetFilters}>
                                    Reset →
                                </button>
                            </div>
                            <div className="fleet">
                                <button
                                    type="button"
                                    className={statusFilter === 'RUNNING' ? 'filter-on' : ''}
                                    onClick={() => setStatusFilter(statusFilter === 'RUNNING' ? '' : 'RUNNING')}
                                    title="Filter running instances"
                                >
                                    <span>🟢 RUNNING</span>
                                    <strong>{fleetRunningServers}</strong>
                                </button>
                                <button
                                    type="button"
                                    className={statusFilter === 'STOPPED' ? 'filter-on' : ''}
                                    onClick={() => setStatusFilter(statusFilter === 'STOPPED' ? '' : 'STOPPED')}
                                    title="Filter offline instances"
                                >
                                    <span>● OFFLINE</span>
                                    <strong>{fleetOfflineServers}</strong>
                                </button>
                                <button
                                    type="button"
                                    className={statusFilter === 'SUSPENDED' ? 'filter-on' : ''}
                                    onClick={() => setStatusFilter(statusFilter === 'SUSPENDED' ? '' : 'SUSPENDED')}
                                    title="Filter suspended instances"
                                >
                                    <span style={{ color: 'var(--accent)' }}>● SUSPENDED</span>
                                    <strong>{fleetSuspendedServers}</strong>
                                </button>
                                <button
                                    type="button"
                                    className={statusFilter === 'INSTALLING' ? 'filter-on' : ''}
                                    onClick={() => setStatusFilter(statusFilter === 'INSTALLING' ? '' : 'INSTALLING')}
                                    title="Filter installing instances"
                                >
                                    <span>● INSTALLING</span>
                                    <strong>{fleetInstallingServers}</strong>
                                </button>
                            </div>

                            {/* Stacked Fleet Distribution Bar */}
                            <div className="fleetbar">
                                <span
                                    style={{
                                        background: 'var(--green)',
                                        width: `${fleetTotalServers > 0 ? (fleetRunningServers / fleetTotalServers) * 100 : 0}%`,
                                    }}
                                />
                                <span
                                    style={{
                                        background: 'var(--accent)',
                                        width: `${fleetTotalServers > 0 ? (fleetSuspendedServers / fleetTotalServers) * 100 : 0}%`,
                                    }}
                                />
                            </div>

                            <div className="legend mono">
                                {fleetRunningServers} live &nbsp;
                                <span style={{ color: 'var(--accent)' }}>{fleetSuspendedServers} suspended</span> &nbsp;
                                {fleetOfflineServers} off &nbsp;
                                {onlinePct}% online
                            </div>
                        </section>

                        {/* Admin Operations Section */}
                        {isAdmin ? (
                            <section>
                                <div className="righthead">
                                    <span className="vc-label">Admin operations</span>
                                    <span className="vc-label">Root controls</span>
                                </div>
                                <div className="ops">
                                    <button type="button" onClick={() => history.push('/admin/nodes')}>
                                        {VcIcons.server}
                                        <span>
                                            <strong>Nodes</strong>
                                            <small>Daemon configs</small>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => history.push('/instances')}>
                                        {VcIcons.layers}
                                        <span>
                                            <strong>Servers</strong>
                                            <small>Admin fleet</small>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => history.push('/user-management')}>
                                        {VcIcons.user}
                                        <span>
                                            <strong>Users</strong>
                                            <small>Accounts</small>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => history.push('/billing-operations')}>
                                        {VcIcons.bill}
                                        <span>
                                            <strong>Billing</strong>
                                            <small>Operations</small>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => history.push('/reimage-requests')}>
                                        {VcIcons.cycle}
                                        <span>
                                            <strong>Reimages</strong>
                                            <small>OS requests</small>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => history.push('/audit-logs')}>
                                        {VcIcons.log}
                                        <span>
                                            <strong>Audit logs</strong>
                                            <small>Security trails</small>
                                        </span>
                                    </button>
                                </div>
                            </section>
                        ) : (
                            <section>
                                <div className="righthead">
                                    <span className="vc-label">Account & Billing</span>
                                    <button type="button" className="textbutton" onClick={() => history.push('/billing')}>
                                        Billing →
                                    </button>
                                </div>
                                <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--muted)' }}>Active instances:</span>
                                        <strong className="mono">{serverList.length}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--muted)' }}>Account status:</span>
                                        <span style={{ color: 'var(--green)' }} className="mono">Verified Active</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--muted)' }}>Support tickets:</span>
                                        <span className="mono">{openTickets.length} open</span>
                                    </div>
                                </div>
                            </section>
                        )}
                    </aside>
                </div>
            )}

            {/* Server Details Modal Dialog matching reference */}
            {selectedServer && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(3px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                    }}
                    onClick={() => setSelectedServer(null)}
                >
                    <div
                        className="votion-modal"
                        style={{
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            width: 'min(540px, 94vw)',
                            padding: '28px',
                            borderRadius: '5px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="dialogtop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span className="vc-label">VotionCloud / Server Details</span>
                            <button
                                type="button"
                                onClick={() => setSelectedServer(null)}
                                style={{ padding: '4px 10px', fontSize: '16px', lineHeight: 1 }}
                                aria-label="Close dialog"
                            >
                                ×
                            </button>
                        </div>

                        <h2>{selectedServer.name}</h2>
                        <span className={`status ${serverStatuses[selectedServer.uuid] === 'running' ? '' : 'off'}`}>
                            ● {(serverStatuses[selectedServer.uuid] || selectedServer.status || 'STOPPED').toUpperCase()}
                        </span>

                        <dl>
                            <dt>Instance ID</dt>
                            <dd>{selectedServer.id}</dd>
                            <dt>UUID</dt>
                            <dd style={{ fontSize: '10px' }}>{selectedServer.uuid}</dd>
                            <dt>Node Location</dt>
                            <dd>{selectedServer.node || 'Primary Cluster Node'}</dd>
                            <dt>Network Address</dt>
                            <dd>
                                {selectedServer.allocations?.[0]
                                    ? `${selectedServer.allocations[0].alias || selectedServer.allocations[0].ip}:${selectedServer.allocations[0].port}`
                                    : 'None'}
                            </dd>
                            <dt>CPU Limit</dt>
                            <dd>{selectedServer.limits.cpu}%</dd>
                            <dt>Committed Memory</dt>
                            <dd>{selectedServer.limits.memory} MB</dd>
                            <dt>Storage Pool</dt>
                            <dd>{selectedServer.limits.disk} MB</dd>
                            {selectedServer.isFiveM && (selectedServer as any).txadminUrl && (
                                <>
                                    <dt>txAdmin Panel</dt>
                                    <dd>
                                        <a
                                            href={(selectedServer as any).txadminUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--green)', textDecoration: 'underline' }}
                                        >
                                            Port {(selectedServer as any).txadminPort || 40120} ↗
                                        </a>
                                    </dd>
                                </>
                            )}
                        </dl>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                            <button type="button" onClick={() => setSelectedServer(null)}>
                                Close
                            </button>
                            <button
                                type="button"
                                className="solid"
                                onClick={() => {
                                    const id = selectedServer.id;
                                    setSelectedServer(null);
                                    history.push(`/server/${id}`);
                                }}
                            >
                                Open Server Console →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Toast Notification */}
            {toastMessage && (
                <div className="votion-toast" role="status">
                    {toastMessage}
                </div>
            )}

            {/* Quick Server Deployment Modal */}
            <VotionDeployModal isOpen={isDeployOpen} onClose={() => setIsDeployOpen(false)} />
        </div>
    );
};
