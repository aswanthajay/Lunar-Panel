import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useUserRole } from '@/plugins/useUserRole';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const VotionDeployModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const history = useHistory();
    const { isAdmin } = useUserRole();
    const [selectedTier, setSelectedTier] = useState<'baremetal' | 'nvme' | 'game'>('nvme');

    if (!isOpen) return null;

    const tiers = [
        {
            id: 'baremetal' as const,
            title: 'High-Frequency Bare Metal',
            tag: 'Ryzen 9 / EPYC',
            specs: 'Up to 64 Cores · 256 GB DDR5 ECC · Dual NVMe',
            desc: 'Maximum performance for heavy multi-threaded instances and dedicated clusters.',
            route: isAdmin ? '/instances' : '/billing',
        },
        {
            id: 'nvme' as const,
            title: 'Unmetered NVMe Cloud VPS',
            tag: 'Most Popular',
            specs: '4-16 vCPUs · 16-64 GB RAM · 10Gbps Edge Port',
            desc: 'Lightning-fast IOPS with enterprise ZFS redundancy and instantaneous provisioning.',
            route: isAdmin ? '/instances' : '/billing',
        },
        {
            id: 'game' as const,
            title: 'LunarShield™ Game Node',
            tag: 'Zero Lag DDoS Protection',
            specs: '100% Dedicated Clock · Multi-Terabit Edge Mitigation',
            desc: 'Engineered specifically for Minecraft, FiveM, Rust, and mission-critical communities.',
            route: isAdmin ? '/instances' : '/billing',
        },
    ];

    const handleProceed = (route: string) => {
        onClose();
        if (isAdmin) {
            window.location.href = '/admin/servers/new';
        } else {
            history.push(route);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="relative w-full max-w-2xl bg-[#09090b] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Ambient glow in modal */}
                <div
                    className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(255,85,0,0.3) 0%, transparent 70%)' }}
                />

                <div className="flex items-center justify-between pb-6 border-b border-white/10">
                    <div>
                        <div className="text-xs uppercase tracking-wider text-orange-500 font-mono font-semibold">
                            Votion Cloud Infrastructure
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                            Deploy New Server
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full border border-white/10 hover:border-white/30 text-zinc-400 hover:text-white flex items-center justify-center transition-colors text-sm"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-3.5 my-6">
                    {tiers.map((tier) => (
                        <div
                            key={tier.id}
                            onClick={() => setSelectedTier(tier.id)}
                            className={`cursor-pointer p-4.5 rounded-2xl border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                selectedTier === tier.id
                                    ? 'bg-white/[0.06] border-orange-500/60 shadow-lg shadow-orange-950/20'
                                    : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                            }`}
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white text-base">{tier.title}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-orange-300 font-mono border border-white/10">
                                        {tier.tag}
                                    </span>
                                </div>
                                <div className="text-xs text-zinc-300 font-mono mt-1">{tier.specs}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">{tier.desc}</div>
                            </div>

                            <div className="shrink-0 flex items-center">
                                <div
                                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                        selectedTier === tier.id
                                            ? 'border-orange-500 bg-orange-500'
                                            : 'border-white/30'
                                    }`}
                                >
                                    {selectedTier === tier.id && <div className="w-2 h-2 rounded-full bg-black" />}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
                    <div className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Automated Instant Deployment Enabled
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-full text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => handleProceed(tiers.find((t) => t.id === selectedTier)?.route || '/billing')}
                            className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-lg active:scale-95"
                        >
                            {isAdmin ? 'Provision in Admin Console →' : 'Continue to Configuration →'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VotionDeployModal;
