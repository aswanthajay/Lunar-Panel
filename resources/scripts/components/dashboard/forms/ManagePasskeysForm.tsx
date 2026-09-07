import React, { useState, useEffect } from 'react';
import {
    getPasskeys,
    enrollPasskey,
    deletePasskey,
    isPasskeySupported,
    PasskeyItem,
} from '@/api/account/webauthn';
import Spinner from '@/components/elements/Spinner';
import { format } from 'date-fns';

interface Props {
    onSuccess?: () => void;
}

export default ({ onSuccess }: Props) => {
    const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [keyName, setKeyName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [supported, setSupported] = useState(true);

    const loadPasskeys = async () => {
        try {
            setLoading(true);
            const list = await getPasskeys();
            setPasskeys(list);
        } catch (err: any) {
            setError(err.message || 'Failed to load passkeys.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setSupported(isPasskeySupported());
        loadPasskeys();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setActionLoading(true);

        try {
            const nameToUse = keyName.trim() || `Security Key (${new Date().toLocaleDateString()})`;
            await enrollPasskey(nameToUse);
            setKeyName('');
            setShowAddForm(false);
            setSuccess(`Passkey "${nameToUse}" enrolled successfully.`);
            await loadPasskeys();
            if (onSuccess) onSuccess();
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                setError('Passkey enrollment was cancelled or timed out.');
            } else {
                setError(err.response?.data?.error || err.message || 'Failed to create passkey.');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`Are you sure you want to revoke the passkey "${name}"?`)) {
            return;
        }

        setError(null);
        setSuccess(null);
        setActionLoading(true);

        try {
            await deletePasskey(id);
            setSuccess(`Passkey "${name}" revoked.`);
            await loadPasskeys();
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to revoke passkey.');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {!supported && (
                <div className="p-4 rounded-lg bg-[#2A1215] border border-[#DC2626]/40 text-[#F87171] text-xs">
                    WebAuthn / Passkeys are not supported by this browser or current connection. Make sure you are using a modern browser over HTTPS or localhost.
                </div>
            )}

            {error && (
                <div className="p-3.5 rounded-lg bg-[#2A1215] border border-[#DC2626]/40 text-[#F87171] text-xs flex items-center justify-between">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="text-[#F87171] hover:text-[#FFFFFF] cursor-pointer bg-transparent border-none">
                        ✕
                    </button>
                </div>
            )}

            {success && (
                <div className="p-3.5 rounded-lg bg-[#0A2618] border border-[#10B981]/40 text-[#34D399] text-xs flex items-center justify-between">
                    <span>{success}</span>
                    <button type="button" onClick={() => setSuccess(null)} className="text-[#34D399] hover:text-[#FFFFFF] cursor-pointer bg-transparent border-none">
                        ✕
                    </button>
                </div>
            )}

            {/* Top Info & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#141414]">
                <div>
                    <h4 className="text-sm font-semibold text-[#FFFFFF] m-0">Registered Passkeys</h4>
                    <p className="text-xs text-[#737373] mt-0.5 m-0">
                        Use biometric identifiers (Touch ID, Face ID, Windows Hello) or physical security keys (YubiKey) to sign in securely without passwords.
                    </p>
                </div>
                {!showAddForm && (
                    <button
                        type="button"
                        disabled={!supported || actionLoading}
                        onClick={() => {
                            setShowAddForm(true);
                            setKeyName(`Key (${new Date().toLocaleDateString()})`);
                        }}
                        className="px-4 py-2 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] text-xs font-semibold tracking-wide transition-all cursor-pointer border-none shadow-sm flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Add New Passkey
                    </button>
                )}
            </div>

            {/* Add New Key Inline Box */}
            {showAddForm && (
                <form onSubmit={handleCreate} className="p-4 rounded-lg bg-[#050505] border border-[#1F1F1F] space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#FFFFFF]">Enroll Passkey Device</span>
                        <button
                            type="button"
                            onClick={() => setShowAddForm(false)}
                            className="text-[#737373] hover:text-[#FFFFFF] text-xs bg-transparent border-none cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs text-[#A3A3A3] mb-1.5">
                            Device / Key Name (e.g. MacBook Touch ID, YubiKey 5)
                        </label>
                        <input
                            type="text"
                            value={keyName}
                            onChange={(e) => setKeyName(e.target.value)}
                            placeholder="Security Key"
                            className="w-full px-3 py-2 bg-[#000000] border border-[#262626] focus:border-[#525252] rounded-md text-xs text-[#FFFFFF] outline-none transition-colors"
                            required
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 rounded-md text-xs text-[#A3A3A3] hover:text-[#FFFFFF] bg-transparent border border-[#262626] hover:border-[#404040] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={actionLoading}
                            className="px-4 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] text-xs font-semibold tracking-wide transition-all cursor-pointer border-none shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {actionLoading && <span className="w-3 h-3 border-2 border-[#000000] border-t-transparent rounded-full animate-spin" />}
                            Register Device
                        </button>
                    </div>
                </form>
            )}

            {/* List of Keys */}
            {loading ? (
                <div className="py-8 flex items-center justify-center">
                    <Spinner size="small" />
                </div>
            ) : passkeys.length === 0 ? (
                <div className="p-6 rounded-lg bg-[#050505] border border-[#141414] text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#141414] flex items-center justify-center text-[#737373]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <p className="text-xs font-medium text-[#D4D4D4] m-0">No passkeys enrolled</p>
                    <p className="text-[11px] text-[#737373] mt-1 m-0">
                        Add a passkey to authenticate quickly and securely without typing your password.
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-[#141414] border border-[#141414] rounded-lg overflow-hidden bg-[#000000]">
                    {passkeys.map((pk) => (
                        <div key={pk.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[#050505] transition-colors">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center shrink-0 text-[#10B981]">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-[#FFFFFF] truncate">{pk.name}</span>
                                        <span className="text-[9px] font-mono uppercase bg-[#141414] text-[#A3A3A3] px-1.5 py-0.5 rounded border border-[#262626]">
                                            FIDO2
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-mono text-[#525252] mt-0.5 truncate">
                                        Added: {pk.created_at ? format(new Date(pk.created_at), 'MMM d, yyyy') : 'Recently'}
                                        {pk.last_used_at && ` • Last used: ${format(new Date(pk.last_used_at), 'MMM d, yyyy HH:mm')}`}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleDelete(pk.id, pk.name)}
                                className="px-3 py-1.5 rounded text-[11px] font-sans text-[#EF4444] hover:text-[#FFFFFF] bg-transparent hover:bg-[#DC2626] border border-[#DC2626]/30 hover:border-[#DC2626] transition-all cursor-pointer shrink-0 disabled:opacity-50"
                            >
                                Revoke
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
