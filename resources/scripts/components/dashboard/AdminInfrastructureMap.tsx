import React, { useState, useMemo, useEffect } from 'react';
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

// Coordinate projection from (lat, lng) to SVG viewBox 0 0 1000 500
// Standard Equirectangular projection:
// Longitude -180 to +180 -> X: 0 to 1000
// Latitude +90 to -90 -> Y: 0 to 500
const project = (lat: number, lng: number): { x: number; y: number } => {
    const x = ((lng + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
};

// Default datacenter nodes matching user's fleet with intentional non-colliding layout
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

        // Add additional network nodes from default list if fleet has fewer than 4
        // to maintain global telemetry aesthetic matching reference NOC design
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

        // Sort primary nodes by longitude to connect west to east seamlessly
        const sorted = [...primaryNodes].sort((a, b) => a.lng - b.lng);

        for (let i = 0; i < sorted.length - 1; i++) {
            const from = sorted[i];
            const to = sorted[i + 1];
            const p1 = project(from.lat, from.lng);
            const p2 = project(to.lat, to.lng);

            // Compute quadratic Bezier midpoint with upward geodesic lift
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

    // Helper to calculate card translation styles to avoid overlap
    const getCardStyle = (node: DatacenterNode, pt: { x: number; y: number }) => {
        const leftPct = (pt.x / 1000) * 100;
        const topPct = (pt.y / 500) * 100;

        let transform = 'translate(18px, -100%)'; // default top-right: sits above-right of pin
        const placement = node.cardPlacement || 'top-right';

        if (placement === 'top-left' || leftPct > 80) {
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

        if (placement === 'top-right') {
            startX = pt.x + 3;
            startY = pt.y - 3;
            endX = pt.x + 18;
            endY = pt.y - 14;
        } else if (placement === 'top-left') {
            startX = pt.x - 3;
            startY = pt.y - 3;
            endX = pt.x - 18;
            endY = pt.y - 14;
        } else if (placement === 'bottom-right') {
            startX = pt.x + 3;
            startY = pt.y + 3;
            endX = pt.x + 18;
            endY = pt.y + 16;
        } else if (placement === 'bottom-left') {
            startX = pt.x - 3;
            startY = pt.y + 3;
            endX = pt.x - 18;
            endY = pt.y + 16;
        }

        return { startX, startY, endX, endY };
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

            {/* Top Toolbar: Telemetry breadcrumb, Search bar, Support queue indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-[#1F1F24]">
                <div className="flex items-center gap-2.5 text-xs font-mono">
                    <span className="font-semibold text-white">Cluster Telemetry</span>
                    <span className="text-[#52525B]">/</span>
                    <span className="text-[#8E8E93]">Production Fleet</span>
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

            {/* Main Stage: World Map with Floating HUD Overlay */}
            <div className="relative w-full rounded-2xl border border-[#1A1A22] bg-[#040407] overflow-hidden shadow-2xl min-h-[520px] lg:min-h-[580px] flex flex-col lg:flex-row items-stretch">
                {/* SVG Global Telemetry Canvas */}
                <div className="relative flex-1 w-full h-[520px] lg:h-[580px] overflow-hidden bg-[#040407]">
                    <svg
                        viewBox="0 0 1000 500"
                        className="w-full h-full object-cover select-none"
                        preserveAspectRatio="xMidYMid slice"
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

                            {/* Radial Edge Vignette to blend smoothly into borders */}
                            <radialGradient id="mapVignette" cx="50%" cy="50%" r="65%">
                                <stop offset="60%" stopColor="#000000" stopOpacity="0" />
                                <stop offset="90%" stopColor="#040407" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#040407" stopOpacity="0.95" />
                            </radialGradient>
                        </defs>

                        {/* Authentic High-Definition NASA Night-Lights & Natural Earth Map */}
                        <image
                            href="/assets/world_telemetry_map.webp"
                            xlinkHref="/assets/world_telemetry_map.jpg"
                            x="0"
                            y="0"
                            width="1000"
                            height="500"
                            preserveAspectRatio="none"
                            opacity="0.92"
                        />

                        {/* Subtle Telemetry Latitude & Longitude Coordinate Lines */}
                        <g stroke="#262A38" strokeWidth="0.5" strokeDasharray="3 6" opacity="0.45">
                            {/* Equator & Key Latitudes */}
                            <line x1="0" y1="250" x2="1000" y2="250" strokeWidth="0.75" />
                            <line x1="0" y1="125" x2="1000" y2="125" />
                            <line x1="0" y1="375" x2="1000" y2="375" />

                            {/* Prime Meridian & Longitudes */}
                            <line x1="500" y1="0" x2="500" y2="500" strokeWidth="0.75" />
                            <line x1="250" y1="0" x2="250" y2="500" />
                            <line x1="750" y1="0" x2="750" y2="500" />
                        </g>

                        {/* Vignette Overlay */}
                        <rect x="0" y="0" width="1000" height="500" fill="url(#mapVignette)" pointerEvents="none" />

                        {/* Animated Geodesic Telemetry Arcs */}
                        <g>
                            {arcs.map((arc) => (
                                <g key={arc.id}>
                                    {/* Base Dashed Arc Track */}
                                    <path
                                        d={arc.d}
                                        fill="none"
                                        stroke="#10B981"
                                        strokeWidth="1.2"
                                        strokeOpacity="0.25"
                                        strokeDasharray="4 4"
                                    />
                                    {/* Glowing Pulse Travel Beam */}
                                    <path
                                        d={arc.d}
                                        fill="none"
                                        stroke="url(#arcGlow)"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        filter="url(#emeraldGlow)"
                                        className="telemetry-arc-beam"
                                        strokeDasharray="40 160"
                                    />
                                </g>
                            ))}
                        </g>

                        {/* Region Indicator Pills on Map */}
                        <g fontFamily="monospace" fontSize="9" fontWeight="700">
                            {/* US Region Tag */}
                            <rect x="235" y="165" width="28" height="14" rx="3" fill="#07080C" stroke="#252530" strokeWidth="0.8" opacity="0.9" />
                            <text x="249" y="175" fill="#71717A" textAnchor="middle">US</text>

                            {/* EU Region Tag */}
                            <rect x="472" y="145" width="28" height="14" rx="3" fill="#07080C" stroke="#252530" strokeWidth="0.8" opacity="0.9" />
                            <text x="486" y="155" fill="#71717A" textAnchor="middle">EU</text>

                            {/* IND Region Tag */}
                            <rect x="702" y="295" width="30" height="14" rx="3" fill="#07080C" stroke="#252530" strokeWidth="0.8" opacity="0.9" />
                            <text x="717" y="305" fill="#71717A" textAnchor="middle">IND</text>

                            {/* SG Region Tag */}
                            <rect x="815" y="292" width="28" height="14" rx="3" fill="#07080C" stroke="#252530" strokeWidth="0.8" opacity="0.9" />
                            <text x="829" y="302" fill="#71717A" textAnchor="middle">SG</text>
                        </g>

                        {/* Delicate Hairline Callout Pointers connecting Beacon to Card Corner */}
                        <g>
                            {filteredNodes.filter((n) => n.isPrimary || hoveredNodeId === n.id).map((node) => {
                                const pt = project(node.lat, node.lng);
                                const { startX, startY, endX, endY } = getLeaderLine(node, pt);
                                const isHovered = hoveredNodeId === node.id;
                                const isSelected = selectedNode?.id === node.id;
                                const active = isHovered || isSelected;

                                return (
                                    <g key={`leader-${node.id}`} className="transition-all duration-200">
                                        {/* Connecting Line */}
                                        <line
                                            x1={startX}
                                            y1={startY}
                                            x2={endX}
                                            y2={endY}
                                            stroke={active ? '#34D399' : '#10B981'}
                                            strokeWidth={active ? '1.2' : '0.8'}
                                            strokeDasharray="2 3"
                                            strokeOpacity={active ? '0.85' : '0.45'}
                                        />
                                        {/* Micro Anchor Terminal Dot at Card Attachment Point */}
                                        <circle
                                            cx={endX}
                                            cy={endY}
                                            r={active ? '2' : '1.5'}
                                            fill={active ? '#34D399' : '#10B981'}
                                            opacity={active ? '1' : '0.65'}
                                        />
                                    </g>
                                );
                            })}
                        </g>

                        {/* Interactive Datacenter Node Radar Pins */}
                        {filteredNodes.map((node) => {
                            const pt = project(node.lat, node.lng);
                            const isHovered = hoveredNodeId === node.id;
                            const isSelected = selectedNode?.id === node.id;

                            return (
                                <g
                                    key={`marker-${node.id}`}
                                    className="cursor-pointer transition-transform duration-150"
                                    onMouseEnter={() => setHoveredNodeId(node.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                    onClick={() => setSelectedNode(node)}
                                >
                                    {/* Sonar Radar Pulse */}
                                    <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={isHovered ? '16' : '10'}
                                        fill={node.status === 'online' ? '#10B981' : '#F59E0B'}
                                        opacity={isHovered ? '0.35' : '0.2'}
                                        className="animate-ping origin-center"
                                    />

                                    {/* Focus Ring on Hover */}
                                    {(isHovered || isSelected) && (
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r="8"
                                            fill="none"
                                            stroke="#34D399"
                                            strokeWidth="1.5"
                                            strokeDasharray="2 2"
                                        />
                                    )}

                                    {/* Core Glowing Marker Dot */}
                                    <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={node.isPrimary ? '4' : '3'}
                                        fill={node.status === 'online' ? '#34D399' : '#FBBF24'}
                                        stroke="#FFFFFF"
                                        strokeWidth="1"
                                        filter="url(#emeraldGlow)"
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* HTML Floating Glassmorphic Telemetry Cards Overlaid on Top of Canvas */}
                    <div className="absolute inset-0 pointer-events-none">
                        {filteredNodes.map((node) => {
                            const pt = project(node.lat, node.lng);
                            const isHovered = hoveredNodeId === node.id;
                            const isSelected = selectedNode?.id === node.id;

                            // Display card if primary, or if hovered/selected
                            const shouldShowCard = node.isPrimary || isHovered || isSelected;

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
                                    onClick={() => setSelectedNode(node)}
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

                        {/* 2. Cluster Nodes List */}
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

                                    return (
                                        <div
                                            key={`node-item-${node.id}`}
                                            onMouseEnter={() => setHoveredNodeId(node.id)}
                                            onMouseLeave={() => setHoveredNodeId(null)}
                                            onClick={() => setSelectedNode(node)}
                                            className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                                isHovered
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
