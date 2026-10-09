import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useStoreState } from '@/state/hooks';

export const VotionRelayWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Array<{ sender: 'relay' | 'user'; text: string; time: string }>>([
        {
            sender: 'relay',
            text: 'Hello! I am Relay, your Votion Cloud assistant. How can I help optimize or diagnose your infrastructure today?',
            time: 'Just now',
        },
    ]);
    const [input, setInput] = useState('');
    const history = useHistory();
    const user = useStoreState((state) => state.user.data);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;

        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userMsg = { sender: 'user' as const, text: trimmed, time: now };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');

        // Smart responsive answers for infrastructure queries
        setTimeout(() => {
            const lower = trimmed.toLowerCase();
            let reply = "I've logged this inquiry. You can also open an urgent ticket directly in our Support queue.";
            if (lower.includes('ddos') || lower.includes('shield') || lower.includes('attack')) {
                reply = 'LunarShield™ DDoS mitigation is actively filtering edge traffic. 0 volumetric packet drops recorded in the last 15 minutes.';
            } else if (lower.includes('lag') || lower.includes('cpu') || lower.includes('ram') || lower.includes('memory')) {
                reply = 'Telemetry indicates high-frequency AMD/Intel bare metal cores are available. You can inspect live resource graphs under your server console or request allocation upgrades.';
            } else if (lower.includes('backup') || lower.includes('restore')) {
                reply = 'Automated snapshots and off-site ZFS backups run on schedule. You can manage backups from the Backups tab in your server console.';
            } else if (lower.includes('support') || lower.includes('ticket') || lower.includes('help')) {
                reply = 'Redirecting to your Support queue or you can click "Open Support Ticket" below.';
            } else if (lower.includes('deploy') || lower.includes('buy') || lower.includes('new server')) {
                reply = 'Ready to expand? Click "Deploy server now" on your dashboard or explore available compute tiers in Billing.';
            }

            setMessages((prev) => [...prev, { sender: 'relay', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        }, 600);
    };

    return (
        <>
            {/* Floating Pill Button matching media_1791524152931.png bottom right */}
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-black/85 hover:bg-neutral-900 border border-white/20 hover:border-orange-500/60 px-4 py-2 rounded-full backdrop-blur-xl shadow-2xl transition-all duration-200 group active:scale-95 cursor-pointer text-white"
                title="Chat with Relay — Votion AI Assistant & Diagnostics"
                aria-label="Chat with Relay"
            >
                {/* Orange Relay emblem */}
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#eb502c] to-[#ff7a18] flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white" aria-hidden="true">
                        <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 3a7 7 0 0 0-7 7c0 3.86 3.14 7 7 7s7-3.14 7-7-3.14-7-7-7zm0 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z" />
                    </svg>
                </div>
                <span className="text-xs font-semibold tracking-tight text-white group-hover:text-zinc-100">
                    Chat with Relay
                </span>
            </button>

            {/* Relay Assistant Drawer / Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-6 pointer-events-none">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity"
                        onClick={() => setIsOpen(false)}
                    />

                    <div className="relative pointer-events-auto w-full sm:w-[420px] max-h-[85vh] h-[580px] bg-[#0c0c0e] border border-white/15 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/50">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#eb502c] to-[#ff7a18] flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                                        <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 3a7 7 0 0 0-7 7c0 3.86 3.14 7 7 7s7-3.14 7-7-3.14-7-7-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                        <span>Relay Assistant</span>
                                        <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.2 rounded-full font-mono">
                                            Online
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-zinc-400">Votion Cloud Diagnostic Intelligence</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-7 h-7 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Status bar */}
                        <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Cluster: 100% Operational
                            </span>
                            <span className="text-zinc-500">LunarShield™ Active</span>
                        </div>

                        {/* Messages Feed */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-xs">
                            {messages.map((m, idx) => (
                                <div
                                    key={idx}
                                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                                            m.sender === 'user'
                                                ? 'bg-white text-black font-medium'
                                                : 'bg-zinc-900 border border-white/10 text-zinc-200'
                                        }`}
                                    >
                                        {m.text}
                                    </div>
                                    <span className="text-[9px] text-zinc-500 mt-1 px-1">{m.time}</span>
                                </div>
                            ))}
                        </div>

                        {/* Quick Action Shortcuts */}
                        <div className="p-3 bg-black/40 border-t border-white/5 flex gap-2 overflow-x-auto text-[11px]">
                            <button
                                type="button"
                                onClick={() => history.push('/support')}
                                className="whitespace-nowrap px-3 py-1 rounded-full border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-colors"
                            >
                                ☏ Open Support Ticket
                            </button>
                            <button
                                type="button"
                                onClick={() => history.push('/billing')}
                                className="whitespace-nowrap px-3 py-1 rounded-full border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-colors"
                            >
                                💳 Billing & Plans
                            </button>
                            <button
                                type="button"
                                onClick={() => history.push('/audit-logs')}
                                className="whitespace-nowrap px-3 py-1 rounded-full border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-colors"
                            >
                                🛡 Security Audit
                            </button>
                        </div>

                        {/* Input bar */}
                        <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-black/60 flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask Relay about servers, ping, diagnostics..."
                                className="flex-1 bg-zinc-900/80 border border-white/10 rounded-full px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                            />
                            <button
                                type="submit"
                                className="w-8 h-8 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center font-bold text-xs transition-colors shrink-0"
                            >
                                ↑
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default VotionRelayWidget;
