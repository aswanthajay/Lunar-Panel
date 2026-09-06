import React, { useState, useEffect, useCallback } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';

interface PlayerItem {
    name: string;
}

interface BannedItem {
    name: string;
    reason?: string | null;
    expires?: string | null;
    source?: string | null;
}

interface WhitelistItem {
    name: string;
    uuid?: string | null;
}

interface OpItem {
    name: string;
    level?: number;
}

export default function PlayerManagerContainer() {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id || '';
    const isMinecraft = Boolean(server?.isMinecraft);

    const [loading, setLoading] = useState(true);
    const [offline, setOffline] = useState(false);
    const [activeTab, setActiveTab] = useState<'online' | 'admins' | 'banned' | 'whitelist' | 'broadcast'>('online');

    const [players, setPlayers] = useState<PlayerItem[]>([]);
    const [onlineCount, setOnlineCount] = useState(0);
    const [maxCount, setMaxCount] = useState<number | null>(null);
    const [platform, setPlatform] = useState('java');

    const [banned, setBanned] = useState<BannedItem[]>([]);
    const [whitelist, setWhitelist] = useState<WhitelistItem[]>([]);
    const [whitelistEnabled, setWhitelistEnabled] = useState<boolean | null>(null);
    const [ops, setOps] = useState<OpItem[]>([]);

    const [newAdmin, setNewAdmin] = useState('');
    const [newBan, setNewBan] = useState('');
    const [newWhitelist, setNewWhitelist] = useState('');
    const [broadcastMsg, setBroadcastMsg] = useState('');

    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
    const [modalAction, setModalAction] = useState<{ type: 'kick' | 'ban'; player: string } | null>(null);
    const [modalReason, setModalReason] = useState('');

    const loadOnlinePlayers = useCallback(
        async (silent = false) => {
            if (!uuid || !isMinecraft) return;
            if (!silent) setLoading(true);

            try {
                const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/players`);
                setPlayers(data.players || []);
                setOnlineCount(data.online ?? (data.players || []).length);
                setMaxCount(data.max);
                setPlatform(data.platform || 'java');
                setOffline(false);
            } catch (err: any) {
                if (err?.response?.status === 409) {
                    setOffline(true);
                    setPlayers([]);
                    setOnlineCount(0);
                } else {
                    setNotice({ type: 'error', text: err?.response?.data?.error || 'Could not fetch players.' });
                }
            } finally {
                setLoading(false);
            }
        },
        [uuid, isMinecraft]
    );

    const loadBanned = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/players/banned`);
            setBanned(data.banned || []);
        } catch {}
    }, [uuid, isMinecraft]);

    const loadWhitelist = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/players/whitelist`);
            setWhitelist(data.whitelist || []);
            setWhitelistEnabled(data.enabled);
        } catch {}
    }, [uuid, isMinecraft]);

    const loadOps = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/players/ops`);
            setOps(data.ops || []);
        } catch {}
    }, [uuid, isMinecraft]);

    const refreshAll = useCallback(
        async (silent = false) => {
            await Promise.all([loadOnlinePlayers(silent), loadBanned(), loadWhitelist(), loadOps()]);
        },
        [loadOnlinePlayers, loadBanned, loadWhitelist, loadOps]
    );

    useEffect(() => {
        refreshAll(false);
        const timer = setInterval(() => refreshAll(true), 15000);
        return () => clearInterval(timer);
    }, [refreshAll]);

    const executeAction = async (action: string, player = '', reason = '') => {
        setBusyAction(`${action}:${player}`);
        setNotice(null);

        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/players/action`, {
                action,
                player,
                reason,
            });

            if (data.offline) {
                setNotice({ type: 'ok', text: `Saved to ops.json (will apply when server starts).` });
            } else {
                setNotice({ type: 'ok', text: `Action "${action}" executed successfully.` });
            }

            if (action === 'op') setNewAdmin('');
            if (action === 'ban') setNewBan('');
            if (action === 'whitelist_add') setNewWhitelist('');
            if (action === 'say') setBroadcastMsg('');

            setTimeout(() => refreshAll(true), 1000);
        } catch (err: any) {
            setNotice({ type: 'error', text: err?.response?.data?.error || 'Command execution failed.' });
        } finally {
            setBusyAction(null);
            setModalAction(null);
            setModalReason('');
        }
    };

    if (!isMinecraft) {
        return (
            <ServerContentBlock title="Player Manager">
                <div className="bg-[#0f0b1a] border border-[#231b3a] rounded-xl p-8 text-center max-w-xl mx-auto my-12">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Minecraft Only Feature</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                        Player Management is configured exclusively for Minecraft servers. To enable this feature for this server, configure the Game Server Type as Minecraft in the admin panel.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title="Minecraft Player Manager">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header controls bar */}
                <div className="bg-[#090710] border border-[#1e172e] rounded-xl px-5 py-3.5 flex items-center justify-between flex-wrap gap-4 shadow-xl">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">Player Overview</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1b142d] border border-[#2d2248] text-purple-300 font-mono">
                            {platform === 'bedrock' ? 'Bedrock Edition' : 'Java Edition'}
                        </span>
                        {maxCount !== null && (
                            <span className="text-xs text-neutral-500">
                                {onlineCount} / {maxCount} online
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => refreshAll(false)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#140e24] border border-[#2c2247] hover:bg-[#1f1538] text-xs font-semibold text-white transition-colors"
                        >
                            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Offline notice */}
                {offline && (
                    <div className="bg-[#120f1a] border border-[#2b213f] rounded-xl p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0m6.364 0v9" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-white m-0">Server is currently offline</p>
                            <p className="text-[11px] text-neutral-400 m-0">
                                Start the server to view live connected players. Operator permissions can still be managed while offline.
                            </p>
                        </div>
                    </div>
                )}

                {/* Notice banner */}
                {notice && (
                    <div
                        className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                            notice.type === 'ok'
                                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                                : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
                        }`}
                    >
                        <span>{notice.text}</span>
                        <button onClick={() => setNotice(null)} className="text-white/60 hover:text-white transition-colors">
                            <svg className={'w-4 h-4'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M6 18L18 6M6 6l12 12'} />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Tab switcher */}
                <div className="flex border-b border-[#1e172e] gap-2 overflow-x-auto pb-1">
                    {[
                        { key: 'online', label: `Online (${onlineCount})` },
                        { key: 'admins', label: `Operators (${ops.length})` },
                        { key: 'banned', label: `Banned (${banned.length})` },
                        { key: 'whitelist', label: `Whitelist (${whitelist.length})` },
                        { key: 'broadcast', label: 'Broadcast' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'bg-[#1b122f] text-white border border-[#3b2b5f]'
                                    : 'text-neutral-400 hover:text-white hover:bg-[#120c22]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* TAB CONTENT */}

                {/* 1. Online Tab */}
                {activeTab === 'online' && (
                    <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-6 shadow-xl">
                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                                <Spinner size="small" />
                                <span className="text-xs text-neutral-500">Querying server players…</span>
                            </div>
                        ) : players.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-sm text-neutral-400">
                                    {offline ? 'Server is offline.' : 'No players currently online.'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[#1b142d]">
                                {players.map((p) => {
                                    const isOp = ops.some((o) => o.name.toLowerCase() === p.name.toLowerCase());
                                    const isBusy = Boolean(busyAction && busyAction.endsWith(`:${p.name}`));

                                    return (
                                        <div
                                            key={p.name}
                                            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={`https://minotar.net/helm/${encodeURIComponent(p.name)}/40`}
                                                    alt=""
                                                    className="w-9 h-9 rounded-lg bg-[#18112b] shrink-0"
                                                    onError={(e: any) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                                <div>
                                                    <span className="text-sm font-semibold text-white block">
                                                        {p.name}
                                                    </span>
                                                    {isOp && (
                                                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                                                            Operator
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Gamemode Selector */}
                                                <select
                                                    disabled={isBusy}
                                                    defaultValue=""
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            executeAction(e.target.value, p.name);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                    className="bg-[#140e24] border border-[#2c2247] text-neutral-300 text-xs rounded-lg px-2.5 py-1.5 outline-none"
                                                >
                                                    <option value="" disabled>
                                                        Change Mode…
                                                    </option>
                                                    <option value="gamemode_survival">Survival</option>
                                                    <option value="gamemode_creative">Creative</option>
                                                    <option value="gamemode_adventure">Adventure</option>
                                                    <option value="gamemode_spectator">Spectator</option>
                                                </select>

                                                {/* OP Toggle */}
                                                {isOp ? (
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => executeAction('deop', p.name)}
                                                        className="px-2.5 py-1.5 bg-[#140e24] border border-[#2c2247] hover:bg-[#201538] text-neutral-300 text-xs font-medium rounded-lg"
                                                    >
                                                        Remove OP
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => executeAction('op', p.name)}
                                                        className="px-2.5 py-1.5 bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg"
                                                    >
                                                        Make OP
                                                    </button>
                                                )}

                                                {/* Kick */}
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => setModalAction({ type: 'kick', player: p.name })}
                                                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg"
                                                >
                                                    Kick
                                                </button>

                                                {/* Ban */}
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => setModalAction({ type: 'ban', player: p.name })}
                                                    className="px-2.5 py-1.5 bg-rose-900/60 hover:bg-rose-700 text-rose-200 border border-rose-800 text-xs font-medium rounded-lg"
                                                >
                                                    Ban
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. Operators Tab */}
                {activeTab === 'admins' && (
                    <div className="space-y-6">
                        {/* Add OP form */}
                        <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-5 shadow-xl">
                            <h4 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-2">
                                Grant Operator Permissions
                            </h4>
                            <p className="text-xs text-neutral-500 mb-3">
                                Add an operator by username. Works even when the server is powered off (writes to ops.json).
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newAdmin}
                                    onChange={(e) => setNewAdmin(e.target.value)}
                                    placeholder="Player username"
                                    className="flex-1 bg-[#140e24] border border-[#2c2247] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                                />
                                <button
                                    type="button"
                                    disabled={!newAdmin.trim()}
                                    onClick={() => executeAction('op', newAdmin.trim())}
                                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                                >
                                    Make OP
                                </button>
                            </div>
                        </div>

                        {/* List OPs */}
                        <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-5 shadow-xl">
                            <h4 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-3">
                                Current Operators ({ops.length})
                            </h4>
                            {ops.length === 0 ? (
                                <p className="text-xs text-neutral-500">No operators registered.</p>
                            ) : (
                                <div className="divide-y divide-[#1b142d]">
                                    {ops.map((o) => (
                                        <div key={o.name} className="py-2.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <img
                                                    src={`https://minotar.net/helm/${encodeURIComponent(o.name)}/32`}
                                                    alt=""
                                                    className="w-7 h-7 rounded bg-[#18112b]"
                                                />
                                                <span className="text-xs font-semibold text-white">{o.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => executeAction('deop', o.name)}
                                                className="text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded hover:bg-rose-950/50 transition-colors"
                                            >
                                                Revoke OP
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Banned Tab */}
                {activeTab === 'banned' && (
                    <div className="space-y-6">
                        <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-5 shadow-xl">
                            <h4 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-2">
                                Ban a Player
                            </h4>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newBan}
                                    onChange={(e) => setNewBan(e.target.value)}
                                    placeholder="Username to ban"
                                    className="flex-1 bg-[#140e24] border border-[#2c2247] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
                                />
                                <button
                                    type="button"
                                    disabled={!newBan.trim()}
                                    onClick={() => executeAction('ban', newBan.trim())}
                                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                                >
                                    Ban Player
                                </button>
                            </div>
                        </div>

                        <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-5 shadow-xl">
                            <h4 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-3">
                                Banned Players ({banned.length})
                            </h4>
                            {banned.length === 0 ? (
                                <p className="text-xs text-neutral-500">No players currently banned.</p>
                            ) : (
                                <div className="divide-y divide-[#1b142d]">
                                    {banned.map((b) => (
                                        <div key={b.name} className="py-2.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <img
                                                    src={`https://minotar.net/helm/${encodeURIComponent(b.name)}/32`}
                                                    alt=""
                                                    className="w-7 h-7 rounded bg-[#18112b]"
                                                />
                                                <div>
                                                    <span className="text-xs font-semibold text-white block">
                                                        {b.name}
                                                    </span>
                                                    {b.reason && (
                                                        <span className="text-[11px] text-neutral-500">
                                                            Reason: {b.reason}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => executeAction('unban', b.name)}
                                                className="text-xs text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded hover:bg-emerald-950/50 transition-colors"
                                            >
                                                Pardon / Unban
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. Whitelist Tab */}
                {activeTab === 'whitelist' && (
                    <div className="space-y-6">
                        <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h4 className="text-xs font-semibold font-sans text-white uppercase tracking-wider m-0">
                                    Whitelist Enforcement
                                </h4>
                                <p className="text-xs text-neutral-500 m-0 mt-1">
                                    {whitelistEnabled
                                        ? 'Active: Only whitelisted players can join.'
                                        : 'Disabled: Anyone can connect.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => executeAction(whitelistEnabled ? 'whitelist_off' : 'whitelist_on')}
                                className={`text-xs font-semibold px-4 py-2 rounded-lg border transition-colors ${
                                    whitelistEnabled
                                        ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                                        : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500'
                                }`}
                            >
                                {whitelistEnabled ? 'Disable Whitelist' : 'Enable Whitelist'}
                            </button>
                        </div>

                        <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-5 shadow-xl">
                            <h4 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-2">
                                Add Player to Whitelist
                            </h4>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newWhitelist}
                                    onChange={(e) => setNewWhitelist(e.target.value)}
                                    placeholder="Player username"
                                    className="flex-1 bg-[#140e24] border border-[#2c2247] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                                />
                                <button
                                    type="button"
                                    disabled={!newWhitelist.trim()}
                                    onClick={() => executeAction('whitelist_add', newWhitelist.trim())}
                                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                                >
                                    Add to Whitelist
                                </button>
                            </div>

                            <h4 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-3">
                                Whitelisted Players ({whitelist.length})
                            </h4>
                            {whitelist.length === 0 ? (
                                <p className="text-xs text-neutral-500">No players on the whitelist.</p>
                            ) : (
                                <div className="divide-y divide-[#1b142d]">
                                    {whitelist.map((w) => (
                                        <div key={w.name} className="py-2.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <img
                                                    src={`https://minotar.net/helm/${encodeURIComponent(w.name)}/32`}
                                                    alt=""
                                                    className="w-7 h-7 rounded bg-[#18112b]"
                                                />
                                                <span className="text-xs font-semibold text-white">{w.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => executeAction('whitelist_remove', w.name)}
                                                className="text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded hover:bg-rose-950/50 transition-colors"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. Broadcast Tab */}
                {activeTab === 'broadcast' && (
                    <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-6 shadow-xl max-w-xl">
                        <h4 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-2">
                            Broadcast Server Announcement
                        </h4>
                        <p className="text-xs text-neutral-500 mb-4">
                            Send a public message to all connected Minecraft players via in-game chat.
                        </p>
                        <div className="space-y-3">
                            <textarea
                                rows={3}
                                value={broadcastMsg}
                                onChange={(e) => setBroadcastMsg(e.target.value)}
                                placeholder="e.g. Scheduled restart in 5 minutes. Please save your items!"
                                className="w-full bg-[#140e24] border border-[#2c2247] rounded-lg p-3 text-xs text-white outline-none focus:border-purple-500"
                            />
                            <button
                                type="button"
                                disabled={!broadcastMsg.trim()}
                                onClick={() => executeAction('say', '', broadcastMsg.trim())}
                                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                            >
                                Send Broadcast
                            </button>
                        </div>
                    </div>
                )}

                {/* Kick / Ban modal */}
                {modalAction && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-[#0e0a19] border border-[#2c2247] rounded-2xl w-full max-w-md p-6 shadow-2xl">
                            <h3 className="text-base font-semibold text-white mb-2">
                                {modalAction.type === 'ban' ? `Ban ${modalAction.player}` : `Kick ${modalAction.player}`}
                            </h3>
                            <p className="text-xs text-neutral-400 mb-4">
                                {modalAction.type === 'ban'
                                    ? 'They will be disconnected and unable to rejoin until unbanned.'
                                    : 'They will be disconnected from the server.'}
                            </p>
                            <input
                                type="text"
                                value={modalReason}
                                onChange={(e) => setModalReason(e.target.value)}
                                placeholder="Reason (optional)"
                                className="w-full bg-[#140e24] border border-[#2c2247] rounded-lg p-2.5 text-xs text-white outline-none mb-6"
                            />
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalAction(null)}
                                    className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => executeAction(modalAction.type, modalAction.player, modalReason)}
                                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                                >
                                    Confirm {modalAction.type === 'ban' ? 'Ban' : 'Kick'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ServerContentBlock>
    );
}
