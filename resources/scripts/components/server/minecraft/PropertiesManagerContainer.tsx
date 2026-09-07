import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';

interface PropertyDefinition {
    category: 'quick' | 'gameplay' | 'world' | 'security' | 'resource_pack' | 'rcon';
    label: string;
    description: string;
    type: 'bool' | 'int' | 'string' | 'select';
    default: string;
    options?: string[];
    min?: number;
    max?: number;
}

type PropertyDefinitionsMap = Record<string, PropertyDefinition>;
type PropertiesMap = Record<string, string>;

// Helper to convert Minecraft formatting codes (§ or &) into HTML span elements for live MOTD preview
function renderMinecraftMotd(text: string): React.ReactNode {
    if (!text) {
        return <span className="text-[#A0A0A0]">A Minecraft Server</span>;
    }

    const colorMap: Record<string, string> = {
        '0': '#000000',
        '1': '#0000AA',
        '2': '#00AA00',
        '3': '#00AAAA',
        '4': '#AA0000',
        '5': '#AA00AA',
        '6': '#FFAA00',
        '7': '#AAAAAA',
        '8': '#555555',
        '9': '#5555FF',
        'a': '#55FF55',
        'b': '#55FFFF',
        'c': '#FF5555',
        'd': '#FF55FF',
        'e': '#FFFF55',
        'f': '#FFFFFF',
    };

    // Normalize & to § for preview
    const normalized = text.replace(/&([0-9a-fk-or])/gi, '§$1');
    const tokens = normalized.split(/(§[0-9a-fk-or])/gi);

    let currentColor = '#FFFFFF';
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;

    return (
        <span>
            {tokens.map((token, i) => {
                if (token.startsWith('§')) {
                    const code = token[1].toLowerCase();
                    if (colorMap[code]) {
                        currentColor = colorMap[code];
                        isBold = false;
                        isItalic = false;
                        isUnderline = false;
                    } else if (code === 'l') isBold = true;
                    else if (code === 'o') isItalic = true;
                    else if (code === 'n') isUnderline = true;
                    else if (code === 'r') {
                        currentColor = '#FFFFFF';
                        isBold = false;
                        isItalic = false;
                        isUnderline = false;
                    }
                    return null;
                }

                return (
                    <span
                        key={i}
                        style={{
                            color: currentColor,
                            fontWeight: isBold ? 'bold' : 'normal',
                            fontStyle: isItalic ? 'italic' : 'normal',
                            textDecoration: isUnderline ? 'underline' : 'none',
                        }}
                    >
                        {token}
                    </span>
                );
            })}
        </span>
    );
}

export default function PropertiesManagerContainer() {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id || '';
    const isMinecraft = Boolean(server?.isMinecraft);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingRaw, setSavingRaw] = useState(false);
    const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

    const [props, setProps] = useState<PropertiesMap>({});
    const [originalProps, setOriginalProps] = useState<PropertiesMap>({});
    const [definitions, setDefinitions] = useState<PropertyDefinitionsMap>({});
    const [rawContent, setRawContent] = useState('');
    const [originalRaw, setOriginalRaw] = useState('');
    const [fileExists, setFileExists] = useState(true);

    const [activeTab, setActiveTab] = useState<'quick' | 'gameplay' | 'world' | 'security' | 'resource_pack' | 'rcon' | 'raw'>('quick');
    const [showRconPassword, setShowRconPassword] = useState(false);

    // Load server properties
    const loadProperties = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        setLoading(true);
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/properties`);
            if (data.success) {
                setProps(data.properties || {});
                setOriginalProps(data.properties || {});
                setDefinitions(data.definitions || {});
                setRawContent(data.raw || '');
                setOriginalRaw(data.raw || '');
                setFileExists(Boolean(data.file_exists));
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || err?.response?.data?.message || 'Failed to load server.properties.',
            });
        } finally {
            setLoading(false);
        }
    }, [uuid, isMinecraft]);

    useEffect(() => {
        loadProperties();
    }, [loadProperties]);

    // Check if any property was modified compared to disk
    const hasChanges = useMemo(() => {
        const keys = new Set([...Object.keys(props), ...Object.keys(originalProps)]);
        for (const k of keys) {
            if ((props[k] ?? '') !== (originalProps[k] ?? '')) {
                return true;
            }
        }
        return false;
    }, [props, originalProps]);

    const hasRawChanges = useMemo(() => {
        return rawContent !== originalRaw;
    }, [rawContent, originalRaw]);

    // Update single field
    const updateField = (key: string, value: string) => {
        setProps((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    // Save properties through key-value API
    const handleSave = async (restartServer = false) => {
        setSaving(true);
        setNotice(null);
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/properties`, {
                properties: props,
                restart_server: restartServer,
            });

            if (data.success) {
                setOriginalProps({ ...props });
                if (data.raw) {
                    setRawContent(data.raw);
                    setOriginalRaw(data.raw);
                }
                setNotice({
                    type: 'ok',
                    text: data.message,
                });
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || err?.response?.data?.message || 'Could not save server properties.',
            });
        } finally {
            setSaving(false);
        }
    };

    // Save raw editor content directly
    const handleSaveRaw = async (restartServer = false) => {
        setSavingRaw(true);
        setNotice(null);
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/properties/raw`, {
                content: rawContent,
                restart_server: restartServer,
            });

            if (data.success) {
                setOriginalRaw(rawContent);
                if (data.properties) {
                    setProps(data.properties);
                    setOriginalProps(data.properties);
                }
                setNotice({
                    type: 'ok',
                    text: data.message,
                });
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || err?.response?.data?.message || 'Could not save raw server.properties.',
            });
        } finally {
            setSavingRaw(false);
        }
    };

    // Revert changes
    const handleDiscard = () => {
        setProps({ ...originalProps });
        setRawContent(originalRaw);
        setNotice({ type: 'ok', text: 'Changes discarded.' });
    };

    // Guard for non-Minecraft servers
    if (!isMinecraft) {
        return (
            <ServerContentBlock title="Server Properties">
                <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-8 text-center max-w-xl mx-auto my-8">
                    <h2 className="text-lg font-sans font-semibold text-[#FFFFFF] mb-2">Minecraft Server Properties</h2>
                    <p className="text-xs text-[#A0A0A0] leading-relaxed">
                        The Server Properties Manager is tailored specifically for Minecraft Java & Bedrock Edition servers. This server is configured with a different game engine.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    if (loading) {
        return (
            <ServerContentBlock title="Server Properties">
                <div className="flex flex-col items-center justify-center py-24">
                    <Spinner size="large" />
                    <p className="text-xs text-[#A0A0A0] mt-4 font-mono">Reading /server.properties…</p>
                </div>
            </ServerContentBlock>
        );
    }

    const isOnlineMode = (props['online-mode'] ?? 'true') === 'true';
    const isWhitelist = (props['white-list'] ?? 'false') === 'true';
    const isEnforceWhitelist = (props['enforce-whitelist'] ?? 'false') === 'true';
    const maxPlayers = parseInt(props['max-players'] || '20', 10);
    const motd = props['motd'] || 'A Minecraft Server';

    return (
        <ServerContentBlock title="Server Properties">
            <div className="space-y-6 pb-28">
                {/* Header Strip */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#1F1F1F] pb-5">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl sm:text-2xl font-sans font-semibold tracking-tight text-[#FFFFFF] m-0">
                                Server Properties
                            </h1>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                                /server.properties
                            </span>
                            {!fileExists && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/60 text-amber-400 border border-amber-500/30">
                                    Templated · First Boot
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-[#A0A0A0] mt-1.5 max-w-3xl leading-relaxed m-0">
                            Configure player limits, cracked mode authentication, whitelist restrictions, MOTD, world generation, and game physics directly from a high-performance visual dashboard.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => loadProperties()}
                            className="px-3 py-1.5 rounded text-xs font-medium text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#111111] hover:bg-[#1A1A1A] border border-[#1F1F1F] transition-colors"
                        >
                            ↻ Reload File
                        </button>
                        <Link
                            to={`/server/${uuid}/files`}
                            className="px-3 py-1.5 rounded text-xs font-medium text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#111111] hover:bg-[#1A1A1A] border border-[#1F1F1F] no-underline transition-colors"
                        >
                            Open in File Manager →
                        </Link>
                    </div>
                </div>

                {/* Status Notice Banner */}
                {notice && (
                    <div
                        className={`px-4 py-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
                            notice.type === 'ok'
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                : 'bg-red-950/40 border-red-500/40 text-red-300'
                        }`}
                    >
                        <span>{notice.text}</span>
                        <button
                            type="button"
                            onClick={() => setNotice(null)}
                            className="text-inherit hover:opacity-75 bg-transparent border-none cursor-pointer font-mono ml-4"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────────────
                    HERO HIGHLIGHTS (Cracked Mode, Max Players, Whitelist, MOTD)
                ──────────────────────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Hero Card 1: Online Mode / Cracked Mode */}
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#2B2B2B] rounded-lg p-5 flex flex-col justify-between transition-colors">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0]">
                                    Authentication Mode
                                </span>
                                {isOnlineMode ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                                        Official Accounts
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-amber-950/80 text-amber-300 border border-amber-500/40">
                                        Cracked Mode Enabled
                                    </span>
                                )}
                            </div>
                            <h3 className="text-base font-sans font-semibold text-[#FFFFFF] m-0 mb-1.5">
                                {isOnlineMode ? 'Online Mode (Official Only)' : 'Cracked / Offline Mode'}
                            </h3>
                            <p className="text-xs text-[#8A8A8A] leading-relaxed m-0">
                                {isOnlineMode
                                    ? 'Enforces official Mojang & Microsoft authentication. Offline and third-party launchers cannot connect.'
                                    : 'Allows players using free, offline, or alternative launchers (e.g. TLauncher, Prism cracked) to join without a Mojang account.'}
                            </p>
                        </div>

                        <div className="pt-4 mt-4 border-t border-[#1F1F1F] flex items-center justify-between">
                            <span className="text-xs text-[#A0A0A0]">Allow Cracked Clients:</span>
                            <button
                                type="button"
                                onClick={() => updateField('online-mode', isOnlineMode ? 'false' : 'true')}
                                className={`px-3 py-1.5 rounded text-xs font-semibold tracking-tight transition-colors border ${
                                    !isOnlineMode
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                        : 'bg-[#141414] text-[#A0A0A0] border-[#222222] hover:text-[#FFFFFF] hover:bg-[#1A1A1A]'
                                }`}
                            >
                                {!isOnlineMode ? '✓ Cracked Mode ON' : 'Enable Cracked Mode'}
                            </button>
                        </div>
                    </div>

                    {/* Hero Card 2: Max Players Slots */}
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#2B2B2B] rounded-lg p-5 flex flex-col justify-between transition-colors">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0]">
                                    Player Capacity
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#141414] text-[#CCCCCC] border border-[#222222]">
                                    max-players
                                </span>
                            </div>
                            <h3 className="text-base font-sans font-semibold text-[#FFFFFF] m-0 mb-1.5">
                                Maximum Player Slots
                            </h3>
                            <p className="text-xs text-[#8A8A8A] leading-relaxed m-0">
                                Maximum concurrent players permitted on the server simultaneously.
                            </p>
                        </div>

                        <div className="pt-4 mt-4 border-t border-[#1F1F1F]">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateField('max-players', String(Math.max(1, maxPlayers - 5)))}
                                    className="w-8 h-8 rounded bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] text-xs font-mono text-[#CCCCCC] transition-colors"
                                >
                                    -5
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('max-players', String(Math.max(1, maxPlayers - 1)))}
                                    className="w-8 h-8 rounded bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] text-xs font-mono text-[#CCCCCC] transition-colors"
                                >
                                    -1
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max="10000"
                                    value={props['max-players'] ?? '20'}
                                    onChange={(e) => updateField('max-players', e.target.value)}
                                    className="flex-1 bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-2.5 py-1.5 text-center text-sm font-mono text-[#FFFFFF] outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => updateField('max-players', String(maxPlayers + 1))}
                                    className="w-8 h-8 rounded bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] text-xs font-mono text-[#CCCCCC] transition-colors"
                                >
                                    +1
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('max-players', String(maxPlayers + 5))}
                                    className="w-8 h-8 rounded bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] text-xs font-mono text-[#CCCCCC] transition-colors"
                                >
                                    +5
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Hero Card 3: Whitelist Mode */}
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#2B2B2B] rounded-lg p-5 flex flex-col justify-between transition-colors">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0]">
                                    Access Control
                                </span>
                                <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${
                                        isWhitelist
                                            ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                                            : 'bg-[#141414] text-[#888888] border-[#222222]'
                                    }`}
                                >
                                    {isWhitelist ? 'Whitelist Active' : 'Public Access'}
                                </span>
                            </div>
                            <h3 className="text-base font-sans font-semibold text-[#FFFFFF] m-0 mb-1.5">
                                Server Whitelist
                            </h3>
                            <p className="text-xs text-[#8A8A8A] leading-relaxed m-0">
                                Restrict server access strictly to pre-approved players on the whitelist.
                            </p>
                        </div>

                        <div className="pt-4 mt-4 border-t border-[#1F1F1F] flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#CCCCCC]">
                                <input
                                    type="checkbox"
                                    checked={isWhitelist}
                                    onChange={(e) => updateField('white-list', e.target.checked ? 'true' : 'false')}
                                    className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0"
                                />
                                Enable Whitelist
                            </label>

                            <Link
                                to={`/server/${uuid}/players`}
                                className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 no-underline"
                            >
                                Edit Whitelist →
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Hero Feature: Interactive MOTD & Live Minecraft Server Browser Preview */}
                <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                        {/* MOTD Input */}
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-sans font-semibold text-[#FFFFFF]">
                                    Server Message of the Day (MOTD)
                                </label>
                                <span className="text-[11px] text-[#A0A0A0] font-mono">
                                    Supports § and & color codes
                                </span>
                            </div>
                            <textarea
                                rows={2}
                                value={props['motd'] ?? ''}
                                onChange={(e) => updateField('motd', e.target.value)}
                                placeholder="A Minecraft Server - Powered by Lunar Panel"
                                className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded p-3 text-xs font-mono text-[#FFFFFF] outline-none leading-relaxed resize-none"
                            />
                            {/* Color code palette buttons */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono text-[#777777] mr-1">Insert Color:</span>
                                {[
                                    { code: '§a', color: '#55FF55', label: 'Green' },
                                    { code: '§b', color: '#55FFFF', label: 'Aqua' },
                                    { code: '§c', color: '#FF5555', label: 'Red' },
                                    { code: '§d', color: '#FF55FF', label: 'Pink' },
                                    { code: '§e', color: '#FFFF55', label: 'Yellow' },
                                    { code: '§6', color: '#FFAA00', label: 'Gold' },
                                    { code: '§f', color: '#FFFFFF', label: 'White' },
                                    { code: '§7', color: '#AAAAAA', label: 'Gray' },
                                    { code: '§l', color: '#DDDDDD', label: 'Bold' },
                                    { code: '§r', color: '#888888', label: 'Reset' },
                                ].map((item) => (
                                    <button
                                        key={item.code}
                                        type="button"
                                        onClick={() => updateField('motd', (props['motd'] || '') + item.code)}
                                        style={{ color: item.color }}
                                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] transition-colors"
                                        title={`Insert ${item.label} (${item.code})`}
                                    >
                                        {item.code}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Live Multiplayer Server List Card Mockup */}
                        <div className="w-full lg:w-[380px] bg-[#000000] border border-[#2B2B2B] rounded-lg p-4 shadow-xl">
                            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#777777] mb-2.5 pb-1.5 border-b border-[#1A1A1A]">
                                <span>Multiplayer Server List Preview</span>
                                <span className="text-emerald-400">● 1.20+ Ready</span>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Server Icon / Grass block */}
                                <div className="w-12 h-12 rounded bg-[#141414] border border-[#2A2A2A] flex items-center justify-center shrink-0 overflow-hidden">
                                    <svg viewBox="0 0 64 64" className="w-8 h-8" fill="none">
                                        <rect x="8" y="8" width="48" height="48" rx="4" fill="#2E7D32" />
                                        <path d="M8 24h48v32H8z" fill="#5D4037" />
                                        <path d="M8 24l6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6v4l-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6z" fill="#388E3C" />
                                    </svg>
                                </div>

                                {/* Server info & MOTD */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-[#FFFFFF] truncate">
                                            {server?.name || 'Minecraft Server'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-mono text-[#A0A0A0]">
                                                0/{maxPlayers}
                                            </span>
                                            {/* Latency Bars */}
                                            <div className="flex items-end gap-0.5 h-3">
                                                <span className="w-0.5 h-1 bg-emerald-400 rounded-sm" />
                                                <span className="w-0.5 h-1.5 bg-emerald-400 rounded-sm" />
                                                <span className="w-0.5 h-2 bg-emerald-400 rounded-sm" />
                                                <span className="w-0.5 h-2.5 bg-emerald-400 rounded-sm" />
                                                <span className="w-0.5 h-3 bg-emerald-400 rounded-sm" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Formatted MOTD */}
                                    <div className="mt-1 text-xs font-mono truncate leading-snug">
                                        {renderMinecraftMotd(motd)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ────────────────────────────────────────────────────────────────
                    NAVIGATION TABS
                ──────────────────────────────────────────────────────────────── */}
                <div className="flex items-center gap-2 border-b border-[#1F1F1F] overflow-x-auto pb-px">
                    {[
                        { id: 'quick', label: 'Quick Setup' },
                        { id: 'gameplay', label: 'Gameplay & Physics' },
                        { id: 'world', label: 'World & Spawning' },
                        { id: 'security', label: 'Security & Network' },
                        { id: 'resource_pack', label: 'Resource Pack & RCON' },
                        { id: 'raw', label: 'Raw Editor (.properties)' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2.5 text-xs font-sans font-medium whitespace-nowrap transition-colors border-b-2 ${
                                activeTab === tab.id
                                    ? 'border-emerald-500 text-[#FFFFFF]'
                                    : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ────────────────────────────────────────────────────────────────
                    TAB CONTENT: Quick Setup
                ──────────────────────────────────────────────────────────────── */}
                {activeTab === 'quick' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Gamemode Selector */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 space-y-3">
                            <label className="text-xs font-sans font-semibold text-[#FFFFFF] block">
                                Default Gamemode
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {['survival', 'creative', 'adventure', 'spectator'].map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => updateField('gamemode', mode)}
                                        className={`px-3 py-2 rounded text-xs capitalize font-medium text-left border transition-all ${
                                            (props['gamemode'] || 'survival') === mode
                                                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                                                : 'bg-[#000000] border-[#222222] text-[#A0A0A0] hover:text-[#FFFFFF]'
                                        }`}
                                    >
                                        {(props['gamemode'] || 'survival') === mode ? '✓ ' : ''}
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Difficulty Selector */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 space-y-3">
                            <label className="text-xs font-sans font-semibold text-[#FFFFFF] block">
                                Server Difficulty
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {['peaceful', 'easy', 'normal', 'hard'].map((diff) => (
                                    <button
                                        key={diff}
                                        type="button"
                                        onClick={() => updateField('difficulty', diff)}
                                        className={`px-3 py-2 rounded text-xs capitalize font-medium text-left border transition-all ${
                                            (props['difficulty'] || 'easy') === diff
                                                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                                                : 'bg-[#000000] border-[#222222] text-[#A0A0A0] hover:text-[#FFFFFF]'
                                        }`}
                                    >
                                        {(props['difficulty'] || 'easy') === diff ? '✓ ' : ''}
                                        {diff}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* PvP Toggle */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-sans font-semibold text-[#FFFFFF] m-0">
                                    Player vs Player (PvP)
                                </h4>
                                <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5">
                                    Allow combat and weapon damage between players.
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={(props['pvp'] ?? 'true') === 'true'}
                                onChange={(e) => updateField('pvp', e.target.checked ? 'true' : 'false')}
                                className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0 w-4 h-4"
                            />
                        </div>

                        {/* Hardcore Toggle */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-sans font-semibold text-[#FFFFFF] m-0">
                                    Hardcore Permadeath
                                </h4>
                                <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5">
                                    Players die permanently and cannot respawn.
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={(props['hardcore'] ?? 'false') === 'true'}
                                onChange={(e) => updateField('hardcore', e.target.checked ? 'true' : 'false')}
                                className="rounded border-[#2B2B2B] bg-[#000000] text-red-500 focus:ring-0 w-4 h-4"
                            />
                        </div>

                        {/* Flight in Survival */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-sans font-semibold text-[#FFFFFF] m-0">
                                    Allow Survival Flight
                                </h4>
                                <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5">
                                    Prevents players from being kicked for flying with mods, jetpacks, or elytra.
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={(props['allow-flight'] ?? 'false') === 'true'}
                                onChange={(e) => updateField('allow-flight', e.target.checked ? 'true' : 'false')}
                                className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0 w-4 h-4"
                            />
                        </div>

                        {/* Force Gamemode */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-sans font-semibold text-[#FFFFFF] m-0">
                                    Force Gamemode on Join
                                </h4>
                                <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5">
                                    Reset players to the default gamemode on every connect.
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={(props['force-gamemode'] ?? 'false') === 'true'}
                                onChange={(e) => updateField('force-gamemode', e.target.checked ? 'true' : 'false')}
                                className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0 w-4 h-4"
                            />
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────────────
                    TAB CONTENT: Gameplay & Physics
                ──────────────────────────────────────────────────────────────── */}
                {activeTab === 'gameplay' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Gamemode */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <label className="text-xs font-sans font-semibold text-[#FFFFFF] block mb-1">
                                    Default Game Mode (gamemode)
                                </label>
                                <select
                                    value={props['gamemode'] || 'survival'}
                                    onChange={(e) => updateField('gamemode', e.target.value)}
                                    className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                >
                                    <option value="survival">Survival</option>
                                    <option value="creative">Creative</option>
                                    <option value="adventure">Adventure</option>
                                    <option value="spectator">Spectator</option>
                                </select>
                            </div>

                            {/* Difficulty */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <label className="text-xs font-sans font-semibold text-[#FFFFFF] block mb-1">
                                    Game Difficulty (difficulty)
                                </label>
                                <select
                                    value={props['difficulty'] || 'easy'}
                                    onChange={(e) => updateField('difficulty', e.target.value)}
                                    className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                >
                                    <option value="peaceful">Peaceful</option>
                                    <option value="easy">Easy</option>
                                    <option value="normal">Normal</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { key: 'pvp', label: 'PvP Combat', desc: 'Allow player vs player attack damage' },
                                { key: 'hardcore', label: 'Hardcore Mode', desc: 'Permadeath spectator ban on death' },
                                { key: 'allow-flight', label: 'Allow Flight', desc: 'Disable vanilla fly hacking kick' },
                                { key: 'force-gamemode', label: 'Force Gamemode', desc: 'Reset gamemode on player reconnect' },
                                { key: 'enable-command-block', label: 'Command Blocks', desc: 'Allow command blocks execution' },
                                { key: 'sync-chunk-writes', label: 'Sync Chunk Writes', desc: 'Synchronous world chunk saving' },
                            ].map((item) => (
                                <div key={item.key} className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-sans font-semibold text-[#FFFFFF] m-0">{item.label}</h4>
                                        <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5">{item.desc}</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={(props[item.key] ?? 'false') === 'true'}
                                        onChange={(e) => updateField(item.key, e.target.checked ? 'true' : 'false')}
                                        className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0 w-4 h-4"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────────────
                    TAB CONTENT: World & Spawning
                ──────────────────────────────────────────────────────────────── */}
                {activeTab === 'world' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* World Name */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <label className="text-xs font-sans font-semibold text-[#FFFFFF] block mb-1">
                                    World Folder Name (level-name)
                                </label>
                                <input
                                    type="text"
                                    value={props['level-name'] ?? 'world'}
                                    onChange={(e) => updateField('level-name', e.target.value)}
                                    className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                />
                                <p className="text-[11px] text-[#8A8A8A] mt-1">Directory containing the active world files.</p>
                            </div>

                            {/* World Seed */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <label className="text-xs font-sans font-semibold text-[#FFFFFF] block mb-1">
                                    World Seed (level-seed)
                                </label>
                                <input
                                    type="text"
                                    value={props['level-seed'] ?? ''}
                                    onChange={(e) => updateField('level-seed', e.target.value)}
                                    placeholder="Leave blank for random seed"
                                    className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                />
                                <p className="text-[11px] text-[#8A8A8A] mt-1">Applies only to newly generated worlds.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* View Distance */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-sans font-semibold text-[#FFFFFF]">
                                        View Distance
                                    </label>
                                    <span className="text-xs font-mono text-emerald-400">
                                        {props['view-distance'] || '10'} chunks
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="3"
                                    max="32"
                                    value={props['view-distance'] || '10'}
                                    onChange={(e) => updateField('view-distance', e.target.value)}
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                                <p className="text-[11px] text-[#8A8A8A] mt-1">Chunk rendering radius sent to players.</p>
                            </div>

                            {/* Simulation Distance */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-sans font-semibold text-[#FFFFFF]">
                                        Simulation Distance
                                    </label>
                                    <span className="text-xs font-mono text-emerald-400">
                                        {props['simulation-distance'] || '10'} chunks
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="3"
                                    max="32"
                                    value={props['simulation-distance'] || '10'}
                                    onChange={(e) => updateField('simulation-distance', e.target.value)}
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                                <p className="text-[11px] text-[#8A8A8A] mt-1">Entity and crop ticking radius.</p>
                            </div>

                            {/* Spawn Protection */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-sans font-semibold text-[#FFFFFF]">
                                        Spawn Protection
                                    </label>
                                    <span className="text-xs font-mono text-emerald-400">
                                        {props['spawn-protection'] || '16'} blocks
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    max="1000"
                                    value={props['spawn-protection'] || '16'}
                                    onChange={(e) => updateField('spawn-protection', e.target.value)}
                                    className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-2.5 py-1 text-xs font-mono text-[#FFFFFF] outline-none"
                                />
                                <p className="text-[11px] text-[#8A8A8A] mt-1">Non-OP block place/break restriction radius.</p>
                            </div>
                        </div>

                        {/* Spawning Toggles */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { key: 'allow-nether', label: 'Allow Nether', desc: 'Enable Nether portals & dimension' },
                                { key: 'generate-structures', label: 'Structures', desc: 'Villages, dungeons, temples' },
                                { key: 'spawn-monsters', label: 'Spawn Monsters', desc: 'Zombies, creepers, skeletons' },
                                { key: 'spawn-animals', label: 'Spawn Animals', desc: 'Cows, sheep, pigs, chickens' },
                                { key: 'spawn-npcs', label: 'Spawn Villagers', desc: 'Villagers in villages' },
                            ].map((item) => (
                                <div key={item.key} className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-sans font-semibold text-[#FFFFFF] m-0">{item.label}</h4>
                                        <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5">{item.desc}</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={(props[item.key] ?? 'true') === 'true'}
                                        onChange={(e) => updateField(item.key, e.target.checked ? 'true' : 'false')}
                                        className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0 w-4 h-4"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────────────
                    TAB CONTENT: Security & Network
                ──────────────────────────────────────────────────────────────── */}
                {activeTab === 'security' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                {
                                    key: 'enforce-secure-profile',
                                    label: 'Enforce Secure Chat Profile',
                                    desc: 'Require cryptographic Mojang chat signatures. Disable this if offline/cracked players cannot send chat messages.',
                                },
                                {
                                    key: 'hide-online-players',
                                    label: 'Hide Online Players',
                                    desc: 'Prevent the player list hover tooltip in the Minecraft multiplayer menu.',
                                },
                                {
                                    key: 'prevent-proxy-connections',
                                    label: 'Prevent Proxy Connections',
                                    desc: 'Blocks players connecting through known VPNs and commercial proxies.',
                                },
                                {
                                    key: 'enable-command-block',
                                    label: 'Command Blocks Enabled',
                                    desc: 'Allows command blocks to execute console level commands.',
                                },
                            ].map((item) => (
                                <div key={item.key} className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4 flex items-center justify-between">
                                    <div className="pr-4">
                                        <h4 className="text-xs font-sans font-semibold text-[#FFFFFF] m-0">{item.label}</h4>
                                        <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5 leading-relaxed">{item.desc}</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={(props[item.key] ?? (item.key === 'enforce-secure-profile' ? 'true' : 'false')) === 'true'}
                                        onChange={(e) => updateField(item.key, e.target.checked ? 'true' : 'false')}
                                        className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0 w-4 h-4 shrink-0"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Compression Threshold */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <label className="text-xs font-sans font-semibold text-[#FFFFFF] block mb-1">
                                    Compression Threshold
                                </label>
                                <input
                                    type="number"
                                    value={props['network-compression-threshold'] ?? '256'}
                                    onChange={(e) => updateField('network-compression-threshold', e.target.value)}
                                    className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                />
                                <p className="text-[11px] text-[#8A8A8A] mt-1">Bytes before packets are compressed (256 standard, -1 disables).</p>
                            </div>

                            {/* Max Tick Time */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <label className="text-xs font-sans font-semibold text-[#FFFFFF] block mb-1">
                                    Max Tick Time (Watchdog ms)
                                </label>
                                <input
                                    type="number"
                                    value={props['max-tick-time'] ?? '60000'}
                                    onChange={(e) => updateField('max-tick-time', e.target.value)}
                                    className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                />
                                <p className="text-[11px] text-[#8A8A8A] mt-1">Milliseconds before server watchdog kills hung server (-1 disables).</p>
                            </div>

                            {/* Idle Kick Timeout */}
                            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                                <label className="text-xs font-sans font-semibold text-[#FFFFFF] block mb-1">
                                    AFK Idle Timeout (Minutes)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={props['player-idle-timeout'] ?? '0'}
                                    onChange={(e) => updateField('player-idle-timeout', e.target.value)}
                                    className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                />
                                <p className="text-[11px] text-[#8A8A8A] mt-1">Minutes of inactivity before kicking AFK players (0 disables).</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────────────
                    TAB CONTENT: Resource Pack & RCON
                ──────────────────────────────────────────────────────────────── */}
                {activeTab === 'resource_pack' && (
                    <div className="space-y-6">
                        {/* Resource Pack Section */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-5 space-y-4">
                            <h3 className="text-sm font-sans font-semibold text-[#FFFFFF] m-0">
                                Server Resource Pack (Automatic Client Download)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-[#CCCCCC] block mb-1">
                                        Resource Pack Direct URL (HTTPS)
                                    </label>
                                    <input
                                        type="url"
                                        value={props['resource-pack'] ?? ''}
                                        onChange={(e) => updateField('resource-pack', e.target.value)}
                                        placeholder="https://example.com/pack.zip"
                                        className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-[#CCCCCC] block mb-1">
                                        SHA-1 Hash (Recommended for caching)
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={40}
                                        value={props['resource-pack-sha1'] ?? ''}
                                        onChange={(e) => updateField('resource-pack-sha1', e.target.value)}
                                        placeholder="e.g. 40-character hexadecimal checksum"
                                        className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div>
                                    <h4 className="text-xs font-sans font-semibold text-[#FFFFFF] m-0">
                                        Require Resource Pack
                                    </h4>
                                    <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5">
                                        Disconnect players who decline or cancel the pack download.
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={(props['require-resource-pack'] ?? 'false') === 'true'}
                                    onChange={(e) => updateField('require-resource-pack', e.target.checked ? 'true' : 'false')}
                                    className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0 w-4 h-4"
                                />
                            </div>
                        </div>

                        {/* RCON Remote Console Section */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-sans font-semibold text-[#FFFFFF] m-0">
                                        Remote Console (RCON)
                                    </h3>
                                    <p className="text-[11px] text-[#8A8A8A] m-0 mt-0.5">
                                        Enable TCP remote console connections for Discord bots and web management tools.
                                    </p>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#CCCCCC]">
                                    <input
                                        type="checkbox"
                                        checked={(props['enable-rcon'] ?? 'false') === 'true'}
                                        onChange={(e) => updateField('enable-rcon', e.target.checked ? 'true' : 'false')}
                                        className="rounded border-[#2B2B2B] bg-[#000000] text-emerald-500 focus:ring-0"
                                    />
                                    Enable RCON
                                </label>
                            </div>

                            {(props['enable-rcon'] ?? 'false') === 'true' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#1F1F1F]">
                                    <div>
                                        <label className="text-xs font-medium text-[#CCCCCC] block mb-1">
                                            RCON Port (rcon.port)
                                        </label>
                                        <input
                                            type="number"
                                            value={props['rcon.port'] ?? '25575'}
                                            onChange={(e) => updateField('rcon.port', e.target.value)}
                                            className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                        />
                                        <p className="text-[11px] text-[#8A8A8A] mt-1">Must match an allocation assigned to this server.</p>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-medium text-[#CCCCCC]">
                                                RCON Password (rcon.password)
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowRconPassword(!showRconPassword)}
                                                className="text-[11px] text-emerald-400 hover:underline bg-transparent border-none p-0 cursor-pointer"
                                            >
                                                {showRconPassword ? 'Hide' : 'Show'}
                                            </button>
                                        </div>
                                        <input
                                            type={showRconPassword ? 'text' : 'password'}
                                            value={props['rcon.password'] ?? ''}
                                            onChange={(e) => updateField('rcon.password', e.target.value)}
                                            placeholder="Enter strong RCON password"
                                            className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────────────
                    TAB CONTENT: Raw Editor
                ──────────────────────────────────────────────────────────────── */}
                {activeTab === 'raw' && (
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-sans font-semibold text-[#FFFFFF] m-0">
                                    Raw server.properties Editor
                                </h3>
                                <p className="text-xs text-[#8A8A8A] m-0 mt-0.5">
                                    Edit any raw property directly, including modded settings from Paper, Purpur, Forge, or Fabric.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRawContent(originalRaw)}
                                disabled={!hasRawChanges}
                                className="px-3 py-1.5 rounded text-xs font-medium text-[#CCCCCC] bg-[#141414] hover:bg-[#1E1E1E] border border-[#222222] disabled:opacity-40 transition-colors"
                            >
                                Revert Editor
                            </button>
                        </div>

                        <textarea
                            rows={24}
                            value={rawContent}
                            onChange={(e) => setRawContent(e.target.value)}
                            className="w-full bg-[#000000] border border-[#2B2B2B] focus:border-emerald-500 rounded p-4 text-xs font-mono text-[#E0E0E0] outline-none leading-relaxed resize-y font-normal selection:bg-emerald-900 selection:text-white"
                            spellCheck={false}
                        />

                        <div className="flex items-center justify-between pt-2 border-t border-[#1F1F1F]">
                            <span className="text-xs text-[#777777] font-mono">
                                {hasRawChanges ? '● Unsaved changes in raw editor' : 'Matches disk file'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSaveRaw(false)}
                                    disabled={savingRaw}
                                    className="px-4 py-2 rounded text-xs font-semibold bg-[#111111] hover:bg-[#1A1A1A] text-[#FFFFFF] border border-[#2B2B2B] transition-colors"
                                >
                                    {savingRaw ? 'Saving…' : 'Save Raw File'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveRaw(true)}
                                    disabled={savingRaw}
                                    className="px-4 py-2 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-[#000000] transition-colors"
                                >
                                    {savingRaw ? 'Saving & Restarting…' : 'Save & Restart Server'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────────────
                    FLOATING / STICKY BOTTOM SAVE ACTION BAR
                ──────────────────────────────────────────────────────────────── */}
                <div className="fixed bottom-6 left-0 right-0 z-40 max-w-5xl mx-auto px-4 pointer-events-none">
                    <div className="bg-[#0A0A0A]/95 backdrop-blur-md border border-[#2B2B2B] rounded-xl p-3.5 shadow-2xl flex items-center justify-between gap-4 pointer-events-auto transition-all">
                        <div className="flex items-center gap-2.5">
                            {hasChanges ? (
                                <>
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                                    <span className="text-xs font-medium text-[#FFFFFF]">
                                        Unsaved changes detected in properties
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    <span className="text-xs font-medium text-[#A0A0A0]">
                                        Properties up to date with disk
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {hasChanges && (
                                <button
                                    type="button"
                                    onClick={handleDiscard}
                                    disabled={saving}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#141414] hover:bg-[#1F1F1F] border border-[#242424] transition-colors"
                                >
                                    Discard
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#282828] text-[#FFFFFF] border border-[#333333] transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save Properties'}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSave(true)}
                                disabled={saving}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-[#000000] transition-colors disabled:opacity-50 shadow-lg shadow-emerald-950/40"
                            >
                                {saving ? 'Applying…' : 'Save & Restart Server'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ServerContentBlock>
    );
}
