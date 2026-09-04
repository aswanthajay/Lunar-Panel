import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useUserRole } from '@/plugins/useUserRole';

interface CommandItem {
    id: string;
    category: 'Navigation' | 'Compute' | 'Operations' | 'Administration';
    title: string;
    description: string;
    path: string;
    adminOnly?: boolean;
}

const COMMAND_ITEMS: CommandItem[] = [
    { id: '1', category: 'Compute', title: 'Server Overview', description: 'Real-time telemetry and fleet metrics', path: '/' },
    { id: '2', category: 'Compute', title: 'Game Servers', description: 'Manage Minecraft, Steam, and container game servers', path: '/instances' },
    { id: '3', category: 'Operations', title: 'Billing Operations', description: 'Invoices, game server subscriptions, and node economics', path: '/billing-operations', adminOnly: true },
    { id: '3b', category: 'Operations', title: 'Billing and Renewals', description: 'Server renewals, remaining days, and INR payments', path: '/billing' },
    { id: '4', category: 'Operations', title: 'Ticket Management', description: 'Customer support and engineering inquiries', path: '/support' },
    { id: '5', category: 'Operations', title: 'Cluster Audit Logs', description: 'Security trails and administrative event history', path: '/audit-logs', adminOnly: true },
    { id: '6', category: 'Operations', title: 'Reinstall Requests', description: 'Automated game server rebuilds and egg reinstall queue', path: '/reimage-requests', adminOnly: true },
    { id: '7', category: 'Operations', title: 'Network Allocations', description: 'Dedicated game IPs, port bindings, and anti-DDoS rules', path: '/ovh-manager', adminOnly: true },
    { id: '8', category: 'Administration', title: 'Daemon Nodes & Wings Clusters', description: 'Wings daemon node connections and cluster hosts', path: '/proxmox-connections', adminOnly: true },
    { id: '9', category: 'Administration', title: 'User Management', description: 'Client access and administrator role delegation', path: '/user-management', adminOnly: true },
    { id: '10', category: 'Administration', title: 'System Settings', description: 'Global cluster policies and telemetry timers', path: '/system-settings', adminOnly: true },
];

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const history = useHistory();
    const { isAdmin } = useUserRole();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredItems = COMMAND_ITEMS.filter((item) =>
        (!item.adminOnly || isAdmin) &&
        (item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase()))
    );

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    history.push(filteredItems[selectedIndex].path);
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, filteredItems, selectedIndex, history, onClose]);

    if (!isOpen) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
            className="fixed inset-0 z-[1000] flex items-start justify-center pt-24 px-4 bg-black/75 backdrop-blur-sm"
        >
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
            <div className="motion-modal relative w-full max-w-xl bg-[#121212] border border-[#262626] rounded-md shadow-2xl overflow-hidden font-sans">
                {/* Search Input */}
                <div className="flex items-center px-4 py-3 border-b border-[#262626] bg-[#0A0A0A]">
                    <svg className="w-4 h-4 text-[#656B6B] mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-expanded={filteredItems.length > 0}
                        aria-autocomplete="list"
                        aria-controls="command-results-list"
                        aria-activedescendant={filteredItems[selectedIndex] ? `cmd-item-${filteredItems[selectedIndex].id}` : undefined}
                        aria-label="Search commands, game servers, or nodes"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder="Search commands, game servers, or nodes..."
                        className="w-full bg-transparent text-sm text-[#FFFFFF] placeholder-[#656B6B] outline-none border-none ring-0 shadow-none focus:outline-none focus:ring-0 focus:border-none"
                        style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                    />
                    <span className="text-[10px] font-mono text-[#656B6B] border border-[#262626] rounded px-1.5 py-0.5" aria-hidden="true">
                        ESC
                    </span>
                </div>

                {/* Results List */}
                <div
                    id="command-results-list"
                    role="listbox"
                    aria-label="Command suggestions"
                    className="max-h-80 overflow-y-auto p-2 divide-y divide-transparent"
                >
                    {filteredItems.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#656B6B]" role="status">
                            No matching commands found
                        </div>
                    ) : (
                        filteredItems.map((item, idx) => (
                            <div
                                key={item.id}
                                id={`cmd-item-${item.id}`}
                                role="option"
                                aria-selected={idx === selectedIndex}
                                onClick={() => {
                                    history.push(item.path);
                                    onClose();
                                }}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.99] min-h-[44px] ${
                                    idx === selectedIndex ? 'bg-[#1A1A1A] text-[#FFFFFF]' : 'text-[#A0A0A0] hover:bg-[#1A1A1A]'
                                }`}
                            >
                                <div>
                                    <div className="text-xs font-semibold text-[#FFFFFF]">{item.title}</div>
                                    <div className="text-[11px] text-[#656B6B] mt-0.5">{item.description}</div>
                                </div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#656B6B] bg-[#0A0A0A] px-2 py-0.5 rounded border border-[#262626]" aria-hidden="true">
                                    {item.category}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
