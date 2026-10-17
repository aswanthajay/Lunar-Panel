import React, { useState, useEffect } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import http from '@/api/http';
import { authenticateWithPasskey, enrollPasskey, isPasskeySupported } from '@/api/account/webauthn';

interface Props {
    initialMode?: 'login' | 'register' | 'forgot-password' | 'reset-password' | '2fa';
}

/**
 * Swiss 8-Ray Astral Starburst with drafting crosshairs (Golden Suisse Style)
 */
const ReticleStar: React.FC = () => (
    <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center select-none pointer-events-none">
        {/* Subtle Drafting Hairlines */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-[1px] bg-neutral-900/90" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-full w-[1px] bg-neutral-900/90" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center rotate-45">
            <div className="w-[141%] h-[1px] bg-neutral-900/80" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center -rotate-45">
            <div className="w-[141%] h-[1px] bg-neutral-900/80" />
        </div>

        {/* 8 Thick White Radiating Rays */}
        <svg viewBox="0 0 200 200" className="w-32 h-32 sm:w-40 sm:h-40 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* North */}
            <line x1="100" y1="84" x2="100" y2="24" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="square" />
            {/* South */}
            <line x1="100" y1="116" x2="100" y2="176" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="square" />
            {/* West */}
            <line x1="84" y1="100" x2="24" y2="100" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="square" />
            {/* East */}
            <line x1="116" y1="100" x2="176" y2="100" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="square" />

            {/* NW */}
            <line x1="88" y1="88" x2="46" y2="46" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="square" />
            {/* NE */}
            <line x1="112" y1="88" x2="154" y2="46" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="square" />
            {/* SW */}
            <line x1="88" y1="112" x2="46" y2="154" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="square" />
            {/* SE */}
            <line x1="112" y1="112" x2="154" y2="154" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="square" />
        </svg>
    </div>
);

export const VotionAuthPages: React.FC<Props> = ({ initialMode = 'login' }) => {
    const history = useHistory();
    const location = useLocation();
    const params = useParams<{ token?: string }>();

    // Retrieve panel company name from store or fallback
    const panelName = useStoreState((state: ApplicationStore) => state.settings.data?.name) || 'Lunar Cloud';

    const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password' | 'reset-password' | '2fa'>(() => {
        if (location.pathname.includes('/register')) return 'register';
        if (location.pathname.includes('/password/reset')) return 'reset-password';
        if (location.pathname.includes('/password')) return 'forgot-password';
        if (location.pathname.includes('/checkpoint')) return '2fa';
        return initialMode;
    });

    // Form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [tempToken, setTempToken] = useState('');
    const [totpCode, setTotpCode] = useState('');

    // Register Form Inputs
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regPasswordConfirmation, setRegPasswordConfirmation] = useState('');
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

    // Enforce pure matte black background and dismiss any preloader
    useEffect(() => {
        document.body.style.backgroundColor = '#000000';
        document.body.style.color = '#ffffff';
        document.body.style.overflowY = 'auto';

        const p = document.getElementById('votion-global-preloader');
        if (p) {
            p.style.display = 'none';
            if (p.parentNode) p.parentNode.removeChild(p);
        }

        return () => {
            document.body.style.backgroundColor = '';
            document.body.style.color = '';
        };
    }, []);

    useEffect(() => {
        if (location.pathname.includes('/register')) {
            setAuthMode('register');
        } else if (location.pathname.includes('/password/reset')) {
            setAuthMode('reset-password');
        } else if (location.pathname.includes('/password')) {
            setAuthMode('forgot-password');
        } else if (location.pathname.includes('/checkpoint')) {
            setAuthMode('2fa');
        } else {
            setAuthMode('login');
        }
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
            window.location.href = targetUrl;
        }
    };

    const handleEnrollPasskeyNow = async () => {
        setPasskeyLoading(true);
        setPasskeyError(null);
        try {
            const name = prompt('Name this Passkey (e.g. My Workstation):', 'Workstation Passkey') || 'My Passkey';
            await enrollPasskey(name);
            window.location.href = pendingRedirectUrl;
        } catch (err: any) {
            setPasskeyError(err.message || 'Passkey enrollment failed.');
            setPasskeyLoading(false);
        }
    };

    const handlePasskeyLogin = async () => {
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!isPasskeySupported()) {
            window.location.href = '/auth/sso/apple';
            return;
        }

        setIsLoading(true);
        try {
            const result = await authenticateWithPasskey(email.trim() || undefined);
            if (result.complete) {
                handleAuthSuccess(result.intended, false);
            } else {
                setErrorMsg('Passkey authentication failed.');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Passkey authentication failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!email.trim()) {
            setErrorMsg('Please enter your email or username.');
            return;
        }
        if (!password) {
            setErrorMsg('Please enter your password.');
            return;
        }

        setIsLoading(true);

        try {
            await http.get('/sanctum/csrf-cookie');
            const res = await http.post('/auth/login', {
                user: email.trim(),
                password: password,
            });

            if (res.data?.data?.complete) {
                handleAuthSuccess(res.data.data.intended, res.data.data.prompt_passkey);
            } else if (res.data?.data?.use_totp || res.data?.data?.use_checkpoint) {
                setTempToken(res.data.data.token || '');
                setAuthMode('2fa');
            } else {
                handleAuthSuccess('/', false);
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.errors?.[0]?.detail ||
                err.response?.data?.error ||
                err.response?.data?.message ||
                'Authentication failed. Please check your credentials.';
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setIsLoading(true);

        try {
            const res = await http.post('/auth/login/checkpoint', {
                code: totpCode.trim(),
                token: tempToken,
            });

            if (res.data?.data?.complete) {
                handleAuthSuccess(res.data.data.intended, res.data.data.prompt_passkey);
            } else {
                handleAuthSuccess('/', false);
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.errors?.[0]?.detail ||
                err.response?.data?.error ||
                'Invalid authenticator code. Please try again.';
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (regPassword !== regPasswordConfirmation) {
            setErrorMsg('The password confirmation does not match.');
            return;
        }

        setIsLoading(true);

        try {
            await http.get('/sanctum/csrf-cookie');
            const res = await http.post('/auth/register', {
                name: regName.trim(),
                email: regEmail.trim(),
                password: regPassword,
                password_confirmation: regPasswordConfirmation,
            });

            if (res.data?.requires_verification) {
                setRegistrationVerificationToken(res.data.verification_token);
                setSuccessMsg('A 6-digit verification code has been sent to your email.');
            } else if (res.data?.data?.complete) {
                handleAuthSuccess(res.data.data.intended, false);
            } else {
                setSuccessMsg('Account created successfully! You may now log in.');
                setTimeout(() => changeMode('login'), 1500);
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.errors?.[0]?.detail ||
                err.response?.data?.message ||
                'Registration failed. Please check your details.';
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegistrationVerificationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsLoading(true);

        try {
            const res = await http.post('/auth/register/verify', {
                verification_token: registrationVerificationToken,
                code: registrationOtp.trim(),
            });

            if (res.data?.data?.complete) {
                handleAuthSuccess(res.data.data.intended, res.data.data.prompt_passkey);
            } else {
                setSuccessMsg('Email verified successfully! You may now log in.');
                setTimeout(() => changeMode('login'), 1500);
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.errors?.[0]?.detail ||
                err.response?.data?.error ||
                'Invalid verification code. Please check and try again.';
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendRegistrationOtp = async () => {
        if (!registrationVerificationToken) return;
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            await http.post('/auth/register/resend', {
                verification_token: registrationVerificationToken,
            });
            setSuccessMsg('A new verification code has been sent to your email.');
        } catch (err: any) {
            setErrorMsg('Failed to resend verification code.');
        }
    };

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsLoading(true);

        try {
            await http.get('/sanctum/csrf-cookie');
            await http.post('/auth/password', {
                email: resetEmail.trim(),
            });
            setSuccessMsg('If an account matching that email exists, password reset instructions have been sent.');
        } catch (err: any) {
            const msg =
                err.response?.data?.errors?.[0]?.detail ||
                err.response?.data?.message ||
                'Unable to process password reset request.';
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

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
            await http.get('/sanctum/csrf-cookie');
            await http.post('/auth/password/reset', {
                token: params.token || '',
                email: resetEmail.trim(),
                password: resetPassword,
                password_confirmation: resetPasswordConfirmation,
            });
            setSuccessMsg('Your password has been successfully reset. Redirecting to login...');
            setTimeout(() => changeMode('login'), 2000);
        } catch (err: any) {
            const msg =
                err.response?.data?.errors?.[0]?.detail ||
                err.response?.data?.message ||
                'Unable to reset password. The link may have expired.';
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen flex flex-col lg:flex-row bg-[#000000] text-white font-sans select-none overflow-x-hidden selection:bg-white selection:text-black">
            
            {/* LEFT COLUMN: Swiss Luxury Branding & Astral Starburst Reticle */}
            <div className="w-full lg:w-5/12 xl:w-5/12 min-h-[300px] lg:min-h-screen bg-[#000000] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative overflow-hidden">
                {/* Top-Left: Company Wordmark */}
                <div className="flex items-center gap-3 z-10">
                    <img src="/votion-logo-metallic.png" alt="Logo" className="w-6 h-6 object-contain" />
                    <span className="text-sm font-semibold tracking-wide text-white uppercase">
                        {panelName}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-normal">®</span>
                </div>

                {/* Center: Astral Starburst Reticle */}
                <div className="my-auto py-8 sm:py-12 flex items-center justify-center relative w-full">
                    <ReticleStar />
                </div>

                {/* Bottom-Left: Subtle Copyright Notice */}
                <div className="text-[11px] text-neutral-600 font-normal tracking-wide z-10">
                    &copy; {panelName} {new Date().getFullYear()}. All rights reserved.
                </div>
            </div>

            {/* RIGHT COLUMN: Golden Suisse Luxury Centered Inset Card */}
            <div className="w-full lg:w-7/12 xl:w-7/12 min-h-screen bg-[#000000] flex items-center justify-center p-4 sm:p-8 lg:p-10 xl:p-12 relative">
                {/* Framed Luxury Charcoal Card with zero trailing gap and unified edges */}
                <div
                    className="w-full max-w-[700px] min-h-[580px] lg:h-[calc(100vh-5rem)] lg:max-h-[820px] bg-[#0c0c0c] border border-neutral-900/90 rounded-[28px] sm:rounded-[36px] lg:rounded-[40px] flex flex-col justify-between p-8 sm:p-12 lg:p-14 xl:p-16 relative shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-y-auto"
                    style={{
                        background: 'radial-gradient(circle at 100% 0%, rgba(255,255,255,0.035) 0%, transparent 60%), #0c0c0c',
                    }}
                >
                    {/* Top Header: Subtitle on Left, Mode Link on Right */}
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <span className="text-[11px] uppercase tracking-widest text-neutral-600 font-medium">
                            {authMode === 'login' ? 'Authentication' : 'Registration'}
                        </span>
                        {authMode === 'login' ? (
                            <button
                                type="button"
                                onClick={() => changeMode('register')}
                                className="text-xs text-neutral-400 hover:text-white transition tracking-wide cursor-pointer font-medium"
                            >
                                Create an account
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => changeMode('login')}
                                className="text-xs text-neutral-400 hover:text-white transition tracking-wide cursor-pointer font-medium"
                            >
                                Sign In to account
                            </button>
                        )}
                    </div>

                    {/* Notification Alerts */}
                    {errorMsg && (
                        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-xl px-4 py-3 flex items-center justify-between mb-6">
                            <span className="truncate pr-2">{errorMsg}</span>
                            <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white text-sm leading-none cursor-pointer">
                                ✕
                            </button>
                        </div>
                    )}
                    {successMsg && (
                        <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-xl px-4 py-3 flex items-center justify-between mb-6">
                            <span className="truncate pr-2">{successMsg}</span>
                            <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white text-sm leading-none cursor-pointer">
                                ✕
                            </button>
                        </div>
                    )}

                    {/* ---------------- MODE: LOGIN ---------------- */}
                    {authMode === 'login' && (
                        <form onSubmit={handleLoginSubmit} className="flex-1 flex flex-col justify-center my-auto">
                            {/* Title (Pure Sans-Serif Swiss Typography) */}
                            <h1
                                className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-[-0.035em] text-white mb-8 sm:mb-12 font-sans"
                                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" }}
                            >
                                Login
                            </h1>

                            {/* 2-Column Minimalist Underline Form — Filling the width */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 w-full">
                                {/* Left Column: Email */}
                                <div>
                                    <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                        Email
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="mark.johnson@gmail.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="username email"
                                        style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                        className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                    />

                                    {/* Remember Me Checkbox */}
                                    <label className="flex items-center gap-2.5 mt-4 cursor-pointer text-xs text-neutral-400 select-none">
                                        <div
                                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                                rememberMe ? 'border-white bg-white text-black' : 'border-neutral-600 bg-transparent'
                                            }`}
                                        >
                                            {rememberMe && (
                                                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 12 12">
                                                    <path d="M3.5 6.5l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                                </svg>
                                            )}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span>Remember me</span>
                                    </label>
                                </div>

                                {/* Right Column: Password */}
                                <div>
                                    <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            autoComplete="current-password"
                                            style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                            className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 pr-8 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition cursor-pointer"
                                            tabIndex={-1}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>

                                    {/* Forgot Password Link */}
                                    <div className="flex justify-start mt-4">
                                        <button
                                            type="button"
                                            onClick={() => changeMode('forgot-password')}
                                            className="text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                                        >
                                            Forgot?
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Controls Row: SSO on Left, Circular Button on Right (Flush with Password Column) */}
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-12 pt-8 border-t border-neutral-900/80">
                                {/* Left: Discrete SSO Options */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Or continue with</span>
                                    <a
                                        href="/auth/sso/google"
                                        className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z" />
                                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.34 24 12 24z" />
                                            <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.13z" />
                                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.57 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z" />
                                        </svg>
                                        <span>Google</span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={handlePasskeyLogin}
                                        className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.07 1.72-.94 2.74 1.01.08 2.03-.5 2.64-1.24z" />
                                        </svg>
                                        <span>Passkey</span>
                                    </button>
                                </div>

                                {/* Right: Signature Circular Action Stamp (Aligned flush with Password Column) */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full font-bold text-[11px] sm:text-xs tracking-widest uppercase flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 shadow-[0_0_35px_rgba(255,255,255,0.18)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group self-end"
                                    style={{
                                        backgroundColor: '#ffffff',
                                        color: '#000000',
                                    }}
                                >
                                    {isLoading ? (
                                        <svg className="w-5 h-5 animate-spin text-black" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                        </svg>
                                    ) : (
                                        <span style={{ color: '#000000' }}>SIGN IN</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ---------------- MODE: REGISTER ---------------- */}
                    {authMode === 'register' && (
                        <div className="flex-1 flex flex-col justify-center my-auto">
                            {!registrationVerificationToken ? (
                                <form onSubmit={handleRegisterSubmit}>
                                    <h1
                                        className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-[-0.035em] text-white mb-8 sm:mb-12 font-sans"
                                        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" }}
                                    >
                                        Register
                                    </h1>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 w-full">
                                        {/* Column 1: Name & Email */}
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                                    Full Name
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Mark Johnson"
                                                    value={regName}
                                                    onChange={(e) => setRegName(e.target.value)}
                                                    required
                                                    style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                                    className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                                    Email Address
                                                </label>
                                                <input
                                                    type="email"
                                                    placeholder="mark.johnson@gmail.com"
                                                    value={regEmail}
                                                    onChange={(e) => setRegEmail(e.target.value)}
                                                    required
                                                    style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                                    className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                                />
                                            </div>
                                        </div>

                                        {/* Column 2: Password & Confirm Password */}
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                                    Password
                                                </label>
                                                <input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={regPassword}
                                                    onChange={(e) => setRegPassword(e.target.value)}
                                                    required
                                                    style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                                    className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                                    Confirm Password
                                                </label>
                                                <input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={regPasswordConfirmation}
                                                    onChange={(e) => setRegPasswordConfirmation(e.target.value)}
                                                    required
                                                    style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                                    className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Circular Action Stamp (Aligned flush with Column 2) */}
                                    <div className="flex justify-end mt-12 pt-6 border-t border-neutral-900/80">
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full font-bold text-[11px] sm:text-xs tracking-widest uppercase flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 shadow-[0_0_35px_rgba(255,255,255,0.18)] cursor-pointer disabled:opacity-50"
                                            style={{
                                                backgroundColor: '#ffffff',
                                                color: '#000000',
                                            }}
                                        >
                                            {isLoading ? (
                                                <svg className="w-5 h-5 animate-spin text-black" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                                </svg>
                                            ) : (
                                                <span style={{ color: '#000000' }}>SIGN UP</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleRegistrationVerificationSubmit}>
                                    <h1
                                        className="text-4xl sm:text-5xl font-light tracking-[-0.035em] text-white mb-4 font-sans"
                                        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" }}
                                    >
                                        Verify
                                    </h1>
                                    <p className="text-xs text-neutral-400 mb-8">
                                        Enter the 6-digit confirmation code sent to your email.
                                    </p>

                                    <div>
                                        <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                            Verification Code
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="123456"
                                            maxLength={6}
                                            value={registrationOtp}
                                            onChange={(e) => setRegistrationOtp(e.target.value)}
                                            required
                                            style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                            className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-xl font-mono tracking-widest py-2.5 px-0 focus:outline-none transition-colors"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between mt-10 pt-6 border-t border-neutral-900/80">
                                        <button
                                            type="button"
                                            onClick={handleResendRegistrationOtp}
                                            className="text-xs text-neutral-400 hover:text-white transition underline cursor-pointer"
                                        >
                                            Resend Code
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full font-bold text-[11px] sm:text-xs tracking-widest uppercase flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_35px_rgba(255,255,255,0.18)] cursor-pointer"
                                            style={{ backgroundColor: '#ffffff', color: '#000000' }}
                                        >
                                            <span style={{ color: '#000000' }}>VERIFY</span>
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {/* ---------------- MODE: FORGOT PASSWORD ---------------- */}
                    {authMode === 'forgot-password' && (
                        <form onSubmit={handleForgotSubmit} className="flex-1 flex flex-col justify-center my-auto">
                            <h1
                                className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-[-0.035em] text-white mb-4 font-sans"
                                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" }}
                            >
                                Reset
                            </h1>
                            <p className="text-xs text-neutral-400 mb-8">
                                Enter your account email to receive a recovery link.
                            </p>

                            <div>
                                <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                    Account Email
                                </label>
                                <input
                                    type="email"
                                    placeholder="mark.johnson@gmail.com"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    required
                                    style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                    className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="flex justify-end mt-12 pt-6 border-t border-neutral-900/80">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full font-bold text-[11px] sm:text-xs tracking-widest uppercase flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_35px_rgba(255,255,255,0.18)] cursor-pointer"
                                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                                >
                                    <span style={{ color: '#000000' }}>SEND</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ---------------- MODE: RESET PASSWORD ---------------- */}
                    {authMode === 'reset-password' && (
                        <form onSubmit={handleResetPasswordSubmit} className="flex-1 flex flex-col justify-center my-auto">
                            <h1
                                className="text-4xl sm:text-5xl font-light tracking-[-0.035em] text-white mb-8 font-sans"
                                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" }}
                            >
                                Password
                            </h1>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full">
                                <div>
                                    <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={resetPassword}
                                        onChange={(e) => setResetPassword(e.target.value)}
                                        required
                                        style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                        className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={resetPasswordConfirmation}
                                        onChange={(e) => setResetPasswordConfirmation(e.target.value)}
                                        required
                                        style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                        className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-sm py-2.5 px-0 placeholder:text-neutral-600 focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end mt-12 pt-6 border-t border-neutral-900/80">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full font-bold text-[11px] sm:text-xs tracking-widest uppercase flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_35px_rgba(255,255,255,0.18)] cursor-pointer"
                                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                                >
                                    <span style={{ color: '#000000' }}>UPDATE</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ---------------- MODE: 2FA CHECKPOINT ---------------- */}
                    {authMode === '2fa' && (
                        <form onSubmit={handle2FASubmit} className="flex-1 flex flex-col justify-center my-auto">
                            <h1
                                className="text-4xl sm:text-5xl font-light tracking-[-0.035em] text-white mb-4 font-sans"
                                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" }}
                            >
                                2FA Code
                            </h1>
                            <p className="text-xs text-neutral-400 mb-8">
                                Enter the 6-digit code from your authenticator app.
                            </p>

                            <div>
                                <label className="block text-xs text-neutral-400 font-medium tracking-wide mb-1.5">
                                    Authenticator Code
                                </label>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value)}
                                    required
                                    autoFocus
                                    style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                                    className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-white text-white text-2xl font-mono tracking-[0.4em] py-2.5 px-0 focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="flex items-center justify-between mt-10 pt-6 border-t border-neutral-900/80">
                                <button
                                    type="button"
                                    onClick={() => changeMode('login')}
                                    className="text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full font-bold text-[11px] sm:text-xs tracking-widest uppercase flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_35px_rgba(255,255,255,0.18)] cursor-pointer"
                                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                                >
                                    <span style={{ color: '#000000' }}>VERIFY</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* WebAuthn / Passkey Post-Login Enrollment Modal */}
            {showPasskeyPrompt && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="bg-[#121212] border border-neutral-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
                        <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1.5">
                            Enable Passkey
                        </h3>
                        <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                            Sign in instantly and securely with Touch ID, Windows Hello, or Face ID next time.
                        </p>

                        {passkeyError && (
                            <div className="text-xs text-red-400 bg-red-950/40 rounded-lg p-2.5 mb-4">
                                {passkeyError}
                            </div>
                        )}

                        <div className="space-y-2.5">
                            <button
                                type="button"
                                onClick={handleEnrollPasskeyNow}
                                disabled={passkeyLoading}
                                className="w-full rounded-full font-semibold text-xs py-3 px-4 shadow-sm hover:bg-neutral-200 transition cursor-pointer"
                                style={{ backgroundColor: '#ffffff', color: '#000000' }}
                            >
                                {passkeyLoading ? 'Enrolling...' : 'Enroll Passkey'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    window.location.href = pendingRedirectUrl;
                                }}
                                className="w-full text-xs text-neutral-500 hover:text-white py-2 cursor-pointer font-normal transition"
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
