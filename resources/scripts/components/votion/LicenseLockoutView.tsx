import React, { useState } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import http from '@/api/http';

export interface LicenseLockoutViewProps {
    license?: {
        valid?: boolean;
        status?: string;
        message?: string;
        tier?: string;
        customer?: string;
        domain?: string;
        host?: string;
        key_masked?: string;
    };
}

export const LicenseLockoutView: React.FC<LicenseLockoutViewProps> = ({ license }) => {
    const { isAdmin } = useUserRole();
    const [key, setKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!key.trim()) return;

        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            await http.post('/admin/license', { license_key: key.trim() });
            window.location.reload();
        } catch (err: any) {
            const msg = err.response?.data?.message || err.response?.data?.error || 'License activation failed. Verify your key.';
            setErrorMsg(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const host = license?.host || window.location.hostname;
    const status = license?.status || 'UNLICENSED';
    const message = license?.message || 'A valid cryptographically signed Lunar Panel license key is required to operate this panel.';

    return (
        <div className="fixed inset-0 w-screen h-screen bg-[#000000] text-[#FFFFFF] z-[99999] flex items-center justify-center p-4 font-sans select-none overflow-y-auto">
            <div className="w-full max-w-lg bg-[#050505] border border-[#1F1F1F] rounded-2xl shadow-2xl p-6 sm:p-10 text-center relative overflow-hidden backdrop-blur-xl my-8">
                {/* Soft ambient radial background glow */}
                <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Badge */}
                <div className="relative w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.75"
                            d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.743 5.743L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.586a1 1 0 0 1 .293-.707l5.964-5.964A6 6 0 1 1 21 9z"
                        />
                    </svg>
                </div>

                {/* Title */}
                <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#FFFFFF] tracking-tight antialiased">
                    Lunar License Required
                </h1>

                {/* Description */}
                <p className="text-xs text-[#A0A0A0] mt-3 max-w-md mx-auto leading-relaxed antialiased">
                    {message}
                </p>

                {/* Telemetry metadata card */}
                <div className="mt-6 p-3.5 rounded-lg bg-[#000000] border border-[#1A1A1A] flex items-center justify-between text-left text-xs font-mono">
                    <div>
                        <span className="text-[#737373] text-[10px] uppercase block tracking-wider">Host Domain</span>
                        <span className="text-[#D4D4D4] font-medium">{host}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[#737373] text-[10px] uppercase block tracking-wider">Status</span>
                        <span className="text-rose-400 font-semibold uppercase">{status}</span>
                    </div>
                </div>

                {/* Admin Quick Activation Form */}
                {isAdmin ? (
                    <form onSubmit={handleActivate} className="mt-6 text-left">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A0] block mb-2 font-mono">
                            Enter License Key (LNR-V1...)
                        </label>
                        <div className="flex flex-col gap-2">
                            <textarea
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                rows={3}
                                placeholder="LNR-V1.eyJkb21haW4iOiJ...c2lnbmF0dXJl..."
                                className="w-full bg-[#000000] border border-[#262626] focus:border-[#FFFFFF] rounded-md p-3 text-xs text-[#FFFFFF] font-mono outline-none transition-colors resize-none leading-relaxed"
                                required
                            />
                            {errorMsg && (
                                <p className="text-xs text-rose-400 font-mono mt-1">
                                    {errorMsg}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting || !key.trim()}
                                className="w-full py-2.5 px-4 rounded-md bg-[#FFFFFF] hover:bg-[#EAEAEA] active:scale-[0.98] text-[#0A0A0A] font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
                                        <span>Verifying Cryptographic Signature...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-[#0A0A0A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Activate License Key</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <a
                            href="/admin/license"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-[#FFFFFF] hover:bg-[#EAEAEA] active:scale-[0.98] text-[#0A0A0A] text-xs font-semibold shadow-sm transition-all cursor-pointer"
                        >
                            <svg className="w-3.5 h-3.5 text-[#0A0A0A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span>Sign in as Admin to Activate</span>
                        </a>

                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-[#141414] hover:bg-[#1E1E1E] text-[#D4D4D4] hover:text-[#FFFFFF] border border-[#262626] text-xs font-medium transition-colors cursor-pointer"
                        >
                            <span>Refresh Status</span>
                        </button>
                    </div>
                )}

                {/* Footer Signature */}
                <div className="mt-8 pt-4 border-t border-[#141414] text-[11px] text-[#525252] font-mono">
                    Lunar Control Plane &bull; Cryptographic RSA-2048 Enforced
                </div>
            </div>
        </div>
    );
};

export default LicenseLockoutView;
