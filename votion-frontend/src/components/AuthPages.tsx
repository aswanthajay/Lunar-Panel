import React, { Suspense, useState, useEffect } from 'react';
import { apiClient, API_BASE_URL } from '../services/apiClient';

interface AuthPagesProps {
  initialMode?: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'setup-admin' | '2fa';
  onNavigateToDashboard?: () => void;
  onNavigateToAuth?: (mode: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'setup-admin' | '2fa') => void;
  onLoginSuccess?: (userRole: 'admin' | 'client') => void;
}

export const AuthPages: React.FC<AuthPagesProps> = ({
  initialMode = 'login',
  onNavigateToDashboard,
  onNavigateToAuth,
  onLoginSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password' | 'reset-password' | 'setup-admin' | '2fa'>(initialMode);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    setAuthMode(initialMode);
  }, [initialMode]);

  // Login Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register Form Inputs
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [registrationVerificationToken, setRegistrationVerificationToken] = useState<string | null>(null);
  const [registrationOtp, setRegistrationOtp] = useState('');

  // Password reset form inputs
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState('');

  // One-time administrator setup inputs
  const [setupToken, setSetupToken] = useState(() => new URLSearchParams(window.location.search).get('token')?.trim() || '');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirmation, setSetupPasswordConfirmation] = useState('');
  const [setupStatus, setSetupStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  // Status & Error Banners
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Live Cluster Status (public endpoint, no auth needed)
  const [clusterStatus, setClusterStatus] = useState<{
    nodes: { name: string; ip: string; status: string; cpu: number; ramUsedGb: number; ramTotalGb: number; uptimeSeconds: number }[];
    summary: { totalNodes: number; onlineNodes: number; activeVMs: number; totalVMs: number };
  } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/status`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setClusterStatus(data);
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h`;
  };

  const triggerSuccess = (role: 'admin' | 'client') => {
    if (onNavigateToDashboard) onNavigateToDashboard();
    if (onLoginSuccess) onLoginSuccess(role);
  };

  const changeMode = (mode: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'setup-admin' | '2fa') => {
    setAuthMode(mode);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (mode !== 'register') {
      setRegistrationVerificationToken(null);
      setRegistrationOtp('');
    }
    if (onNavigateToAuth) onNavigateToAuth(mode);
  };

  useEffect(() => {
    if (authMode !== 'setup-admin') return;
    const tokenFromLink = new URLSearchParams(window.location.search).get('token')?.trim() || '';
    setSetupToken(tokenFromLink);
    if (!tokenFromLink) {
      setSetupStatus('unavailable');
      setErrorMsg('This setup link is missing its security token. Restart the service to issue a new link.');
      return;
    }
    window.history.replaceState({}, document.title, '/setup');

    let active = true;
    setSetupStatus('checking');
    void apiClient.getInitialAdminSetupStatus().then((status) => {
      if (!active) return;
      setSetupStatus(status.success && status.setupAvailable ? 'available' : 'unavailable');
      if (!status.success) setErrorMsg(status.error || 'Unable to verify initial administrator setup status.');
      if (status.success && !status.setupAvailable) setErrorMsg('This administrator setup link is no longer available.');
    });
    return () => { active = false; };
  }, [authMode]);

  const handleInitialAdminSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!setupToken) {
      setErrorMsg('This setup link is missing its security token. Restart the service to issue a new link.');
      return;
    }
    if (setupPassword.length < 12) {
      setErrorMsg('Use a password with at least 12 characters.');
      return;
    }
    if (setupPassword !== setupPasswordConfirmation) {
      setErrorMsg('The password confirmation does not match.');
      return;
    }

    setIsLoading(true);
    const result = await apiClient.completeInitialAdminSetup(setupToken, setupPassword);
    setIsLoading(false);
    if (!result.success) {
      setErrorMsg(result.error || 'Unable to complete administrator setup.');
      return;
    }

    setSetupToken('');
    setSetupPassword('');
    setSetupPasswordConfirmation('');
    setSetupStatus('unavailable');
    setSuccessMsg('Administrator setup is complete. Opening the control panel...');
    window.setTimeout(() => triggerSuccess('admin'), 700);
  };

  // Handle Login Submission
  
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/v1/auth/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, totpCode })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('votion_jwt_token', data.token);
        localStorage.setItem('votion_user_email', data.user.email);
        localStorage.setItem('votion_user_role', data.user.role);
        const role = data.user?.role || 'client';
        if (onLoginSuccess) onLoginSuccess(role);
        else window.location.href = role === 'admin' ? '/admin' : '/client';
      } else {
        setErrorMsg(data.error || 'Invalid 2FA code');
      }
    } catch (err) {
      setErrorMsg('Connection failed');
    } finally {
      setIsLoading(false);
    }
  };
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await apiClient.login(email, password);

    setIsLoading(false);
    if (res.success && res.user) {
      localStorage.setItem('votion_jwt_token', res.token || 'votion_auth_token');
      localStorage.setItem('votion_user_email', res.user.email);
      localStorage.setItem('votion_user_role', res.user.role || 'client');
      triggerSuccess(res.user.role as 'admin' | 'client');
    } else {
      setErrorMsg(res.error || 'Invalid email address or password. Please verify your credentials or use Account Recovery.');
    }
  };

  const handlePasskeyLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials?.get) {
      setErrorMsg('WebAuthn Passkeys are not supported in this browser environment.');
      return;
    }

    setIsLoading(true);
    try {
      const challengeRes = await apiClient.getPasskeyChallenge(email.trim() || undefined);
      if (!challengeRes.success || !challengeRes.challenge) {
        setErrorMsg(challengeRes.error || 'Failed to initialize passkey authentication challenge.');
        setIsLoading(false);
        return;
      }

      const challengeBuf = Uint8Array.from(atob(challengeRes.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

      const allowCredentials = Array.isArray(challengeRes.allowCredentials) && challengeRes.allowCredentials.length > 0
        ? challengeRes.allowCredentials.map((c: any) => ({
            id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)),
            type: 'public-key' as const,
          }))
        : undefined;

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challengeBuf,
          rpId: challengeRes.rpId || window.location.hostname,
          allowCredentials,
          timeout: 60000,
          userVerification: 'preferred',
        },
      }) as PublicKeyCredential | null;

      if (!assertion) {
        throw new Error('No passkey credential received.');
      }

      const rawIdB64 = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      const response = assertion.response as AuthenticatorAssertionResponse;
      const clientDataJSON = response.clientDataJSON
        ? btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
        : undefined;
      const authenticatorData = response.authenticatorData
        ? btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
        : undefined;
      const signature = response.signature
        ? btoa(String.fromCharCode(...new Uint8Array(response.signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
        : undefined;

      const loginRes = await apiClient.loginWithPasskey({
        credentialId: rawIdB64,
        clientDataJSON,
        authenticatorData,
        signature,
      });

      if (loginRes.success && loginRes.user) {
        localStorage.setItem('votion_jwt_token', loginRes.token || 'votion_auth_token');
        localStorage.setItem('votion_user_email', loginRes.user.email);
        localStorage.setItem('votion_user_role', loginRes.user.role || 'client');
        setSuccessMsg(`Welcome back, ${loginRes.user.name || loginRes.user.email}!`);
        setTimeout(() => triggerSuccess(loginRes.user.role as 'admin' | 'client'), 600);
      } else {
        setErrorMsg(loginRes.error || 'Passkey authentication failed.');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Passkey authentication was cancelled or timed out.');
      } else {
        setErrorMsg(err.message || 'Passkey sign-in failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Registration Submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await apiClient.register(regName, regEmail, regPassword);

    setIsLoading(false);
    if (res.success && res.verificationRequired && res.verificationToken) {
      setRegistrationVerificationToken(res.verificationToken);
      setRegistrationOtp('');
      setSuccessMsg(res.message || 'A verification code has been sent to your email address.');
    } else if (res.success && res.user) {
      setSuccessMsg(`Account created successfully for ${res.user.email}! Logging in...`);
      setTimeout(() => {
        triggerSuccess('client');
      }, 1000);
    } else {
      setErrorMsg(res.error || 'Registration failed');
    }
  };

  const handleRegistrationVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationVerificationToken) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);
    const res = await apiClient.verifyRegistrationEmail(regEmail, registrationVerificationToken, registrationOtp);
    setIsLoading(false);
    if (res.success && res.user) {
      setSuccessMsg(`Email verified for ${res.user.email}! Logging in...`);
      setTimeout(() => triggerSuccess('client'), 700);
    } else {
      setErrorMsg(res.error || 'Unable to verify your email address.');
    }
  };

  const resendRegistrationVerification = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);
    const res = await apiClient.register(regName, regEmail, regPassword);
    setIsLoading(false);
    if (res.success && res.verificationRequired && res.verificationToken) {
      setRegistrationVerificationToken(res.verificationToken);
      setRegistrationOtp('');
      setSuccessMsg(res.message || 'A new verification code has been sent.');
    } else {
      setErrorMsg(res.error || 'Unable to resend the verification code.');
    }
  };

  // Handle Forgot Password Submission — sends API request to backend
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always show success to prevent email enumeration
      setSuccessMsg(`If an account exists for ${email}, password reset instructions have been sent.`);
    } catch {
      setSuccessMsg(`If an account exists for ${email}, password reset instructions have been sent.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const token = new URLSearchParams(window.location.search).get('token')?.trim() || '';
    if (!token) {
      setErrorMsg('This password reset link is missing its security token. Request a new link.');
      return;
    }
    if (resetPassword.length < 12) {
      setErrorMsg('Use a password with at least 12 characters.');
      return;
    }
    if (resetPassword !== resetPasswordConfirmation) {
      setErrorMsg('The password confirmation does not match.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: resetPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'This reset link is invalid or has expired.');
        return;
      }
      setResetPassword('');
      setResetPasswordConfirmation('');
      setSuccessMsg('Password reset successfully. You can now sign in.');
      window.history.replaceState({}, document.title, '/login');
      setTimeout(() => changeMode('login'), 1200);
    } catch {
      setErrorMsg('Unable to reset your password right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#111111] outline-none text-sm text-[#1a1a1a] placeholder-transparent focus:border-[#1a1a1a] transition-colors';

  return (
    <div className="auth-page relative min-h-screen w-full font-sans bg-[#ffffff] overflow-hidden">
      <div className="auth-grid absolute inset-0 z-0 opacity-[0.2]" aria-hidden="true" />

      {/* ================= LEFT BLACK EDITORIAL PANEL ================= */}
      <div className="hidden lg:flex fixed inset-y-0 left-0 w-[42%] bg-[#000000] flex-col justify-between p-12 z-10">
        {/* Top brand lockup */}
        <div>
          <div className="text-[#ffffff] text-lg font-bold lowercase tracking-tight font-mono">votion</div>
          <div className="mt-1 text-[11px] text-[#a1a1aa] tracking-wide">ONE Platform</div>
        </div>

        {/* Middle editorial content */}
        <div className="mb-10">
          <div className="text-[11px] text-[#ffffff]/80 tracking-wider mb-5">Now Live</div>
          <h1
            className="text-[34px] leading-[1.15] text-[#ffffff] font-serif italic font-medium mb-6"
            style={{ fontFamily: 'var(--ink-font-global-family-prominent), Georgia, serif' }}
          >
            Automation, precision, and insight, everywhere you work
          </h1>
          <p className="text-[13px] leading-[1.7] text-[#ffffff]/70 max-w-[380px] mb-8">
            VOTION&apos;s proprietary compute platform is here. Provision VMs, manage firewalls,
            snapshot backups, and monitor cluster health — all from your live VOTION data,
            computed on the cluster itself, not estimated by a model.
          </p>
          <button
            type="button"
            onClick={() => changeMode('register')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#ffffff]/40 text-[#ffffff] text-[13px] font-medium hover:bg-[#ffffff]/10 transition-colors"
          >
            Create a client account
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Bottom cluster status card with dot-grid */}
        <div className="relative rounded-xl bg-[#0a0a0a] border border-[#27272a] p-6 overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-[0.12] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dotgrid" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="#3f3f46" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotgrid)" />
          </svg>

          <div className="relative z-10 flex items-start justify-between mb-5">
            <div>
              <div className="text-[9px] font-mono text-[#3f3f46] uppercase tracking-[0.2em] mb-2">NODE CLUSTER / STATUS</div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${
                    clusterStatus && clusterStatus.summary.onlineNodes === clusterStatus.summary.totalNodes
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                  }`}
                ></span>
                <span className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-widest">
                  {clusterStatus
                    ? clusterStatus.summary.onlineNodes === clusterStatus.summary.totalNodes
                      ? 'All Systems Operational'
                      : `${clusterStatus.summary.onlineNodes}/${clusterStatus.summary.totalNodes} Nodes Online`
                    : 'Connecting...'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-mono text-[#3f3f46] uppercase tracking-[0.2em] mb-1">SERVER TIME</div>
              <div className="text-lg font-extrabold text-white font-mono tracking-tighter">
                {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Node rows */}
          <div className="relative z-10 flex flex-col gap-[1px] bg-[#27272a] rounded-lg overflow-hidden border border-[#27272a] mb-5">
            {clusterStatus && clusterStatus.nodes.length > 0 ? (
              clusterStatus.nodes.map((node, i) => (
                <div key={i} className="flex items-center bg-[#0a0a0a] px-4 py-3 gap-4">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${node.status === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`}
                  ></span>
                  <span className="font-mono text-xs font-bold text-white w-20 truncate">{node.name || `lunar-0${i + 1}`}</span>
                  <span className="font-mono text-[11px] text-[#52525b] flex-1">{node.ip}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1 bg-[#27272a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#a1a1aa] rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(node.cpu, 100)}%` }}
                      ></div>
                    </div>
                    <span className="font-mono text-[11px] text-[#71717a] w-8 text-right">{node.cpu}%</span>
                  </div>
                </div>
              ))
            ) : (
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-center bg-[#0a0a0a] px-4 py-3 gap-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#27272a] flex-shrink-0"></span>
                  <span className="font-mono text-xs bg-[#1c1c1e] text-[#1c1c1e] rounded w-16 h-3">lunar-0{i + 1}</span>
                  <span className="flex-1 bg-[#1c1c1e] h-2 rounded"></span>
                  <span className="w-8 bg-[#1c1c1e] h-2 rounded"></span>
                </div>
              ))
            )}
          </div>

          {/* Bottom stat bar */}
          <div className="relative z-10 grid grid-cols-3 gap-4 pt-4 border-t border-[#27272a]">
            {[
              { label: 'ACTIVE VMs', value: clusterStatus ? String(clusterStatus.summary.activeVMs) : '—' },
              {
                label: 'NODES ONLINE',
                value: clusterStatus ? `${clusterStatus.summary.onlineNodes}/${clusterStatus.summary.totalNodes}` : '—',
              },
              { label: 'UPTIME', value: clusterStatus?.nodes[0] ? formatUptime(clusterStatus.nodes[0].uptimeSeconds) : '—' },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-[9px] font-mono text-[#3f3f46] uppercase tracking-[0.18em] mb-1">{s.label}</div>
                <div className="text-sm font-bold font-mono text-[#e4e4e7]">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= RIGHT WHITE LOGIN PANEL ================= */}
      <div className="auth-page-panel min-h-screen w-full lg:w-[58%] lg:ml-auto flex flex-col justify-between py-12 px-6 sm:px-12 relative z-20 bg-white">
        {/* Mobile brand (only visible on small screens) */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="text-lg font-bold lowercase tracking-tight font-mono">votion</div>
          <span className="text-[11px] text-[#656b6b] tracking-wide">ONE Platform</span>
        </div>

        {/* Centered form column */}
        <div className="w-full max-w-[380px] mx-auto mt-8 lg:mt-16">
          {/* Wordmark */}
          <div className="text-center mb-10">
            <div className="inline-block border border-[#111111] px-4 py-1.5 rounded text-xl font-bold lowercase tracking-tight font-mono">
              votion
            </div>
          </div>

          {/* Error / success banners */}
          {errorMsg && (
            <div className="mb-5 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-xs rounded-lg font-medium">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-5 px-4 py-3 bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-xs rounded-lg font-medium">
              {successMsg}
            </div>
          )}

          {authMode === 'setup-admin' && (
            <>
              <div className="mb-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#656b6b]">Secure first-run setup</p>
                <h2
                  className="text-[26px] text-[#1a1a1a] leading-tight mb-1 font-medium"
                  style={{ fontFamily: 'var(--ink-font-global-family-prominent), Georgia, serif' }}
                >
                  Configure your administrator
                </h2>
                <p className="text-xs text-[#656b6b]">Create the protected administrator password for admin@votioncloud.org.</p>
              </div>

              {setupStatus === 'checking' ? (
                <div className="rounded-lg border border-[#dedfdf] bg-[#fafafa] px-4 py-3 text-xs text-[#656b6b]" role="status">
                  Verifying the one-time setup link…
                </div>
              ) : setupStatus === 'available' ? (
                <form onSubmit={handleInitialAdminSetupSubmit} className="flex flex-col gap-5">
                  <div>
                    <label htmlFor="votion-setup-password" className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Administrator password</label>
                    <input
                      id="votion-setup-password"
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                      placeholder="At least 12 characters"
                      required
                      minLength={12}
                    />
                  </div>
                  <div>
                    <label htmlFor="votion-setup-password-confirmation" className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Confirm administrator password</label>
                    <input
                      id="votion-setup-password-confirmation"
                      type="password"
                      value={setupPasswordConfirmation}
                      onChange={(e) => setSetupPasswordConfirmation(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                      placeholder="Re-enter password"
                      required
                      minLength={12}
                    />
                  </div>
                  <p className="-mt-1 text-[11px] leading-relaxed text-[#656b6b]">
                    This one-time link is issued only for a new installation and becomes unavailable after administrator setup completes.
                  </p>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-full bg-[#000000] text-[#ffffff] text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                    Complete secure setup
                  </button>
                </form>
              ) : (
                <div className="rounded-lg border border-[#dedfdf] bg-[#fafafa] px-4 py-4 text-xs leading-relaxed text-[#656b6b]" role="status">
                  This setup link is unavailable. An administrator may already be configured, or the link may have expired. Restart the service to issue a replacement only if no administrator account exists.
                </div>
              )}

              <div className="mt-6 flex items-center justify-center text-xs text-[#656b6b]">
                <button type="button" onClick={() => changeMode('login')} className="text-[#1a1a1a] underline underline-offset-2 hover:opacity-70">
                  Back to log in
                </button>
              </div>
            </>
          )}

                    {authMode === '2fa' && (
            <div className="flex flex-col flex-1">
              <div className="mb-8">
                <h2 className="text-[24px] font-semibold text-[#1a1a1a] mb-2">Two-Factor Authentication</h2>
                <p className="text-[#656b6c] text-[15px]">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <form onSubmit={handle2FASubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-[#1a1a1a] uppercase tracking-wide">Authenticator Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="border border-[#dedfdf] bg-white rounded-md px-4 py-3 text-[15px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a] transition-colors"
                    placeholder="123456"
                  />
                </div>
                {errorMsg && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-[14px]">
                    {errorMsg}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-[#1a1a1a] text-white font-semibold py-3.5 px-4 rounded-md hover:bg-[#333] transition-colors mt-2 disabled:opacity-70"
                >
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>
                <div className="text-center mt-2">
                  <button type="button" onClick={() => changeMode('login')} className="text-[#656b6c] text-[14px] hover:text-[#1a1a1a] underline underline-offset-2">
                    Back to Login
                  </button>
                </div>
              </form>
            </div>
          )}
          {authMode === 'login' && (
            <>
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-6">
                <div>
                  <label htmlFor="votion-email" className="block text-sm font-medium text-[#1a1a1a] mb-1.5">
                    Email
                  </label>
                  <input
                    id="votion-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoComplete="email"
                    className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="votion-password" className="block text-sm font-medium text-[#1a1a1a]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => changeMode('forgot-password')}
                      className="text-xs text-[#1a1a1a] underline underline-offset-2 hover:opacity-70"
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
                    className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                    required
                  />
                </div>

                {/* Terms line */}
                <p className="text-[11px] text-[#656b6b] leading-relaxed -mt-1">
                  By clicking the Log in button, you agree to VOTION&apos;s{' '}
                  <a href="/legal/terms" className="underline underline-offset-2 hover:opacity-70">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/legal/privacy" className="underline underline-offset-2 hover:opacity-70">
                    Privacy Policy
                  </a>
                  .
                </p>

                {/* Black pill Log in button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-full bg-[#000000] text-[#ffffff] text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  Log in
                </button>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-0.5">
                  <div className="border-t border-[#e5e5e5] w-full"></div>
                  <span className="bg-white px-3 text-[11px] font-medium text-[#8a8a8a] uppercase tracking-wider">or</span>
                </div>

                {/* Sign in with Passkey button */}
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-full border border-[#111111] bg-white text-[#111111] text-sm font-semibold tracking-wide hover:bg-[#f4f4f5] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
                >
                  <svg className="w-4 h-4 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Sign in with Passkey
                </button>

                {/* Link row with dividers, Carta-style */}
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[#656b6b]">
                  <button
                    type="button"
                    onClick={() => changeMode('forgot-password')}
                    className="text-[#1a1a1a] underline underline-offset-2 hover:opacity-70"
                  >
                    Account recovery
                  </button>
                  <span className="text-[#d4d4d4]">|</span>
                  <button
                    type="button"
                    onClick={() => changeMode('register')}
                    className="text-[#1a1a1a] underline underline-offset-2 hover:opacity-70"
                  >
                    Create client account
                  </button>
                  <span className="text-[#d4d4d4]">|</span>
                  <button type="button" className="hover:opacity-70 text-[#656b6b]">
                    Help
                  </button>
                </div>
              </form>
            </>
          )}

          {authMode === 'register' && (
            <>
              <div className="mb-6">
                <h2
                  className="text-[26px] text-[#1a1a1a] leading-tight mb-1 font-medium"
                  style={{ fontFamily: 'var(--ink-font-global-family-prominent), Georgia, serif' }}
                >
                  {registrationVerificationToken ? 'Verify your email' : 'Create client account'}
                </h2>
                <p className="text-xs text-[#656b6b]">{registrationVerificationToken ? `Enter the six-digit code sent to ${regEmail}.` : 'Register a new client on Votion Cloud.'}</p>
              </div>

              {registrationVerificationToken ? (
                <form onSubmit={handleRegistrationVerificationSubmit} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Verification code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={registrationOtp}
                      onChange={(e) => setRegistrationOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm tracking-[0.32em] text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                      required
                      minLength={6}
                      maxLength={6}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || registrationOtp.length !== 6}
                    className="w-full py-3 rounded-full bg-[#000000] text-[#ffffff] text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                    Verify and create account
                  </button>
                  <div className="flex items-center justify-center gap-3 text-xs text-[#656b6b]">
                    <button type="button" disabled={isLoading} onClick={() => void resendRegistrationVerification()} className="text-[#1a1a1a] underline underline-offset-2 hover:opacity-70 disabled:opacity-50">Resend code</button>
                    <button type="button" disabled={isLoading} onClick={() => { setRegistrationVerificationToken(null); setRegistrationOtp(''); setErrorMsg(null); setSuccessMsg(null); }} className="text-[#1a1a1a] underline underline-offset-2 hover:opacity-70 disabled:opacity-50">Change details</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Work Email</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="jane@company.com"
                      autoComplete="email"
                      className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Password</label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-full bg-[#000000] text-[#ffffff] text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                    Create account
                  </button>
                  <div className="flex items-center justify-center gap-2 text-xs text-[#656b6b]">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => changeMode('login')}
                      className="text-[#1a1a1a] underline underline-offset-2 hover:opacity-70"
                    >
                      Log in
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {authMode === 'forgot-password' && (
            <>
              <div className="mb-6">
                <h2
                  className="text-[26px] text-[#1a1a1a] leading-tight mb-1 font-medium"
                  style={{ fontFamily: 'var(--ink-font-global-family-prominent), Georgia, serif' }}
                >
                  Reset your password
                </h2>
                <p className="text-xs text-[#656b6b]">Enter your email to receive password reset instructions.</p>
              </div>

              <form onSubmit={handleForgotSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-full bg-[#000000] text-[#ffffff] text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  Send Reset Link
                </button>
                <div className="flex items-center justify-center text-xs text-[#656b6b]">
                  <button
                    type="button"
                    onClick={() => changeMode('login')}
                    className="text-[#1a1a1a] underline underline-offset-2 hover:opacity-70"
                  >
                    ← Back to Log in
                  </button>
                </div>
              </form>
            </>
          )}

          {authMode === 'reset-password' && (
            <>
              <div className="mb-6">
                <h2
                  className="text-[26px] text-[#1a1a1a] leading-tight mb-1 font-medium"
                  style={{ fontFamily: 'var(--ink-font-global-family-prominent), Georgia, serif' }}
                >
                  Set a new password
                </h2>
                <p className="text-xs text-[#656b6b]">Choose a new password for your account. This link can be used once.</p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">New password</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                    required
                    minLength={12}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Confirm new password</label>
                  <input
                    type="password"
                    value={resetPasswordConfirmation}
                    onChange={(e) => setResetPasswordConfirmation(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 border border-[#111111] rounded-md outline-none text-sm text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10 transition-shadow"
                    required
                    minLength={12}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-full bg-[#000000] text-[#ffffff] text-sm font-semibold tracking-wide hover:bg-[#1c1c1c] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  Reset password
                </button>
                <div className="flex items-center justify-center text-xs text-[#656b6b]">
                  <button
                    type="button"
                    onClick={() => changeMode('login')}
                    className="text-[#1a1a1a] underline underline-offset-2 hover:opacity-70"
                  >
                    ← Back to Log in
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer links, Carta-style */}
        <div className="auth-page-footer w-full max-w-[380px] mx-auto mt-12 flex items-center justify-between text-[11px] text-[#656b6b]">
          <div>&copy; 2026 Votion One™ Platform</div>
          <button type="button" className="hover:opacity-70 underline underline-offset-2">
            View latest updates
          </button>
        </div>
      </div>
    </div>
  );
};
