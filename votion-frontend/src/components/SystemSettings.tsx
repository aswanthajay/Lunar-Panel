import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

interface MailTemplate {
  id: number;
  template_key: string;
  subject: string;
  body: string;
  enabled: boolean;
  updated_at?: string;
}

interface PlatformSettings {
  faviconUrl: string;
  timezone: string;
}

interface MailNotifs {
  smtp_enabled?: boolean;
  alert_emails?: string;
  expiry_warning_emails?: string;
  welcome_emails?: string;
  alert_enabled?: boolean;
  expiry_enabled?: boolean;
  welcome_enabled?: boolean;
}

const PREVIEW_STYLES = {
  backgroundColor: '#050505',
  color: '#f5f5f2',
  fontFamily: 'Arial, Helvetica, sans-serif',
  lineHeight: 1.6,
};

const friendlyKey = (key: string): string => {
  const map: Record<string, string> = {
    registration_verification: 'Registration Verification',
    welcome: 'Welcome Email',
    ticket_update: 'Support Ticket Update',
    billing_reminder: 'Billing Reminder',
    expiry_warning: 'Service Expiry Warning',
    alert_fired: 'Alert Triggered',
    password_reset: 'Password Changed',
    account_updated: 'Account Updated',
    connection_test: 'Connection Test Result',
  };
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const SystemSettings: React.FC = () => {
  const [tab, setTab] = useState<'platform' | 'smtp' | 'templates' | 'notifications' | 'ovh' | 'hetzner'>('platform');
  const [ovhEnabled, setOvhEnabled] = useState(false);
  const [ovhEndpoint, setOvhEndpoint] = useState('ovh-eu');
  const [ovhAppKey, setOvhAppKey] = useState('');
  const [ovhAppSecret, setOvhAppSecret] = useState('');
  const [ovhConsumerKey, setOvhConsumerKey] = useState('');
  const [ovhSaving, setOvhSaving] = useState(false);
  const [ovhTesting, setOvhTesting] = useState(false);
  const [ovhGeneratingKey, setOvhGeneratingKey] = useState(false);

  // Hetzner Robot
  const [hetznerEnabled, setHetznerEnabled] = useState(false);
  const [hetznerUser, setHetznerUser] = useState('');
  const [hetznerPassword, setHetznerPassword] = useState('');
  const [hetznerSaving, setHetznerSaving] = useState(false);
  const [hetznerTesting, setHetznerTesting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // SMTP
  const [config, setConfig] = useState({
    enabled: false,
    host: '',
    port: 587,
    user: '',
    pass: '',
    secure: false,
    from: 'noreply@votioncloud.org',
  });

  // Mail templates
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [editTemplate, setEditTemplate] = useState<MailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  // Notifications
  const [notifs, setNotifs] = useState<MailNotifs>({});
  const [notifsSaving, setNotifsSaving] = useState(false);
  const [platform, setPlatform] = useState<PlatformSettings>({ faviconUrl: '/votion-logo-metallic.png', timezone: 'Asia/Kolkata' });
  const [platformSaving, setPlatformSaving] = useState(false);

  const show = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  useEffect(() => {
    (async () => {
      try {
        const platformResponse = await apiClient.getPlatformSettings();
        if (platformResponse.success && platformResponse.data) setPlatform(platformResponse.data);
        const smtp = await apiClient.getSmtpConfig();
        if (smtp.success && smtp.data) setConfig(smtp.data);
        const tpl = await apiClient.getMailTemplates();
        if (tpl.success) setTemplates(tpl.data || []);
        const n = await apiClient.getMailNotifications();
        if (n.success) setNotifs(n.data || {});

        const ovhConf = await apiClient.getOvhSettings().catch(() => null);
        if (ovhConf?.data) {
          setOvhEnabled(Boolean(ovhConf.data.enabled));
          setOvhEndpoint(ovhConf.data.endpoint || 'ovh-eu');
          setOvhAppKey(ovhConf.data.applicationKey || '');
          setOvhAppSecret(ovhConf.data.applicationSecret || '');
          setOvhConsumerKey(ovhConf.data.consumerKey || '');
        }

        const hetzConf = await apiClient.getHetznerConfig().catch(() => null);
        if (hetzConf) {
          setHetznerEnabled(Boolean(hetzConf.enabled));
          setHetznerUser(hetzConf.user || '');
          setHetznerPassword(hetzConf.password || '');
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient.saveSmtpConfig(config);
      if (res.success) {
        show('success', 'SMTP configuration saved and applied.');
      } else {
        show('error', res.error || 'Failed to save settings.');
      }
    } catch (err) {
      show('error', 'Network error saving configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      show('error', 'Please enter a test email address.');
      return;
    }
    setTesting(true);
    try {
      const res = await apiClient.testSmtp(testEmail);
      if (res.success) {
        show('success', 'Test email dispatched successfully! Check your inbox.');
      } else {
        show('error', res.error || 'Failed to send test email.');
      }
    } catch (err) {
      show('error', 'Network error sending test email.');
    } finally {
      setTesting(false);
    }
  };

  const openTemplateEdit = (t: MailTemplate) => {
    setEditTemplate(t);
    setEditSubject(t.subject);
    setEditBody(t.body);
  };

  const handleSaveTemplate = async () => {
    if (!editTemplate) return;
    setSaving(true);
    try {
      const res = await apiClient.updateMailTemplate(editTemplate.template_key, {
        subject: editSubject,
        body: editBody,
        enabled: editTemplate.enabled,
      });
      if (res.success) {
        setTemplates((prev) => prev.map((x) => (x.template_key === editTemplate.template_key ? res.template : x)));
        show('success', `Template "${friendlyKey(editTemplate.template_key)}" updated`);
        setEditTemplate(null);
      } else {
        show('error', res.error || 'Failed to update template');
      }
    } catch (err) {
      show('error', 'Network error updating template');
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplateEnabled = async (t: MailTemplate) => {
    try {
      const res = await apiClient.updateMailTemplate(t.template_key, { enabled: !t.enabled });
      if (res.success) {
        setTemplates((prev) => prev.map((x) => (x.template_key === t.template_key ? res.template : x)));
      }
    } catch (err) {
      show('error', 'Network error');
    }
  };

  const handleSavePlatform = async () => {
    setPlatformSaving(true);
    try {
      const res = await apiClient.savePlatformSettings(platform);
      if (res.success && res.data) {
        setPlatform(res.data);
        document.documentElement.dataset.timezone = res.data.timezone;
        const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (favicon) favicon.href = res.data.faviconUrl;
        show('success', 'Platform branding and timezone saved.');
      } else {
        show('error', res.error || 'Failed to save platform settings.');
      }
    } catch {
      show('error', 'Network error saving platform settings.');
    } finally {
      setPlatformSaving(false);
    }
  };

  const handleSaveOvh = async () => {
      setOvhSaving(true);
      try {
        const res = await apiClient.saveOvhSettings({
          enabled: ovhEnabled,
          endpoint: ovhEndpoint,
          applicationKey: ovhAppKey,
          applicationSecret: ovhAppSecret,
          consumerKey: ovhConsumerKey,
        });
        if (res.success) {
          show('success', 'OVH configuration saved and applied.');
        } else {
          show('error', res.error || 'Failed to save OVH settings.');
        }
      } catch {
        show('error', 'Network error saving OVH configuration.');
      } finally {
        setOvhSaving(false);
      }
    };

    const handleTestOvh = async () => {
      setOvhTesting(true);
      try {
        const res = await apiClient.testOvhSettings();
        if (res.success) {
          show('success', res.message || 'Connection test succeeded!');
        } else {
          show('error', res.error || 'Connection test failed.');
        }
      } catch {
        show('error', 'Network error during connection test.');
      } finally {
        setOvhTesting(false);
      }
    };

    const handleSaveHetzner = async () => {
      setHetznerSaving(true);
      try {
        const res = await apiClient.saveHetznerConfig({
          enabled: hetznerEnabled,
          user: hetznerUser,
          password: hetznerPassword,
        });
        if (res.success) {
          show('success', 'Hetzner Robot configuration saved and applied.');
        } else {
          show('error', res.error || 'Failed to save Hetzner settings.');
        }
      } catch {
        show('error', 'Network error saving Hetzner configuration.');
      } finally {
        setHetznerSaving(false);
      }
    };

    const handleTestHetzner = async () => {
      setHetznerTesting(true);
      try {
        const res = await apiClient.testHetznerConnection();
        if (res.success) {
          show('success', res.message || 'Hetzner connection test succeeded!');
        } else {
          show('error', res.error || 'Hetzner connection test failed.');
        }
      } catch {
        show('error', 'Network error during Hetzner connection test.');
      } finally {
        setHetznerTesting(false);
      }
    };

    const handleGenerateOvhKey = async () => {
      if (!ovhAppKey) {
        show('error', 'Please enter your Application Key first.');
        return;
      }
      setOvhGeneratingKey(true);
      try {
        const res = await apiClient.generateOvhConsumerKey(ovhEndpoint, ovhAppKey);
        if (res.success && res.consumerKey) {
          setOvhConsumerKey(res.consumerKey);
          show('success', 'Consumer Key generated! Authorization page opened.');
          if (res.validationUrl) {
            window.open(res.validationUrl, '_blank', 'noopener,noreferrer');
          }
        } else {
          show('error', res.error || 'Failed to generate Consumer Key from OVH.');
        }
      } catch {
        show('error', 'Network error generating OVH Consumer Key.');
      } finally {
        setOvhGeneratingKey(false);
      }
    };

  const handleSaveNotifs = async () => {
    setNotifsSaving(true);
    try {
      const res = await apiClient.updateMailNotifications(notifs);
      if (res.success) {
        show('success', 'Notification preferences saved');
      } else {
        show('error', res.error || 'Failed to save preferences');
      }
    } catch (err) {
      show('error', 'Network error saving preferences');
    } finally {
      setNotifsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-[#656b6b]">Loading system settings...</div>;
  }

  const tabs = [
    { key: 'platform', label: 'Platform' },
    { key: 'smtp', label: 'SMTP Server' },
    { key: 'templates', label: 'Mail Templates' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'ovh', label: 'OVH Cloud API' },
    { key: 'hetzner', label: 'Hetzner Robot API' },
  ] as const;

  return (
    <div className="p-8 max-w-[960px]">
      <div className="mb-8">
        <h1 className="page-heading">System Settings</h1>
        <p className="text-sm text-[#656b6b]">Manage global platform configurations, mailers, and notification preferences.</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#dedfdf]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors border-b-2 -mb-px cursor-pointer ${
              tab === t.key
                ? 'border-[#2563eb] text-[#2563eb]'
                : 'border-transparent text-[#656b6b] hover:text-[#1a1a1a]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`mb-6 p-4 text-sm font-medium border rounded-lg ${message.type === 'success' ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]' : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'}`}>
          {message.type === 'success' ? '✓ ' : '⚠ '}{message.text}
        </div>
      )}

      {/* ================= PLATFORM TAB ================= */}
      {tab === 'platform' && (
        <div className="bg-ink-card border border-[#dedfdf] rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-[#dedfdf] bg-[#fbfaf9]">
            <h2 className="text-base font-bold text-[#1a1a1a]">Platform Identity &amp; Timezone</h2>
            <p className="text-xs text-[#656b6b] mt-1">Control the browser badge and the timezone used for platform timestamps.</p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Favicon URL</label>
              <input
                type="url"
                value={platform.faviconUrl}
                onChange={(e) => setPlatform({ ...platform, faviconUrl: e.target.value })}
                className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                placeholder="/votion-logo-metallic.png or https://cdn.example.com/favicon.png"
                spellCheck={false}
              />
              <p className="mt-1.5 text-xs text-[#656b6b]">Use a same-origin path such as <code>/votion-logo-metallic.png</code> or an HTTPS image URL. Unsafe URL schemes are rejected.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Display timezone</label>
              <input
                type="text"
                list="votion-timezones"
                value={platform.timezone}
                onChange={(e) => setPlatform({ ...platform, timezone: e.target.value })}
                className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                placeholder="Asia/Kolkata"
                spellCheck={false}
              />
              <datalist id="votion-timezones">
                {['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'].map((zone) => <option key={zone} value={zone} />)}
              </datalist>
              <p className="mt-1.5 text-xs text-[#656b6b]">Use an IANA timezone identifier. Example: <code>Asia/Kolkata</code>.</p>
            </div>
            <div className="flex items-end justify-end">
              <button type="button" onClick={handleSavePlatform} disabled={platformSaving} className="btn-primary px-6 py-2 cursor-pointer disabled:opacity-60">
                {platformSaving ? 'Saving…' : 'Save Platform Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SMTP TAB ================= */}
      {tab === 'smtp' && (
        <div className="bg-ink-card border border-[#dedfdf] rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-[#dedfdf] flex items-center justify-between bg-[#fbfaf9]">
            <div>
              <h2 className="text-base font-bold text-[#1a1a1a]">SMTP Mail Server</h2>
              <p className="text-xs text-[#656b6b] mt-1">Configure outbound transactional emails (Password Resets, Tickets, Welcome).</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                />
                <div className={`block w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-[#2563eb]' : 'bg-[#dedfdf]'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-ink-card w-4 h-4 rounded-full transition-transform ${config.enabled ? 'transform translate-x-6' : ''}`}></div>
              </div>
              <span className="ml-3 text-sm font-semibold text-[#1a1a1a]">{config.enabled ? 'Active' : 'Disabled'}</span>
            </label>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {!config.enabled && (
              <div className="absolute inset-0 bg-ink-card/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <div className="bg-ink-card border border-[#dedfdf] shadow-lg rounded-lg px-4 py-2 text-sm font-semibold text-[#656b6b]">
                  Enable SMTP to configure settings
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">SMTP Host</label>
              <input
                type="text"
                autoComplete="off"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                placeholder="smtp.mailgun.org"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Port</label>
              <input
                type="number"
                autoComplete="off"
                value={config.port}
                onChange={(e) => {
                  const p = parseInt(e.target.value) || 587;
                  setConfig({
                    ...config,
                    port: p,
                    secure: p === 465,
                  });
                }}
                className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
              />
              <span className="text-[11px] text-[#656b6b] mt-1 block">
                Standard: <strong>587</strong> (STARTTLS) or <strong>465</strong> (SSL)
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Username</label>
              <input
                type="text"
                autoComplete="off"
                value={config.user}
                onChange={(e) => setConfig({ ...config, user: e.target.value })}
                className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                placeholder="postmaster@domain.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={config.pass}
                onChange={(e) => setConfig({ ...config, pass: e.target.value })}
                className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                placeholder="••••••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Sender Address (From)</label>
              <input
                type="email"
                autoComplete="off"
                value={config.from}
                onChange={(e) => setConfig({ ...config, from: e.target.value })}
                className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                placeholder="noreply@votioncloud.org"
              />
            </div>

            <div className="flex flex-col justify-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.secure}
                  onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
                  className="rounded border-[#dedfdf]"
                />
                <span className="text-sm font-semibold text-[#1a1a1a]">Use Direct SSL/TLS (Port 465)</span>
              </label>
              <span className="text-[11px] text-[#656b6b] mt-1 ml-6">
                {config.port === 587
                  ? 'Port 587 automatically negotiates STARTTLS encryption. Keep this unchecked.'
                  : config.port === 465
                    ? 'Port 465 requires direct SSL encryption. Keep this checked.'
                    : 'Unchecked for STARTTLS, checked for direct SSL.'}
              </span>
            </div>
          </div>

          <div className="bg-[#fbfaf9] border-t border-[#dedfdf] p-4 px-6 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <input
                type="email"
                autoComplete="off"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Test email address..."
                className="border border-[#dedfdf] rounded px-3 py-1.5 text-sm outline-none focus:border-[#1a1a1a] min-w-[200px]"
                disabled={!config.enabled}
              />
              <button
                onClick={handleTest}
                disabled={!config.enabled || testing}
                className="px-4 py-1.5 bg-ink-card border border-[#dedfdf] text-[#1a1a1a] font-semibold text-sm rounded hover:bg-[#f1f1f1] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {testing ? 'Sending...' : 'Send Test'}
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-[#1a1a1a] text-white font-semibold text-sm rounded-lg hover:bg-black transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* ================= MAIL TEMPLATES TAB ================= */}
      {tab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.template_key} className="bg-ink-card border border-[#dedfdf] rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1a1a1a]">{friendlyKey(t.template_key)}</h3>
                  <p className="text-[10px] font-mono text-[#656b6b]">{t.template_key}</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={t.enabled}
                      onChange={() => toggleTemplateEnabled(t)}
                    />
                    <div className={`block w-10 h-5 rounded-full transition-colors ${t.enabled ? 'bg-[#2563eb]' : 'bg-[#dedfdf]'}`}></div>
                    <div className={`dot absolute left-0.5 top-0.5 bg-ink-card w-4 h-4 rounded-full transition-transform ${t.enabled ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                </label>
              </div>
              <div className="bg-[#fbfaf9] border border-[#dedfdf] rounded-lg p-3 text-xs">
                <p className="font-semibold text-[#1a1a1a] mb-1">Subject: {t.subject}</p>
                <p className="text-[#656b6b] line-clamp-2" dangerouslySetInnerHTML={{ __html: t.body.replace(/<[^>]+>/g, '').slice(0, 120) }} />
              <p className="mt-2 text-[10px] font-medium text-[#656b6b]">Votion One™ automatically applies the signature black delivery shell.</p>
              </div>
              <button
                onClick={() => openTemplateEdit(t)}
                className="mt-auto self-start px-4 py-1.5 text-xs font-semibold text-[#2563eb] bg-[#eff6ff] rounded hover:bg-[#dbeafe] transition-colors cursor-pointer"
              >
                Edit Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ================= NOTIFICATIONS TAB ================= */}
      {tab === 'notifications' && (
        <div className="flex flex-col gap-4">
          <div className="bg-ink-card border border-[#dedfdf] rounded-xl p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-base font-bold text-[#1a1a1a] mb-1">Notification Preferences</h2>
              <p className="text-xs text-[#656b6b]">Control which events generate email notifications and where they are delivered. These preferences require SMTP to be enabled.</p>
            </div>
            <div className="flex flex-col gap-4 pt-2">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">Master Switch</p>
                  <p className="text-[11px] text-[#656b6b]">Globally enable or disable outbound email notifications</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!notifs.smtp_enabled}
                  onChange={(e) => setNotifs({ ...notifs, smtp_enabled: e.target.checked })}
                  className="w-4 h-4 accent-[#2563eb]"
                />
              </label>
              <div className="border-t border-[#dedfdf] pt-4 flex flex-col gap-4">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">Alert Notifications</p>
                    <p className="text-[11px] text-[#656b6b]">Email when a custom alert rule threshold is triggered</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!notifs.alert_enabled}
                    onChange={(e) => setNotifs({ ...notifs, alert_enabled: e.target.checked })}
                    className="w-4 h-4 accent-[#2563eb]"
                  />
                </label>
                <div>
                  <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Alert Recipients (comma-separated emails)</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={notifs.alert_emails || ''}
                    onChange={(e) => setNotifs({ ...notifs, alert_emails: e.target.value })}
                    placeholder="admin@votioncloud.org"
                    className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                  />
                </div>
              </div>
              <div className="border-t border-[#dedfdf] pt-4 flex flex-col gap-4">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">Expiry Warnings</p>
                    <p className="text-[11px] text-[#656b6b]">Email users when their virtual machines approach the expiry date</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!notifs.expiry_enabled}
                    onChange={(e) => setNotifs({ ...notifs, expiry_enabled: e.target.checked })}
                    className="w-4 h-4 accent-[#2563eb]"
                  />
                </label>
                <div>
                  <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Expiry Warning Recipients</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={notifs.expiry_warning_emails || ''}
                    onChange={(e) => setNotifs({ ...notifs, expiry_warning_emails: e.target.value })}
                    placeholder="admin@votioncloud.org"
                    className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                  />
                </div>
              </div>
              <div className="border-t border-[#dedfdf] pt-4 flex flex-col gap-4">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">Welcome Emails</p>
                    <p className="text-[11px] text-[#656b6b]">Email new users when their account is provisioned</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!notifs.welcome_enabled}
                    onChange={(e) => setNotifs({ ...notifs, welcome_enabled: e.target.checked })}
                    className="w-4 h-4 accent-[#2563eb]"
                  />
                </label>
                <div>
                  <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Welcome CC Recipients</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={notifs.welcome_emails || ''}
                    onChange={(e) => setNotifs({ ...notifs, welcome_emails: e.target.value })}
                    placeholder="admin@votioncloud.org"
                    className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveNotifs}
                disabled={notifsSaving}
                className="px-6 py-2 bg-[#1a1a1a] text-white font-semibold text-sm rounded-lg hover:bg-black transition-colors cursor-pointer disabled:opacity-60"
              >
                {notifsSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= OVH CLOUD TAB ================= */}
      {tab === 'ovh' && (
        <div className="bg-ink-card border border-[#dedfdf] rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-[#dedfdf] flex items-center justify-between bg-[#fbfaf9]">
            <div>
              <h2 className="text-base font-bold text-[#1a1a1a]">OVH Cloud API Integration</h2>
              <p className="text-xs text-[#656b6b] mt-1">Configure your OVHcloud API credentials to enable reverse DNS control, edge firewall management, and DDoS port mitigation controls.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ovhEnabled}
                onChange={(e) => setOvhEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563eb]"></div>
              <span className="ms-3 text-xs font-semibold text-[#1a1a1a] uppercase tracking-wide">Enabled</span>
            </label>
          </div>
          <div className="p-6 flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">API Endpoint</label>
                <select
                  value={ovhEndpoint}
                  onChange={(e) => setOvhEndpoint(e.target.value)}
                  className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] bg-white cursor-pointer"
                >
                  <option value="ovh-eu">OVH Europe (ovh-eu)</option>
                  <option value="ovh-ca">OVH Canada (ovh-ca)</option>
                  <option value="ovh-us">OVH US (ovh-us)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Application Key</label>
                <input
                  type="text"
                  value={ovhAppKey}
                  onChange={(e) => setOvhAppKey(e.target.value)}
                  placeholder="e.g. ab1234567"
                  className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Application Secret</label>
                <input
                  type="password"
                  value={ovhAppSecret}
                  onChange={(e) => setOvhAppSecret(e.target.value)}
                  placeholder={ovhAppSecret ? '********' : 'Enter application secret'}
                  className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Consumer Key</label>
                <input
                  type="password"
                  value={ovhConsumerKey}
                  onChange={(e) => setOvhConsumerKey(e.target.value)}
                  placeholder={ovhConsumerKey ? '********' : 'Enter consumer key'}
                  className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                />
                <button
                  type="button"
                  onClick={handleGenerateOvhKey}
                  disabled={ovhGeneratingKey || !ovhAppKey}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8] cursor-pointer disabled:opacity-50"
                >
                  {ovhGeneratingKey ? 'Generating token from OVH...' : '🔑 Generate & Authorize Consumer Key in 1 Click →'}
                </button>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-[#fbfaf9] border-t border-[#dedfdf] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <span className="text-[11px] text-[#656b6b]">Secure cryptographic request signing will be handled automatically.</span>
            <div className="flex items-center justify-end gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleTestOvh}
                disabled={ovhTesting || !ovhEnabled}
                className="px-4 py-2 bg-white border border-[#dedfdf] text-xs font-semibold text-[#1a1a1a] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {ovhTesting ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={handleSaveOvh}
                disabled={ovhSaving}
                className="px-6 py-2 bg-[#1a1a1a] text-white font-semibold text-sm rounded-lg hover:bg-black transition-colors cursor-pointer disabled:opacity-60"
              >
                {ovhSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= HETZNER ROBOT TAB ================= */}
      {tab === 'hetzner' && (
        <div className="bg-ink-card border border-[#dedfdf] rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-[#dedfdf] flex items-center justify-between bg-[#fbfaf9]">
            <div>
              <h2 className="text-base font-bold text-[#1a1a1a]">Hetzner Robot WebService API Integration</h2>
              <p className="text-xs text-[#656b6b] mt-1">Configure your Hetzner Robot WebService credentials to enable automatic Virtual MAC generation, reverse DNS management, and subnet inventory discovery.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hetznerEnabled}
                onChange={(e) => setHetznerEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563eb]"></div>
              <span className="ms-3 text-xs font-semibold text-[#1a1a1a] uppercase tracking-wide">Enabled</span>
            </label>
          </div>
          <div className="p-6 flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Robot WebService Username</label>
                <input
                  type="text"
                  value={hetznerUser}
                  onChange={(e) => setHetznerUser(e.target.value)}
                  placeholder="e.g. your_robot_webservice_user"
                  className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                />
                <p className="mt-1 text-[11px] text-[#656b6b]">Hetzner Robot account username or dedicated WebService user created in Hetzner Robot settings.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">WebService Password / API Token</label>
                <input
                  type="password"
                  value={hetznerPassword}
                  onChange={(e) => setHetznerPassword(e.target.value)}
                  placeholder={hetznerPassword ? '********' : 'Enter WebService password'}
                  className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                />
                <p className="mt-1 text-[11px] text-[#656b6b]">Secure credentials for Basic Auth against https://robot-ws.your-server.de.</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-[#fbfaf9] border-t border-[#dedfdf] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <span className="text-[11px] text-[#656b6b]">Operates in pure network management mode (rDNS, Virtual MACs, subnets). Server buying is strictly prohibited.</span>
            <div className="flex items-center justify-end gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleTestHetzner}
                disabled={hetznerTesting || !hetznerEnabled || !hetznerUser}
                className="px-4 py-2 bg-white border border-[#dedfdf] text-xs font-semibold text-[#1a1a1a] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {hetznerTesting ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={handleSaveHetzner}
                disabled={hetznerSaving}
                className="px-6 py-2 bg-[#1a1a1a] text-white font-semibold text-sm rounded-lg hover:bg-black transition-colors cursor-pointer disabled:opacity-60"
              >
                {hetznerSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TEMPLATE EDIT MODAL ================= */}
      {editTemplate !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1010] flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-[640px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 my-8">
            <h3 className="text-base font-bold text-[#1a1a1a] mb-1">Edit Template: {friendlyKey(editTemplate.template_key)}</h3>
            <p className="text-xs text-[#656b6b] mb-5">Edit the message content below. Votion One™ automatically applies the signature deep-black shell, security footer, responsive layout, and plain-text alternative. Use placeholders such as {'{name}'}, {'{email}'}, {'{vmid}'}, {'{ticketNumber}'}, {'{status}'}, {'{message}'}, and {'{title}'} for context-specific values.</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Subject Line</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Email Body (HTML)</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={10}
                  className="w-full border border-[#dedfdf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">Live Preview</label>
                <div className="border border-[#dedfdf] rounded-lg p-4" style={PREVIEW_STYLES} dangerouslySetInnerHTML={{ __html: editBody }} />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-[#dedfdf]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editTemplate.enabled}
                    onChange={(e) => setEditTemplate({ ...editTemplate, enabled: e.target.checked })}
                    className="w-4 h-4 accent-[#2563eb]"
                  />
                  <span className="text-xs font-semibold text-[#1a1a1a]">Template enabled</span>
                </label>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setEditTemplate(null)}
                  className="btn-secondary px-4 py-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={saving}
                  className="btn-primary px-4 py-2 cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
