import React, { useState, useEffect } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import http from '@/api/http';
import { VotionLogo } from '@/components/elements/VotionLogo';
import { authenticateWithPasskey, enrollPasskey, isPasskeySupported } from '@/api/account/webauthn';
import { PulseLoader } from '@/components/elements/Spinner';

interface Props {
    initialMode?: 'login' | 'register' | 'forgot-password' | 'reset-password' | '2fa';
}

export const VotionAuthPages: React.FC<Props> = ({ initialMode = 'login' }) => {
    const history = useHistory();
    const location = useLocation();
    const params = useParams<{ token?: string }>();

    const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password' | 'reset-password' | '2fa'>(() => {
        if (location.pathname.includes('/register')) return 'register';
        if (location.pathname.includes('/password/reset')) return 'reset-password';
        if (location.pathname.includes('/password')) return 'forgot-password';
        if (location.pathname.includes('/checkpoint')) return '2fa';
        return initialMode;
    });

    // Login Form Inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [tempToken, setTempToken] = useState('');
    const [totpCode, setTotpCode] = useState('');

    // Register Form Inputs
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [registrationVerificationToken, setRegistrationVerificationToken] = useState<string | null>(null);
    const [registrationOtp, setRegistrationOtp] = useState('');

    // Password reset form inputs
    const [resetEmail, setResetEmail] = useState('');
    const [resetPassword, setResetPassword] = useState('');
    const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState('');

    // Passkey Post-Login Prompt States
    const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
    const [pendingRedirectUrl, setPendingRedirectUrl] = useState<string>('/');
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [passkeyError, setPasskeyError] = useState<string | null>(null);

    // Status & Error Banners
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (location.pathname.includes('/register')) setAuthMode('register');
        else if (location.pathname.includes('/password/reset')) setAuthMode('reset-password');
        else if (location.pathname.includes('/password')) setAuthMode('forgot-password');
        else if (location.pathname.includes('/checkpoint')) setAuthMode('2fa');
        else setAuthMode('login');
    }, [location.pathname]);

    const changeMode = (mode: 'login' | 'register' | 'forgot-password' | 'reset-password' | '2fa') => {
        setAuthMode(mode);
        setErrorMsg(null);
        setSuccessMsg(null);
        if (mode !== 'register') {
            setRegistrationVerificationToken(null);
            setRegistrationOtp('');
        }

        if (mode === 'login') history.push('/auth/login');
        else if (mode === 'register') history.push('/auth/register');
        else if (mode === 'forgot-password') history.push('/auth/password');
    };

    const handleAuthSuccess = (intended?: string, promptPasskey?: boolean) => {
        const targetUrl = intended || '/';
        setPendingRedirectUrl(targetUrl);
        if (promptPasskey && isPasskeySupported()) {
            setShowPasskeyPrompt(true);
        } else {
            setSuccessMsg('Authentication confirmed. Redirecting...');
            window.location.href = targetUrl;
        }
    };

    // Handle Passkey Enrollment from Prompt Modal
    const handleEnrollPasskeyNow = async () => {
        setPasskeyLoading(true);
        setPasskeyError(null);
        try {
            await enrollPasskey(`Passkey (${new Date().toLocaleDateString()})`);
            setSuccessMsg('Passkey enrolled! Opening panel...');
            setTimeout(() => {
                window.location.href = pendingRedirectUrl || '/';
            }, 600);
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                setPasskeyError('Passkey setup was cancelled.');
            } else {
                setPasskeyError(
                    err.response?.data?.error ||
                    err.message ||
                    'Failed to create passkey. You can try again or skip for now.'
                );
            }
            setPasskeyLoading(false);
        }
    };

    const handleSkipPasskey = () => {
        setShowPasskeyPrompt(false);
        window.location.href = pendingRedirectUrl || '/';
    };

    // Handle Sign In with Passkey
    const handlePasskeyLogin = async () => {
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!isPasskeySupported()) {
            setErrorMsg('WebAuthn / Passkeys are not supported by this browser.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await authenticateWithPasskey(email);
            if (result.complete) {
                setSuccessMsg('Passkey verified. Opening panel...');
                window.location.href = result.intended || '/';
            } else {
                setErrorMsg('Passkey authentication could not be completed.');
            }
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                setErrorMsg('Passkey sign-in was cancelled or timed out.');
            } else {
                const errDetail =
                    err.response?.data?.errors?.[0]?.detail ||
                    err.response?.data?.error ||
                    err.message ||
                    'Passkey sign-in failed. Please verify your passkey device or sign in with your password.';
                setErrorMsg(errDetail);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Login Submission
    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsLoading(true);

        try {
            await http.get('/sanctum/csrf-cookie');
            const res = await http.post('/auth/login', {
                user: email.trim(),
                password,
            });

            setIsLoading(false);

            if (res.data?.data?.complete) {
                handleAuthSuccess(res.data?.data?.intended, !!res.data?.data?.prompt_passkey);
                return;
            }

            if (res.data?.data?.confirmation_token) {
                setTempToken(res.data.data.confirmation_token);
                setAuthMode('2fa');
                setSuccessMsg('Please enter your Two-Factor Authentication code.');
            }
        } catch (err: any) {
            setIsLoading(false);
            const errDetail =
                err.response?.data?.errors?.[0]?.detail ||
                err.response?.data?.error ||
                'Invalid email address or password. Please verify your credentials or use Account Recovery.';
            setErrorMsg(errDetail);
        }
    };

    // Handle 2FA Submission
    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);

        try {
            const res = await http.post('/auth/login/checkpoint', {
                confirmation_token: tempToken,
                code: totpCode.trim(),
            });

            setIsLoading(false);

            if (res.data?.data?.complete) {
                handleAuthSuccess(res.data?.data?.intended, !!res.data?.data?.prompt_passkey);
            } else {
                setErrorMsg('Invalid authentication code. Please try again.');
            }
        } catch (err: any) {
            setIsLoading(false);
            const errDetail =
                err.response?.data?.errors?.[0]?.detail ||
                err.response?.data?.error ||
                'Two-factor authentication checkpoint failed. The code may have expired.';
            setErrorMsg(errDetail);
        }
    };

    // Handle Registration Submission
    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsLoading(true);

        try {
            await http.get('/sanctum/csrf-cookie');
            const res = await http.post('/auth/register', {
                name: regName.trim(),
                email: regEmail.trim(),
                password: regPassword,
            });

            setIsLoading(false);

            if (res.data?.success && res.data?.verificationRequired && res.data?.verificationToken) {
                setRegistrationVerificationToken(res.data.verificationToken);
                setRegistrationOtp('');
                setSuccessMsg(res.data.message || `A verification code has been sent to ${regEmail}.`);
            } else if (res.data?.success && !res.data?.verificationRequired) {
                setSuccessMsg(res.data?.message || 'Account created successfully! Logging into dashboard...');
                setTimeout(() => {
                    window.location.href = res.data?.redirect || '/';
                }, 700);
            } else {
                setErrorMsg(res.data?.error || 'Registration failed. Please try again.');
            }
        } catch (err: any) {
            setIsLoading(false);
            const errDetail =
                err.response?.data?.error ||
                err.response?.data?.message ||
                err.response?.data?.errors?.[0]?.detail ||
                'Registration failed. Please verify your details.';
            setErrorMsg(errDetail);
        }
    };

    // Handle Registration OTP Verification
    const handleRegistrationVerificationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!registrationVerificationToken) return;
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsLoading(true);

        try {
            const res = await http.post('/auth/register/verify', {
                email: regEmail.trim(),
                verificationToken: registrationVerificationToken,
                otp: registrationOtp.trim(),
            });

            setIsLoading(false);

            if (res.data?.success) {
                setSuccessMsg(`Email verified successfully for ${regEmail}! Logging into dashboard...`);
                setTimeout(() => {
                    window.location.href = res.data?.redirect || '/';
                }, 700);
            } else {
                setErrorMsg(res.data?.error || 'Invalid verification code.');
            }
        } catch (err: any) {
            setIsLoading(false);
            const errDetail =
                err.response?.data?.error ||
                err.response?.data?.message ||
                'Unable to verify email. The verification code may be invalid or expired.';
            setErrorMsg(errDetail);
        }
    };

    // Resend OTP Code
    const resendRegistrationVerification = async () => {
        if (!registrationVerificationToken) return;
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsLoading(true);

        try {
            const res = await http.post('/auth/register/resend', {
                email: regEmail.trim(),
                verificationToken: registrationVerificationToken,
            });

            setIsLoading(false);

            if (res.data?.success) {
                setRegistrationOtp('');
                setSuccessMsg(res.data.message || 'A new verification code has been sent.');
            } else {
                setErrorMsg(res.data?.error || 'Unable to resend verification code.');
            }
        } catch (err: any) {
            setIsLoading(false);
            setErrorMsg('Unable to resend verification code. Please check your connection.');
        }
    };

    // Handle Forgot Password Submission
    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setIsLoading(true);

        try {
            await http.post('/auth/password', { email: email.trim() });
            setSuccessMsg(`If an account exists for ${email}, password reset instructions have been sent.`);
        } catch {
            setSuccessMsg(`If an account exists for ${email}, password reset instructions have been sent.`);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Reset Password Submission
    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (resetPassword !== resetPasswordConfirmation) {
            setErrorMsg('The password confirmation does not match.');
            return;
        }

        setIsLoading(true);

        try {
            await http.post('/auth/password/reset', {
                token: params.token || '',
                email: resetEmail.trim() || email.trim(),
                password: resetPassword,
                password_confirmation: resetPasswordConfirmation,
            });

            setIsLoading(false);
            setSuccessMsg('Your password has been successfully reset! Redirecting to login...');
            setTimeout(() => {
                changeMode('login');
            }, 1200);
        } catch (err: any) {
            setIsLoading(false);
            const errDetail =
                err.response?.data?.error ||
                err.response?.data?.message ||
                'Unable to reset password. The reset link may have expired.';
            setErrorMsg(errDetail);
        }
    };

    return (
        <div className="min-h-screen w-full flex relative select-none font-sans bg-[#000000]">
            {/* Scoped CSS override to ensure autofill background remains sleek dark with light text */}
            <style>{`
                .votion-auth-input:-webkit-autofill,
                .votion-auth-input:-webkit-autofill:hover,
                .votion-auth-input:-webkit-autofill:focus,
                .votion-auth-input:-webkit-autofill:active,
                input.votion-auth-input:-webkit-autofill,
                input.votion-auth-input:-webkit-autofill:hover,
                input.votion-auth-input:-webkit-autofill:focus,
                input.votion-auth-input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #0c0d12 inset !important;
                    box-shadow: 0 0 0 1000px #0c0d12 inset !important;
                    -webkit-text-fill-color: #f4f4f5 !important;
                    color: #f4f4f5 !important;
                    caret-color: #f4f4f5 !important;
                    border-color: #27272a !important;
                    transition: background-color 5000s ease-in-out 0s !important;
                }

                @keyframes votionFloat {
                    0%, 100% {
                        transform: translateY(0px) translateX(0px);
                        opacity: 0.2;
                    }
                    50% {
                        transform: translateY(-20px) translateX(10px);
                        opacity: 0.65;
                    }
                }
                .votion-particle {
                    position: absolute;
                    border-radius: 9999px;
                    background: radial-gradient(circle, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 70%);
                    pointer-events: none;
                    animation: votionFloat 8s ease-in-out infinite;
                }
            `}</style>

            {/* Subtle grid background */}
            <div
                className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
                    backgroundSize: '32px 32px',
                }}
            />

            {/* ================= LEFT BLACK EDITORIAL PANEL ================= */}
            <div className="hidden lg:flex fixed inset-y-0 left-0 w-[42%] bg-[#000000] flex-col justify-between p-12 z-10 border-r border-[#141414]">
                {/* Top brand lockup */}
                <div>
                    <VotionLogo size="md" theme="dark" />
                    <div className="mt-2 text-[11px] text-[#a1a1aa] tracking-wide font-sans">ONE Platform</div>
                </div>

                {/* Middle editorial content */}
                <div className="mb-10">
                    <div className="text-[11px] text-[#ffffff]/80 tracking-wider mb-5 font-sans">Now Live</div>
                    <h1
                        className="text-[34px] leading-[1.15] text-[#ffffff] font-serif italic font-medium mb-6"
                    >
                        Automation, precision, and insight, everywhere you work
                    </h1>
                    <p className="text-[13px] leading-[1.7] text-[#ffffff]/70 max-w-[380px] mb-8 font-sans">
                        VOTION&apos;s proprietary compute platform is here. Provision game servers, orchestrate
                        high-performance containers, and monitor fleet health &mdash; all from your live VOTION cluster fabric.
                    </p>
                    <button
                        type="button"
                        onClick={() => changeMode('register')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#ffffff]/40 text-[#ffffff] text-[13px] font-medium hover:bg-[#ffffff]/10 transition-colors cursor-pointer bg-transparent font-sans"
                    >
                        Create a client account
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path
                                d="M3 7h8M7 3l4 4-4 4"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>

                {/* Bottom Card: Minimalist Architecture Showcase */}
                <div className="relative rounded-xl bg-[#0a0a0a] border border-[#27272a] p-6 overflow-hidden">
                    <div className="relative z-10 flex items-start justify-between mb-4">
                        <div>
                            <div className="text-[9px] font-mono text-[#71717a] uppercase tracking-[0.2em] mb-1.5">
                                VOTION CLUSTER ARCHITECTURE
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-widest font-mono">
                                    High-Performance Container Fabric
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Architectural Feature Strip */}
                    <div className="relative z-10 grid grid-cols-3 gap-3 pt-4 border-t border-[#27272a]">
                        <div>
                            <div className="text-[9px] font-mono text-[#71717a] uppercase tracking-wider mb-1">ISOLATION</div>
                            <div className="text-xs font-semibold font-mono text-[#e4e4e7]">Namespaces</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-mono text-[#71717a] uppercase tracking-wider mb-1">PROTECTION</div>
                            <div className="text-xs font-semibold font-mono text-[#e4e4e7]">L4/L7 Edge</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-mono text-[#71717a] uppercase tracking-wider mb-1">TELEMETRY</div>
                            <div className="text-xs font-semibold font-mono text-[#e4e4e7]">Real-time</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================= RIGHT ATMOSPHERIC DARK PANEL ================= */}
            <div className="min-h-screen w-full lg:w-[58%] lg:ml-auto flex flex-col justify-between py-12 px-6 sm:px-12 relative z-20 font-sans bg-[#050508] text-[#f4f4f5] overflow-hidden">
                {/* Atmospheric Horizon Glow */}
                <div
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                        background: 'radial-gradient(ellipse 90% 60% at 50% 100%, rgba(16, 185, 129, 0.06), rgba(24, 24, 27, 0.4) 60%, transparent 80%)',
                    }}
                />

                {/* Subtle Horizon Line */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent pointer-events-none z-0" />

                {/* Soft Drifting Particles */}
                <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                    <div className="votion-particle w-1.5 h-1.5 top-[16%] left-[18%]" style={{ animationDelay: '0s', animationDuration: '8s' }} />
                    <div className="votion-particle w-1 h-1 top-[30%] left-[78%]" style={{ animationDelay: '1.8s', animationDuration: '9.5s' }} />
                    <div className="votion-particle w-2 h-2 top-[48%] left-[10%]" style={{ animationDelay: '3.2s', animationDuration: '11s' }} />
                    <div className="votion-particle w-1 h-1 top-[62%] left-[84%]" style={{ animationDelay: '2.1s', animationDuration: '7.5s' }} />
                    <div className="votion-particle w-1.5 h-1.5 top-[76%] left-[28%]" style={{ animationDelay: '4.7s', animationDuration: '10s' }} />
                    <div className="votion-particle w-1 h-1 top-[86%] left-[62%]" style={{ animationDelay: '0.9s', animationDuration: '8.5s' }} />
                </div>

                {/* Mobile brand (only visible on small screens) */}
                <div className="lg:hidden flex items-center gap-2 mb-8 relative z-10">
                    <VotionLogo size="sm" theme="dark" />
                    <span className="text-[11px] text-[#a1a1aa] tracking-wide font-sans">ONE Platform</span>
                </div>

                {/* Centered form column */}
                <div className="w-full max-w-[390px] mx-auto mt-6 lg:mt-12 mb-auto relative z-10">
                    {/* Wordmark matching left panel */}
                    <div className="flex flex-col items-center justify-center text-center mb-8">
                        <VotionLogo size="md" theme="dark" />
                        <span className="mt-2 text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">ONE Platform</span>
                    </div>

                    {/* Error / success banners */}
                    {errorMsg && (
                        <div
                            role="alert"
                            aria-live="assertive"
                            className="mb-5 px-4 py-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-medium leading-relaxed font-sans"
                        >
                            {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="mb-5 px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium leading-relaxed font-sans"
                        >
                            {successMsg}
                        </div>
                    )}

                    {/* LOGIN MODE */}
                    {authMode === 'login' && (
                        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5 font-sans">
                            <div>
                                <label
                                    htmlFor="votion-email"
                                    className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans"
                                >
                                    Email
                                </label>
                                <input
                                    id="votion-email"
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email address"
                                    autoComplete="email"
                                    aria-required="true"
                                    aria-invalid={Boolean(errorMsg)}
                                    className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                    required
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label
                                        htmlFor="votion-password"
                                        className="block text-xs font-medium text-zinc-300 font-sans"
                                    >
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => changeMode('forgot-password')}
                                        className="text-xs text-zinc-400 hover:text-white transition-colors duration-150 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <input
                                    id="votion-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    autoComplete="current-password"
                                    aria-required="true"
                                    aria-invalid={Boolean(errorMsg)}
                                    className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                    required
                                />
                            </div>

                            {/* Terms line */}
                            <p className="text-[11px] leading-relaxed text-zinc-500 font-sans -mt-1">
                                By clicking the Log in button, you agree to VOTION&apos;s Terms of Service and Privacy Policy.
                            </p>

                            {/* Primary Log In CTA */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 min-h-[44px] rounded-full text-sm font-semibold tracking-wide bg-[#ffffff] text-[#000000] hover:bg-[#e4e4e7] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans shadow-sm"
                            >
                                {isLoading && (
                                    <PulseLoader size="small" />
                                )}
                                Log in
                            </button>

                            {/* Genuine Alternate Sign-In Method: Passkey */}
                            <div className="relative flex items-center justify-center my-0.5">
                                <div className="border-t border-[#27272a] w-full" />
                                <span className="px-3 text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-[#050508]">
                                    or
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handlePasskeyLogin}
                                disabled={isLoading}
                                className="w-full py-2.5 px-4 rounded-full border border-[#27272a] bg-[#121215] hover:bg-[#1c1c21] hover:border-[#3f3f46] text-[#f4f4f5] hover:text-white text-sm font-medium tracking-wide active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer font-sans"
                            >
                                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Sign in with Passkey
                            </button>

                            {/* Consolidated Secondary Action & Utilities Row */}
                            <div className="mt-4 pt-5 border-t border-[#1f2026] flex flex-col items-center gap-3">
                                <div className="text-xs text-zinc-400 font-sans">
                                    Don&apos;t have a client account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => changeMode('register')}
                                        className="text-white hover:text-zinc-200 font-medium underline underline-offset-4 cursor-pointer bg-transparent border-none p-0 transition-colors"
                                    >
                                        Create client account &rarr;
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-zinc-500 font-sans">
                                    <button
                                        type="button"
                                        onClick={() => changeMode('forgot-password')}
                                        className="text-zinc-400 hover:text-white transition-colors duration-150 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    >
                                        Account recovery
                                    </button>
                                    <span className="text-zinc-700">&bull;</span>
                                    <button
                                        type="button"
                                        onClick={() => changeMode('forgot-password')}
                                        className="text-zinc-400 hover:text-white transition-colors duration-150 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    >
                                        Help
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* REGISTER MODE */}
                    {authMode === 'register' && (
                        <>
                            <div className="mb-6 font-sans">
                                <h2 className="text-[26px] leading-tight mb-1 font-medium font-serif text-white">
                                    {registrationVerificationToken ? 'Verify your email' : 'Create client account'}
                                </h2>
                                <p className="text-xs font-sans text-zinc-400">
                                    {registrationVerificationToken
                                        ? `Enter the six-digit code sent to ${regEmail}.`
                                        : 'Register a new client on Votion Cloud.'}
                                </p>
                            </div>

                            {registrationVerificationToken ? (
                                <form onSubmit={handleRegistrationVerificationSubmit} className="flex flex-col gap-5 font-sans">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans">
                                            Verification code
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={registrationOtp}
                                            onChange={(e) => setRegistrationOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000000"
                                            className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] outline-none text-base tracking-[0.32em] text-center font-mono font-bold placeholder:text-zinc-600 focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                            required
                                            minLength={6}
                                            maxLength={6}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading || registrationOtp.length !== 6}
                                        className="w-full py-3 min-h-[44px] rounded-full text-sm font-semibold tracking-wide bg-[#ffffff] text-[#000000] hover:bg-[#e4e4e7] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans shadow-sm"
                                    >
                                        {isLoading && (
                                            <PulseLoader size="small" />
                                        )}
                                        Verify and create account
                                    </button>
                                    <div className="flex items-center justify-center gap-3 text-xs font-sans text-zinc-400">
                                        <button
                                            type="button"
                                            disabled={isLoading}
                                            onClick={() => void resendRegistrationVerification()}
                                            className="text-zinc-400 hover:text-white transition-colors duration-150 disabled:opacity-50 bg-transparent border-none cursor-pointer p-0 font-sans"
                                        >
                                            Resend code
                                        </button>
                                        <span className="text-zinc-700">&bull;</span>
                                        <button
                                            type="button"
                                            disabled={isLoading}
                                            onClick={() => {
                                                setRegistrationVerificationToken(null);
                                                setRegistrationOtp('');
                                                setErrorMsg(null);
                                                setSuccessMsg(null);
                                            }}
                                            className="text-zinc-400 hover:text-white transition-colors duration-150 disabled:opacity-50 bg-transparent border-none cursor-pointer p-0 font-sans"
                                        >
                                            Change details
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5 font-sans">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={regName}
                                            onChange={(e) => setRegName(e.target.value)}
                                            placeholder="Jane Doe"
                                            autoComplete="name"
                                            className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans">
                                            Work Email
                                        </label>
                                        <input
                                            type="email"
                                            value={regEmail}
                                            onChange={(e) => setRegEmail(e.target.value)}
                                            placeholder="jane@company.com"
                                            autoComplete="email"
                                            className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans">
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            value={regPassword}
                                            onChange={(e) => setRegPassword(e.target.value)}
                                            placeholder="Minimum 8 characters"
                                            autoComplete="new-password"
                                            className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                            required
                                            minLength={8}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full py-3 min-h-[44px] rounded-full text-sm font-semibold tracking-wide bg-[#ffffff] text-[#000000] hover:bg-[#e4e4e7] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans shadow-sm"
                                    >
                                        {isLoading && <PulseLoader size="small" />}
                                        Create account
                                    </button>
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-sans mt-1">
                                        Already have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => changeMode('login')}
                                            className="text-white hover:text-zinc-200 font-medium underline underline-offset-4 cursor-pointer bg-transparent border-none p-0 transition-colors"
                                        >
                                            Log in
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}

                    {/* FORGOT PASSWORD MODE */}
                    {authMode === 'forgot-password' && (
                        <div className="flex flex-col">
                            <div className="mb-6 font-sans">
                                <h2 className="text-[26px] leading-tight mb-1 font-medium font-serif text-white">
                                    Reset your password
                                </h2>
                                <p className="text-xs font-sans text-zinc-400">
                                    Enter your email to receive password reset instructions.
                                </p>
                            </div>

                            <form onSubmit={handleForgotSubmit} className="flex flex-col gap-5 font-sans">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email address"
                                        className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 min-h-[44px] rounded-full text-sm font-semibold tracking-wide bg-[#ffffff] text-[#000000] hover:bg-[#e4e4e7] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans shadow-sm"
                                >
                                    {isLoading && <PulseLoader size="small" />}
                                    Send Reset Link
                                </button>
                                <div className="flex items-center justify-center text-xs font-sans mt-2">
                                    <button
                                        type="button"
                                        onClick={() => changeMode('login')}
                                        className="text-zinc-400 hover:text-white transition-colors duration-150 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    >
                                        &larr; Back to Log in
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* RESET PASSWORD MODE */}
                    {authMode === 'reset-password' && (
                        <div className="flex flex-col">
                            <div className="mb-6 font-sans">
                                <h2 className="text-[26px] leading-tight mb-1 font-medium font-serif text-white">
                                    Set a new password
                                </h2>
                                <p className="text-xs font-sans text-zinc-400">
                                    Choose a new password for your account.
                                </p>
                            </div>

                            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-5 font-sans">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        placeholder="Confirm your email"
                                        className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans">
                                        New password
                                    </label>
                                    <input
                                        type="password"
                                        value={resetPassword}
                                        onChange={(e) => setResetPassword(e.target.value)}
                                        autoComplete="new-password"
                                        placeholder="Minimum 8 characters"
                                        className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-sans">
                                        Confirm new password
                                    </label>
                                    <input
                                        type="password"
                                        value={resetPasswordConfirmation}
                                        onChange={(e) => setResetPasswordConfirmation(e.target.value)}
                                        autoComplete="new-password"
                                        placeholder="Re-enter password"
                                        className="votion-auth-input w-full px-3.5 py-2.5 rounded-lg border border-[#27272a] bg-[#0c0d12] text-[#f4f4f5] placeholder:text-zinc-600 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 min-h-[44px] rounded-full text-sm font-semibold tracking-wide bg-[#ffffff] text-[#000000] hover:bg-[#e4e4e7] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans shadow-sm"
                                >
                                    {isLoading && <PulseLoader size="small" />}
                                    Reset password
                                </button>
                                <div className="flex items-center justify-center text-xs font-sans mt-2">
                                    <button
                                        type="button"
                                        onClick={() => changeMode('login')}
                                        className="text-zinc-400 hover:text-white transition-colors duration-150 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    >
                                        &larr; Back to Log in
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* 2FA MODE */}
                    {authMode === '2fa' && (
                        <div className="flex flex-col flex-1 font-sans">
                            <div className="mb-8 font-sans">
                                <h2 className="text-[24px] font-semibold text-white mb-2 font-sans">
                                    Two-Factor Authentication
                                </h2>
                                <p className="text-[14px] text-zinc-400 font-sans">
                                    Enter the 6-digit code from your authenticator app.
                                </p>
                            </div>
                            <form onSubmit={handle2FASubmit} className="flex flex-col gap-6 font-sans">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-sans">
                                        Authenticator Code
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        required
                                        value={totpCode}
                                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                        className="votion-auth-input w-full px-4 py-3 rounded-lg border border-[#27272a] bg-[#0c0d12] text-white text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-zinc-400 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                        placeholder="123456"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading || totpCode.length < 6}
                                    className="w-full py-3 min-h-[44px] rounded-full text-sm font-semibold tracking-wide bg-[#ffffff] text-[#000000] hover:bg-[#e4e4e7] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans shadow-sm"
                                >
                                    {isLoading ? 'Verifying...' : 'Verify Code'}
                                </button>
                                <div className="text-center mt-2">
                                    <button
                                        type="button"
                                        onClick={() => changeMode('login')}
                                        className="text-xs text-zinc-400 hover:text-white transition-colors duration-150 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    >
                                        &larr; Back to Login
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Footer links */}
                <div className="w-full max-w-[390px] mx-auto mt-12 flex items-center justify-between text-[11px] text-zinc-500 font-sans relative z-10">
                    <div>&copy; 2026 Votion One&trade; Platform</div>
                    <button
                        type="button"
                        className="text-zinc-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0 font-sans"
                    >
                        View latest updates
                    </button>
                </div>
            </div>

            {/* Optional Passkey Setup Prompt Modal */}
            {showPasskeyPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-[420px] bg-[#0a0a0d] rounded-2xl shadow-2xl p-6 sm:p-8 border border-[#27272a] text-center font-sans text-white">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#121215] border border-[#27272a] flex items-center justify-center text-zinc-200">
                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 font-serif">
                            Set up a Passkey
                        </h3>

                        <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-sans">
                            Sign in faster and more securely next time using Touch ID, Face ID, Windows Hello, or your security key. No password required.
                        </p>

                        {passkeyError && (
                            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-sans">
                                {passkeyError}
                            </div>
                        )}

                        <div className="flex flex-col gap-2.5">
                            <button
                                type="button"
                                onClick={handleEnrollPasskeyNow}
                                disabled={passkeyLoading}
                                className="w-full py-3 rounded-full text-sm font-semibold tracking-wide bg-[#ffffff] text-[#000000] hover:bg-[#e4e4e7] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none shadow-sm font-sans"
                            >
                                {passkeyLoading && <PulseLoader size="small" />}
                                {passkeyLoading ? 'Waiting for biometric scan...' : 'Create Passkey Now'}
                            </button>

                            <button
                                type="button"
                                onClick={handleSkipPasskey}
                                disabled={passkeyLoading}
                                className="w-full py-2.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer border-none bg-transparent font-sans"
                            >
                                Skip for now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VotionAuthPages;
