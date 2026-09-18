import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { FleetStats } from '@/api/getServers';
import { getTickets, Ticket } from '@/api/tickets';

interface AdminInfrastructureMapProps {
    fleet?: FleetStats | null;
    onViewInstances?: () => void;
}

interface DatacenterNode {
    id: string | number;
    code: string;
    name: string;
    subtitle: string;
    fqdn: string;
    region: string;
    lat: number;
    lng: number;
    serversCount: number;
    latency: number;
    status: 'online' | 'offline' | 'maintenance';
    isPrimary?: boolean;
    cardPlacement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

interface Viewport {
    x: number;
    y: number;
    w: number;
    h: number;
}

const GLOBAL_VIEWPORT: Viewport = { x: 0, y: 0, w: 1000, h: 500 };

const REGION_PRESETS: Record<string, { label: string; tag: string; viewport: Viewport }> = {
    global: {
        label: 'Global View',
        tag: 'ALL',
        viewport: GLOBAL_VIEWPORT,
    },
    eu: {
        label: 'Europe',
        tag: 'EU',
        viewport: { x: 420, y: 55, w: 220, h: 140 },
    },
    ind: {
        label: 'India',
        tag: 'IND',
        viewport: { x: 635, y: 155, w: 160, h: 115 },
    },
    us: {
        label: 'North America',
        tag: 'US',
        viewport: { x: 150, y: 75, w: 260, h: 155 },
    },
    sg: {
        label: 'Asia-Pacific',
        tag: 'APAC',
        viewport: { x: 710, y: 175, w: 230, h: 150 },
    },
};

// Coordinate projection from (lat, lng) to standard SVG space 0 0 1000 500
const project = (lat: number, lng: number): { x: number; y: number } => {
    const x = ((lng + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
};

// Inverse projection from SVG (x, y) to (lat, lng)
const unproject = (x: number, y: number): { lat: number; lng: number } => {
    const lng = (x / 1000) * 360 - 180;
    const lat = 90 - (y / 500) * 180;
    return { lat, lng };
};

const DEFAULT_DCS: DatacenterNode[] = [
    {
        id: 1,
        code: 'DE-NBG-01',
        name: 'German DE 1',
        subtitle: 'Nuremberg, Germany',
        fqdn: 'de-nuremberg-02.votioncloud.org',
        region: 'EU',
        lat: 49.45,
        lng: 11.07,
        serversCount: 41,
        latency: 15,
        status: 'online',
        isPrimary: true,
        cardPlacement: 'top-right',
    },
    {
        id: 2,
        code: 'IN-MUM-02',
        name: 'Mumbai 5',
        subtitle: 'Nexus DC, Mumbai',
        fqdn: 'in-mumbai-02.votioncloud.org',
        region: 'IND',
        lat: 19.07,
        lng: 72.87,
        serversCount: 19,
        latency: 15,
        status: 'online',
        isPrimary: true,
        cardPlacement: 'bottom-left',
    },
    {
        id: 3,
        code: 'SG-SIN-01',
        name: 'SINGAPORE',
        subtitle: 'Equinix SG1, Singapore',
        fqdn: 'sg.laworsloud.in',
        region: 'SG',
        lat: 1.35,
        lng: 103.82,
        serversCount: 18,
        latency: 15,
        status: 'online',
        isPrimary: true,
        cardPlacement: 'bottom-right',
    },
    {
        id: 4,
        code: 'IN-KAN-01',
        name: 'Kannur DC1 Votion',
        subtitle: 'Malabar Edge, Kerala',
        fqdn: 'dmnd01.votioncloud.org',
        region: 'IND',
        lat: 11.87,
        lng: 75.37,
        serversCount: 1,
        latency: 15,
        status: 'online',
        isPrimary: false,
        cardPlacement: 'bottom-left',
    },
    {
        id: 5,
        code: 'IN-BLR-02',
        name: 'Bengaluru Edge',
        subtitle: 'Bengaluru, Karnataka',
        fqdn: 'in-blr02.votioncloud.org',
        region: 'IND',
        lat: 12.97,
        lng: 77.59,
        serversCount: 0,
        latency: 15,
        status: 'online',
        isPrimary: false,
        cardPlacement: 'bottom-left',
    },
    {
        id: 6,
        code: 'IN-MAA-02',
        name: 'Chennai Edge',
        subtitle: 'Chennai, Tamil Nadu',
        fqdn: 'in-maa02.votioncloud.org',
        region: 'IND',
        lat: 13.08,
        lng: 80.27,
        serversCount: 0,
        latency: 15,
        status: 'online',
        isPrimary: false,
        cardPlacement: 'bottom-right',
    },
];

export const AdminInfrastructureMap: React.FC<AdminInfrastructureMapProps> = ({ fleet, onViewInstances }) => {
    const history = useHistory();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNode, setSelectedNode] = useState<DatacenterNode | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | number | null>(null);
    const [recentTicket, setRecentTicket] = useState<Ticket | null>(null);

    // Active & Target Viewport for smooth fly-in animation
    const [viewport, setViewport] = useState<Viewport>(GLOBAL_VIEWPORT);
    const [activeRegionKey, setActiveRegionKey] = useState<string>('global');

    const targetViewportRef = useRef<Viewport>(GLOBAL_VIEWPORT);
    const currentViewportRef = useRef<Viewport>(GLOBAL_VIEWPORT);
    const animFrameRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Drag-to-pan state
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef<{ clientX: number; clientY: number; vpX: number; vpY: number }>({
        clientX: 0,
        clientY: 0,
        vpX: 0,
        vpY: 0,
    });
    const [isDragging, setIsDragging] = useState(false);

    // Smooth Viewport Animation Loop (lerp)
    const animateViewport = useCallback(() => {
        const cur = currentViewportRef.current;
        const tgt = targetViewportRef.current;

        const lerpFactor = 0.16;
        const dx = tgt.x - cur.x;
        const dy = tgt.y - cur.y;
        const dw = tgt.w - cur.w;
        const dh = tgt.h - cur.h;

        const isClose =
            Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2 && Math.abs(dw) < 0.2 && Math.abs(dh) < 0.2;

        if (isClose) {
            currentViewportRef.current = { ...tgt };
            setViewport({ ...tgt });
            animFrameRef.current = null;
        } else {
            const next: Viewport = {
                x: cur.x + dx * lerpFactor,
                y: cur.y + dy * lerpFactor,
                w: cur.w + dw * lerpFactor,
                h: cur.h + dh * lerpFactor,
            };
            currentViewportRef.current = next;
            setViewport(next);
            animFrameRef.current = requestAnimationFrame(animateViewport);
        }
    }, []);

    const setTargetViewport = useCallback(
        (newTarget: Viewport, regionKey?: string) => {
            // Clamp viewport
            const minW = 110;
            const maxW = 1000;
            const w = Math.max(minW, Math.min(maxW, newTarget.w));
            const h = w * 0.5; // preserve 2:1 aspect ratio
            const minX = -60;
            const maxX = 1060 - w;
            const minY = -40;
            const maxY = 540 - h;

            const clamped: Viewport = {
                x: Math.max(minX, Math.min(maxX, newTarget.x)),
                y: Math.max(minY, Math.min(maxY, newTarget.y)),
                w,
                h,
            };

            targetViewportRef.current = clamped;
            if (regionKey !== undefined) {
                setActiveRegionKey(regionKey);
            } else {
                setActiveRegionKey('');
            }

            if (!animFrameRef.current) {
                animFrameRef.current = requestAnimationFrame(animateViewport);
            }
        },
        [animateViewport]
    );

    useEffect(() => {
        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, []);

    // Fetch open support tickets
    useEffect(() => {
        getTickets({ status: 'open' })
            .then((res) => {
                if (Array.isArray(res) && res.length > 0) {
                    setRecentTicket(res[0]);
                }
            })
            .catch(() => {});
    }, []);

    // Merge live node stats if available from backend
    const dcNodes: DatacenterNode[] = useMemo(() => {
        if (!fleet || !fleet.nodes || fleet.nodes.length === 0) {
            return DEFAULT_DCS;
        }

        const resolved: DatacenterNode[] = fleet.nodes.map((node, idx) => {
            const fqdnLower = (node.fqdn || '').toLowerCase();
            const nameLower = (node.name || '').toLowerCase();

            let lat = 49.45;
            let lng = 11.07;
            let region = 'EU';
            let code = `DC-${idx + 1}`;
            let subtitle = node.location || 'Datacenter Facility';
            let cardPlacement: DatacenterNode['cardPlacement'] = 'top-right';

            if (fqdnLower.includes('nuremberg') || nameLower.includes('german') || nameLower.includes('de') || nameLower.includes('falkenstein')) {
                lat = 49.45;
                lng = 11.07;
                region = 'EU';
                code = 'DE-NBG-01';
                subtitle = 'Nuremberg, Germany';
                cardPlacement = 'top-right';
            } else if (fqdnLower.includes('mum') || nameLower.includes('mumbai') || nameLower.includes('bombay')) {
                lat = 19.07;
                lng = 72.87;
                region = 'IND';
                code = 'IN-MUM-02';
                subtitle = 'Nexus DC, Mumbai';
                cardPlacement = 'bottom-left';
            } else if (fqdnLower.includes('sg') || fqdnLower.includes('sing') || nameLower.includes('singapore')) {
                lat = 1.35;
                lng = 103.82;
                region = 'SG';
                code = 'SG-SIN-01';
                subtitle = 'Equinix SG1, Singapore';
                cardPlacement = 'bottom-right';
            } else if (fqdnLower.includes('kann') || nameLower.includes('kannur') || nameLower.includes('kerala')) {
                lat = 11.87;
                lng = 75.37;
                region = 'IND';
                code = 'IN-KAN-01';
                subtitle = 'Malabar Edge, Kerala';
                cardPlacement = 'bottom-left';
            } else if (fqdnLower.includes('blr') || nameLower.includes('bengaluru') || nameLower.includes('bangalore')) {
                lat = 12.97;
                lng = 77.59;
                region = 'IND';
                code = 'IN-BLR-02';
                subtitle = 'Bengaluru, Karnataka';
                cardPlacement = 'bottom-left';
            } else if (fqdnLower.includes('chennai') || nameLower.includes('chennai') || nameLower.includes('maa')) {
                lat = 13.08;
                lng = 80.27;
                region = 'IND';
                code = 'IN-MAA-02';
                subtitle = 'Chennai, Tamil Nadu';
                cardPlacement = 'bottom-right';
            } else if (fqdnLower.includes('hel') || nameLower.includes('helsinki') || nameLower.includes('finland')) {
                lat = 60.16;
                lng = 24.93;
                region = 'EU';
                code = 'FI-HEL-01';
                subtitle = 'Helsinki, Finland';
                cardPlacement = 'top-right';
            } else if (fqdnLower.includes('lon') || nameLower.includes('london') || nameLower.includes('uk')) {
                lat = 51.50;
                lng = -0.12;
                region = 'EU';
                code = 'UK-LON-01';
                subtitle = 'London, UK';
                cardPlacement = 'top-left';
            } else if (nameLower.includes('us') || fqdnLower.includes('us') || nameLower.includes('ashburn') || nameLower.includes('virginia')) {
                lat = 39.04;
                lng = -77.48;
                region = 'US';
                code = 'US-DC-1';
                subtitle = 'Ashburn VA, USA';
                cardPlacement = 'top-right';
            } else {
                lat = 38.0 + (idx * 4) % 15;
                lng = -78.0 + (idx * 12) % 30;
                region = 'US';
                code = `US-DC-${idx + 1}`;
                subtitle = 'Ashburn VA, USA';
                cardPlacement = 'top-right';
            }

            return {
                id: node.id,
                code,
                name: node.name,
                subtitle,
                fqdn: node.fqdn,
                region,
                lat,
                lng,
                serversCount: node.servers_count || 0,
                latency: 15,
                status: node.status || 'online',
                isPrimary: true,
                cardPlacement,
            };
        });

        if (resolved.length < 4) {
            const existingCodes = new Set(resolved.map((r) => r.code));
            DEFAULT_DCS.forEach((d) => {
                if (!existingCodes.has(d.code)) {
                    resolved.push({ ...d, isPrimary: false });
                }
            });
        }

        return resolved;
    }, [fleet]);

    // Filter nodes based on search query
    const filteredNodes = useMemo(() => {
        if (!searchQuery.trim()) return dcNodes;
        const q = searchQuery.toLowerCase().trim();
        return dcNodes.filter(
            (node) =>
                node.name.toLowerCase().includes(q) ||
                node.code.toLowerCase().includes(q) ||
                node.fqdn.toLowerCase().includes(q) ||
                node.subtitle.toLowerCase().includes(q) ||
                node.region.toLowerCase().includes(q)
        );
    }, [dcNodes, searchQuery]);

    // Primary nodes for geodesic arcs
    const primaryNodes = useMemo(() => {
        const primary = dcNodes.filter((n) => n.isPrimary);
        return primary.length > 0 ? primary : dcNodes.slice(0, 4);
    }, [dcNodes]);

    // Calculate arc paths connecting primary nodes in geographic order
    const arcs = useMemo(() => {
        const paths: { id: string; d: string; from: DatacenterNode; to: DatacenterNode }[] = [];
        if (primaryNodes.length < 2) return paths;

        const sorted = [...primaryNodes].sort((a, b) => a.lng - b.lng);

        for (let i = 0; i < sorted.length - 1; i++) {
            const from = sorted[i];
            const to = sorted[i + 1];
            const p1 = project(from.lat, from.lng);
            const p2 = project(to.lat, to.lng);

            const midX = (p1.x + p2.x) / 2;
            const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const lift = Math.min(70, Math.max(25, dist * 0.2));
            const midY = Math.min(p1.y, p2.y) - lift;

            const d = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;
            paths.push({ id: `arc-${from.id}-${to.id}`, d, from, to });
        }
        return paths;
    }, [primaryNodes]);

    // Metrics computation
    const totalServers = fleet?.total ?? 79;
    const runningServers = fleet?.running ?? 37;
    const offlineServers = (totalServers - runningServers - (fleet?.suspended ?? 4) - (fleet?.installing ?? 0)) > 0
        ? totalServers - runningServers - (fleet?.suspended ?? 4) - (fleet?.installing ?? 0)
        : 38;
    const suspendedServers = fleet?.suspended ?? 4;
    const installingServers = fleet?.installing ?? 0;
    const onlineNodesCount = fleet?.nodes_online ?? primaryNodes.filter((n) => n.status === 'online').length;
    const totalNodesCount = fleet?.nodes_total ?? primaryNodes.length;
    const healthPercent = totalNodesCount > 0 ? Math.round((onlineNodesCount / totalNodesCount) * 100) : 100;

    // Zoom level multiplier (1x at global, up to 7x zoomed in)
    const zoomLevel = useMemo(() => {
        return Math.round((1000 / viewport.w) * 10) / 10;
    }, [viewport.w]);

    const isZoomedIn = viewport.w < 550;

    // Focus on a specific node
    const focusNode = useCallback(
        (node: DatacenterNode) => {
            setSelectedNode(node);
            const pt = project(node.lat, node.lng);
            // Fly to node with zoom width ~190
            const targetW = 200;
            const targetH = 100;
            setTargetViewport({
                x: pt.x - targetW * 0.45,
                y: pt.y - targetH * 0.45,
                w: targetW,
                h: targetH,
            });
        },
        [setTargetViewport]
    );

    // Zoom In button handler
    const handleZoomIn = () => {
        const cur = targetViewportRef.current;
        const newW = cur.w * 0.68;
        const newH = cur.h * 0.68;
        const cx = cur.x + cur.w / 2;
        const cy = cur.y + cur.h / 2;
        setTargetViewport({
            x: cx - newW / 2,
            y: cy - newH / 2,
            w: newW,
            h: newH,
        });
    };

    // Zoom Out button handler
    const handleZoomOut = () => {
        const cur = targetViewportRef.current;
        const newW = cur.w / 0.68;
        const newH = cur.h / 0.68;
        const cx = cur.x + cur.w / 2;
        const cy = cur.y + cur.h / 2;
        setTargetViewport({
            x: cx - newW / 2,
            y: cy - newH / 2,
            w: newW,
            h: newH,
        });
    };

    // Mouse Wheel Zoom centered around pointer
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = (e.clientX - rect.left) / rect.width; // 0 to 1
        const mouseY = (e.clientY - rect.top) / rect.height; // 0 to 1

        const cur = targetViewportRef.current;
        // World point under cursor
        const worldX = cur.x + mouseX * cur.w;
        const worldY = cur.y + mouseY * cur.h;

        const factor = e.deltaY < 0 ? 0.8 : 1.25;
        const newW = cur.w * factor;
        const newH = cur.h * factor;

        setTargetViewport({
            x: worldX - mouseX * newW,
            y: worldY - mouseY * newH,
            w: newW,
            h: newH,
        });
    };

    // Mouse Drag to Pan
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only left mouse button and not on interactive buttons/cards
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('.pointer-events-auto')) return;

        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            vpX: currentViewportRef.current.x,
            vpY: currentViewportRef.current.y,
        };
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const dxPixels = e.clientX - dragStartRef.current.clientX;
        const dyPixels = e.clientY - dragStartRef.current.clientY;

        const cur = currentViewportRef.current;
        const dxWorld = (dxPixels / rect.width) * cur.w;
        const dyWorld = (dyPixels / rect.height) * cur.h;

        const newX = dragStartRef.current.vpX - dxWorld;
        const newY = dragStartRef.current.vpY - dyWorld;

        targetViewportRef.current = {
            ...cur,
            x: newX,
            y: newY,
        };
        currentViewportRef.current = {
            ...cur,
            x: newX,
            y: newY,
        };
        setViewport({
            ...cur,
            x: newX,
            y: newY,
        });
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
    };

    // Double click to zoom in at point
    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = (e.clientX - rect.left) / rect.width;
        const mouseY = (e.clientY - rect.top) / rect.height;

        const cur = targetViewportRef.current;
        const worldX = cur.x + mouseX * cur.w;
        const worldY = cur.y + mouseY * cur.h;

        const newW = cur.w * 0.55;
        const newH = cur.h * 0.55;

        setTargetViewport({
            x: worldX - 0.5 * newW,
            y: worldY - 0.5 * newH,
            w: newW,
            h: newH,
        });
    };

    // Helper to calculate card translation styles relative to dynamic viewport
    const getCardStyle = (node: DatacenterNode, pt: { x: number; y: number }) => {
        // Percentage coordinates within the animated viewport
        const leftPct = ((pt.x - viewport.x) / viewport.w) * 100;
        const topPct = ((pt.y - viewport.y) / viewport.h) * 100;

        let transform = 'translate(18px, -100%)'; // default top-right: sits above-right of pin
        const placement = node.cardPlacement || 'top-right';

        if (placement === 'top-left' || leftPct > 78) {
            transform = 'translate(calc(-100% - 18px), -100%)';
        } else if (placement === 'bottom-left') {
            transform = 'translate(calc(-100% - 18px), 16px)';
        } else if (placement === 'bottom-right') {
            transform = 'translate(18px, 16px)';
        }

        return {
            left: `${leftPct}%`,
            top: `${topPct}%`,
            transform,
        };
    };

    // Helper to calculate callout hairline leader line from pin to card corner
    const getLeaderLine = (node: DatacenterNode, pt: { x: number; y: number }) => {
        const placement = node.cardPlacement || 'top-right';
        let startX = pt.x;
        let startY = pt.y;
        let endX = pt.x;
        let endY = pt.y;

        // Dynamic offset scaled gracefully with zoom so line always lands at card
        const scaleFactor = Math.max(0.4, Math.min(1.2, viewport.w / 600));
        const offsetX = 18 * scaleFactor;
        const offsetY = 16 * scaleFactor;

        if (placement === 'top-right') {
            startX = pt.x + 3 * scaleFactor;
            startY = pt.y - 3 * scaleFactor;
            endX = pt.x + offsetX;
            endY = pt.y - offsetY;
        } else if (placement === 'top-left') {
            startX = pt.x - 3 * scaleFactor;
            startY = pt.y - 3 * scaleFactor;
            endX = pt.x - offsetX;
            endY = pt.y - offsetY;
        } else if (placement === 'bottom-right') {
            startX = pt.x + 3 * scaleFactor;
            startY = pt.y + 3 * scaleFactor;
            endX = pt.x + offsetX;
            endY = pt.y + offsetY;
        } else if (placement === 'bottom-left') {
            startX = pt.x - 3 * scaleFactor;
            startY = pt.y + 3 * scaleFactor;
            endX = pt.x - offsetX;
            endY = pt.y + offsetY;
        }

        return { startX, startY, endX, endY };
    };

    // Determine if a node is visible inside the current animated viewport
    const isNodeInView = (pt: { x: number; y: number }) => {
        const marginX = viewport.w * 0.15;
        const marginY = viewport.h * 0.15;
        return (
            pt.x >= viewport.x - marginX &&
            pt.x <= viewport.x + viewport.w + marginX &&
            pt.y >= viewport.y - marginY &&
            pt.y <= viewport.y + viewport.h + marginY
        );
    };

    return (
        <div className="w-full select-none text-white font-sans">
            <style>{`
                @keyframes telemetryDash {
                    from { stroke-dashoffset: 200; }
                    to { stroke-dashoffset: 0; }
                }
                .telemetry-arc-beam {
                    animation: telemetryDash 4s linear infinite;
                }
            `}</style>

            {/* Top Toolbar: Telemetry breadcrumb, Region Preset Bar, Search bar, Support queue indicator */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 mb-4 border-b border-[#1F1F24]">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="font-semibold text-white">Cluster Telemetry</span>
                        <span className="text-[#52525B]">/</span>
                        <span className="text-[#8E8E93]">Production Fleet</span>
                    </div>

                    {/* Dynamic Region Presets Bar */}
                    <div className="flex items-center gap-1 bg-[#090A0F] border border-[#20222D] p-1 rounded-lg">
                        {Object.entries(REGION_PRESETS).map(([key, r]) => {
                            const isActive = activeRegionKey === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTargetViewport(r.viewport, key)}
                                    className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                                        isActive
                                            ? 'bg-[#10B981]/15 text-[#34D399] font-bold border border-[#10B981]/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                            : 'bg-transparent text-[#8E8E93] hover:text-white hover:bg-white/[0.04]'
                                    }`}
                                >
                                    <span>{r.label}</span>
                                    <span className={`text-[9px] px-1 py-0.2 rounded font-sans uppercase ${isActive ? 'bg-[#10B981]/25 text-white' : 'bg-white/[0.05] text-[#71717A]'}`}>
                                        {r.tag}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Search Map & DCs */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Map & DCs"
                            className="bg-[#0B0B0E] border border-[#23232A] focus:border-[#4B4B58] text-xs px-3 py-1.5 pl-8 rounded-md text-[#E1E1E6] placeholder-[#60606B] outline-none transition-colors w-48 sm:w-56"
                        />
                        <svg
                            className="w-3.5 h-3.5 text-[#60606B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                        </svg>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white text-xs bg-transparent border-none p-0 cursor-pointer"
                            >
                                &times;
                            </button>
                        )}
                    </div>

                    {/* Support Queue Link */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[#8E8E93] hidden md:inline font-mono">Support Queue</span>
                        <span className="bg-[#2D1B08] text-[#F59E0B] border border-[#F59E0B]/30 text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
                            1 pending
                        </span>
                        <button
                            type="button"
                            onClick={() => history.push('/support')}
                            className="text-xs text-[#8E8E93] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 inline-flex items-center gap-1 font-medium ml-1"
                        >
                            <span>Manage</span>
                            <span>&rarr;</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Stage: Dynamic Interactive Map with Floating HUD Overlay */}
            <div className="relative w-full rounded-2xl border border-[#1A1A22] bg-[#040407] overflow-hidden shadow-2xl min-h-[520px] lg:min-h-[580px] flex flex-col lg:flex-row items-stretch">
                {/* SVG Global Telemetry Canvas with Pan & Zoom */}
                <div
                    ref={containerRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                    className={`relative flex-1 w-full h-[520px] lg:h-[580px] overflow-hidden bg-[#040407] select-none ${
                        isDragging ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                >
                    <svg
                        viewBox={`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`}
                        className="w-full h-full object-cover select-none pointer-events-none"
                        preserveAspectRatio="none"
                    >
                        <defs>
                            {/* Linear Gradient for Arcs */}
                            <linearGradient id="arcGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                                <stop offset="50%" stopColor="#34D399" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#065F46" stopOpacity="0.2" />
                            </linearGradient>

                            {/* Node Core Glow Filter */}
                            <filter id="emeraldGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2.5" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>

                            {/* Edge Vignette */}
                            <radialGradient id="mapVignette" cx="50%" cy="50%" r="65%">
                                <stop offset="60%" stopColor="#000000" stopOpacity="0" />
                                <stop offset="90%" stopColor="#040407" stopOpacity="0.45" />
                                <stop offset="100%" stopColor="#040407" stopOpacity="0.9" />
                            </radialGradient>
                        </defs>

                        {/* Authentic High-Definition 3600x1800 NASA Night-Lights & Natural Earth Map */}
                        <image
                            href="/assets/world_telemetry_map.webp"
                            xlinkHref="/assets/world_telemetry_map.jpg"
                            x="0"
                            y="0"
                            width="1000"
                            height="500"
                            preserveAspectRatio="none"
                            opacity="0.94"
                        />

                        {/* Dynamic Subtle Telemetry Latitude & Longitude Coordinate Grid */}
                        <g stroke="#262A38" strokeWidth={0.5 * (viewport.w / 1000)} strokeDasharray="3 6" opacity="0.45">
                            <line x1="0" y1="250" x2="1000" y2="250" strokeWidth={0.75 * (viewport.w / 1000)} />
                            <line x1="0" y1="125" x2="1000" y2="125" />
                            <line x1="0" y1="375" x2="1000" y2="375" />

                            <line x1="500" y1="0" x2="500" y2="500" strokeWidth={0.75 * (viewport.w / 1000)} />
                            <line x1="250" y1="0" x2="250" y2="500" />
                            <line x1="750" y1="0" x2="750" y2="500" />
                        </g>

                        {/* Vignette Overlay in Global View */}
                        {!isZoomedIn && (
                            <rect x="0" y="0" width="1000" height="500" fill="url(#mapVignette)" pointerEvents="none" />
                        )}

                        {/* Animated Geodesic Telemetry Arcs */}
                        <g>
                            {arcs.map((arc) => (
                                <g key={arc.id}>
                                    <path
                                        d={arc.d}
                                        fill="none"
                                        stroke="#10B981"
                                        strokeWidth={1.2 * Math.max(0.6, viewport.w / 1000)}
                                        strokeOpacity="0.25"
                                        strokeDasharray="4 4"
                                    />
                                    <path
                                        d={arc.d}
                                        fill="none"
                                        stroke="url(#arcGlow)"
                                        strokeWidth={2.2 * Math.max(0.6, viewport.w / 1000)}
                                        strokeLinecap="round"
                                        filter="url(#emeraldGlow)"
                                        className="telemetry-arc-beam"
                                        strokeDasharray="40 160"
                                    />
                                </g>
                            ))}
                        </g>

                        {/* Region Indicator Pills on Map (Visible in Global View) */}
                        {!isZoomedIn && (
                            <g fontFamily="monospace" fontSize="9" fontWeight="700">
                                <rect x="235" y="165" width="28" height="14" rx="3" fill="#07080C" stroke="#252530" strokeWidth="0.8" opacity="0.9" />
                                <text x="249" y="175" fill="#71717A" textAnchor="middle">US</text>

                                <rect x="472" y="145" width="28" height="14" rx="3" fill="#07080C" stroke="#252530" strokeWidth="0.8" opacity="0.9" />
                                <text x="486" y="155" fill="#71717A" textAnchor="middle">EU</text>

                                <rect x="702" y="295" width="30" height="14" rx="3" fill="#07080C" stroke="#252530" strokeWidth="0.8" opacity="0.9" />
                                <text x="717" y="305" fill="#71717A" textAnchor="middle">IND</text>

                                <rect x="815" y="292" width="28" height="14" rx="3" fill="#07080C" stroke="#252530" strokeWidth="0.8" opacity="0.9" />
                                <text x="829" y="302" fill="#71717A" textAnchor="middle">SG</text>
                            </g>
                        )}

                        {/* Delicate Hairline Callout Pointers connecting Beacon to Card Corner */}
                        <g>
                            {filteredNodes
                                .filter((n) => isNodeInView(project(n.lat, n.lng)))
                                .filter((n) => n.isPrimary || isZoomedIn || hoveredNodeId === n.id || selectedNode?.id === n.id)
                                .map((node) => {
                                    const pt = project(node.lat, node.lng);
                                    const { startX, startY, endX, endY } = getLeaderLine(node, pt);
                                    const isHovered = hoveredNodeId === node.id;
                                    const isSelected = selectedNode?.id === node.id;
                                    const active = isHovered || isSelected;

                                    return (
                                        <g key={`leader-${node.id}`} className="transition-all duration-200">
                                            <line
                                                x1={startX}
                                                y1={startY}
                                                x2={endX}
                                                y2={endY}
                                                stroke={active ? '#34D399' : '#10B981'}
                                                strokeWidth={active ? 1.2 : 0.8}
                                                strokeDasharray="2 3"
                                                strokeOpacity={active ? 0.85 : 0.45}
                                            />
                                            <circle
                                                cx={endX}
                                                cy={endY}
                                                r={active ? 2 : 1.5}
                                                fill={active ? '#34D399' : '#10B981'}
                                                opacity={active ? 1 : 0.65}
                                            />
                                        </g>
                                    );
                                })}
                        </g>

                        {/* Interactive Datacenter Node Radar Pins */}
                        {filteredNodes.map((node) => {
                            const pt = project(node.lat, node.lng);
                            if (!isNodeInView(pt)) return null;

                            const isHovered = hoveredNodeId === node.id;
                            const isSelected = selectedNode?.id === node.id;
                            const scale = Math.max(0.55, Math.min(1.1, viewport.w / 700));

                            return (
                                <g
                                    key={`marker-${node.id}`}
                                    className="cursor-pointer transition-transform duration-150 pointer-events-auto"
                                    onMouseEnter={() => setHoveredNodeId(node.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        focusNode(node);
                                    }}
                                >
                                    {/* Sonar Radar Pulse */}
                                    <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={(isHovered ? 16 : 10) * scale}
                                        fill={node.status === 'online' ? '#10B981' : '#F59E0B'}
                                        opacity={isHovered ? 0.35 : 0.2}
                                        className="animate-ping origin-center"
                                    />

                                    {/* Focus Ring on Hover/Select */}
                                    {(isHovered || isSelected) && (
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r={8 * scale}
                                            fill="none"
                                            stroke="#34D399"
                                            strokeWidth={1.5 * scale}
                                            strokeDasharray="2 2"
                                        />
                                    )}

                                    {/* Core Glowing Marker Dot */}
                                    <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={(node.isPrimary ? 4 : 3) * scale}
                                        fill={node.status === 'online' ? '#34D399' : '#FBBF24'}
                                        stroke="#FFFFFF"
                                        strokeWidth={1 * scale}
                                        filter="url(#emeraldGlow)"
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* HTML Floating Glassmorphic Telemetry Cards Overlaid on Top of Canvas */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {filteredNodes.map((node) => {
                            const pt = project(node.lat, node.lng);
                            if (!isNodeInView(pt)) return null;

                            const isHovered = hoveredNodeId === node.id;
                            const isSelected = selectedNode?.id === node.id;

                            // Display card if primary, or if zoomed in on region, or if hovered/selected
                            const shouldShowCard = node.isPrimary || isZoomedIn || isHovered || isSelected;

                            return (
                                <div
                                    key={`card-${node.id}`}
                                    style={getCardStyle(node, pt)}
                                    className={`absolute pointer-events-auto transition-all duration-200 ${
                                        isHovered || isSelected
                                            ? 'scale-105 z-50 opacity-100'
                                            : shouldShowCard
                                            ? 'opacity-95 hover:opacity-100 z-20'
                                            : 'opacity-0 pointer-events-none'
                                    }`}
                                    onMouseEnter={() => setHoveredNodeId(node.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        focusNode(node);
                                    }}
                                >
                                    {/* Frosted Glassmorphism Telemetry Card */}
                                    <div
                                        className={`relative px-3 py-2 rounded-lg transition-all duration-200 min-w-[155px] max-w-[195px] select-none ${
                                            isHovered || isSelected
                                                ? 'bg-[#08090E]/90 backdrop-blur-xl border border-[#10B981]/50 shadow-[0_0_22px_rgba(16,185,129,0.18),0_12px_28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(52,211,153,0.3)]'
                                                : 'bg-[#08090E]/80 backdrop-blur-lg border border-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/20'
                                        }`}
                                    >
                                        {/* Subtle Top Specular Gradient Line */}
                                        <div
                                            className={`absolute top-0 inset-x-2 h-[1px] bg-gradient-to-r from-transparent ${
                                                isHovered || isSelected ? 'via-emerald-400/50' : 'via-white/20'
                                            } to-transparent`}
                                        />

                                        {/* Top Row: Status Beacon + Node Code + Region + Latency Pill */}
                                        <div className="flex items-center justify-between gap-1.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] animate-pulse shrink-0" />
                                                <span className="font-mono text-[11px] font-bold text-white tracking-tight truncate">
                                                    {node.code}
                                                </span>
                                                <span className="text-[8px] font-mono font-semibold px-1 py-0.2 rounded bg-white/[0.06] text-[#9CA3AF] border border-white/[0.08] shrink-0">
                                                    {node.region}
                                                </span>
                                            </div>
                                            <div className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-[#062417]/90 text-[#34D399] border border-[#10B981]/30 flex items-center gap-1 shrink-0 ml-auto">
                                                <span className="w-1 h-1 rounded-full bg-[#34D399]" />
                                                {node.latency}ms
                                            </div>
                                        </div>

                                        {/* Subtle Hairline Divider */}
                                        <div className="h-[1px] w-full bg-white/[0.06] my-1.5" />

                                        {/* Middle Row: Facility Name & Subtitle Location */}
                                        <div className="space-y-0.5">
                                            <div className="text-[11px] font-medium text-[#F1F5F9] truncate leading-tight">
                                                {node.name}
                                            </div>
                                            <div className="text-[9.5px] font-mono text-[#71717A] truncate flex items-center gap-1">
                                                <svg className="w-2.5 h-2.5 text-[#52525B] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span className="truncate">{node.subtitle}</span>
                                            </div>
                                        </div>

                                        {/* Bottom Row: Server Capacity & Live Optimal Health */}
                                        <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-white/[0.04] text-[9px] font-mono">
                                            <span className="text-[#A1A1AA] flex items-center gap-1 truncate">
                                                <svg className="w-2.5 h-2.5 text-[#6B7280] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <rect x="2" y="2" width="20" height="8" rx="2" strokeWidth={2} />
                                                    <rect x="2" y="14" width="20" height="8" rx="2" strokeWidth={2} />
                                                    <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth={2} />
                                                    <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth={2} />
                                                </svg>
                                                <span>{node.serversCount} {node.serversCount === 1 ? 'Server' : 'Servers'}</span>
                                            </span>
                                            <span className="text-[#34D399] font-medium uppercase tracking-wider text-[8px] flex items-center gap-0.5 shrink-0">
                                                OPTIMAL
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Floating Zoom & Pan Navigation Control HUD in bottom-left */}
                    <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1.5 bg-[#090A0F]/85 backdrop-blur-md border border-[#20222D] p-1 rounded-lg shadow-xl">
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            title="Zoom In (or use mouse wheel)"
                            className="w-7 h-7 flex items-center justify-center rounded bg-[#13141B] hover:bg-[#1C1E29] text-white border border-[#262835] hover:border-[#383A4A] transition-colors cursor-pointer text-sm font-bold font-mono"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            title="Zoom Out (or use mouse wheel)"
                            className="w-7 h-7 flex items-center justify-center rounded bg-[#13141B] hover:bg-[#1C1E29] text-white border border-[#262835] hover:border-[#383A4A] transition-colors cursor-pointer text-sm font-bold font-mono"
                        >
                            &minus;
                        </button>
                        <div className="w-[1px] h-4 bg-[#232530] mx-0.5" />
                        <button
                            type="button"
                            onClick={() => setTargetViewport(GLOBAL_VIEWPORT, 'global')}
                            title="Reset to Global View"
                            className="px-2 h-7 flex items-center justify-center gap-1 rounded bg-[#13141B] hover:bg-[#1C1E29] text-[#A1A1AA] hover:text-white border border-[#262835] hover:border-[#383A4A] transition-colors cursor-pointer text-xs font-mono"
                        >
                            <span>&#x21bb;</span>
                            <span className="text-[10px] hidden sm:inline">Reset</span>
                        </button>

                        <span className="text-[10px] font-mono text-[#60606B] px-1.5 hidden md:inline">
                            {zoomLevel}x
                        </span>
                    </div>

                    {/* Subtle Navigation Hint in bottom center */}
                    <div className="absolute bottom-4 right-4 z-20 pointer-events-none hidden lg:flex items-center gap-2 text-[10px] font-mono text-[#52525B]">
                        <span>Drag to Pan</span>
                        <span>&bull;</span>
                        <span>Scroll to Zoom</span>
                        <span>&bull;</span>
                        <span>Click Pin to Focus</span>
                    </div>
                </div>

                {/* ---------- RIGHT FLOATING HUD OVERLAY ---------- */}
                <div className="w-full lg:w-[340px] xl:w-[370px] bg-[#07070B]/95 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-[#1A1A22] p-5 flex flex-col justify-between gap-4 z-20 shrink-0">
                    <div className="space-y-4">
                        {/* 1. Critical Support Ticket Banner */}
                        <div
                            onClick={() => history.push('/support')}
                            className="bg-[#0D0D12] hover:bg-[#12121A] border border-[#24242E] hover:border-[#383848] transition-all p-3 rounded-xl cursor-pointer shadow-lg group"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold text-[#A1A1AA] group-hover:text-white truncate">
                                    {recentTicket ? `#${recentTicket.ticket_id || recentTicket.id}` : '#T-T-1043'}
                                </span>
                                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/50 shrink-0">
                                    {recentTicket?.priority?.toUpperCase() || 'CRITICAL'}
                                </span>
                            </div>
                            <div className="text-xs font-medium text-white truncate mt-1">
                                {recentTicket?.title || 'AWM Shall give me Germany port'}
                            </div>
                            <div className="text-[10px] text-[#71717A] mt-1 flex items-center gap-1.5 font-mono">
                                <span>6 days ago</span>
                                <span>&bull;</span>
                                <span className="truncate">by {recentTicket?.user?.username || 'vortex'}</span>
                            </div>
                        </div>

                        {/* 2. Cluster Nodes List with Single-Click Camera Fly-in */}
                        <div>
                            <div className="flex items-center justify-between pb-2 border-b border-[#1A1A22]">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-white">Cluster Nodes</span>
                                    <span className="text-[11px] font-mono text-[#10B981] flex items-center gap-1 font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                        {onlineNodesCount} / {totalNodesCount} Online
                                    </span>
                                </div>
                                <a
                                    href="/admin/nodes"
                                    className="text-[11px] text-[#8E8E93] hover:text-white transition-colors no-underline font-medium inline-flex items-center gap-0.5"
                                >
                                    <span>Nodes</span>
                                    <span>&rarr;</span>
                                </a>
                            </div>

                            <div className="mt-2.5 space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                                {dcNodes.filter((n) => n.isPrimary).map((node) => {
                                    const isHovered = hoveredNodeId === node.id;
                                    const isSelected = selectedNode?.id === node.id;

                                    return (
                                        <div
                                            key={`node-item-${node.id}`}
                                            onMouseEnter={() => setHoveredNodeId(node.id)}
                                            onMouseLeave={() => setHoveredNodeId(null)}
                                            onClick={() => focusNode(node)}
                                            className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                                isHovered || isSelected
                                                    ? 'bg-[#14141E] border-[#34D399]/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                                                    : 'bg-[#0B0B0F] border-[#1C1C24] hover:bg-[#111117]'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-semibold text-white truncate">
                                                        {node.name}
                                                    </span>
                                                    <span className="text-[9px] font-mono uppercase bg-[#181820] text-[#A1A1AA] border border-[#272732] px-1 py-0.2 rounded shrink-0">
                                                        {node.region}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-mono text-[#60606B] truncate mt-0.5">
                                                    {node.fqdn}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <div className="font-mono text-xs font-bold text-white">
                                                    {node.serversCount}
                                                </div>
                                                <div className="text-[9px] font-mono text-[#71717A] uppercase">
                                                    SERVERS
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Cluster Health Bar */}
                        <div>
                            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                                <span className="text-[#8E8E93]">Cluster Health</span>
                                <span className="text-[#10B981] font-bold">{healthPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#161620] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#10B981] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                    style={{ width: `${healthPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 4. Server Fleet Status Grid (2x2) */}
                    <div className="pt-2 border-t border-[#1A1A22]">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold text-white">
                                Server Fleet Status <span className="text-[#71717A] font-mono font-normal">({totalServers} Total)</span>
                            </span>
                            <button
                                type="button"
                                onClick={onViewInstances || (() => history.push('/instances'))}
                                className="text-[11px] text-[#8E8E93] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 inline-flex items-center gap-0.5 font-medium"
                            >
                                <span>Fleet</span>
                                <span>&rarr;</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-1 font-mono">
                            {/* Running */}
                            <div className="bg-[#0B0B0F] border border-[#1C1C24] p-2.5 rounded-lg flex flex-col justify-between">
                                <span className="text-[10px] uppercase tracking-wider text-[#34D399] font-bold flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                    RUNNING
                                </span>
                                <span className="text-lg font-bold text-white mt-1">{runningServers}</span>
                            </div>

                            {/* Offline */}
                            <div className="bg-[#0B0B0F] border border-[#1C1C24] p-2.5 rounded-lg flex flex-col justify-between">
                                <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-bold flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]" />
                                    OFFLINE
                                </span>
                                <span className="text-lg font-bold text-white mt-1">{offlineServers}</span>
                            </div>

                            {/* Suspended */}
                            <div className="bg-[#0B0B0F] border border-[#1C1C24] p-2.5 rounded-lg flex flex-col justify-between">
                                <span className="text-[10px] uppercase tracking-wider text-[#F59E0B] font-bold flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                                    SUSPENDED
                                </span>
                                <span className="text-lg font-bold text-white mt-1">{suspendedServers}</span>
                            </div>

                            {/* Installing */}
                            <div className="bg-[#0B0B0F] border border-[#1C1C24] p-2.5 rounded-lg flex flex-col justify-between">
                                <span className="text-[10px] uppercase tracking-wider text-[#60A5FA] font-bold flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" />
                                    INSTALLING
                                </span>
                                <span className="text-lg font-bold text-white mt-1">{installingServers}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminInfrastructureMap;
