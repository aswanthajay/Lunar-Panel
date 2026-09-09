import React, { useState } from 'react';
import { FiveMPlayer } from './types';

interface FiveMPlayerCardProps {
    player: FiveMPlayer;
    maskIps: boolean;
    onInspect: (player: FiveMPlayer) => void;
    onWhisper: (player: FiveMPlayer) => void;
    onKick: (player: FiveMPlayer) => void;
    onBan: (player: FiveMPlayer) => void;
}

export const FiveMPlayerCard: React.FC<FiveMPlayerCardProps> = ({
    player,
    maskIps,
    onInspect,
    onWhisper,
    onKick,
    onBan,
}) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyToClipboard = (text: string, key: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const getSteamId64 = (steamHex?: string, fallbackId64?: string): string | null => {
        if (fallbackId64) return fallbackId64;
        if (!steamHex) return null;
        try {
            const cleanHex = steamHex.replace(/^steam:/i, '');
            return BigInt('0x' + cleanHex).toString();
        } catch {
            return null;
        }
    };

    const getCountryFlag = (countryCode?: string) => {
        if (!countryCode || countryCode.length !== 2 || countryCode === 'LOC') return '🌐';
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map((char) => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    };

    const maskIpAddress = (ip?: string | null): string => {
        if (!ip) return '—';
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
            return '127.0.0.1 (Localhost)';
        }
        if (!maskIps) return ip;
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.***.***.${parts[3]}`;
        }
        return '***.***.***.***';
    };

    const getPingRating = (ping: number | null) => {
        if (ping === null) {
            return {
                color: 'text-[#737373]',
                dot: 'bg-zinc-500',
                pill: 'bg-[#141416] border-[#27272A] text-[#A1A1AA]',
                label: 'Unknown',
            };
        }
        if (ping < 45) {
            return {
                color: 'text-[#10B981]',
                dot: 'bg-[#10B981]',
                pill: 'bg-[#051F14] border-[#10B981]/40 text-[#10B981]',
                label: 'Optimal',
            };
        }
        if (ping < 85) {
            return {
                color: 'text-[#38BDF8]',
                dot: 'bg-[#38BDF8]',
                pill: 'bg-[#0A192F] border-[#38BDF8]/40 text-[#38BDF8]',
                label: 'Normal',
            };
        }
        if (ping < 140) {
            return {
                color: 'text-[#F59E0B]',
                dot: 'bg-[#F59E0B]',
                pill: 'bg-[#1C1405] border-[#F59E0B]/40 text-[#F59E0B]',
                label: 'Moderate',
            };
        }
        return {
            color: 'text-[#EF4444]',
            dot: 'bg-[#EF4444]',
            pill: 'bg-[#1F080A] border-[#EF4444]/40 text-[#EF4444]',
            label: 'High Latency',
        };
    };

    const pingInfo = getPingRating(player.ping);
    const steamId64 = getSteamId64(player.identifiers.steam, player.identifiers.steam_id64);
    const maskedIp = maskIpAddress(player.ip);
    const flag = getCountryFlag(player.geo?.country_code);

    return (
        <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] p-4 hover:border-[#2D2D2D] transition-colors group shadow-lg">
            {/* ── Top Header Row ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141414] pb-3.5 mb-3.5">
                {/* Left: ID, Name, Ping, Playtime */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Server ID Badge */}
                    <div className="px-2.5 py-1 rounded bg-[#0A0A0A] border border-[#222222] font-mono text-xs font-bold text-white tracking-wide shrink-0">
                        #{player.id}
                    </div>

                    {/* Player Name & Client ID */}
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-sans text-sm font-semibold text-white tracking-tight">
                                {player.name}
                            </span>
                            <span className="text-[10px] font-mono text-[#737373] bg-[#0A0A0A] border border-[#1A1A1A] px-1.5 py-0.5 rounded">
                                Client ID: {player.id}
                            </span>
                        </div>
                    </div>

                    {/* Ping Capsule */}
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border shrink-0 ${pingInfo.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pingInfo.dot}`} />
                        <span>{player.ping !== null ? `${player.ping} ms` : '—'}</span>
                        <span className="opacity-75">· {pingInfo.label}</span>
                    </div>

                    {/* Playtime tag */}
                    {player.play_time && (
                        <span className="text-[10px] font-mono text-[#A0A0A0] bg-[#0A0A0A] border border-[#222222] px-2 py-0.5 rounded">
                            ⏱️ {player.play_time}
                        </span>
                    )}
                </div>

                {/* Right: Quick Action Suite */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Whisper / PM */}
                    <button
                        type="button"
                        onClick={() => onWhisper(player)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#111111] hover:bg-[#1A1A1A] border border-[#262626] text-[#D4D4D4] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        title="Send in-game whisper / direct message"
                    >
                        <svg className="w-3 h-3 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span>PM</span>
                    </button>

                    {/* Full Inspect Modal */}
                    <button
                        type="button"
                        onClick={() => onInspect(player)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#111111] hover:bg-[#1A1A1A] border border-[#262626] text-[#D4D4D4] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        title="View all hardware IDs, raw tokens, and identifiers"
                    >
                        <svg className="w-3 h-3 text-[#A0A0A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Inspect</span>
                    </button>

                    {/* Kick */}
                    <button
                        type="button"
                        onClick={() => onKick(player)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#1F1212] hover:bg-[#2A1717] border border-[#451A1A] text-[#EF4444] hover:text-[#F87171] transition-colors cursor-pointer"
                        title="Kick player from server session"
                    >
                        Kick
                    </button>

                    {/* Ban */}
                    <button
                        type="button"
                        onClick={() => onBan(player)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#2A0E12] hover:bg-[#3D141A] border border-[#EF4444]/40 text-[#EF4444] hover:text-white transition-colors cursor-pointer"
                        title="Ban player from server"
                    >
                        Ban
                    </button>
                </div>
            </div>

            {/* ── Middle: Telemetry Bento Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
                {/* 1. IP & Network Section */}
                <div className="bg-[#050505] border border-[#1A1A1A] rounded-md p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase font-sans font-semibold tracking-wider text-[#737373]">
                            IP &amp; Endpoint
                        </span>
                        {player.ip && (
                            <button
                                type="button"
                                onClick={(e) => copyToClipboard(player.ip!, `ip-${player.id}`, e)}
                                className="text-[10px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
                            >
                                {copiedKey === `ip-${player.id}` ? '✓ Copied' : 'Copy IP'}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 text-white font-medium">
                        <span className="text-sm">{flag}</span>
                        <span className="truncate">{maskedIp}</span>
                        {player.port && (
                            <span className="text-[#737373] text-[10px]">:{player.port}</span>
                        )}
                    </div>

                    <div className="text-[10px] text-[#737373] mt-1 truncate">
                        {player.geo?.country ? (
                            <span>
                                {player.geo.country}
                                {player.geo.city ? ` · ${player.geo.city}` : ''}
                                {player.geo.isp ? ` (${player.geo.isp})` : ''}
                            </span>
                        ) : (
                            <span>Endpoint Privacy Protected / Local</span>
                        )}
                    </div>
                </div>

                {/* 2. Hardware ID (HWID Tokens) */}
                <div className="bg-[#050505] border border-[#1A1A1A] rounded-md p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase font-sans font-semibold tracking-wider text-[#737373] flex items-center gap-1">
                            <span>HWID Tokens</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#111111] text-[#E5A93C] border border-[#333333]">
                                {player.hwids.length} Detected
                            </span>
                        </span>
                        {player.hwids.length > 0 && (
                            <button
                                type="button"
                                onClick={(e) => copyToClipboard(player.hwids.join('\n'), `hwids-${player.id}`, e)}
                                className="text-[10px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
                            >
                                {copiedKey === `hwids-${player.id}` ? '✓ Copied All' : 'Copy Tokens'}
                            </button>
                        )}
                    </div>

                    {player.hwids.length > 0 ? (
                        <div>
                            <div className="text-[11px] text-white truncate font-mono">
                                {player.hwids[0].substring(0, 24)}…
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-[#737373]">
                                    Hardware hashes tracked
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onInspect(player)}
                                    className="text-[10px] text-[#38BDF8] hover:underline cursor-pointer"
                                >
                                    View all {player.hwids.length} tokens →
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[10px] text-[#525252] mt-1">
                            No tokens captured yet by daemon / txAdmin
                        </div>
                    )}
                </div>

                {/* 3. Gaming Platforms (Steam & Discord) */}
                <div className="bg-[#050505] border border-[#1A1A1A] rounded-md p-2.5">
                    <div className="text-[10px] uppercase font-sans font-semibold tracking-wider text-[#737373] mb-1.5">
                        Platforms &amp; Accounts
                    </div>

                    <div className="flex flex-col gap-1 text-[11px]">
                        {/* Discord */}
                        {player.identifiers.discord ? (
                            <div className="flex items-center justify-between text-[#888888]">
                                <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-[#5865F2] font-semibold text-[10px]">Discord:</span>
                                    <span className="text-white truncate">{player.identifiers.discord}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                    <a
                                        href={`https://discord.com/users/${player.identifiers.discord}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-[#5865F2] hover:underline"
                                        title="Open Discord Profile"
                                    >
                                        Profile ↗
                                    </a>
                                    <button
                                        type="button"
                                        onClick={(e) => copyToClipboard(player.identifiers.discord!, `discord-${player.id}`, e)}
                                        className="text-[10px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
                                    >
                                        {copiedKey === `discord-${player.id}` ? '✓' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[10px] text-[#525252]">Discord: Not linked</div>
                        )}

                        {/* Steam */}
                        {player.identifiers.steam ? (
                            <div className="flex items-center justify-between text-[#888888]">
                                <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-[#38BDF8] font-semibold text-[10px]">Steam:</span>
                                    <span className="text-white truncate">
                                        {player.identifiers.steam.replace(/^steam:/i, '')}
                                    </span>
                                </div>
                                {steamId64 ? (
                                    <a
                                        href={`https://steamcommunity.com/profiles/${steamId64}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-[#38BDF8] hover:underline shrink-0 ml-1"
                                        title="Open Steam Profile"
                                    >
                                        Profile ↗
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => copyToClipboard(player.identifiers.steam!, `steam-${player.id}`, e)}
                                        className="text-[10px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
                                    >
                                        {copiedKey === `steam-${player.id}` ? '✓' : 'Copy'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="text-[10px] text-[#525252]">Steam: Not linked</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Identifiers Pill Ribbon ── */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-[#141414] text-[10px] font-mono">
                {/* License */}
                {player.identifiers.license && (
                    <button
                        type="button"
                        onClick={(e) => copyToClipboard(player.identifiers.license!, `lic-${player.id}`, e)}
                        className="px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#222222] text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title="Click to copy Rockstar Social Club License"
                    >
                        <span className="text-[#10B981] font-semibold">License:</span>
                        <span>{player.identifiers.license.substring(0, 10)}…</span>
                        {copiedKey === `lic-${player.id}` && <span className="text-[#10B981]">✓</span>}
                    </button>
                )}

                {/* License2 */}
                {player.identifiers.license2 && (
                    <button
                        type="button"
                        onClick={(e) => copyToClipboard(player.identifiers.license2!, `lic2-${player.id}`, e)}
                        className="px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#222222] text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title="Click to copy Modern Rockstar License 2"
                    >
                        <span className="text-[#059669] font-semibold">License2:</span>
                        <span>{player.identifiers.license2.substring(0, 10)}…</span>
                        {copiedKey === `lic2-${player.id}` && <span className="text-[#10B981]">✓</span>}
                    </button>
                )}

                {/* Cfx.re Forum */}
                {player.identifiers.fivem && (
                    <a
                        href={`https://forum.cfx.re/u/${player.identifiers.fivem}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#222222] text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title="Open Cfx.re Forum profile"
                    >
                        <span className="text-[#E5A93C] font-semibold">Cfx.re:</span>
                        <span>#{player.identifiers.fivem} ↗</span>
                    </a>
                )}

                {/* Xbox Live */}
                {player.identifiers.xbl && (
                    <button
                        type="button"
                        onClick={(e) => copyToClipboard(player.identifiers.xbl!, `xbl-${player.id}`, e)}
                        className="px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#222222] text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title="Click to copy Xbox Live identifier"
                    >
                        <span className="text-[#107C10] font-semibold">XBL:</span>
                        <span>{player.identifiers.xbl.substring(0, 8)}…</span>
                    </button>
                )}

                {/* Microsoft Live */}
                {player.identifiers.live && (
                    <button
                        type="button"
                        onClick={(e) => copyToClipboard(player.identifiers.live!, `live-${player.id}`, e)}
                        className="px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#222222] text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title="Click to copy Microsoft Live identifier"
                    >
                        <span className="text-[#00A4EF] font-semibold">Live:</span>
                        <span>{player.identifiers.live.substring(0, 8)}…</span>
                    </button>
                )}

                {/* Copy All Identifiers */}
                <button
                    type="button"
                    onClick={(e) =>
                        copyToClipboard(
                            JSON.stringify(
                                {
                                    id: player.id,
                                    name: player.name,
                                    ip: player.ip,
                                    hwids: player.hwids,
                                    identifiers: player.identifiers,
                                    raw: player.raw_identifiers,
                                },
                                null,
                                2
                            ),
                            `all-${player.id}`,
                            e
                        )
                    }
                    className="ml-auto text-[10px] text-[#737373] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{copiedKey === `all-${player.id}` ? '✓ Copied JSON' : 'Copy All Data'}</span>
                </button>
            </div>
        </div>
    );
};
