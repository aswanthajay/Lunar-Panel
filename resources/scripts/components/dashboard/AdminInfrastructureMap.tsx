import React, { useState, useMemo, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { FleetStats, NodeStats } from '@/api/getServers';
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
}

// Coordinate projection from (lat, lng) to SVG viewBox 0 0 1000 500
const project = (lat: number, lng: number): { x: number; y: number } => {
    const x = ((lng + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
};

// Default datacenter nodes matching user's fleet
const DEFAULT_DCS: DatacenterNode[] = [
    {
        id: 1,
        code: 'DE-NBG-01',
        name: 'German DE 1',
        subtitle: 'Nuremberg',
        fqdn: 'de-nuremberg-01.votioncloud.org',
        region: 'EU',
        lat: 49.45,
        lng: 11.07,
        serversCount: 41,
        latency: 15,
        status: 'online',
        isPrimary: true,
    },
    {
        id: 2,
        code: 'IN-MUM-02',
        name: 'Mumbai 5',
        subtitle: 'Nexus DC',
        fqdn: 'in-mum01-02.votioncloud.org',
        region: 'IND',
        lat: 19.07,
        lng: 72.87,
        serversCount: 19,
        latency: 15,
        status: 'online',
        isPrimary: true,
    },
    {
        id: 3,
        code: 'SG-SIN-01',
        name: 'SINGAPORE',
        subtitle: 'Equinix SG1',
        fqdn: 'sg0.inwarscloud.in',
        region: 'SG',
        lat: 1.35,
        lng: 103.82,
        serversCount: 18,
        latency: 15,
        status: 'online',
        isPrimary: true,
    },
    {
        id: 4,
        code: 'IN-KAN-01',
        name: 'Kannur DC1 Votion',
        subtitle: 'Malabar Edge',
        fqdn: 'kanndc1.votioncloud.org',
        region: 'IND',
        lat: 11.87,
        lng: 75.37,
        serversCount: 1,
        latency: 15,
        status: 'online',
        isPrimary: true,
    },
    {
        id: 5,
        code: 'IN-BLR-02',
        name: 'Bengaluru Edge',
        subtitle: 'Bengaluru',
        fqdn: 'in-blr02.votioncloud.org',
        region: 'IND',
        lat: 12.97,
        lng: 77.59,
        serversCount: 0,
        latency: 15,
        status: 'online',
        isPrimary: false,
    },
    {
        id: 6,
        code: 'IN-MAA-02',
        name: 'Chennai Edge',
        subtitle: 'Chennai',
        fqdn: 'in-maa02.votioncloud.org',
        region: 'IND',
        lat: 13.08,
        lng: 80.27,
        serversCount: 0,
        latency: 15,
        status: 'online',
        isPrimary: false,
    },
];

// Curated high-density world night-lights clusters for authentic NASA Black Marble aesthetic
const NIGHT_LIGHT_CLUSTERS: [number, number, number][] = [
    // [lat, lng, opacity/density]
    // Western & Central Europe
    [51.5, -0.1, 0.9], [48.8, 2.3, 0.9], [52.5, 13.4, 0.85], [52.3, 4.9, 0.9], [50.8, 4.3, 0.85],
    [41.9, 12.5, 0.8], [40.4, -3.7, 0.8], [45.4, 9.2, 0.85], [48.1, 11.6, 0.9], [50.1, 8.7, 0.9],
    [53.5, 10.0, 0.8], [55.7, 37.6, 0.85], [59.9, 30.3, 0.75], [52.2, 21.0, 0.8], [50.0, 14.4, 0.8],
    [47.4, 19.0, 0.8], [48.2, 16.3, 0.85], [46.9, 7.4, 0.8], [37.9, 23.7, 0.7], [38.7, -9.1, 0.75],
    [53.3, -6.2, 0.8], [55.9, -3.2, 0.75], [59.3, 18.0, 0.8], [60.1, 24.9, 0.8], [55.6, 12.5, 0.8],
    // South Asia / India & Neighbors
    [28.6, 77.2, 0.95], [19.0, 72.8, 0.95], [12.9, 77.5, 0.9], [13.0, 80.2, 0.9], [17.3, 78.4, 0.85],
    [22.5, 88.3, 0.85], [23.0, 72.5, 0.8], [18.5, 73.8, 0.85], [26.9, 75.8, 0.8], [26.8, 80.9, 0.8],
    [11.8, 75.3, 0.75], [9.9, 76.2, 0.8], [8.5, 76.9, 0.75], [24.8, 67.0, 0.85], [31.5, 74.3, 0.85],
    [23.8, 90.4, 0.8], [6.9, 79.8, 0.75],
    // Southeast Asia & East Asia
    [1.35, 103.8, 0.95], [13.7, 100.5, 0.85], [3.1, 101.6, 0.85], [-6.2, 106.8, 0.85], [14.5, 120.9, 0.8],
    [10.8, 106.6, 0.8], [22.3, 114.1, 0.9], [25.0, 121.5, 0.85], [31.2, 121.4, 0.95], [39.9, 116.4, 0.95],
    [23.1, 113.2, 0.9], [22.5, 114.0, 0.9], [30.5, 114.3, 0.8], [30.6, 104.0, 0.8], [37.5, 126.9, 0.95],
    [35.6, 139.6, 0.95], [34.6, 135.5, 0.9], [35.1, 136.9, 0.85], [43.0, 141.3, 0.75],
    // Middle East
    [25.2, 55.2, 0.9], [24.4, 54.3, 0.85], [24.7, 46.6, 0.85], [21.5, 39.1, 0.8], [29.3, 47.9, 0.8],
    [32.0, 34.7, 0.85], [31.9, 35.9, 0.75], [33.8, 35.5, 0.75], [41.0, 28.9, 0.9], [39.9, 32.8, 0.8],
    // North America
    [40.7, -74.0, 0.95], [34.0, -118.2, 0.95], [41.8, -87.6, 0.9], [29.7, -95.3, 0.85], [32.7, -96.7, 0.85],
    [37.7, -122.4, 0.9], [47.6, -122.3, 0.85], [25.7, -80.1, 0.85], [33.7, -84.3, 0.85], [38.9, -77.0, 0.9],
    [42.3, -71.0, 0.85], [43.6, -79.3, 0.85], [45.5, -73.5, 0.8], [49.2, -123.1, 0.8], [19.4, -99.1, 0.85],
    // South America
    [-23.5, -46.6, 0.9], [-22.9, -43.1, 0.85], [-34.6, -58.3, 0.85], [-33.4, -70.6, 0.8], [-12.0, -77.0, 0.8],
    [4.7, -74.0, 0.8],
    // Australia & Africa
    [-33.8, 151.2, 0.9], [-37.8, 144.9, 0.85], [-27.4, 153.0, 0.8], [-31.9, 115.8, 0.75],
    [30.0, 31.2, 0.85], [-26.2, 28.0, 0.85], [-33.9, 18.4, 0.8], [6.5, 3.3, 0.8],
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
            let subtitle = node.location || 'Datacenter';

            if (fqdnLower.includes('nuremberg') || nameLower.includes('german') || nameLower.includes('de')) {
                lat = 49.45;
                lng = 11.07;
                region = 'EU';
                code = 'DE-NBG-01';
                subtitle = 'Nuremberg';
            } else if (fqdnLower.includes('mum') || nameLower.includes('mumbai') || nameLower.includes('bombay')) {
                lat = 19.07;
                lng = 72.87;
                region = 'IND';
                code = 'IN-MUM-02';
                subtitle = 'Mumbai';
            } else if (fqdnLower.includes('sg') || fqdnLower.includes('sing') || nameLower.includes('singapore')) {
                lat = 1.35;
                lng = 103.82;
                region = 'SG';
                code = 'SG-SIN-01';
                subtitle = 'Singapore';
            } else if (fqdnLower.includes('kann') || nameLower.includes('kannur') || nameLower.includes('kerala')) {
                lat = 11.87;
                lng = 75.37;
                region = 'IND';
                code = 'IN-KAN-01';
                subtitle = 'Kannur';
            } else if (fqdnLower.includes('blr') || nameLower.includes('bengaluru') || nameLower.includes('bangalore')) {
                lat = 12.97;
                lng = 77.59;
                region = 'IND';
                code = 'IN-BLR-02';
                subtitle = 'Bengaluru';
            } else if (fqdnLower.includes('chennai') || nameLower.includes('chennai') || nameLower.includes('maa')) {
                lat = 13.08;
                lng = 80.27;
                region = 'IND';
                code = 'IN-MAA-02';
                subtitle = 'Chennai';
            } else if (fqdnLower.includes('hel') || nameLower.includes('helsinki') || nameLower.includes('finland')) {
                lat = 60.16;
                lng = 24.93;
                region = 'EU';
                code = 'FI-HEL-01';
                subtitle = 'Helsinki';
            } else if (fqdnLower.includes('lon') || nameLower.includes('london') || nameLower.includes('uk')) {
                lat = 51.50;
                lng = -0.12;
                region = 'EU';
                code = 'UK-LON-01';
                subtitle = 'London';
            } else {
                lat = 40.0 + (idx * 5) % 20;
                lng = -75.0 + (idx * 15) % 40;
                region = 'US';
                code = `US-DC-${idx + 1}`;
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
            };
        });

        // Add additional decorative edge nodes from default list if fleet has fewer than 5
        if (resolved.length < 5) {
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
    const primaryNodes = useMemo(() => dcNodes.filter((n) => n.isPrimary), [dcNodes]);

    // Calculate arc paths connecting primary nodes (Germany <-> Mumbai, Mumbai <-> Singapore, etc.)
    const arcs = useMemo(() => {
        const paths: { id: string; d: string; from: DatacenterNode; to: DatacenterNode }[] = [];
        if (primaryNodes.length < 2) return paths;

        for (let i = 0; i < primaryNodes.length - 1; i++) {
            const from = primaryNodes[i];
            const to = primaryNodes[i + 1];
            const p1 = project(from.lat, from.lng);
            const p2 = project(to.lat, to.lng);

            // Compute quadratic Bezier midpoint with upward geodesic lift
            const midX = (p1.x + p2.x) / 2;
            const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const lift = Math.min(80, Math.max(30, dist * 0.22));
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

    return (
        <div className="w-full select-none text-white font-sans">
            <style>{`
                @keyframes telemetryDash {
                    from { stroke-dashoffset: 200; }
                    to { stroke-dashoffset: 0; }
                }
                .telemetry-arc-beam {
                    animation: telemetryDash 3.5s linear infinite;
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
            <div className="relative w-full rounded-2xl border border-[#1A1A22] bg-[#030306] overflow-hidden shadow-2xl min-h-[520px] lg:min-h-[580px] flex items-stretch">
                {/* Background Grid Texture */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                        backgroundImage: `radial-gradient(circle, #2C2C38 1px, transparent 1px)`,
                        backgroundSize: '24px 24px',
                    }}
                />

                {/* SVG Global Telemetry Canvas */}
                <div className="relative flex-1 w-full h-[520px] lg:h-[580px] overflow-hidden">
                    <svg
                        viewBox="0 0 1000 500"
                        className="w-full h-full object-cover select-none"
                        preserveAspectRatio="xMidYMid slice"
                    >
                        <defs>
                            {/* Linear Gradient for Arcs */}
                            <linearGradient id="arcGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                                <stop offset="50%" stopColor="#34D399" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#065F46" stopOpacity="0.2" />
                            </linearGradient>

                            {/* Node Core Glow Filter */}
                            <filter id="emeraldGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Subtle Continental Landmass Outlines */}
                        <g fill="#0B0B11" stroke="#161622" strokeWidth="0.75" opacity="0.95">
                            {/* North America */}
                            <path d="M 120 70 Q 180 50 250 60 Q 300 75 320 120 Q 290 150 260 170 Q 230 210 200 240 Q 180 230 170 200 Q 140 180 120 140 Z" />
                            {/* South America */}
                            <path d="M 270 260 Q 340 280 360 340 Q 340 420 300 460 Q 270 420 260 360 Q 250 300 270 260 Z" />
                            {/* Eurasia & Africa */}
                            <path d="M 460 70 Q 560 60 720 75 Q 860 85 910 140 Q 890 220 840 250 Q 760 260 700 220 Q 640 200 620 180 Q 570 170 520 120 Q 480 90 460 70 Z" />
                            <path d="M 480 180 Q 560 180 580 230 Q 590 320 540 390 Q 480 400 460 340 Q 440 260 480 180 Z" />
                            {/* Australia & Oceania */}
                            <path d="M 780 340 Q 860 330 900 370 Q 880 430 820 440 Q 770 410 780 340 Z" />
                            {/* British Isles & Japan */}
                            <path d="M 480 100 Q 495 95 490 115 Q 475 118 480 100 Z" />
                            <path d="M 870 140 Q 895 130 900 170 Q 880 180 870 140 Z" />
                        </g>

                        {/* High-Density Night-Lights Clusters */}
                        <g fill="#FFFFFF">
                            {NIGHT_LIGHT_CLUSTERS.map(([lat, lng, opacity], i) => {
                                const pt = project(lat, lng);
                                return (
                                    <circle
                                        key={`light-${i}`}
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={opacity > 0.85 ? 1.4 : 1.0}
                                        fill="#E2E8F0"
                                        opacity={opacity * 0.45}
                                    />
                                );
                            })}
                        </g>

                        {/* Animated Geodesic Telemetry Arcs */}
                        <g>
                            {arcs.map((arc) => (
                                <g key={arc.id}>
                                    {/* Base Background Track */}
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
                        <g fontFamily="monospace" fontSize="10" fontWeight="700">
                            {/* EU Region Tag */}
                            <rect x="475" y="142" width="28" height="15" rx="3" fill="#0A0A0E" stroke="#252530" strokeWidth="0.8" />
                            <text x="489" y="153" fill="#8E8E93" textAnchor="middle">EU</text>

                            {/* IND Region Tag */}
                            <rect x="696" y="270" width="32" height="15" rx="3" fill="#0A0A0E" stroke="#252530" strokeWidth="0.8" />
                            <text x="712" y="281" fill="#8E8E93" textAnchor="middle">IND</text>

                            {/* SG Region Tag */}
                            <rect x="802" y="278" width="28" height="15" rx="3" fill="#0A0A0E" stroke="#252530" strokeWidth="0.8" />
                            <text x="816" y="289" fill="#8E8E93" textAnchor="middle">SG</text>
                        </g>

                        {/* Interactive Datacenter Node Markers */}
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
                                        r="12"
                                        fill={node.status === 'online' ? '#10B981' : '#F59E0B'}
                                        opacity="0.25"
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
                                        r="4"
                                        fill={node.status === 'online' ? '#34D399' : '#FBBF24'}
                                        stroke="#FFFFFF"
                                        strokeWidth="1"
                                        filter="url(#emeraldGlow)"
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* HTML Floating Node Cards Overlaid on Top of SVG Canvas */}
                    <div className="absolute inset-0 pointer-events-none">
                        {filteredNodes.map((node) => {
                            const pt = project(node.lat, node.lng);
                            // Percentage offsets relative to container
                            const leftPct = (pt.x / 1000) * 100;
                            const topPct = (pt.y / 500) * 100;
                            const isHovered = hoveredNodeId === node.id;
                            const isSelected = selectedNode?.id === node.id;

                            // Adjust card placement offset to avoid edge clipping
                            const isFarRight = leftPct > 72;
                            const isFarTop = topPct < 25;

                            return (
                                <div
                                    key={`card-${node.id}`}
                                    style={{
                                        left: `${leftPct}%`,
                                        top: `${topPct}%`,
                                        transform: `translate(${isFarRight ? '-105%' : '14px'}, ${isFarTop ? '12px' : '-50%'})`,
                                    }}
                                    className={`absolute pointer-events-auto transition-all duration-200 z-20 ${
                                        isHovered || isSelected ? 'scale-105 z-30' : 'opacity-90 hover:opacity-100'
                                    }`}
                                    onMouseEnter={() => setHoveredNodeId(node.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                    onClick={() => setSelectedNode(node)}
                                >
                                    <div className="bg-[#0B0B0E]/95 backdrop-blur-md border border-[#23232C] hover:border-[#3E3E4C] px-2.5 py-1.5 rounded-lg shadow-2xl flex flex-col gap-0.5 min-w-[120px]">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-[11px] font-bold text-white tracking-tight">
                                                {node.code}
                                            </span>
                                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#062417] text-[#34D399] border border-[#10B981]/30">
                                                {node.latency}ms
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-[#8E8E93] truncate max-w-[130px] font-sans">
                                            {node.name}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Subtle 4-Point Sparkle Logo / Star in bottom right corner */}
                    <div className="absolute bottom-4 right-4 pointer-events-none opacity-20 hidden lg:block">
                        <svg width="42" height="42" viewBox="0 0 24 24" fill="#FFFFFF">
                            <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
                        </svg>
                    </div>
                </div>

                {/* ---------- RIGHT FLOATING HUD OVERLAY ---------- */}
                <div className="w-full lg:w-[340px] xl:w-[370px] bg-[#08080C]/90 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-[#1A1A22] p-5 flex flex-col justify-between gap-4 z-20 shrink-0">
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
                                                    ? 'bg-[#14141E] border-[#383848]'
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
