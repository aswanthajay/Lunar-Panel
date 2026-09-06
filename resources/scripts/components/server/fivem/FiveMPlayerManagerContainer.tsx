import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';

interface FiveMPlayer {
    id: number;
    name: string;
    ping: number | null;
    identifiers: {
        steam?: string;
        discord?: string;
        license?: string;
        fivem?: string;
        xbl?: string;
        live?: string;
        [key: string]: string | undefined;
    };
    raw_identifiers: string[];
}

interface ServerData {
    offline: boolean;
    online: number;
    max: number;
    server_name: string;
    project_desc?: string | null;
    gametype?: string;
    mapname?: string;
    cfx_id?: string | null;
    join_url?: string | null;
    players: FiveMPlayer[];
}

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

    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'players' | 'broadcast'>('players');

    // Kick modal state
    const [kickTarget, setKickTarget] = useState<FiveMPlayer | null>(null);
    const [kickReason, setKickReason] = useState('Kicked by administrator');
    const [kicking, setKicking] = useState(false);

    // Broadcast state
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcasting, setBroadcasting] = useState(false);

    // Toast notification
    const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
                    text: err?.response?.data?.error || 'Failed to query FiveM players. Ensure server is running.',
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
    const handleKick = async () => {
        if (!kickTarget) return;
        setKicking(true);
        try {
            await http.post(`/api/client/servers/${uuid}/fivem/players/action`, {
                action: 'kick',
                player_id: kickTarget.id,
                reason: kickReason,
            });

            setNotice({
                type: 'ok',
                text: `Player ${kickTarget.name} (ID #${kickTarget.id}) has been kicked.`,
            });
            setKickTarget(null);
            setKickReason('Kicked by administrator');
            // Refresh players list
            loadPlayers(true);
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to kick player.',
            });
        } finally {
            setKicking(false);
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
                text: 'Announcement successfully broadcast to all FiveM players.',
            });
            setBroadcastMsg('');
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to send broadcast.',
            });
        } finally {
            setBroadcasting(false);
        }
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Filter players by query
    const filteredPlayers = useMemo(() => {
        if (!search.trim()) return data.players;
        const q = search.toLowerCase();
        return data.players.filter((p) => {
            if (p.name.toLowerCase().includes(q)) return true;
            if (String(p.id) === q) return true;
            if (p.identifiers.discord?.toLowerCase().includes(q)) return true;
            if (p.identifiers.steam?.toLowerCase().includes(q)) return true;
            if (p.identifiers.license?.toLowerCase().includes(q)) return true;
            return false;
        });
    }, [data.players, search]);

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
                <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1.5">
                                <span
                                    className={`w-2.5 h-2.5 rounded-full ${
                                        data.offline ? 'bg-[#EF4444]' : 'bg-[#10B981] animate-pulse'
                                    }`}
                                />
                                <h1 className="text-lg font-semibold text-white tracking-tight">
                                    {data.server_name}
                                </h1>
                                {data.cfx_id && (
                                    <span className="text-[11px] font-mono bg-[#0A0A0A] border border-[#262626] text-[#A0A0A0] px-2 py-0.5 rounded">
                                        CFX: {data.cfx_id}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-[#737373] m-0 flex items-center gap-2">
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
                        <div className="flex items-center gap-3">
                            <div className="bg-[#050505] border border-[#1F1F1F] px-3.5 py-2 rounded-lg text-right">
                                <span className="text-[10px] uppercase font-mono text-[#6B7280] block tracking-wider">
                                    Connected Players
                                </span>
                                <span className="text-base font-mono font-medium text-white tabular-nums">
                                    {data.online} <span className="text-[#404040]">/</span> {data.max}
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
                                    <span>Open txAdmin</span>
                                    {server.txadminPort && (
                                        <span className="text-[10px] font-mono text-[#737373]">
                                            :{server.txadminPort}
                                        </span>
                                    )}
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

                {/* ── Tabs & Search Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141414] pb-3">
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
                            Online Players ({data.players.length})
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

                    {activeTab === 'players' && (
                        <div className="relative w-full sm:w-72">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name, ID, Discord..."
                                className="w-full bg-[#050505] border border-[#1F1F1F] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#525252] outline-none focus:border-[#404040] font-mono transition-colors"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2.5 top-1.5 text-xs text-[#737373] hover:text-white cursor-pointer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Main Tab Content ── */}
                {activeTab === 'players' && (
                    <div>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 border border-[#1F1F1F] rounded-lg bg-[#000000]">
                                <Spinner size="large" />
                                <span className="text-xs text-[#737373] mt-3 font-mono">Querying FiveM players…</span>
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
                        ) : filteredPlayers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 border border-[#1F1F1F] rounded-lg bg-[#000000] text-center px-4">
                                <p className="text-xs text-[#737373] m-0">
                                    {search ? 'No players matching your search filter.' : 'No players currently connected to the server.'}
                                </p>
                            </div>
                        ) : (
                            <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] overflow-hidden">
                                <div className="divide-y divide-[#141414]">
                                    {filteredPlayers.map((player) => {
                                        const pingColor =
                                            player.ping === null
                                                ? 'text-[#737373]'
                                                : player.ping < 65
                                                ? 'text-[#10B981]'
                                                : player.ping < 130
                                                ? 'text-[#F59E0B]'
                                                : 'text-[#EF4444]';

                                        return (
                                            <div
                                                key={player.id}
                                                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#050505] transition-colors"
                                            >
                                                {/* Player Info */}
                                                <div className="flex items-center gap-3.5">
                                                    <div className="w-10 h-10 rounded-lg bg-[#111111] border border-[#222222] flex items-center justify-center font-mono text-xs font-semibold text-[#EDEDED] shrink-0">
                                                        #{player.id}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm text-white">
                                                                {player.name}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-[#737373] bg-[#0A0A0A] border border-[#1F1F1F] px-1.5 py-0.5 rounded">
                                                                Client ID: {player.id}
                                                            </span>
                                                        </div>

                                                        {/* Identifiers */}
                                                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] font-mono text-[#888888]">
                                                            {player.identifiers.discord && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            player.identifiers.discord!,
                                                                            `discord-${player.id}`
                                                                        )
                                                                    }
                                                                    className="px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#222222] flex items-center gap-1.5 cursor-pointer text-[#A0A0A0] hover:text-white transition-colors"
                                                                    title="Click to copy Discord ID"
                                                                >
                                                                    <span className="text-[#5865F2] font-semibold">Discord:</span>
                                                                    <span>{player.identifiers.discord}</span>
                                                                    {copiedKey === `discord-${player.id}` ? '✓' : ''}
                                                                </button>
                                                            )}

                                                            {player.identifiers.steam && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            player.identifiers.steam!,
                                                                            `steam-${player.id}`
                                                                        )
                                                                    }
                                                                    className="px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#222222] flex items-center gap-1.5 cursor-pointer text-[#A0A0A0] hover:text-white transition-colors"
                                                                    title="Click to copy Steam Hex"
                                                                >
                                                                    <span className="text-[#66C0F4] font-semibold">Steam:</span>
                                                                    <span className="truncate max-w-[130px]">{player.identifiers.steam}</span>
                                                                    {copiedKey === `steam-${player.id}` ? '✓' : ''}
                                                                </button>
                                                            )}

                                                            {player.identifiers.license && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            player.identifiers.license!,
                                                                            `lic-${player.id}`
                                                                        )
                                                                    }
                                                                    className="px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#222222] flex items-center gap-1.5 cursor-pointer text-[#A0A0A0] hover:text-white transition-colors"
                                                                    title="Click to copy FiveM License"
                                                                >
                                                                    <span className="text-[#10B981] font-semibold">License:</span>
                                                                    <span className="truncate max-w-[110px]">{player.identifiers.license.substring(0, 10)}…</span>
                                                                    {copiedKey === `lic-${player.id}` ? '✓' : ''}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Ping & Actions */}
                                                <div className="flex items-center gap-4 self-end md:self-center">
                                                    <div className="text-right">
                                                        <span className="text-[10px] uppercase font-mono text-[#6B7280] block">Ping</span>
                                                        <span className={`text-xs font-mono font-medium ${pingColor}`}>
                                                            {player.ping !== null ? `${player.ping} ms` : '—'}
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setKickTarget(player)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1212] hover:bg-[#2A1717] border border-[#451A1A] text-[#EF4444] hover:text-[#F87171] transition-colors cursor-pointer"
                                                    >
                                                        Kick
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Broadcast Announcement Tab ── */}
                {activeTab === 'broadcast' && (
                    <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] p-6 max-w-2xl">
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

                {/* ── Kick Confirmation Modal ── */}
                {kickTarget && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-[#050505] border border-[#262626] rounded-xl max-w-md w-full p-6 shadow-2xl">
                            <h3 className="text-base font-semibold text-white mb-1">
                                Kick {kickTarget.name} (ID #{kickTarget.id})?
                            </h3>
                            <p className="text-xs text-[#A0A0A0] mb-4">
                                The player will be immediately disconnected from the FiveM server session.
                            </p>

                            <div className="mb-4">
                                <label className="block text-xs font-mono text-[#737373] mb-1.5 uppercase tracking-wider">
                                    Kick Reason
                                </label>
                                <input
                                    type="text"
                                    value={kickReason}
                                    onChange={(e) => setKickReason(e.target.value)}
                                    placeholder="e.g., Disruptive behavior / AFK"
                                    className="w-full bg-[#000000] border border-[#1F1F1F] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#404040] font-sans"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setKickTarget(null)}
                                    className="px-4 py-2 rounded-lg text-xs font-medium text-[#A0A0A0] hover:text-white bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleKick}
                                    disabled={kicking}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {kicking && <Spinner size="small" />}
                                    <span>Confirm Kick</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ServerContentBlock>
    );
}
