import React, { useState, useEffect } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import http from '@/api/http';

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
                setSuccessMsg('Authentication confirmed. Redirecting...');
                window.location.href = res.data?.data?.intended || '/';
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
                setSuccessMsg('Code verified. Opening panel...');
                window.location.href = res.data?.data?.intended || '/';
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
            {/* Scoped CSS override to ensure autofill background remains crisp white with dark text */}
            <style>{`
                .votion-auth-input:-webkit-autofill,
                .votion-auth-input:-webkit-autofill:hover,
                .votion-auth-input:-webkit-autofill:focus,
                .votion-auth-input:-webkit-autofill:active,
                input.votion-auth-input:-webkit-autofill,
                input.votion-auth-input:-webkit-autofill:hover,
                input.votion-auth-input:-webkit-autofill:focus,
                input.votion-auth-input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
                    box-shadow: 0 0 0 1000px #ffffff inset !important;
                    -webkit-text-fill-color: #1a1a1a !important;
                    color: #1a1a1a !important;
                    caret-color: #1a1a1a !important;
                    border-color: #111111 !important;
                    transition: background-color 5000s ease-in-out 0s !important;
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
                    <div className="text-[#ffffff] text-lg font-bold lowercase tracking-tight font-mono">votion</div>
                    <div className="mt-1 text-[11px] text-[#a1a1aa] tracking-wide font-sans">ONE Platform</div>
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

                {/* Bottom Card: Minimalist Architecture Showcase (No node IPs/telemetry) */}
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

            {/* ================= RIGHT WHITE LOGIN PANEL (1:1 Votion Authentic) ================= */}
            <div
                className="min-h-screen w-full lg:w-[58%] lg:ml-auto flex flex-col justify-between py-12 px-6 sm:px-12 relative z-20 font-sans"
                style={{ backgroundColor: '#ffffff', color: '#111111' }}
            >
                {/* Mobile brand (only visible on small screens) */}
                <div className="lg:hidden flex items-center gap-2 mb-8">
                    <div className="text-lg font-bold lowercase tracking-tight font-mono text-[#111111]">votion</div>
                    <span className="text-[11px] text-[#656b6b] tracking-wide font-sans">ONE Platform</span>
                </div>

                {/* Centered form column */}
                <div className="w-full max-w-[380px] mx-auto mt-8 lg:mt-16 mb-auto">
                    {/* Wordmark */}
                    <div className="text-center mb-10">
                        <div
                            className="inline-block border border-[#111111] px-4 py-1.5 rounded text-xl font-bold lowercase tracking-tight font-mono"
                            style={{ color: '#111111', borderColor: '#111111', backgroundColor: '#ffffff' }}
                        >
                            votion
                        </div>
                    </div>

                    {/* Error / success banners */}
                    {errorMsg && (
                        <div
                            role="alert"
                            aria-live="assertive"
                            className="mb-5 px-4 py-3 border text-xs rounded-lg font-medium leading-relaxed font-sans"
                            style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}
                        >
                            {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="mb-5 px-4 py-3 border text-xs rounded-lg font-medium leading-relaxed font-sans"
                            style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}
                        >
                            {successMsg}
                        </div>
                    )}

                    {/* LOGIN MODE */}
                    {authMode === 'login' && (
                        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-6 font-sans">
                            <div>
                                <label
                                    htmlFor="votion-email"
                                    className="block text-sm font-medium mb-1.5 font-sans"
                                    style={{ color: '#1a1a1a' }}
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
                                    className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                    style={{
                                        backgroundColor: '#ffffff',
                                        color: '#1a1a1a',
                                        borderColor: '#111111',
                                    }}
                                    required
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label
                                        htmlFor="votion-password"
                                        className="block text-sm font-medium font-sans"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => changeMode('forgot-password')}
                                        className="text-xs underline underline-offset-2 hover:opacity-70 bg-transparent border-none cursor-pointer p-0 font-sans"
                                        style={{ color: '#1a1a1a' }}
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
                                    className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                    style={{
                                        backgroundColor: '#ffffff',
                                        color: '#1a1a1a',
                                        borderColor: '#111111',
                                    }}
                                    required
                                />
                            </div>

                            {/* Terms line */}
                            <p
                                className="text-[11px] leading-relaxed -mt-1 font-sans"
                                style={{ color: '#656b6b' }}
                            >
                                By clicking the Log in button, you agree to VOTION&apos;s Terms of Service and Privacy Policy.
                            </p>

                            {/* Black pill Log in button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 min-h-[44px] rounded-full text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans"
                                style={{ backgroundColor: '#000000', color: '#ffffff' }}
                            >
                                {isLoading && (
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                                )}
                                Log in
                            </button>

                            {/* Divider */}
                            <div className="relative flex items-center justify-center my-0.5">
                                <div className="border-t w-full" style={{ borderColor: '#e5e5e5' }} />
                                <span
                                    className="px-3 text-[11px] font-medium uppercase tracking-wider font-sans"
                                    style={{ backgroundColor: '#ffffff', color: '#8a8a8a' }}
                                >
                                    or
                                </span>
                            </div>

                            {/* Create client account button */}
                            <button
                                type="button"
                                onClick={() => changeMode('register')}
                                className="w-full py-2.5 px-4 rounded-full border text-sm font-semibold tracking-wide hover:bg-[#f4f4f5] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer font-sans"
                                style={{ backgroundColor: '#ffffff', color: '#111111', borderColor: '#111111' }}
                            >
                                Create client account
                            </button>

                            {/* Link row with dividers, Carta-style */}
                            <div
                                className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-sans"
                                style={{ color: '#656b6b' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => changeMode('forgot-password')}
                                    className="underline underline-offset-2 hover:opacity-70 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    style={{ color: '#1a1a1a' }}
                                >
                                    Account recovery
                                </button>
                                <span style={{ color: '#d4d4d4' }}>|</span>
                                <button
                                    type="button"
                                    onClick={() => changeMode('register')}
                                    className="underline underline-offset-2 hover:opacity-70 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    style={{ color: '#1a1a1a' }}
                                >
                                    Create client account
                                </button>
                                <span style={{ color: '#d4d4d4' }}>|</span>
                                <button
                                    type="button"
                                    onClick={() => changeMode('forgot-password')}
                                    className="hover:opacity-70 bg-transparent border-none cursor-pointer p-0 font-sans"
                                    style={{ color: '#656b6b' }}
                                >
                                    Help
                                </button>
                            </div>
                        </form>
                    )}

                    {/* REGISTER MODE */}
                    {authMode === 'register' && (
                        <>
                            <div className="mb-6 font-sans">
                                <h2
                                    className="text-[26px] leading-tight mb-1 font-medium font-serif"
                                    style={{ color: '#1a1a1a' }}
                                >
                                    {registrationVerificationToken ? 'Verify your email' : 'Create client account'}
                                </h2>
                                <p className="text-xs font-sans" style={{ color: '#656b6b' }}>
                                    {registrationVerificationToken
                                        ? `Enter the six-digit code sent to ${regEmail}.`
                                        : 'Register a new client on Votion Cloud.'}
                                </p>
                            </div>

                            {registrationVerificationToken ? (
                                <form onSubmit={handleRegistrationVerificationSubmit} className="flex flex-col gap-5 font-sans">
                                    <div>
                                        <label
                                            className="block text-sm font-medium mb-1.5 font-sans"
                                            style={{ color: '#1a1a1a' }}
                                        >
                                            Verification code
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={registrationOtp}
                                            onChange={(e) => setRegistrationOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000000"
                                            className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-base tracking-[0.32em] text-center font-mono font-bold placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                                            style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#111111' }}
                                            required
                                            minLength={6}
                                            maxLength={6}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading || registrationOtp.length !== 6}
                                        className="w-full py-3 rounded-full text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans"
                                        style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                    >
                                        {isLoading && (
                                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        )}
                                        Verify and create account
                                    </button>
                                    <div
                                        className="flex items-center justify-center gap-3 text-xs font-sans"
                                        style={{ color: '#656b6b' }}
                                    >
                                        <button
                                            type="button"
                                            disabled={isLoading}
                                            onClick={() => void resendRegistrationVerification()}
                                            className="underline underline-offset-2 hover:opacity-70 disabled:opacity-50 bg-transparent border-none cursor-pointer p-0 font-sans"
                                            style={{ color: '#1a1a1a' }}
                                        >
                                            Resend code
                                        </button>
                                        <span style={{ color: '#d4d4d4' }}>&bull;</span>
                                        <button
                                            type="button"
                                            disabled={isLoading}
                                            onClick={() => {
                                                setRegistrationVerificationToken(null);
                                                setRegistrationOtp('');
                                                setErrorMsg(null);
                                                setSuccessMsg(null);
                                            }}
                                            className="underline underline-offset-2 hover:opacity-70 disabled:opacity-50 bg-transparent border-none cursor-pointer p-0 font-sans"
                                            style={{ color: '#1a1a1a' }}
                                        >
                                            Change details
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5 font-sans">
                                    <div>
                                        <label
                                            className="block text-sm font-medium mb-1.5 font-sans"
                                            style={{ color: '#1a1a1a' }}
                                        >
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={regName}
                                            onChange={(e) => setRegName(e.target.value)}
                                            placeholder="Jane Doe"
                                            autoComplete="name"
                                            className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                            style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#111111' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label
                                            className="block text-sm font-medium mb-1.5 font-sans"
                                            style={{ color: '#1a1a1a' }}
                                        >
                                            Work Email
                                        </label>
                                        <input
                                            type="email"
                                            value={regEmail}
                                            onChange={(e) => setRegEmail(e.target.value)}
                                            placeholder="jane@company.com"
                                            autoComplete="email"
                                            className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                            style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#111111' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label
                                            className="block text-sm font-medium mb-1.5 font-sans"
                                            style={{ color: '#1a1a1a' }}
                                        >
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            value={regPassword}
                                            onChange={(e) => setRegPassword(e.target.value)}
                                            placeholder="Minimum 8 characters"
                                            autoComplete="new-password"
                                            className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                            style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#111111' }}
                                            required
                                            minLength={8}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full py-3 rounded-full text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans"
                                        style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                    >
                                        {isLoading && (
                                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        )}
                                        Create account
                                    </button>
                                    <div
                                        className="flex items-center justify-center gap-2 text-xs font-sans"
                                        style={{ color: '#656b6b' }}
                                    >
                                        Already have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => changeMode('login')}
                                            className="underline underline-offset-2 hover:opacity-70 bg-transparent border-none cursor-pointer p-0 font-sans"
                                            style={{ color: '#1a1a1a' }}
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
                                <h2
                                    className="text-[26px] leading-tight mb-1 font-medium font-serif"
                                    style={{ color: '#1a1a1a' }}
                                >
                                    Reset your password
                                </h2>
                                <p className="text-xs font-sans" style={{ color: '#656b6b' }}>
                                    Enter your email to receive password reset instructions.
                                </p>
                            </div>

                            <form onSubmit={handleForgotSubmit} className="flex flex-col gap-5 font-sans">
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-1.5 font-sans"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email address"
                                        className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                        style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#111111' }}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 rounded-full text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans"
                                    style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                >
                                    {isLoading && (
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    )}
                                    Send Reset Link
                                </button>
                                <div
                                    className="flex items-center justify-center text-xs font-sans mt-2"
                                    style={{ color: '#656b6b' }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => changeMode('login')}
                                        className="underline underline-offset-2 hover:opacity-70 bg-transparent border-none cursor-pointer p-0 font-sans"
                                        style={{ color: '#1a1a1a' }}
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
                                <h2
                                    className="text-[26px] leading-tight mb-1 font-medium font-serif"
                                    style={{ color: '#1a1a1a' }}
                                >
                                    Set a new password
                                </h2>
                                <p className="text-xs font-sans" style={{ color: '#656b6b' }}>
                                    Choose a new password for your account.
                                </p>
                            </div>

                            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-5 font-sans">
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-1.5 font-sans"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        placeholder="Confirm your email"
                                        className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                        style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#111111' }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-1.5 font-sans"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        New password
                                    </label>
                                    <input
                                        type="password"
                                        value={resetPassword}
                                        onChange={(e) => setResetPassword(e.target.value)}
                                        autoComplete="new-password"
                                        placeholder="Minimum 8 characters"
                                        className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                        style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#111111' }}
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-1.5 font-sans"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        Confirm new password
                                    </label>
                                    <input
                                        type="password"
                                        value={resetPasswordConfirmation}
                                        onChange={(e) => setResetPasswordConfirmation(e.target.value)}
                                        autoComplete="new-password"
                                        placeholder="Re-enter password"
                                        className="votion-auth-input w-full px-3 py-2.5 border rounded-md outline-none text-sm placeholder:text-[#9a9a9a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow font-sans"
                                        style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#111111' }}
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 rounded-full text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border-none font-sans"
                                    style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                >
                                    {isLoading && (
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    )}
                                    Reset password
                                </button>
                                <div
                                    className="flex items-center justify-center text-xs font-sans mt-2"
                                    style={{ color: '#656b6b' }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => changeMode('login')}
                                        className="underline underline-offset-2 hover:opacity-70 bg-transparent border-none cursor-pointer p-0 font-sans"
                                        style={{ color: '#1a1a1a' }}
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
                                <h2
                                    className="text-[24px] font-semibold mb-2 font-sans"
                                    style={{ color: '#1a1a1a' }}
                                >
                                    Two-Factor Authentication
                                </h2>
                                <p className="text-[15px] font-sans" style={{ color: '#656b6c' }}>
                                    Enter the 6-digit code from your authenticator app.
                                </p>
                            </div>
                            <form onSubmit={handle2FASubmit} className="flex flex-col gap-6 font-sans">
                                <div className="flex flex-col gap-2">
                                    <label
                                        className="text-[13px] font-semibold uppercase tracking-wide font-sans"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        Authenticator Code
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        required
                                        value={totpCode}
                                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                        className="votion-auth-input border rounded-md px-4 py-3 text-[15px] outline-none focus:border-[#1a1a1a] transition-colors font-sans"
                                        style={{ backgroundColor: '#ffffff', color: '#1a1a1a', borderColor: '#dedfdf' }}
                                        placeholder="123456"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading || totpCode.length < 6}
                                    className="font-semibold py-3.5 px-4 rounded-md hover:bg-[#333] transition-colors mt-2 disabled:opacity-70 cursor-pointer border-none font-sans"
                                    style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}
                                >
                                    {isLoading ? 'Verifying...' : 'Verify Code'}
                                </button>
                                <div className="text-center mt-2">
                                    <button
                                        type="button"
                                        onClick={() => changeMode('login')}
                                        className="text-[14px] hover:text-[#1a1a1a] underline underline-offset-2 bg-transparent border-none cursor-pointer font-sans"
                                        style={{ color: '#656b6c' }}
                                    >
                                        Back to Login
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Footer links, Carta-style */}
                <div
                    className="w-full max-w-[380px] mx-auto mt-12 flex items-center justify-between text-[11px] font-sans"
                    style={{ color: '#656b6b' }}
                >
                    <div>&copy; 2026 Votion One&trade; Platform</div>
                    <button
                        type="button"
                        className="hover:opacity-70 underline underline-offset-2 bg-transparent border-none cursor-pointer p-0 font-sans"
                        style={{ color: '#656b6b' }}
                    >
                        View latest updates
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VotionAuthPages;
