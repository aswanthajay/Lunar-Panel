import React, { useState } from 'react';
import Spinner from '@/components/elements/Spinner';
import { FiveMPlayer } from './types';

interface InspectModalProps {
    player: FiveMPlayer | null;
    onClose: () => void;
}

export const InspectPlayerModal: React.FC<InspectModalProps> = ({ player, onClose }) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    if (!player) return null;

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#050505] border border-[#262626] rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto font-sans">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#141414] pb-4 mb-4">
                    <div>
                        <h3 className="text-base font-sans font-semibold text-white m-0">
                            Inspect Player: {player.name}
                        </h3>
                        <p className="text-xs font-mono text-[#737373] mt-0.5 m-0">
                            Session Client ID #{player.id} · {player.ping !== null ? `${player.ping} ms latency` : 'Unknown ping'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white text-base cursor-pointer px-2 py-1"
                    >
                        ✕
                    </button>
                </div>

                {/* Section: HWID Tokens */}
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A0A0A0] m-0 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#E5A93C]" />
                            <span>Hardware ID (HWID) Tokens ({player.hwids.length})</span>
                        </h4>
                        {player.hwids.length > 0 && (
                            <button
                                type="button"
                                onClick={() => copyToClipboard(player.hwids.join('\n'), 'inspect-all-hwids')}
                                className="text-xs text-[#38BDF8] hover:underline cursor-pointer font-mono"
                            >
                                {copiedKey === 'inspect-all-hwids' ? '✓ Copied All Tokens' : 'Copy All Tokens'}
                            </button>
                        )}
                    </div>

                    {player.hwids.length > 0 ? (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {player.hwids.map((hw, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between gap-2 p-2 rounded bg-[#0A0A0A] border border-[#1A1A1A] text-xs font-mono"
                                >
                                    <span className="text-[#EDEDED] break-all select-all">{hw}</span>
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(hw, `hw-${idx}`)}
                                        className="text-[11px] text-[#737373] hover:text-white shrink-0 cursor-pointer ml-2"
                                    >
                                        {copiedKey === `hw-${idx}` ? '✓' : 'Copy'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-[#525252] font-mono m-0 p-3 bg-[#0A0A0A] border border-[#1A1A1A] rounded">
                            No hardware tokens captured yet. Hardware tokens are populated by FXServer or txAdmin playersDB.
                        </p>
                    )}
                </div>

                {/* Section: IP & Geolocation */}
                <div className="mb-5">
                    <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A0A0A0] mb-2 m-0 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                        <span>Network &amp; Geolocation</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                        <div className="p-2.5 rounded bg-[#0A0A0A] border border-[#1A1A1A]">
                            <span className="text-[10px] text-[#737373] block">IP Address</span>
                            <span className="text-white font-semibold">{player.ip || '—'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#0A0A0A] border border-[#1A1A1A]">
                            <span className="text-[10px] text-[#737373] block">Port</span>
                            <span className="text-white font-semibold">{player.port || '—'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#0A0A0A] border border-[#1A1A1A]">
                            <span className="text-[10px] text-[#737373] block">Location</span>
                            <span className="text-white font-semibold truncate block">
                                {player.geo?.country || 'Local / Private'}
                            </span>
                        </div>
                        <div className="p-2.5 rounded bg-[#0A0A0A] border border-[#1A1A1A]">
                            <span className="text-[10px] text-[#737373] block">ISP</span>
                            <span className="text-white font-semibold truncate block">
                                {player.geo?.isp || 'Internal'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Section: All Identifiers */}
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A0A0A0] m-0 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                            <span>Identifiers List</span>
                        </h4>
                        <button
                            type="button"
                            onClick={() =>
                                copyToClipboard(
                                    JSON.stringify(player.identifiers, null, 2),
                                    'inspect-ids'
                                )
                            }
                            className="text-xs text-[#38BDF8] hover:underline cursor-pointer font-mono"
                        >
                            {copiedKey === 'inspect-ids' ? '✓ Copied IDs' : 'Copy Identifiers JSON'}
                        </button>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {Object.entries(player.identifiers).map(([key, val]) => (
                            <div
                                key={key}
                                className="flex items-center justify-between gap-2 p-2 rounded bg-[#0A0A0A] border border-[#1A1A1A] text-xs font-mono"
                            >
                                <span className="text-[#38BDF8] font-semibold">{key}:</span>
                                <span className="text-[#EDEDED] break-all select-all flex-1 text-right">{val}</span>
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(val || '', `id-${key}`)}
                                    className="text-[11px] text-[#737373] hover:text-white shrink-0 cursor-pointer ml-2"
                                >
                                    {copiedKey === `id-${key}` ? '✓' : 'Copy'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#141414]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] text-[#EDEDED] hover:text-white transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

interface WhisperModalProps {
    player: FiveMPlayer | null;
    loading: boolean;
    onClose: () => void;
    onSend: (message: string) => void;
}

export const WhisperPlayerModal: React.FC<WhisperModalProps> = ({
    player,
    loading,
    onClose,
    onSend,
}) => {
    const [msg, setMsg] = useState('');

    if (!player) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!msg.trim() || loading) return;
        onSend(msg.trim());
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#050505] border border-[#262626] rounded-xl max-w-md w-full p-6 shadow-2xl font-sans">
                <h3 className="text-base font-semibold text-white mb-1">
                    Send Whisper to {player.name} (ID #{player.id})
                </h3>
                <p className="text-xs text-[#A0A0A0] mb-4">
                    This message will be delivered privately to the player's in-game chat interface.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="block text-xs font-mono text-[#737373] mb-1.5 uppercase tracking-wider">
                            Message
                        </label>
                        <input
                            type="text"
                            value={msg}
                            onChange={(e) => setMsg(e.target.value)}
                            placeholder="e.g., Please stop breaking server rule #3."
                            className="w-full bg-[#000000] border border-[#1F1F1F] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#404040] font-sans"
                            autoFocus
                        />
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-5">
                        {[
                            'Please check our Discord for an important announcement.',
                            'Notice: Please stop breaking server rules.',
                            'Are you AFK? Please respond.',
                            'Please join staff voice channel on Discord.',
                        ].map((preset, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setMsg(preset)}
                                className="text-[10px] px-2 py-0.5 rounded bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
                            >
                                {preset.substring(0, 26)}…
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs font-medium text-[#A0A0A0] hover:text-white bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !msg.trim()}
                            className="px-4 py-2 rounded-lg text-xs font-semibold text-black bg-white hover:bg-[#E5E5E5] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {loading && <Spinner size="small" />}
                            <span>Send Whisper</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface KickModalProps {
    player: FiveMPlayer | null;
    loading: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

export const KickPlayerModal: React.FC<KickModalProps> = ({
    player,
    loading,
    onClose,
    onConfirm,
}) => {
    const [reason, setReason] = useState('Kicked by administrator');

    if (!player) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        onConfirm(reason);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#050505] border border-[#262626] rounded-xl max-w-md w-full p-6 shadow-2xl font-sans">
                <h3 className="text-base font-semibold text-white mb-1">
                    Kick {player.name} (ID #{player.id})?
                </h3>
                <p className="text-xs text-[#A0A0A0] mb-4">
                    The player will be immediately disconnected from the FiveM server session.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="block text-xs font-mono text-[#737373] mb-1.5 uppercase tracking-wider">
                            Kick Reason
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g., Disruptive behavior / AFK"
                            className="w-full bg-[#000000] border border-[#1F1F1F] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#404040] font-sans"
                            autoFocus
                        />
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-5">
                        {[
                            'AFK / Inactive',
                            'Rule Violation',
                            'Desync / Please Reconnect',
                            'Disruptive Behavior',
                        ].map((preset, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setReason(preset)}
                                className="text-[10px] px-2 py-0.5 rounded bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
                            >
                                {preset}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs font-medium text-[#A0A0A0] hover:text-white bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {loading && <Spinner size="small" />}
                            <span>Confirm Kick</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface BanModalProps {
    player: FiveMPlayer | null;
    loading: boolean;
    onClose: () => void;
    onConfirm: (duration: string, reason: string) => void;
}

export const BanPlayerModal: React.FC<BanModalProps> = ({
    player,
    loading,
    onClose,
    onConfirm,
}) => {
    const [duration, setDuration] = useState('24h');
    const [reason, setReason] = useState('Banned by administrator');

    if (!player) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        onConfirm(duration, reason);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#050505] border border-[#262626] rounded-xl max-w-md w-full p-6 shadow-2xl font-sans">
                <h3 className="text-base font-semibold text-white mb-1">
                    Ban {player.name} (ID #{player.id})?
                </h3>
                <p className="text-xs text-[#A0A0A0] mb-4">
                    The player will be immediately kicked and blocked from reconnecting.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="block text-xs font-mono text-[#737373] mb-1.5 uppercase tracking-wider">
                            Ban Duration
                        </label>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="w-full bg-[#000000] border border-[#1F1F1F] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#404040] font-sans"
                        >
                            <option value="1h">1 Hour</option>
                            <option value="12h">12 Hours</option>
                            <option value="24h">24 Hours (1 Day)</option>
                            <option value="3d">3 Days</option>
                            <option value="7d">7 Days (1 Week)</option>
                            <option value="30d">30 Days</option>
                            <option value="perm">Permanent</option>
                        </select>
                    </div>

                    <div className="mb-5">
                        <label className="block text-xs font-mono text-[#737373] mb-1.5 uppercase tracking-wider">
                            Ban Reason
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g., Exploiting / Cheating / Toxicity"
                            className="w-full bg-[#000000] border border-[#1F1F1F] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#404040] font-sans"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs font-medium text-[#A0A0A0] hover:text-white bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {loading && <Spinner size="small" />}
                            <span>Confirm Ban</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
