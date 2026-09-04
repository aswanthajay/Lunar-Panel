import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../services/apiClient';

type InstallationState = 'checking' | 'code-entry' | 'ready' | 'unavailable' | 'complete';

export const InstallationWizard: React.FC = () => {
  const [state, setState] = useState<InstallationState>('checking');
  const [setupCode, setSetupCode] = useState('');
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [publicAppUrl, setPublicAppUrl] = useState(() => window.location.origin);
  const [applicationPort, setApplicationPort] = useState(() => String(window.location.port || 5000));
  const [corsOrigins, setCorsOrigins] = useState(() => window.location.origin);
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirmation, setAdminPasswordConfirmation] = useState('');
  const [databaseVerified, setDatabaseVerified] = useState(false);
  const [isTestingDatabase, setIsTestingDatabase] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const requestHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
  }), []);

  useEffect(() => {
    let active = true;
    void fetch(`${API_BASE_URL}/installation/status`, { headers: requestHeaders, credentials: 'same-origin' })
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 410) {
          setState('code-entry');
          setError(null);
          return;
        }
        if (!response.ok || !data.success) {
          setState('unavailable');
          setError(data.error || 'The installation service could not verify its current setup state.');
          return;
        }
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setState('unavailable');
        setError('Unable to reach the installation service.');
      });
    return () => { active = false; };
  }, [requestHeaders]);

  const redeemSetupCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = setupCode.trim().toUpperCase();
    if (!code) {
      setError('Enter the one-time setup code shown in the server console.');
      return;
    }

    setError(null);
    setIsRedeemingCode(true);
    try {
      const response = await fetch(`${API_BASE_URL}/installation/session`, {
        method: 'POST',
        headers: requestHeaders,
        credentials: 'same-origin',
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setError(data.error || 'The setup code could not be verified.');
        return;
      }
      setSetupCode('');
      setState('ready');
    } catch {
      setError('Unable to reach the installation service while verifying the setup code.');
    } finally {
      setIsRedeemingCode(false);
    }
  };

  const testDatabase = async () => {
    setError(null);
    setMessage(null);
    setDatabaseVerified(false);
    if (!databaseUrl.trim()) {
      setError('Enter your PostgreSQL connection URL before testing it.');
      return;
    }
    setIsTestingDatabase(true);
    try {
      const response = await fetch(`${API_BASE_URL}/installation/validate-database`, {
        method: 'POST',
        headers: requestHeaders,
        credentials: 'same-origin',
        body: JSON.stringify({ databaseUrl }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setError(data.error || 'The database connection could not be verified.');
        return;
      }
      setDatabaseVerified(true);
      setMessage('Database connection and required write permissions have been verified.');
    } catch {
      setError('Unable to reach the installation service while testing the database.');
    } finally {
      setIsTestingDatabase(false);
    }
  };

  const completeInstallation = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!databaseVerified) {
      setError('Verify the database connection before completing installation.');
      return;
    }
    const normalizedPort = applicationPort.trim();
    if (!/^\d{1,5}$/.test(normalizedPort) || Number(normalizedPort) < 1 || Number(normalizedPort) > 65535) {
      setError('Use an application port between 1 and 65535.');
      return;
    }
    if (adminPassword.length < 12) {
      setError('Use an administrator password with at least 12 characters.');
      return;
    }
    if (adminPassword !== adminPasswordConfirmation) {
      setError('The administrator password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/installation/complete`, {
        method: 'POST',
        headers: requestHeaders,
        credentials: 'same-origin',
        body: JSON.stringify({ databaseUrl, publicAppUrl, port: Number(applicationPort), corsOrigins, adminName, adminPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setError(data.error || 'Installation could not be completed.');
        return;
      }
      setAdminPassword('');
      setAdminPasswordConfirmation('');
      setState('complete');
      setMessage(data.message || 'Installation is complete. Restart the service to launch Votion One™.');
    } catch {
      setError('Unable to reach the installation service while saving configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page min-h-screen bg-white px-4 py-8 sm:px-8 lg:px-12">
      <div className="installation-wizard-shell mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-2xl border border-[#dedfdf] bg-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="installation-wizard-editorial bg-black p-8 text-white sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Votion One™</p>
          <h1 className="mt-8 max-w-md font-serif text-4xl leading-tight italic sm:text-5xl">Install your control plane with confidence.</h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-zinc-300">This guided setup verifies your database, generates required application secrets, establishes the trusted application origin, and creates the first administrator. Provider connections remain optional and are configured later from the administrator panel.</p>
          <div className="mt-10 space-y-4 border-t border-zinc-800 pt-7 text-sm text-zinc-300">
            <p><span className="mr-3 font-mono text-zinc-500">01</span>Database connection and schema initialization</p>
            <p><span className="mr-3 font-mono text-zinc-500">02</span>Trusted browser origin and session protection</p>
            <p><span className="mr-3 font-mono text-zinc-500">03</span>Administrator account provisioning</p>
            <p><span className="mr-3 font-mono text-zinc-500">04</span>Optional provider connection after sign-in</p>
          </div>
        </section>

        <section className="auth-page-panel installation-wizard-panel p-6 sm:p-12">
          <div className="mx-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#656b6b]">First-run installation</p>
            <h2 className="mt-3 text-3xl font-medium text-[#1a1a1a]" style={{ fontFamily: 'var(--ink-font-global-family-prominent), Georgia, serif' }}>Configure Votion One™</h2>
            <p className="mt-2 text-sm leading-6 text-[#656b6b]">Required values are stored in the protected runtime configuration after validation. The one-time setup code becomes unavailable after it is redeemed or installation is complete.</p>

            {error && <div className="mt-6 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#dc2626]" role="alert">{error}</div>}
            {message && <div className="mt-6 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#16a34a]" role="status">{message}</div>}

            {state === 'checking' && <div className="mt-8 rounded-lg border border-[#dedfdf] bg-[#fafafa] px-4 py-3 text-sm text-[#656b6b]">Verifying the protected installation session…</div>}
            {state === 'code-entry' && (
              <form className="mt-8 space-y-5 rounded-xl border border-[#dedfdf] bg-[#fafafa] p-5" onSubmit={redeemSetupCode}>
                <div>
                  <h3 className="text-base font-semibold text-[#1a1a1a]">Enter setup code</h3>
                  <p className="mt-1.5 text-sm leading-6 text-[#656b6b]">Open the local server console, copy the one-time code shown after the `[INSTALL]` message, and enter it here. The code expires after 30 minutes and is exchanged for a protected browser session.</p>
                </div>
                <div>
                  <label htmlFor="installer-setup-code" className="mb-1.5 block text-sm text-[#1a1a1a]">One-time setup code</label>
                  <input id="installer-setup-code" value={setupCode} onChange={(event) => setSetupCode(event.target.value.toUpperCase())} type="password" autoComplete="one-time-code" spellCheck={false} placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX" className="w-full rounded-md border border-[#111111] px-3 py-2.5 font-mono text-sm uppercase tracking-[0.12em] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-black/10" required />
                </div>
                <button type="submit" disabled={isRedeemingCode} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-60">
                  {isRedeemingCode ? 'Verifying code…' : 'Continue to installation'}
                </button>
              </form>
            )}
            {state === 'unavailable' && <div className="mt-8 rounded-lg border border-[#dedfdf] bg-[#fafafa] px-4 py-4 text-sm leading-6 text-[#656b6b]">This installation wizard is unavailable. Confirm that the installation service is running, then reload this page.</div>}
            {state === 'complete' && <div className="mt-8 rounded-lg border border-[#dedfdf] bg-[#fafafa] px-4 py-4 text-sm leading-6 text-[#656b6b]">Configuration is saved. Restart the service once to leave installation mode and sign in as the administrator you created.</div>}

            {state === 'ready' && (
              <form className="mt-8 space-y-7" onSubmit={completeInstallation}>
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-[#1a1a1a]">Database</legend>
                  <div>
                    <label htmlFor="installer-database-url" className="mb-1.5 block text-sm text-[#1a1a1a]">PostgreSQL connection URL</label>
                    <input id="installer-database-url" value={databaseUrl} onChange={(event) => { setDatabaseUrl(event.target.value); setDatabaseVerified(false); }} type="password" autoComplete="off" placeholder="postgresql://user:password@host:5432/database" className="w-full rounded-md border border-[#111111] px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-black/10" required />
                  </div>
                  <button type="button" onClick={() => void testDatabase()} disabled={isTestingDatabase} className="rounded-full border border-[#111111] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition hover:bg-black hover:text-white disabled:opacity-60">
                    {isTestingDatabase ? 'Testing database…' : databaseVerified ? 'Database verified' : 'Test database connection'}
                  </button>
                </fieldset>

                <fieldset className="space-y-4 border-t border-[#dedfdf] pt-7">
                  <legend className="text-sm font-semibold text-[#1a1a1a]">Trusted application settings</legend>
                  <div>
                    <label htmlFor="installer-public-url" className="mb-1.5 block text-sm text-[#1a1a1a]">Public application URL</label>
                    <input id="installer-public-url" value={publicAppUrl} onChange={(event) => setPublicAppUrl(event.target.value)} type="url" autoComplete="url" className="w-full rounded-md border border-[#111111] px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-black/10" required />
                  </div>
                  <div>
                    <label htmlFor="installer-application-port" className="mb-1.5 block text-sm text-[#1a1a1a]">Application port</label>
                    <input id="installer-application-port" value={applicationPort} onChange={(event) => setApplicationPort(event.target.value.replace(/\D/g, '').slice(0, 5))} type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{1,5}" placeholder="5000" className="w-full rounded-md border border-[#111111] px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-black/10" required />
                    <p className="mt-1.5 text-xs text-[#656b6b]">Use the port assigned by your host. A deployment-level <code>PORT</code> environment variable takes precedence over this saved value.</p>
                  </div>
                  <div>
                    <label htmlFor="installer-cors-origins" className="mb-1.5 block text-sm text-[#1a1a1a]">Trusted browser origins</label>
                    <input id="installer-cors-origins" value={corsOrigins} onChange={(event) => setCorsOrigins(event.target.value)} type="text" autoComplete="off" className="w-full rounded-md border border-[#111111] px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-black/10" required />
                    <p className="mt-1.5 text-xs text-[#656b6b]">Use comma-separated origins only if you have more than one trusted domain.</p>
                  </div>
                </fieldset>

                <fieldset className="space-y-4 border-t border-[#dedfdf] pt-7">
                  <legend className="text-sm font-semibold text-[#1a1a1a]">Administrator</legend>
                  <p className="text-xs text-[#656b6b]">The first administrator email is fixed to admin@votioncloud.org.</p>
                  <div>
                    <label htmlFor="installer-admin-name" className="mb-1.5 block text-sm text-[#1a1a1a]">Display name</label>
                    <input id="installer-admin-name" value={adminName} onChange={(event) => setAdminName(event.target.value)} type="text" autoComplete="name" placeholder="Votion Administrator" className="w-full rounded-md border border-[#111111] px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-black/10" />
                  </div>
                  <div>
                    <label htmlFor="installer-admin-password" className="mb-1.5 block text-sm text-[#1a1a1a]">Administrator password</label>
                    <input id="installer-admin-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} type="password" autoComplete="new-password" minLength={12} placeholder="At least 12 characters" className="w-full rounded-md border border-[#111111] px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-black/10" required />
                  </div>
                  <div>
                    <label htmlFor="installer-admin-password-confirmation" className="mb-1.5 block text-sm text-[#1a1a1a]">Confirm administrator password</label>
                    <input id="installer-admin-password-confirmation" value={adminPasswordConfirmation} onChange={(event) => setAdminPasswordConfirmation(event.target.value)} type="password" autoComplete="new-password" minLength={12} className="w-full rounded-md border border-[#111111] px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-black/10" required />
                  </div>
                </fieldset>

                <button type="submit" disabled={isSubmitting || !databaseVerified} className="w-full rounded-full bg-black py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? 'Saving installation…' : 'Complete installation'}
                </button>
                <p className="text-center text-xs leading-5 text-[#656b6b]">Proxmox connections are intentionally optional. Add them securely from the administrator panel after installation.</p>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};
