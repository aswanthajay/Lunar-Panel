import React, { useState, useEffect } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import http from '@/api/http';
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

    // Login Flow States (Votion Cloud 2-Step Pattern)
    const [loginStep, setLoginStep] = useState<'id' | 'password'>('id');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [selectedRealm, setSelectedRealm] = useState<'Votion ID' | 'Email'>('Votion ID');
    const [showRealmMenu, setShowRealmMenu] = useState(false);
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

    // Immediately dismiss the global preloader and enforce Carbon dark theme styling
    useEffect(() => {
        document.body.classList.add('cds--dark-theme');

        // Dynamically inject carbon.css if not already present in <head>
        if (!document.getElementById('votion-carbon-css')) {
            const link = document.createElement('link');
            link.id = 'votion-carbon-css';
            link.rel = 'stylesheet';
            link.href = '/assets/carbon.css';
            document.head.appendChild(link);
        }

        // Dynamically inject IBM Plex Sans font if not already present
        if (!document.getElementById('votion-carbon-font')) {
            const fontLink = document.createElement('link');
            fontLink.id = 'votion-carbon-font';
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap';
            document.head.appendChild(fontLink);
        }

        const p = document.getElementById('votion-global-preloader');
        if (p) {
            p.style.opacity = '0';
            p.style.pointerEvents = 'none';
            setTimeout(() => {
                if (p && p.parentNode) p.parentNode.removeChild(p);
            }, 50);
        }

        return () => {
            document.body.classList.remove('cds--dark-theme');
        };
    }, []);

    useEffect(() => {
        if (location.pathname.includes('/register')) {
            setAuthMode('register');
            setLoginStep('id');
        } else if (location.pathname.includes('/password/reset')) {
            setAuthMode('reset-password');
            setLoginStep('id');
        } else if (location.pathname.includes('/password')) {
            setAuthMode('forgot-password');
            setLoginStep('id');
        } else if (location.pathname.includes('/checkpoint')) {
            setAuthMode('2fa');
            setLoginStep('id');
        } else {
            setAuthMode('login');
        }
    }, [location.pathname]);

    const changeMode = (mode: 'login' | 'register' | 'forgot-password' | 'reset-password' | '2fa') => {
        setAuthMode(mode);
        setLoginStep('id');
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

    const handleContinueToPassword = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg(null);
        if (!email.trim()) {
            setErrorMsg('Please enter your Votion ID or email address.');
            return;
        }
        setLoginStep('password');
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

    const handleSkipPasskey = () => {
        window.location.href = pendingRedirectUrl;
    };

    const handlePasskeyLogin = async () => {
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!isPasskeySupported()) {
            setErrorMsg('WebAuthn / Passkeys are not supported by this browser.');
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
            setLoginStep('id');
            setErrorMsg('Please enter your Votion ID or email address.');
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
        <div className="ibm-cloud-app ibm-cloud-react-container" data-root-path="/login">
            <div className="app-container">
                {/* ---------------- Fixed Navbar ---------------- */}
                <div className="cds--header navbar">
                    <a href="/auth/login" className="cds--header__name">
                        <img
                            src="/votion-logo-metallic.png"
                            alt="Votion"
                            style={{ width: '22px', height: '22px', objectFit: 'contain', marginRight: '6px' }}
                        />
                        <span className="cds--header__name--prefix">Votion</span>&nbsp;<span>Cloud</span>
                    </a>
                    <nav aria-label="Votion Cloud" className="cds--header__nav">
                        <ul className="cds--header__menu-bar">
                            <li>
                                <a
                                    analytics-name="login - learn more"
                                    href="https://votioncloud.org"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cds--header__menu-item"
                                    tabIndex={0}
                                >
                                    <span className="cds--text-truncate--end">
                                        <span className="navbar__icon">
                                            <svg
                                                focusable="false"
                                                preserveAspectRatio="xMidYMid meet"
                                                fill="currentColor"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 20 20"
                                                aria-hidden="true"
                                                className="catalog-icon"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path d="M16.25,5 L12.5,5 L12.5,3.75 C12.5,1.6875 10.8125,0 8.75,0 C6.6875,0 5,1.6875 5,3.75 L5,5 L1.25,5 C0.5625,5 0,5.5625 0,6.25 L0,13.75 C0,15.125 1.125,16.25 2.5,16.25 L15,16.25 C16.375,16.25 17.5,15.125 17.5,13.75 L17.5,6.25 C17.5,5.5625 16.9375,5 16.25,5 Z M6.25,3.75 C6.25,2.375 7.375,1.25 8.75,1.25 C10.125,1.25 11.25,2.375 11.25,3.75 L11.25,5 L6.25,5 L6.25,3.75 Z M16.25,6.25 L16.25,11.25 L1.25,11.25 L1.25,6.25 L16.25,6.25 Z M15,15 L2.5,15 C1.8125,15 1.25,14.4375 1.25,13.75 L1.25,12.5 L16.25,12.5 L16.25,13.75 C16.25,14.4375 15.6875,15 15,15 Z" />
                                            </svg>
                                        </span>
                                        <span className="navbar__menu-text">Catalog</span>
                                    </span>
                                </a>
                            </li>
                            <li>
                                <a
                                    analytics-name="login - learn more"
                                    href="#estimator"
                                    className="cds--header__menu-item"
                                    tabIndex={0}
                                >
                                    <span className="cds--text-truncate--end">
                                        <span className="navbar__icon">
                                            <svg
                                                focusable="false"
                                                preserveAspectRatio="xMidYMid meet"
                                                fill="currentColor"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 32 32"
                                                aria-hidden="true"
                                                className="cost-estimator-icon"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path d="M26,4V28H6V4H26m0-2H6A2,2,0,0,0,4,4V28a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V4A2,2,0,0,0,26,2Z" />
                                                <path d="M9 23H11V25H9zM21 23H23V25H21zM9 18H11V20H9zM21 18H23V20H21zM9 13H11V15H9zM15 23H17V25H15zM15 18H17V20H15zM15 13H17V15H15zM21 13H23V15H21zM9 7H23V10H9z" />
                                            </svg>
                                        </span>
                                        <span className="navbar__menu-text">Cost estimator</span>
                                    </span>
                                </a>
                            </li>
                            <li>
                                <a
                                    analytics-name="login - learn more"
                                    href="https://docs.votioncloud.org"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cds--header__menu-item"
                                    tabIndex={0}
                                >
                                    <span className="cds--text-truncate--end">
                                        <span className="navbar__icon">
                                            <svg
                                                focusable="false"
                                                preserveAspectRatio="xMidYMid meet"
                                                fill="currentColor"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 32 32"
                                                aria-hidden="true"
                                                className="docs-icon"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path d="M25.7,9.3l-7-7C18.5,2.1,18.3,2,18,2H8C6.9,2,6,2.9,6,4v24c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V10C26,9.7,25.9,9.5,25.7,9.3 z M18,4.4l5.6,5.6H18V4.4z M24,28H8V4h8v6c0,1.1,0.9,2,2,2h6V28z" />
                                                <path d="M10 22H22V24H10z" />
                                                <path d="M10 16H22V18H10z" />
                                            </svg>
                                        </span>
                                        <span className="navbar__menu-text">Docs</span>
                                    </span>
                                </a>
                            </li>
                        </ul>
                    </nav>
                </div>

                {/* ---------------- Left Container (Form & Footer) ---------------- */}
                <div className="login-container login-container--with-form">
                    <div className="login-wrapper">
                        <div className="login-sub-wrapper">
                            {/* Votion Brand Emblem */}
                            <div className="cloud-logo-vector" style={{ marginBottom: '18px', display: 'flex', alignItems: 'center' }}>
                                <div className="theme-brand-logo" style={{ height: '34px' }}>
                                    <span className="comet-trace-beam" />
                                    <span className="theme-brand-logo-inner">votion</span>
                                </div>
                            </div>

                            {/* Notifications / Errors */}
                            {errorMsg && (
                                <div
                                    style={{
                                        backgroundColor: '#2d0709',
                                        borderLeft: '3px solid #fa4d56',
                                        color: '#fff',
                                        padding: '12px 16px',
                                        fontSize: '13px',
                                        marginTop: '16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span>{errorMsg}</span>
                                    <button
                                        type="button"
                                        onClick={() => setErrorMsg(null)}
                                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {successMsg && (
                                <div
                                    style={{
                                        backgroundColor: '#042813',
                                        borderLeft: '3px solid #24a148',
                                        color: '#fff',
                                        padding: '12px 16px',
                                        fontSize: '13px',
                                        marginTop: '16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span>{successMsg}</span>
                                    <button
                                        type="button"
                                        onClick={() => setSuccessMsg(null)}
                                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* ================= LOGIN FORM ================= */}
                            {authMode === 'login' && (
                                <form
                                    aria-labelledby="page-title"
                                    name="login"
                                    method="post"
                                    className="login-form"
                                    noValidate
                                    onSubmit={loginStep === 'id' ? handleContinueToPassword : handleLoginSubmit}
                                >
                                    <h1 id="page-title" className="login-form__title">
                                        Log in to Votion<span className="login-form__title-2">Cloud</span>
                                    </h1>
                                    <div className="login-form__create-account">
                                        Don&apos;t have an account?&ensp;
                                        <button
                                            type="button"
                                            onClick={() => changeMode('register')}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#78a9ff',
                                                cursor: 'pointer',
                                                padding: 0,
                                                font: 'inherit',
                                                textDecoration: 'none',
                                            }}
                                        >
                                            Create an account
                                        </button>
                                    </div>

                                    <div className="login-form__input-rows">
                                        {/* STEP 1: USERNAME / ID ROW */}
                                        {loginStep === 'id' && (
                                            <div className="login-form__realm-user-id-row">
                                                <div className="login-form__label-wrapper">
                                                    <div className="login-form__label">
                                                        <span>Sign in with</span>
                                                    </div>
                                                </div>
                                                <div className="login-form__realm-user-id-wrapper">
                                                    <div className="login-form__realm-wrapper">
                                                        <div className="cds--layer-two">
                                                            <div className="cds--dropdown__wrapper cds--list-box__wrapper">
                                                                <label className="cds--label cds--visually-hidden" id="realm-label">
                                                                    Sign in with
                                                                </label>
                                                                <div id="realm-switch" className="cds--dropdown cds--dropdown--lg cds--list-box cds--list-box--lg">
                                                                    <button
                                                                        type="button"
                                                                        className="cds--list-box__field"
                                                                        onClick={() => setShowRealmMenu(!showRealmMenu)}
                                                                    >
                                                                        <span className="cds--list-box__label">{selectedRealm}</span>
                                                                        <div className="cds--list-box__menu-icon">
                                                                            <svg focusable="false" preserveAspectRatio="xMidYMid meet" fill="currentColor" width="16" height="16" viewBox="0 0 16 16">
                                                                                <path d="M8 11 3 6 3.7 5.3 8 9.6 12.3 5.3 13 6z" />
                                                                            </svg>
                                                                        </div>
                                                                    </button>
                                                                    {showRealmMenu && (
                                                                        <ul
                                                                            className="cds--list-box__menu"
                                                                            role="listbox"
                                                                            style={{
                                                                                display: 'block',
                                                                                position: 'absolute',
                                                                                width: '100%',
                                                                                zIndex: 1000,
                                                                                background: '#262626',
                                                                                border: '1px solid #525252',
                                                                                boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                                                                            }}
                                                                        >
                                                                            <li
                                                                                className="cds--list-box__menu-item"
                                                                                onClick={() => {
                                                                                    setSelectedRealm('Votion ID');
                                                                                    setShowRealmMenu(false);
                                                                                }}
                                                                                style={{ padding: '12px 16px', cursor: 'pointer', color: '#f4f4f4' }}
                                                                            >
                                                                                <div className="cds--list-box__menu-item__option">Votion ID</div>
                                                                            </li>
                                                                            <li
                                                                                className="cds--list-box__menu-item"
                                                                                onClick={() => {
                                                                                    setSelectedRealm('Email');
                                                                                    setShowRealmMenu(false);
                                                                                }}
                                                                                style={{ padding: '12px 16px', cursor: 'pointer', color: '#f4f4f4' }}
                                                                            >
                                                                                <div className="cds--list-box__menu-item__option">Email</div>
                                                                            </li>
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="login-form__user-id-wrapper login-form__fluid-input-label login-form__fluid-input-label--align-top">
                                                        <div className="cds--layer-two">
                                                            <div className="cds--form-item login-form__user-id cds--text-input-wrapper">
                                                                <div className="cds--text-input__label-wrapper">
                                                                    <label htmlFor="userid" className="cds--label cds--visually-hidden">
                                                                        Votion ID
                                                                    </label>
                                                                </div>
                                                                <div className="cds--text-input__field-outer-wrapper">
                                                                    <div className="cds--text-input__field-wrapper">
                                                                        <input
                                                                            id="userid"
                                                                            placeholder="username@example.com"
                                                                            type="text"
                                                                            className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                                                            name="userid"
                                                                            autoCapitalize="none"
                                                                            autoComplete="username"
                                                                            value={email}
                                                                            onChange={(e) => setEmail(e.target.value)}
                                                                            required
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="login-form__login-button-wrapper">
                                                    <button
                                                        name="login"
                                                        className="login-form__button cds--btn cds--btn--primary"
                                                        type="button"
                                                        onClick={handleContinueToPassword}
                                                    >
                                                        <span>Continue</span>
                                                        <svg
                                                            focusable="false"
                                                            preserveAspectRatio="xMidYMid meet"
                                                            fill="currentColor"
                                                            aria-hidden="true"
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 16 16"
                                                            className="cds--btn__icon"
                                                        >
                                                            <path d="M9.3 3.7 13.1 7.5 1 7.5 1 8.5 13.1 8.5 9.3 12.3 10 13 15 8 10 3z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <div className="login-form__footer">
                                                    <div className="forgot-links">
                                                        <div className="forgot-links__ibm-id-links">
                                                            <button
                                                                type="button"
                                                                onClick={() => changeMode('forgot-password')}
                                                                className="cds--link"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                            >
                                                                Forgot ID?
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="cds--form-item cds--checkbox-wrapper login-form__remember-me">
                                                        <input
                                                            name="remember-me-checkbox"
                                                            type="checkbox"
                                                            className="cds--checkbox"
                                                            id="remember-me-checkbox"
                                                            checked={rememberMe}
                                                            onChange={(e) => setRememberMe(e.target.checked)}
                                                        />
                                                        <label htmlFor="remember-me-checkbox" className="cds--checkbox-label">
                                                            <div className="cds--checkbox-label-text">Remember ID</div>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div className="login-form__input-rows login-form__input-rows--mt6">
                                                    <span className="login-form__separator">Or</span>
                                                </div>
                                                <div className="login-form__input-rows login-form__input-rows--mt8">
                                                    <a
                                                        className="gsi-material-button cds--btn cds--btn--tertiary"
                                                        href="/auth/sso/authentik"
                                                    >
                                                        <div className="gsi-material-button-content-wrapper">
                                                            <span className="gsi-material-button-contents">Continue with Authentik</span>
                                                            <div className="gsi-material-button-icon">
                                                                <svg
                                                                    viewBox="0 0 24 24"
                                                                    version="1.1"
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    preserveAspectRatio="xMidYMid"
                                                                    aria-hidden="true"
                                                                    width="20"
                                                                    height="20"
                                                                >
                                                                    <path
                                                                        d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
                                                                        fill="#fd4b2d"
                                                                    />
                                                                    <path
                                                                        d="M12 6L6.5 9.5V14.5L12 18L17.5 14.5V9.5L12 6Z"
                                                                        fill="#161616"
                                                                    />
                                                                    <path
                                                                        d="M12 8.5L8.5 10.5V13.5L12 15.5L15.5 13.5V10.5L12 8.5Z"
                                                                        fill="#fd4b2d"
                                                                    />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </a>
                                                </div>
                                                <div className="login-form__input-rows login-form__input-rows--mt4">
                                                    <a
                                                        className="gsi-material-button cds--btn cds--btn--tertiary"
                                                        href="/auth/sso/google"
                                                    >
                                                        <div className="gsi-material-button-content-wrapper">
                                                            <span className="gsi-material-button-contents">Continue with Google</span>
                                                            <div className="gsi-material-button-icon">
                                                                <svg
                                                                    version="1.1"
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 48 48"
                                                                    aria-hidden="true"
                                                                    style={{ display: 'block' }}
                                                                    width="20"
                                                                    height="20"
                                                                >
                                                                    <path
                                                                        fill="#EA4335"
                                                                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                                                                    />
                                                                    <path
                                                                        fill="#4285F4"
                                                                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                                                                    />
                                                                    <path
                                                                        fill="#FBBC05"
                                                                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                                                                    />
                                                                    <path
                                                                        fill="#34A853"
                                                                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                                                                    />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </a>
                                                </div>
                                                {isPasskeySupported() && (
                                                    <div className="login-form__input-rows login-form__input-rows--mt4">
                                                        <button
                                                            className="gsi-material-button cds--btn cds--btn--tertiary"
                                                            type="button"
                                                            onClick={handlePasskeyLogin}
                                                            disabled={isLoading}
                                                        >
                                                            <div className="gsi-material-button-content-wrapper">
                                                                <span className="gsi-material-button-contents">Sign in with Passkey</span>
                                                                <div className="gsi-material-button-icon">
                                                                    <svg
                                                                        width="20"
                                                                        height="20"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="#78a9ff"
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                    >
                                                                        <path d="M21 2l-2 2m-1.5 1.5L14 9a5 5 0 1 0-7 7 5 5 0 0 0 7-7l2.5-2.5m1.5-1.5L21 2" />
                                                                        <circle cx="7.5" cy="16.5" r="1.5" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* STEP 2: PASSWORD ROW */}
                                        {loginStep === 'password' && (
                                            <div className="login-form__password-row" style={{ position: 'relative', opacity: 1 }}>
                                                <div className="login-form__label-wrapper">
                                                    <button
                                                        type="button"
                                                        className="login-form__label login-form__user-id-display"
                                                        onClick={() => setLoginStep('id')}
                                                    >
                                                        <svg
                                                            focusable="false"
                                                            preserveAspectRatio="xMidYMid meet"
                                                            fill="currentColor"
                                                            width="20"
                                                            height="20"
                                                            viewBox="0 0 32 32"
                                                            aria-hidden="true"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                        >
                                                            <path d="M14 26 15.41 24.59 7.83 17 28 17 28 15 7.83 15 15.41 7.41 14 6 4 16 14 26z" />
                                                        </svg>
                                                        <span>{email}</span>
                                                    </button>
                                                </div>
                                                <div className="login-form__user-id-wrapper login-form__user-id-wrapper--password login-form__fluid-input-label login-form__fluid-input-label--align-top">
                                                    <div className="cds--layer-two">
                                                        <div
                                                            className="cds--form-item cds--text-input-wrapper cds--password-input-wrapper"
                                                            style={{ position: 'relative' }}
                                                        >
                                                            <label htmlFor="password" className="cds--label">
                                                                Password
                                                            </label>
                                                            <div className="cds--text-input__field-outer-wrapper">
                                                                <div className="cds--text-input__field-wrapper" style={{ position: 'relative' }}>
                                                                    <input
                                                                        id="password"
                                                                        type={showPassword ? 'text' : 'password'}
                                                                        className="cds--text-input cds--password-input login-form__password cds--text-input--lg cds--layout--size-lg"
                                                                        name="password"
                                                                        autoFocus
                                                                        value={password}
                                                                        onChange={(e) => setPassword(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleLoginSubmit(e);
                                                                        }}
                                                                        required
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowPassword(!showPassword)}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            right: '12px',
                                                                            top: '50%',
                                                                            transform: 'translateY(-50%)',
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            color: '#c6c6c6',
                                                                            cursor: 'pointer',
                                                                            padding: '4px',
                                                                        }}
                                                                        title={showPassword ? 'Hide password' : 'Show password'}
                                                                    >
                                                                        {showPassword ? (
                                                                            <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
                                                                                <path d="M29.71 28.29l-26-26L2.29 3.71l4.5 4.5A16.27 16.27 0 001.37 15.5a1 1 0 000 1 17.5 17.5 0 0027.69 4.29l1.65 1.65zM8.21 9.62l3.35 3.35A5 5 0 0011 16a5 5 0 005 5 5 5 0 003-.94l3.35 3.35A15.42 15.42 0 0116 26.5 15.49 15.49 0 013.43 16a14.28 14.28 0 014.78-6.38zM16 7.5a15.49 15.49 0 0112.57 10.5 14.25 14.25 0 01-3.23 5.15l-1.44-1.44A12.3 12.3 0 0026.57 16 13.5 13.5 0 0016 9.5a13.34 13.34 0 00-4.83.91L9.69 8.93A15.34 15.34 0 0116 7.5z" />
                                                                            </svg>
                                                                        ) : (
                                                                            <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
                                                                                <path d="M16 8a17.5 17.5 0 00-14.63 8 17.5 17.5 0 0029.26 0A17.5 17.5 0 0016 8zm0 13a5 5 0 115-5 5 5 0 01-5 5zm0-8a3 3 0 103 3 3 3 0 00-3-3z" />
                                                                            </svg>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="login-form__login-button-wrapper" style={{ marginTop: '16px' }}>
                                                    <button
                                                        name="login"
                                                        className="login-form__button cds--btn cds--btn--primary"
                                                        type="button"
                                                        disabled={isLoading || !password}
                                                        onClick={handleLoginSubmit}
                                                    >
                                                        <span>{isLoading ? 'Logging in...' : 'Log in'}</span>
                                                        {isLoading ? (
                                                            <PulseLoader size="small" />
                                                        ) : (
                                                            <svg
                                                                focusable="false"
                                                                preserveAspectRatio="xMidYMid meet"
                                                                fill="currentColor"
                                                                aria-hidden="true"
                                                                width="16"
                                                                height="16"
                                                                viewBox="0 0 16 16"
                                                                className="cds--btn__icon"
                                                            >
                                                                <path d="M9.3 3.7 13.1 7.5 1 7.5 1 8.5 13.1 8.5 9.3 12.3 10 13 15 8 10 3z" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="login-form__footer" style={{ marginTop: '16px' }}>
                                                    <div className="forgot-links">
                                                        <div className="forgot-links__ibm-id-links">
                                                            <button
                                                                type="button"
                                                                onClick={() => changeMode('forgot-password')}
                                                                className="cds--link"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                            >
                                                                Forgot password?
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </form>
                            )}

                            {/* ================= REGISTRATION FORM ================= */}
                            {authMode === 'register' && (
                                <form
                                    aria-labelledby="page-title"
                                    className="login-form"
                                    noValidate
                                    onSubmit={registrationVerificationToken ? handleRegistrationVerificationSubmit : handleRegisterSubmit}
                                >
                                    <h1 id="page-title" className="login-form__title">
                                        Create a Votion<span className="login-form__title-2">ID</span>
                                    </h1>
                                    <div className="login-form__create-account">
                                        Already have an account?&ensp;
                                        <button
                                            type="button"
                                            onClick={() => changeMode('login')}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#78a9ff',
                                                cursor: 'pointer',
                                                padding: 0,
                                                font: 'inherit',
                                            }}
                                        >
                                            Log in
                                        </button>
                                    </div>

                                    {!registrationVerificationToken ? (
                                        <div className="login-form__input-rows" style={{ marginTop: '16px' }}>
                                            <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '16px' }}>
                                                <label className="cds--label">Full Name</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={regName}
                                                    onChange={(e) => setRegName(e.target.value)}
                                                    placeholder="Alex Mercer"
                                                    className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                                />
                                            </div>
                                            <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '16px' }}>
                                                <label className="cds--label">Email Address</label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={regEmail}
                                                    onChange={(e) => setRegEmail(e.target.value)}
                                                    placeholder="name@example.com"
                                                    className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                                />
                                            </div>
                                            <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '24px' }}>
                                                <label className="cds--label">Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={regPassword}
                                                    onChange={(e) => setRegPassword(e.target.value)}
                                                    placeholder="Create a strong password"
                                                    className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                                />
                                            </div>
                                            <div className="login-form__login-button-wrapper">
                                                <button
                                                    type="submit"
                                                    disabled={isLoading || !regEmail || !regPassword || !regName}
                                                    className="login-form__button cds--btn cds--btn--primary"
                                                >
                                                    <span>{isLoading ? 'Creating account...' : 'Create account'}</span>
                                                    <svg
                                                        focusable="false"
                                                        preserveAspectRatio="xMidYMid meet"
                                                        fill="currentColor"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 16 16"
                                                        className="cds--btn__icon"
                                                    >
                                                        <path d="M9.3 3.7 13.1 7.5 1 7.5 1 8.5 13.1 8.5 9.3 12.3 10 13 15 8 10 3z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="login-form__input-rows" style={{ marginTop: '16px' }}>
                                            <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '24px' }}>
                                                <label className="cds--label">6-Digit Verification Code</label>
                                                <input
                                                    type="text"
                                                    required
                                                    maxLength={6}
                                                    value={registrationOtp}
                                                    onChange={(e) => setRegistrationOtp(e.target.value)}
                                                    placeholder="000000"
                                                    className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                                    style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '18px' }}
                                                />
                                            </div>
                                            <div className="login-form__login-button-wrapper">
                                                <button
                                                    type="submit"
                                                    disabled={isLoading || registrationOtp.length < 6}
                                                    className="login-form__button cds--btn cds--btn--primary"
                                                >
                                                    <span>{isLoading ? 'Verifying...' : 'Verify Email & Finish'}</span>
                                                    <svg
                                                        focusable="false"
                                                        preserveAspectRatio="xMidYMid meet"
                                                        fill="currentColor"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 16 16"
                                                        className="cds--btn__icon"
                                                    >
                                                        <path d="M9.3 3.7 13.1 7.5 1 7.5 1 8.5 13.1 8.5 9.3 12.3 10 13 15 8 10 3z" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={handleResendRegistrationOtp}
                                                    className="cds--link"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                                >
                                                    Didn&apos;t receive code? Resend
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </form>
                            )}

                            {/* ================= FORGOT PASSWORD ================= */}
                            {authMode === 'forgot-password' && (
                                <form aria-labelledby="page-title" className="login-form" noValidate onSubmit={handleForgotSubmit}>
                                    <h1 id="page-title" className="login-form__title">
                                        Reset your<span className="login-form__title-2">Password</span>
                                    </h1>
                                    <div className="login-form__create-account">
                                        Enter your account email to receive a password reset link.
                                    </div>
                                    <div className="login-form__input-rows" style={{ marginTop: '16px' }}>
                                        <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '24px' }}>
                                            <label className="cds--label">Email Address</label>
                                            <input
                                                type="email"
                                                required
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                placeholder="name@example.com"
                                                className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                            />
                                        </div>
                                        <div className="login-form__login-button-wrapper">
                                            <button
                                                type="submit"
                                                disabled={isLoading || !resetEmail}
                                                className="login-form__button cds--btn cds--btn--primary"
                                            >
                                                <span>{isLoading ? 'Sending...' : 'Send reset link'}</span>
                                                <svg
                                                    focusable="false"
                                                    preserveAspectRatio="xMidYMid meet"
                                                    fill="currentColor"
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 16 16"
                                                    className="cds--btn__icon"
                                                >
                                                    <path d="M9.3 3.7 13.1 7.5 1 7.5 1 8.5 13.1 8.5 9.3 12.3 10 13 15 8 10 3z" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={() => changeMode('login')}
                                                className="cds--link"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                                            >
                                                &larr; Back to login
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {/* ================= RESET PASSWORD FORM ================= */}
                            {authMode === 'reset-password' && (
                                <form aria-labelledby="page-title" className="login-form" noValidate onSubmit={handleResetPasswordSubmit}>
                                    <h1 id="page-title" className="login-form__title">
                                        Set New<span className="login-form__title-2">Password</span>
                                    </h1>
                                    <div className="login-form__create-account">
                                        Choose a new password for your account.
                                    </div>
                                    <div className="login-form__input-rows" style={{ marginTop: '16px' }}>
                                        <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '16px' }}>
                                            <label className="cds--label">Email Address</label>
                                            <input
                                                type="email"
                                                required
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                placeholder="name@example.com"
                                                className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                            />
                                        </div>
                                        <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '16px' }}>
                                            <label className="cds--label">New Password</label>
                                            <input
                                                type="password"
                                                required
                                                value={resetPassword}
                                                onChange={(e) => setResetPassword(e.target.value)}
                                                placeholder="Enter new password"
                                                className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                            />
                                        </div>
                                        <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '24px' }}>
                                            <label className="cds--label">Confirm New Password</label>
                                            <input
                                                type="password"
                                                required
                                                value={resetPasswordConfirmation}
                                                onChange={(e) => setResetPasswordConfirmation(e.target.value)}
                                                placeholder="Confirm new password"
                                                className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                            />
                                        </div>
                                        <div className="login-form__login-button-wrapper">
                                            <button
                                                type="submit"
                                                disabled={isLoading || !resetPassword || !resetPasswordConfirmation}
                                                className="login-form__button cds--btn cds--btn--primary"
                                            >
                                                <span>{isLoading ? 'Resetting password...' : 'Reset password'}</span>
                                                <svg
                                                    focusable="false"
                                                    preserveAspectRatio="xMidYMid meet"
                                                    fill="currentColor"
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 16 16"
                                                    className="cds--btn__icon"
                                                >
                                                    <path d="M9.3 3.7 13.1 7.5 1 7.5 1 8.5 13.1 8.5 9.3 12.3 10 13 15 8 10 3z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {/* ================= 2FA / CHECKPOINT ================= */}
                            {authMode === '2fa' && (
                                <form aria-labelledby="page-title" className="login-form" noValidate onSubmit={handle2FASubmit}>
                                    <h1 id="page-title" className="login-form__title">
                                        Two-Factor<span className="login-form__title-2">Authentication</span>
                                    </h1>
                                    <div className="login-form__create-account">
                                        Enter the 6-digit code generated by your authenticator app.
                                    </div>
                                    <div className="login-form__input-rows" style={{ marginTop: '16px' }}>
                                        <div className="cds--form-item login-form__user-id cds--text-input-wrapper" style={{ marginBottom: '24px' }}>
                                            <label className="cds--label">Authenticator Code</label>
                                            <input
                                                type="text"
                                                required
                                                maxLength={6}
                                                value={totpCode}
                                                onChange={(e) => setTotpCode(e.target.value)}
                                                placeholder="000000"
                                                className="cds--text-input cds--text-input--lg cds--layout--size-lg"
                                                style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '18px' }}
                                            />
                                        </div>
                                        <div className="login-form__login-button-wrapper">
                                            <button
                                                type="submit"
                                                disabled={isLoading || totpCode.length < 6}
                                                className="login-form__button cds--btn cds--btn--primary"
                                            >
                                                <span>{isLoading ? 'Verifying...' : 'Verify & Continue'}</span>
                                                <svg
                                                    focusable="false"
                                                    preserveAspectRatio="xMidYMid meet"
                                                    fill="currentColor"
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 16 16"
                                                    className="cds--btn__icon"
                                                >
                                                    <path d="M9.3 3.7 13.1 7.5 1 7.5 1 8.5 13.1 8.5 9.3 12.3 10 13 15 8 10 3z" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={() => changeMode('login')}
                                                className="cds--link"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                                            >
                                                &larr; Back to login
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Bottom Copyright Clause */}
                        <div className="copyright-clause">
                            <span>
                                &copy; Copyright Votion Cloud 2026. All rights reserved.&nbsp;
                                <a target="_blank" rel="noreferrer" href="https://votioncloud.org/privacy">
                                    Privacy
                                </a>
                            </span>
                        </div>
                    </div>
                </div>

                {/* ---------------- Right Promotion Container ---------------- */}
                <div className="promotion-container">
                    <div className="promotion-wrapper">
                        <div
                            className="promotion-box"
                            style={{ '--promo-bg': 'linear-gradient(180deg,#e5f6ff,#bae6ff)' } as React.CSSProperties}
                        >
                            <div className="promotion-content-top">
                                <div className="promotion-title-wrapper">
                                    <div className="promotion-title">Votion Cloud ™</div>
                                </div>
                                <div className="promotion-description-wrapper">
                                    <div className="promotion-description">
                                        Accelerates high-performance NVMe cloud compute and mission-critical workflows with zero-latency performance.
                                    </div>
                                </div>
                            </div>
                            <div className="promotion-button-wrapper">
                                <a
                                    href="https://votioncloud.org"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="promotion-button cds--g10 cds--btn cds--btn--tertiary"
                                >
                                    <span className="promotion-button-text">Learn more</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================= PASSKEY PROMPT MODAL ================= */}
            {showPasskeyPrompt && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <div
                        style={{
                            background: '#262626',
                            border: '1px solid #525252',
                            width: '100%',
                            maxWidth: '440px',
                            padding: '24px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    background: 'rgba(15,98,254,0.2)',
                                    color: '#78a9ff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 2l-2 2m-1.5 1.5L14 9a5 5 0 1 0-7 7 5 5 0 0 0 7-7l2.5-2.5m1.5-1.5L21 2" />
                                    <circle cx="7.5" cy="16.5" r="1.5" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ color: '#f4f4f4', fontWeight: 600, fontSize: '16px' }}>Enable Fast Passkey Login?</div>
                                <div style={{ color: '#8d8d8d', fontSize: '12px' }}>
                                    Sign in instantly next time with Windows Hello, Touch ID, or security key.
                                </div>
                            </div>
                        </div>

                        {passkeyError && (
                            <div
                                style={{
                                    background: '#2d0709',
                                    borderLeft: '3px solid #fa4d56',
                                    color: '#fff',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    marginBottom: '16px',
                                }}
                            >
                                {passkeyError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={handleEnrollPasskeyNow}
                                disabled={passkeyLoading}
                                className="cds--btn cds--btn--primary"
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                {passkeyLoading ? 'Setting up...' : 'Setup Passkey'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSkipPasskey}
                                className="cds--btn cds--btn--tertiary"
                                style={{ flex: 1, justifyContent: 'center' }}
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
