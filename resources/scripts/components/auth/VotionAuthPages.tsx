import React, { useState, useEffect } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import http from '@/api/http';
import { authenticateWithPasskey, enrollPasskey, isPasskeySupported } from '@/api/account/webauthn';

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

    // Form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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

    // Ensure body allows scrolling on shorter screens and clean up any legacy artifacts
    useEffect(() => {
        document.body.style.backgroundColor = '#bbbbbb';
        document.body.style.overflowY = 'auto';

        // Immediately dismiss any residual preloader
        const p = document.getElementById('votion-global-preloader');
        if (p) {
            p.style.display = 'none';
            if (p.parentNode) p.parentNode.removeChild(p);
        }

        return () => {
            document.body.style.backgroundColor = '';
            document.body.style.overflowY = '';
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
            // If passkey is not supported in browser, fallback to Apple SSO endpoint
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
        setIsLoading(true);

        try {
            await http.get('/sanctum/csrf-cookie');
            const res = await http.post('/auth/register', {
                name: regName.trim(),
                email: regEmail.trim(),
                password: regPassword,
                password_confirmation: regPassword,
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
        <div
            className="w-full min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 font-sans select-none bg-[#bbbbbb]"
            style={{ backgroundColor: '#bbbbbb' }}
        >
            {/* Centered Floating Architectural Card */}
            <div className="w-full max-w-[880px] min-h-[540px] md:min-h-[580px] bg-white rounded-2xl md:rounded-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.22)] overflow-hidden grid grid-cols-1 md:grid-cols-2 relative transition-all duration-300">
                
                {/* LEFT COLUMN: Clean Form */}
                <div className="flex flex-col justify-between p-8 sm:p-10 md:p-12 lg:p-14 bg-white text-neutral-900 w-full h-full relative">
                    
                    {/* Top Branding Emblem: Minimalist Lightning Monogram */}
                    <div className="flex justify-center mb-5 sm:mb-6">
                        <svg className="w-4 h-5 text-neutral-950 fill-current" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.8 0L0.5 9.6H6.8L5.6 18L13.5 8.4H7.2L7.8 0Z" fill="currentColor" />
                        </svg>
                    </div>

                    {/* Messages / Notifications */}
                    {errorMsg && (
                        <div className="text-xs text-red-600 bg-red-50/90 border border-red-200/80 rounded-full px-4 py-2 flex items-center justify-between mb-4 shadow-2xs">
                            <span className="truncate pr-2">{errorMsg}</span>
                            <button type="button" onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800 text-sm leading-none cursor-pointer">
                                ✕
                            </button>
                        </div>
                    )}
                    {successMsg && (
                        <div className="text-xs text-emerald-700 bg-emerald-50/90 border border-emerald-200/80 rounded-full px-4 py-2 flex items-center justify-between mb-4 shadow-2xs">
                            <span className="truncate pr-2">{successMsg}</span>
                            <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800 text-sm leading-none cursor-pointer">
                                ✕
                            </button>
                        </div>
                    )}

                    {/* ---------------- MODE: LOGIN ---------------- */}
                    {authMode === 'login' && (
                        <div>
                            {/* Header */}
                            <h1 className="text-2xl sm:text-[28px] md:text-[30px] font-semibold text-neutral-950 tracking-[-0.03em] text-center leading-tight">
                                Welcome back!
                            </h1>
                            <p className="text-xs sm:text-[13px] text-neutral-500 font-normal text-center mt-1.5 mb-6 leading-relaxed">
                                Your work, your team, your flow — all in one place.
                            </p>

                            {/* Social / SSO Sign-In Pills */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <a
                                    href="/auth/sso/google"
                                    className="flex items-center justify-center gap-2 rounded-full border border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50 px-3.5 py-2.5 text-xs font-medium text-neutral-800 transition shadow-2xs active:scale-[0.98]"
                                >
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z" />
                                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.34 24 12 24z" />
                                        <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.13z" />
                                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.57 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z" />
                                    </svg>
                                    <span className="whitespace-nowrap">Sign In with Google</span>
                                </a>

                                <button
                                    type="button"
                                    onClick={handlePasskeyLogin}
                                    className="flex items-center justify-center gap-2 rounded-full border border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50 px-3.5 py-2.5 text-xs font-medium text-neutral-800 transition shadow-2xs active:scale-[0.98] cursor-pointer"
                                >
                                    <svg className="w-3.5 h-3.5 fill-current text-neutral-950 flex-shrink-0" viewBox="0 0 24 24">
                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.07 1.72-.94 2.74 1.01.08 2.03-.5 2.64-1.24z" />
                                    </svg>
                                    <span className="whitespace-nowrap">Sign In with Apple</span>
                                </button>
                            </div>

                            {/* Hairline Divider */}
                            <div className="relative my-4 flex items-center justify-center">
                                <div className="w-full border-t border-neutral-200" />
                                <span className="absolute bg-white px-3 text-[11px] uppercase tracking-wider text-neutral-400 font-normal">
                                    Or
                                </span>
                            </div>

                            {/* Credentials Form */}
                            <form onSubmit={handleLoginSubmit} className="space-y-3">
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="username email"
                                        className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                    />
                                </div>

                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
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

                                <div className="flex justify-end pr-1">
                                    <button
                                        type="button"
                                        onClick={() => changeMode('forgot-password')}
                                        className="text-[11px] text-neutral-400 hover:text-neutral-900 font-normal transition cursor-pointer"
                                    >
                                        Forgot password?
                                    </button>
                                </div>

                                {/* Primary Button: Solid Black Pill */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm py-3 px-6 shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                            </svg>
                                            <span>Signing in...</span>
                                        </>
                                    ) : (
                                        <span>Sign in with email</span>
                                    )}
                                </button>
                            </form>

                            {/* Secondary switch */}
                            <p className="text-xs text-neutral-500 mt-4 text-center">
                                Don&apos;t have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => changeMode('register')}
                                    className="font-semibold text-neutral-900 underline hover:text-black ml-0.5 cursor-pointer"
                                >
                                    Sign Up
                                </button>
                            </p>
                        </div>
                    )}

                    {/* ---------------- MODE: REGISTER ---------------- */}
                    {authMode === 'register' && (
                        <div>
                            {!registrationVerificationToken ? (
                                <>
                                    <h1 className="text-2xl sm:text-[28px] md:text-[30px] font-semibold text-neutral-950 tracking-[-0.03em] text-center leading-tight">
                                        Create account
                                    </h1>
                                    <p className="text-xs sm:text-[13px] text-neutral-500 font-normal text-center mt-1.5 mb-6 leading-relaxed">
                                        Start managing your servers and infrastructure in seconds.
                                    </p>

                                    <form onSubmit={handleRegisterSubmit} className="space-y-3">
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Full Name"
                                                value={regName}
                                                onChange={(e) => setRegName(e.target.value)}
                                                required
                                                className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="email"
                                                placeholder="Email address"
                                                value={regEmail}
                                                onChange={(e) => setRegEmail(e.target.value)}
                                                required
                                                className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="password"
                                                placeholder="Password (minimum 8 characters)"
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                                required
                                                className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm py-3 px-6 shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-60"
                                        >
                                            {isLoading ? <span>Creating account...</span> : <span>Create account</span>}
                                        </button>
                                    </form>

                                    <p className="text-xs text-neutral-500 mt-4 text-center">
                                        Already have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => changeMode('login')}
                                            className="font-semibold text-neutral-900 underline hover:text-black ml-0.5 cursor-pointer"
                                        >
                                            Sign In
                                        </button>
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-2xl sm:text-[28px] font-semibold text-neutral-950 tracking-[-0.03em] text-center leading-tight">
                                        Verify your email
                                    </h1>
                                    <p className="text-xs sm:text-[13px] text-neutral-500 font-normal text-center mt-1.5 mb-6 leading-relaxed">
                                        Enter the 6-digit code sent to your inbox.
                                    </p>

                                    <form onSubmit={handleRegistrationVerificationSubmit} className="space-y-4">
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="123456"
                                                maxLength={6}
                                                value={registrationOtp}
                                                onChange={(e) => setRegistrationOtp(e.target.value)}
                                                required
                                                className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-center text-lg font-mono tracking-widest text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm py-3 px-6 shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            {isLoading ? <span>Verifying...</span> : <span>Confirm & Activate</span>}
                                        </button>

                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={handleResendRegistrationOtp}
                                                className="text-xs text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                                            >
                                                Didn&apos;t receive a code? Resend
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}
                        </div>
                    )}

                    {/* ---------------- MODE: FORGOT PASSWORD ---------------- */}
                    {authMode === 'forgot-password' && (
                        <div>
                            <h1 className="text-2xl sm:text-[28px] md:text-[30px] font-semibold text-neutral-950 tracking-[-0.03em] text-center leading-tight">
                                Reset password
                            </h1>
                            <p className="text-xs sm:text-[13px] text-neutral-500 font-normal text-center mt-1.5 mb-6 leading-relaxed">
                                Enter your email and we&apos;ll send recovery instructions.
                            </p>

                            <form onSubmit={handleForgotSubmit} className="space-y-3">
                                <div>
                                    <input
                                        type="email"
                                        placeholder="Enter your email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm py-3 px-6 shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-60"
                                >
                                    {isLoading ? <span>Sending...</span> : <span>Send recovery link</span>}
                                </button>
                            </form>

                            <p className="text-xs text-neutral-500 mt-4 text-center">
                                Remembered your password?{' '}
                                <button
                                    type="button"
                                    onClick={() => changeMode('login')}
                                    className="font-semibold text-neutral-900 underline hover:text-black ml-0.5 cursor-pointer"
                                >
                                    Sign In
                                </button>
                            </p>
                        </div>
                    )}

                    {/* ---------------- MODE: RESET PASSWORD ---------------- */}
                    {authMode === 'reset-password' && (
                        <div>
                            <h1 className="text-2xl sm:text-[28px] font-semibold text-neutral-950 tracking-[-0.03em] text-center leading-tight">
                                Set new password
                            </h1>
                            <p className="text-xs sm:text-[13px] text-neutral-500 font-normal text-center mt-1.5 mb-6 leading-relaxed">
                                Enter your email and choose a new secure password.
                            </p>

                            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                                <div>
                                    <input
                                        type="email"
                                        placeholder="Enter your email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="password"
                                        placeholder="New Password"
                                        value={resetPassword}
                                        onChange={(e) => setResetPassword(e.target.value)}
                                        required
                                        className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="password"
                                        placeholder="Confirm Password"
                                        value={resetPasswordConfirmation}
                                        onChange={(e) => setResetPasswordConfirmation(e.target.value)}
                                        required
                                        className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm py-3 px-6 shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-60"
                                >
                                    {isLoading ? <span>Updating...</span> : <span>Update password</span>}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ---------------- MODE: 2FA CHECKPOINT ---------------- */}
                    {authMode === '2fa' && (
                        <div>
                            <h1 className="text-2xl sm:text-[28px] font-semibold text-neutral-950 tracking-[-0.03em] text-center leading-tight">
                                Two-Factor Auth
                            </h1>
                            <p className="text-xs sm:text-[13px] text-neutral-500 font-normal text-center mt-1.5 mb-6 leading-relaxed">
                                Enter the 6-digit code from your authenticator app.
                            </p>

                            <form onSubmit={handle2FASubmit} className="space-y-4">
                                <div>
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={totpCode}
                                        onChange={(e) => setTotpCode(e.target.value)}
                                        required
                                        autoFocus
                                        className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-center text-xl font-mono tracking-[0.3em] text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm py-3 px-6 shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                >
                                    {isLoading ? <span>Verifying...</span> : <span>Verify & Continue</span>}
                                </button>
                            </form>

                            <p className="text-xs text-neutral-500 mt-4 text-center">
                                <button
                                    type="button"
                                    onClick={() => changeMode('login')}
                                    className="font-semibold text-neutral-900 underline hover:text-black cursor-pointer"
                                >
                                    Back to Sign In
                                </button>
                            </p>
                        </div>
                    )}

                    {/* Bottom Legal / Help Links */}
                    <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 font-normal pt-6 mt-auto">
                        <a href="#help" className="hover:text-neutral-600 transition">Help</a>
                        <span>/</span>
                        <a href="#terms" className="hover:text-neutral-600 transition">Terms</a>
                        <span>/</span>
                        <a href="#privacy" className="hover:text-neutral-600 transition">Privacy</a>
                    </div>
                </div>

                {/* RIGHT COLUMN: 1-Bit Dithered Architectural Courtyard Artwork */}
                <div className="hidden md:block relative w-full h-full min-h-full overflow-hidden bg-neutral-100">
                    <img
                        src="/assets/auth-illustration@2x.png"
                        srcSet="/assets/auth-illustration.png 1x, /assets/auth-illustration@2x.png 2x"
                        alt="Architectural Artwork"
                        className="w-full h-full object-cover select-none pointer-events-none"
                    />
                </div>

                {/* WebAuthn / Passkey Post-Login Enrollment Modal */}
                {showPasskeyPrompt && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 z-50">
                        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
                            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                                <svg className="w-5 h-5 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-neutral-950 mb-1">
                                Faster & safer login
                            </h3>
                            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
                                Enable a Passkey (Touch ID, Windows Hello, Face ID) to sign in securely with one tap next time.
                            </p>

                            {passkeyError && (
                                <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2 mb-3">
                                    {passkeyError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={handleEnrollPasskeyNow}
                                    disabled={passkeyLoading}
                                    className="w-full rounded-full bg-black hover:bg-neutral-800 text-white font-medium text-xs py-2.5 px-4 shadow-sm transition cursor-pointer"
                                >
                                    {passkeyLoading ? 'Registering...' : 'Enroll Passkey'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.location.href = pendingRedirectUrl;
                                    }}
                                    className="w-full text-xs text-neutral-500 hover:text-neutral-800 py-2 cursor-pointer font-normal"
                                >
                                    Skip for now
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VotionAuthPages;
