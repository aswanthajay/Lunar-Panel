import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';
import { FiveMPlayer, ServerData } from './types';
import { FiveMPlayerCard } from './FiveMPlayerCard';
import {
    InspectPlayerModal,
    WhisperPlayerModal,
    KickPlayerModal,
    BanPlayerModal,
} from './FiveMPlayerModals';

export default function FiveMPlayerManagerContainer() {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id || '';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<ServerData>({
        offline: false,
        online: 0,
        max: 32,
        server_name: server?.name || 'FiveM Server',
        gametype: 'FiveM RP',
        mapname: 'Los Santos',
        cfx_id: null,
        join_url: null,
        players: [],
    });

    // Filtering, Searching & Options
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState<'all' | 'hwid' | 'discord' | 'steam'>('all');
    const [sortBy, setSortBy] = useState<'id' | 'name' | 'ping'>('id');
    const [maskIps, setMaskIps] = useState(false);
    const [activeTab, setActiveTab] = useState<'players' | 'broadcast'>('players');

    // Modals state
    const [inspectPlayer, setInspectPlayer] = useState<FiveMPlayer | null>(null);

    const [whisperPlayer, setWhisperPlayer] = useState<FiveMPlayer | null>(null);
    const [whisperLoading, setWhisperLoading] = useState(false);

    const [kickPlayer, setKickPlayer] = useState<FiveMPlayer | null>(null);
    const [kickLoading, setKickLoading] = useState(false);

    const [banPlayer, setBanPlayer] = useState<FiveMPlayer | null>(null);
    const [banLoading, setBanLoading] = useState(false);

    // Broadcast state
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcasting, setBroadcasting] = useState(false);

    // Toast Notice
    const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

    const loadPlayers = useCallback(
        async (silent = false) => {
            if (!uuid) return;
            if (!silent) setLoading(true);
            else setRefreshing(true);

            try {
                const res = await http.get(`/api/client/servers/${uuid}/fivem/players`);
                setData(res.data);
            } catch (err: any) {
                setNotice({
                    type: 'error',
                    text: err?.response?.data?.error || 'Failed to query FiveM players. Ensure FXServer is active.',
                });
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [uuid]
    );

    useEffect(() => {
        loadPlayers();
        const interval = setInterval(() => {
            loadPlayers(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [loadPlayers]);

    // Handle Kick action
    const handleConfirmKick = async (reason: string) => {
        if (!kickPlayer) return;
        setKickLoading(true);
        try {
            await http.post(`/api/client/servers/${uuid}/fivem/players/action`, {
                action: 'kick',
                player_id: kickPlayer.id,
                reason,
            });

            setNotice({
                type: 'ok',
                text: `Player ${kickPlayer.name} (ID #${kickPlayer.id}) was kicked.`,
            });
            setKickPlayer(null);
            loadPlayers(true);
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to kick player.',
            });
        } finally {
            setKickLoading(false);
        }
    };

    // Handle Ban action
    const handleConfirmBan = async (duration: string, reason: string) => {
        if (!banPlayer) return;
        setBanLoading(true);
        try {
            await http.post(`/api/client/servers/${uuid}/fivem/players/action`, {
                action: 'ban',
                player_id: banPlayer.id,
                duration,
                reason,
            });

            setNotice({
                type: 'ok',
                text: `Player ${banPlayer.name} (ID #${banPlayer.id}) was banned (${duration}).`,
            });
            setBanPlayer(null);
            loadPlayers(true);
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to ban player.',
            });
        } finally {
            setBanLoading(false);
        }
    };

    // Handle Whisper action
    const handleConfirmWhisper = async (message: string) => {
        if (!whisperPlayer) return;
        setWhisperLoading(true);
        try {
            await http.post(`/api/client/servers/${uuid}/fivem/players/action`, {
                action: 'message',
                player_id: whisperPlayer.id,
                message,
            });

            setNotice({
                type: 'ok',
                text: `Whisper delivered to ${whisperPlayer.name} (ID #${whisperPlayer.id}).`,
            });
            setWhisperPlayer(null);
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to send whisper.',
            });
        } finally {
            setWhisperLoading(false);
        }
    };

    // Handle Chat Broadcast
    const handleBroadcast = async () => {
        if (!broadcastMsg.trim()) return;
        setBroadcasting(true);
        try {
            await http.post(`/api/client/servers/${uuid}/fivem/players/action`, {
                action: 'broadcast',
                message: broadcastMsg.trim(),
            });

            setNotice({
                type: 'ok',
                text: 'Announcement broadcasted to all in-game FiveM players.',
            });
            setBroadcastMsg('');
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to broadcast announcement.',
            });
        } finally {
            setBroadcasting(false);
        }
    };

    // Calculate latency and platform metrics
    const stats = useMemo(() => {
        const players = data.players || [];
        const pings = players.map((p) => p.ping).filter((p): p is number => typeof p === 'number');
        const avgPing = pings.length > 0 ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null;
        const hwidCount = players.filter((p) => p.hwids && p.hwids.length > 0).length;
        const discordCount = players.filter((p) => Boolean(p.identifiers.discord)).length;
        const steamCount = players.filter((p) => Boolean(p.identifiers.steam)).length;

        return {
            avgPing,
            hwidCount,
            discordCount,
            steamCount,
            total: players.length,
        };
    }, [data.players]);

    // Filter & sort player list
    const filteredAndSortedPlayers = useMemo(() => {
        let list = [...(data.players || [])];

        // Search query
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((p) => {
                if (p.name.toLowerCase().includes(q)) return true;
                if (String(p.id) === q) return true;
                if (p.ip && p.ip.toLowerCase().includes(q)) return true;
                if (p.geo?.country?.toLowerCase().includes(q)) return true;
                if (p.geo?.city?.toLowerCase().includes(q)) return true;
                if (p.identifiers.discord?.toLowerCase().includes(q)) return true;
                if (p.identifiers.steam?.toLowerCase().includes(q)) return true;
                if (p.identifiers.license?.toLowerCase().includes(q)) return true;
                if (p.identifiers.license2?.toLowerCase().includes(q)) return true;
                if (p.hwids && p.hwids.some((hw) => hw.toLowerCase().includes(q))) return true;
                return false;
            });
        }

        // Filter Category
        if (filterCategory === 'hwid') {
            list = list.filter((p) => p.hwids && p.hwids.length > 0);
        } else if (filterCategory === 'discord') {
            list = list.filter((p) => Boolean(p.identifiers.discord));
        } else if (filterCategory === 'steam') {
            list = list.filter((p) => Boolean(p.identifiers.steam));
        }

        // Sort
        list.sort((a, b) => {
            if (sortBy === 'id') {
                return a.id - b.id;
            }
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            }
            if (sortBy === 'ping') {
                const pA = a.ping ?? 9999;
                const pB = b.ping ?? 9999;
                return pA - pB;
            }
            return 0;
        });

        return list;
    }, [data.players, search, filterCategory, sortBy]);

    return (
        <ServerContentBlock title="FiveM Player Manager">
            <div className="flex flex-col gap-5 text-[#EDEDED]" style={{ fontFamily: 'var(--font-sans)' }}>
                {/* ── Toast Notice ── */}
                {notice && (
                    <div
                        className={`flex items-center justify-between px-4 py-3 rounded-lg text-xs font-mono border transition-all ${
                            notice.type === 'ok'
                                ? 'bg-[#000000] border-[#10B981] text-[#10B981]'
                                : 'bg-[#000000] border-[#EF4444] text-[#EF4444]'
                        }`}
                    >
                        <span>{notice.text}</span>
                        <button
                            type="button"
                            onClick={() => setNotice(null)}
                            className="text-[#737373] hover:text-white ml-4 cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* ── Server Overview Header ── */}
                <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] p-5 shadow-lg">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                                <span
                                    className={`w-2.5 h-2.5 rounded-full ${
                                        data.offline ? 'bg-[#EF4444]' : 'bg-[#10B981] animate-pulse'
                                    }`}
                                />
                                <h1 className="text-lg font-sans font-semibold text-white tracking-tight">
                                    {data.server_name}
                                </h1>
                                {data.cfx_id && (
                                    <span className="text-[11px] font-mono bg-[#0A0A0A] border border-[#262626] text-[#A0A0A0] px-2 py-0.5 rounded">
                                        CFX: {data.cfx_id}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-[#737373] m-0 flex items-center gap-2 flex-wrap">
                                <span>Mode: <strong className="text-[#A0A0A0]">{data.gametype || 'Roleplay'}</strong></span>
                                <span>•</span>
                                <span>Map: <strong className="text-[#A0A0A0]">{data.mapname || 'Los Santos'}</strong></span>
                                {data.project_desc && (
                                    <>
                                        <span>•</span>
                                        <span className="truncate max-w-sm">{data.project_desc}</span>
                                    </>
                                )}
                            </p>
                        </div>

                        {/* Right stats & action */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Connected Players */}
                            <div className="bg-[#050505] border border-[#1F1F1F] px-3.5 py-2 rounded-lg text-right">
                                <span className="text-[9px] uppercase font-mono text-[#6B7280] block tracking-wider">
                                    Online Players
                                </span>
                                <span className="text-base font-mono font-medium text-white tabular-nums">
                                    {data.online} <span className="text-[#404040]">/</span> {data.max}
                                </span>
                            </div>

                            {/* Average Ping */}
                            <div className="bg-[#050505] border border-[#1F1F1F] px-3.5 py-2 rounded-lg text-right hidden sm:block">
                                <span className="text-[9px] uppercase font-mono text-[#6B7280] block tracking-wider">
                                    Avg Ping
                                </span>
                                <span className="text-base font-mono font-medium text-[#10B981] tabular-nums">
                                    {stats.avgPing !== null ? `${stats.avgPing} ms` : '—'}
                                </span>
                            </div>

                            {/* HWIDs Tracked */}
                            <div className="bg-[#050505] border border-[#1F1F1F] px-3.5 py-2 rounded-lg text-right hidden sm:block">
                                <span className="text-[9px] uppercase font-mono text-[#6B7280] block tracking-wider">
                                    HWID Captured
                                </span>
                                <span className="text-base font-mono font-medium text-[#E5A93C] tabular-nums">
                                    {stats.hwidCount}
                                </span>
                            </div>

                            {/* Discord Linked */}
                            <div className="bg-[#050505] border border-[#1F1F1F] px-3.5 py-2 rounded-lg text-right hidden md:block">
                                <span className="text-[9px] uppercase font-mono text-[#6B7280] block tracking-wider">
                                    Discord Linked
                                </span>
                                <span className="text-base font-mono font-medium text-[#5865F2] tabular-nums">
                                    {stats.discordCount}
                                </span>
                            </div>

                            {data.cfx_id && (
                                <a
                                    href={`fivem://connect/cfx.re/join/${data.cfx_id}`}
                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#111111] hover:bg-[#1A1A1A] border border-[#262626] text-[#EDEDED] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                                    title="Launch FiveM & Direct Connect"
                                >
                                    <svg className="w-3.5 h-3.5 text-[#F59E0B]" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2L2 19.7778H22L12 2Z" />
                                    </svg>
                                    <span>Play Now</span>
                                </a>
                            )}

                            {server?.txadminUrl && (
                                <a
                                    href={server.txadminUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#111111] hover:bg-[#1A1A1A] border border-[#262626] text-[#EDEDED] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer group"
                                    title={`Open txAdmin web panel on port ${server.txadminPort || 40120}`}
                                >
                                    <svg className="w-3.5 h-3.5 text-[#10B981] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    <span>txAdmin</span>
                                </a>
                            )}

                            <button
                                type="button"
                                onClick={() => loadPlayers(true)}
                                disabled={refreshing}
                                className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#111111] hover:bg-[#1A1A1A] border border-[#262626] text-[#EDEDED] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title="Refresh live status"
                            >
                                <svg
                                    className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Tabs, Filters & Search Bar ── */}
                <div className="flex flex-col gap-3 border-b border-[#141414] pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setActiveTab('players')}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                    activeTab === 'players'
                                        ? 'bg-white text-black font-semibold shadow-sm'
                                        : 'text-[#A0A0A0] hover:text-white hover:bg-[#0A0A0A]'
                                }`}
                            >
                                Online Players ({data.players?.length || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('broadcast')}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                    activeTab === 'broadcast'
                                        ? 'bg-white text-black font-semibold shadow-sm'
                                        : 'text-[#A0A0A0] hover:text-white hover:bg-[#0A0A0A]'
                                }`}
                            >
                                Broadcast Announcement
                            </button>
                        </div>

                        {/* Privacy / Streamer Mask Mode Toggle */}
                        {activeTab === 'players' && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMaskIps(!maskIps)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer border ${
                                        maskIps
                                            ? 'bg-[#1F1605] border-[#F59E0B]/50 text-[#F59E0B]'
                                            : 'bg-[#0A0A0A] border-[#222222] text-[#737373] hover:text-white'
                                    }`}
                                    title={maskIps ? 'IP addresses masked for streaming/screenshots' : 'IP addresses visible'}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        {maskIps ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        )}
                                    </svg>
                                    <span>{maskIps ? 'Streamer Mask: ON' : 'Mask IPs'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Filter Ribbon & Search Bar */}
                    {activeTab === 'players' && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                            {/* Filter Chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono uppercase text-[#737373] mr-1">Filter:</span>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('all')}
                                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                                        filterCategory === 'all'
                                            ? 'bg-[#222222] text-white font-medium border border-[#333333]'
                                            : 'text-[#737373] hover:text-white bg-[#0A0A0A] border border-[#1A1A1A]'
                                    }`}
                                >
                                    All ({data.players?.length || 0})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('hwid')}
                                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                                        filterCategory === 'hwid'
                                            ? 'bg-[#1C1405] text-[#E5A93C] font-medium border border-[#E5A93C]/40'
                                            : 'text-[#737373] hover:text-white bg-[#0A0A0A] border border-[#1A1A1A]'
                                    }`}
                                >
                                    HWID Captured ({stats.hwidCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('discord')}
                                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                                        filterCategory === 'discord'
                                            ? 'bg-[#0E122B] text-[#5865F2] font-medium border border-[#5865F2]/40'
                                            : 'text-[#737373] hover:text-white bg-[#0A0A0A] border border-[#1A1A1A]'
                                    }`}
                                >
                                    Discord Linked ({stats.discordCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('steam')}
                                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                                        filterCategory === 'steam'
                                            ? 'bg-[#0A192F] text-[#38BDF8] font-medium border border-[#38BDF8]/40'
                                            : 'text-[#737373] hover:text-white bg-[#0A0A0A] border border-[#1A1A1A]'
                                    }`}
                                >
                                    Steam Linked ({stats.steamCount})
                                </button>
                            </div>

                            {/* Search & Sort */}
                            <div className="flex items-center gap-2">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-[#050505] border border-[#1F1F1F] rounded-lg px-2.5 py-1.5 text-xs text-[#A0A0A0] outline-none font-mono cursor-pointer"
                                >
                                    <option value="id">Sort by ID</option>
                                    <option value="name">Sort by Name</option>
                                    <option value="ping">Sort by Ping</option>
                                </select>

                                <div className="relative w-full sm:w-64">
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search name, ID, IP, HWID, Discord..."
                                        className="w-full bg-[#050505] border border-[#1F1F1F] rounded-lg pl-3 pr-7 py-1.5 text-xs text-white placeholder-[#525252] outline-none focus:border-[#404040] font-mono transition-colors"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            className="absolute right-2 top-1.5 text-xs text-[#737373] hover:text-white cursor-pointer"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Main Tab Content ── */}
                {activeTab === 'players' && (
                    <div>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 border border-[#1F1F1F] rounded-lg bg-[#000000]">
                                <Spinner size="large" />
                                <span className="text-xs text-[#737373] mt-3 font-mono">
                                    Querying FiveM players, HWID tokens, and telemetry…
                                </span>
                            </div>
                        ) : data.offline ? (
                            <div className="flex flex-col items-center justify-center py-16 border border-[#1F1F1F] rounded-lg bg-[#000000] text-center px-4">
                                <div className="w-12 h-12 rounded-full bg-[#141414] flex items-center justify-center mb-3">
                                    <svg className="w-6 h-6 text-[#737373]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-semibold text-white mb-1">Server Offline</h3>
                                <p className="text-xs text-[#737373] max-w-md m-0">
                                    The FiveM server is currently offline or unreachable on its configured port. Start the server from the Console to inspect connected players.
                                </p>
                            </div>
                        ) : filteredAndSortedPlayers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 border border-[#1F1F1F] rounded-lg bg-[#000000] text-center px-4">
                                <p className="text-xs text-[#737373] m-0">
                                    {search || filterCategory !== 'all'
                                        ? 'No players matching your search filter.'
                                        : 'No players currently connected to the server.'}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {filteredAndSortedPlayers.map((player) => (
                                    <FiveMPlayerCard
                                        key={player.id}
                                        player={player}
                                        maskIps={maskIps}
                                        onInspect={setInspectPlayer}
                                        onWhisper={setWhisperPlayer}
                                        onKick={setKickPlayer}
                                        onBan={setBanPlayer}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Broadcast Announcement Tab ── */}
                {activeTab === 'broadcast' && (
                    <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] p-6 max-w-2xl shadow-lg">
                        <h2 className="text-sm font-semibold text-white mb-1">Server In-Game Broadcast</h2>
                        <p className="text-xs text-[#737373] mb-4">
                            Send a public broadcast announcement to all currently connected players in their in-game FiveM chat.
                        </p>

                        <div className="flex flex-col gap-3">
                            <textarea
                                value={broadcastMsg}
                                onChange={(e) => setBroadcastMsg(e.target.value)}
                                rows={3}
                                placeholder="Type an announcement to send to chat (e.g., 'Server restart in 10 minutes for update')..."
                                className="w-full bg-[#050505] border border-[#1F1F1F] rounded-lg p-3 text-xs text-white placeholder-[#525252] outline-none focus:border-[#404040] font-sans resize-none"
                            />

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleBroadcast}
                                    disabled={broadcasting || !broadcastMsg.trim()}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-[#E5E5E5] text-black transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {broadcasting && <Spinner size="small" />}
                                    <span>Send Announcement</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Modals ── */}
                <InspectPlayerModal
                    player={inspectPlayer}
                    onClose={() => setInspectPlayer(null)}
                />

                <WhisperPlayerModal
                    player={whisperPlayer}
                    loading={whisperLoading}
                    onClose={() => setWhisperPlayer(null)}
                    onSend={handleConfirmWhisper}
                />

                <KickPlayerModal
                    player={kickPlayer}
                    loading={kickLoading}
                    onClose={() => setKickPlayer(null)}
                    onConfirm={handleConfirmKick}
                />

                <BanPlayerModal
                    player={banPlayer}
                    loading={banLoading}
                    onClose={() => setBanPlayer(null)}
                    onConfirm={handleConfirmBan}
                />
            </div>
        </ServerContentBlock>
    );
}
