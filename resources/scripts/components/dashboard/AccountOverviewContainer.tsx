import React, { useState } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import UpdatePasswordForm from '@/components/dashboard/forms/UpdatePasswordForm';
import UpdateEmailAddressForm from '@/components/dashboard/forms/UpdateEmailAddressForm';
import ConfigureTwoFactorForm from '@/components/dashboard/forms/ConfigureTwoFactorForm';
import MessageBox from '@/components/MessageBox';
import { useLocation, Link } from 'react-router-dom';

export default () => {
    const { state } = useLocation<undefined | { twoFactorRedirect?: boolean }>();
    const user = useStoreState((store: ApplicationStore) => store.user.data);

    const [activeSection, setActiveSection] = useState<'password' | 'email' | '2fa' | null>(
        state?.twoFactorRedirect ? '2fa' : null
    );

    return (
        <div className="space-y-6 select-none font-sans">
            {state?.twoFactorRedirect && (
                <div className="mb-4">
                    <MessageBox title="2-Factor Required" type="error">
                        Your account must have two-factor authentication enabled in order to continue.
                    </MessageBox>
                </div>
            )}

            {/* BLOCK 1: ACCOUNT CREDENTIALS (Pure Black Bento) */}
            <section className="bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-[#050505] border-b border-[#141414] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="font-serif text-base font-normal text-[#FFFFFF] tracking-tight m-0">
                            Account Credentials
                        </h2>
                        <p className="text-[11px] font-sans text-[#737373] mt-0.5 m-0">
                            Primary authentication identifiers and cryptographic keys
                        </p>
                    </div>
                    <span className="text-[10px] font-mono text-[#737373] bg-[#000000] px-2.5 py-1 rounded border border-[#1F1F1F]">
                        UUID: {user?.uuid.slice(0, 8)}
                    </span>
                </div>

                <div className="divide-y divide-[#141414] text-xs">
                    {/* ROW 1: PRIMARY EMAIL */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 gap-4 hover:bg-[#050505] transition-colors">
                        <div className="w-52 shrink-0 font-mono text-[11px] uppercase tracking-wider text-[#737373]">
                            Primary Email
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="font-mono text-xs font-medium text-[#FFFFFF]">{user?.email}</span>
                            <div className="text-[11px] font-sans text-[#525252] mt-0.5">
                                Used for administrative notices, security alerts, and login
                            </div>
                        </div>
                        <div className="shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveSection(activeSection === 'email' ? null : 'email')}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-sans transition-all cursor-pointer ${
                                    activeSection === 'email'
                                        ? 'bg-[#FFFFFF] text-[#000000] font-semibold border-none shadow-sm'
                                        : 'bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838]'
                                }`}
                            >
                                {activeSection === 'email' ? 'Close Editor' : 'Edit Email'}
                            </button>
                        </div>
                    </div>

                    {/* ROW 2: PASSWORD */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 gap-4 hover:bg-[#050505] transition-colors">
                        <div className="w-52 shrink-0 font-mono text-[11px] uppercase tracking-wider text-[#737373]">
                            Password
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[#737373] font-mono tracking-widest text-xs">••••••••••••••••</span>
                            <div className="text-[11px] font-sans text-[#525252] mt-0.5">
                                Protected via 100,000-iteration cryptographic salt
                            </div>
                        </div>
                        <div className="shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveSection(activeSection === 'password' ? null : 'password')}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-sans transition-all cursor-pointer ${
                                    activeSection === 'password'
                                        ? 'bg-[#FFFFFF] text-[#000000] font-semibold border-none shadow-sm'
                                        : 'bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838]'
                                }`}
                            >
                                {activeSection === 'password' ? 'Close Editor' : 'Edit Password'}
                            </button>
                        </div>
                    </div>

                    {/* ROW 3: TWO-FACTOR AUTH (2FA) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 gap-4 hover:bg-[#050505] transition-colors">
                        <div className="w-52 shrink-0 font-mono text-[11px] uppercase tracking-wider text-[#737373]">
                            Two-Factor Auth
                        </div>
                        <div className="flex-1 min-w-0">
                            {user?.useTotp ? (
                                <span className="bg-[#051F14] text-[#10B981] border border-[#10B981]/40 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold inline-flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                                    Active (TOTP)
                                </span>
                            ) : (
                                <span className="bg-[#0A0A0A] text-[#737373] border border-[#1F1F1F] px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-medium">
                                    Disabled
                                </span>
                            )}
                            <div className="text-[11px] font-sans text-[#525252] mt-0.5">
                                Hardware TOTP security key / authenticator verification requirement on login
                            </div>
                        </div>
                        <div className="shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveSection(activeSection === '2fa' ? null : '2fa')}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-sans transition-all cursor-pointer ${
                                    activeSection === '2fa'
                                        ? 'bg-[#FFFFFF] text-[#000000] font-semibold border-none shadow-sm'
                                        : 'bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838]'
                                }`}
                            >
                                {activeSection === '2fa' ? 'Close Editor' : user?.useTotp ? 'Reconfigure 2FA' : 'Enable 2FA'}
                            </button>
                        </div>
                    </div>

                    {/* ROW 4: SSH KEYS */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 gap-4 hover:bg-[#050505] transition-colors">
                        <div className="w-52 shrink-0 font-mono text-[11px] uppercase tracking-wider text-[#737373]">
                            Public SSH Keys
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[#FFFFFF] font-medium text-xs">Authorized Public Keys</span>
                            <div className="text-[11px] font-sans text-[#525252] mt-0.5">
                                Used for secure automated server deployments and Cloud-Init
                            </div>
                        </div>
                        <div className="shrink-0">
                            <Link
                                to="/account/ssh"
                                className="px-3.5 py-1.5 rounded-md text-xs font-sans font-medium text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] transition-colors no-underline inline-block"
                            >
                                Manage Keys &rarr;
                            </Link>
                        </div>
                    </div>

                    {/* ROW 5: API ACCESS */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 gap-4 hover:bg-[#050505] transition-colors">
                        <div className="w-52 shrink-0 font-mono text-[11px] uppercase tracking-wider text-[#737373]">
                            API Credentials
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[#FFFFFF] font-medium text-xs">Account Access Tokens</span>
                            <div className="text-[11px] font-sans text-[#525252] mt-0.5">
                                Manage personal programmatic API keys
                            </div>
                        </div>
                        <div className="shrink-0">
                            <Link
                                to="/account/api"
                                className="px-3.5 py-1.5 rounded-md text-xs font-sans font-medium text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] transition-colors no-underline inline-block"
                            >
                                Manage API Keys &rarr;
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* BLOCK 2: DYNAMIC EDITOR CARDS BASED ON SELECTED ACTION */}
            {activeSection === 'password' && (
                <section className="bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-200">
                    <div className="bg-[#050505] border-b border-[#141414] px-6 py-4 flex items-center justify-between">
                        <h3 className="font-serif text-sm font-normal text-[#FFFFFF] tracking-tight m-0">
                            Update Password
                        </h3>
                        <button
                            type="button"
                            onClick={() => setActiveSection(null)}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#000000] hover:bg-[#141414] text-[#737373] hover:text-[#FFFFFF] border border-[#1F1F1F] cursor-pointer transition-colors text-xs"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="p-6">
                        <UpdatePasswordForm />
                    </div>
                </section>
            )}

            {activeSection === 'email' && (
                <section className="bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-200">
                    <div className="bg-[#050505] border-b border-[#141414] px-6 py-4 flex items-center justify-between">
                        <h3 className="font-serif text-sm font-normal text-[#FFFFFF] tracking-tight m-0">
                            Update Email Address
                        </h3>
                        <button
                            type="button"
                            onClick={() => setActiveSection(null)}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#000000] hover:bg-[#141414] text-[#737373] hover:text-[#FFFFFF] border border-[#1F1F1F] cursor-pointer transition-colors text-xs"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="p-6">
                        <UpdateEmailAddressForm />
                    </div>
                </section>
            )}

            {activeSection === '2fa' && (
                <section className="bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-200">
                    <div className="bg-[#050505] border-b border-[#141414] px-6 py-4 flex items-center justify-between">
                        <h3 className="font-serif text-sm font-normal text-[#FFFFFF] tracking-tight m-0">
                            Two-Step Verification Configuration
                        </h3>
                        <button
                            type="button"
                            onClick={() => setActiveSection(null)}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#000000] hover:bg-[#141414] text-[#737373] hover:text-[#FFFFFF] border border-[#1F1F1F] cursor-pointer transition-colors text-xs"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="p-6">
                        <ConfigureTwoFactorForm />
                    </div>
                </section>
            )}
        </div>
    );
};

