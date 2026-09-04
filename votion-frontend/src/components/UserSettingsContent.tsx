import React, { useState, useEffect } from 'react';
import { apiClient, ApiAccount } from '../services/apiClient';
import { TeamAccessContent } from './TeamAccessContent';
import { getStoredThemeMode, setThemeMode, ThemeMode } from '../theme';

export const UserSettingsContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'security' | 'signature' | 'appearance' | 'team-access'>('security');
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [openActionRow, setOpenActionRow] = useState<string | null>(null);

  // Dynamic User Profile State loaded directly from PostgreSQL via Express API
  const [userProfile, setUserProfile] = useState<ApiAccount | null>(null);
  const [primaryEmail, setPrimaryEmail] = useState(localStorage.getItem('votion_user_email') || '');
  const [secondaryEmails, setSecondaryEmails] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [twoFactorActive, setTwoFactorActive] = useState(false);
  const [passkeys, setPasskeys] = useState<string[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [supportPinConfigured, setSupportPinConfigured] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active Interactive Modal State
  const [activeModal, setActiveModal] = useState<
    | 'change-email'
    | 'add-secondary-email'
    | 'change-password'
    | 'reconfigure-2fa'
    | 'disable-2fa'
    | 'add-phone'
    | 'edit-ssh-keys'
    | 'add-passkey'
    | 'remote-session'
    | 'file-upload'
    | null
  >(null);

  // Modal Form Inputs
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputNewPassword, setInputNewPassword] = useState('');
  const [inputConfirmPassword, setInputConfirmPassword] = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [inputTotpCode, setInputTotpCode] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [activeRemoteSession, setActiveRemoteSession] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeModeState(mode);
    setThemeMode(mode);
    showToast(`Appearance set to ${mode === 'system' ? 'System default' : mode === 'dark' ? 'Dark' : 'Light'}.`);
  };

  useEffect(() => {
    const handleStorage = () => setThemeModeState(getStoredThemeMode());
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    window.addEventListener('storage', handleStorage);
    media?.addEventListener('change', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      media?.removeEventListener('change', handleStorage);
    };
  }, []);

  // STEP 3.1: Load Live User Profile Details from GET /api/v1/user/profile
  const [sshKeys, setSshKeys] = useState('');

  const loadUserProfile = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getUserProfile(primaryEmail);
      if (data) {
        setUserProfile(data);
        setPrimaryEmail(data.email);
        if (data.name) {
          const parts = data.name.split(' ');
          setFirstName(parts[0] || 'User');
          setLastName(parts.slice(1).join(' ') || '');
        }
        if (data.phone) setPhoneNumber(data.phone);
        setSupportPinConfigured(Boolean(data.supportPinConfigured));
        if (data.twoFactorActive !== undefined) setTwoFactorActive(data.twoFactorActive);
        if (data.sshKeys !== undefined) setSshKeys(data.sshKeys);
      }
    } catch (err) {
      // Catch network error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
    loadSecondaryEmails();
    loadPasskeys();
  }, []);

  const loadSecondaryEmails = async () => {
    try {
      const data = await apiClient.getSecondaryEmails();
      if (data && Array.isArray(data.data)) setSecondaryEmails(data.data.map((e: any) => e.email || e.secondary_email || e));
    } catch {}
  };

  const loadPasskeys = async () => {
    try {
      const data = await apiClient.getPasskeys();
      if (Array.isArray(data)) setPasskeys(data.map((p: any) => p.name || p.key_name || p.credential_id || 'Hardware Passkey'));
    } catch {}
  };

  // STEP 3.4: Real TOTP setup — fetch otpauth URI + secret, render QR with the qrcode library
  useEffect(() => {
    if (activeModal === 'reconfigure-2fa') {
      let cancelled = false;
      setQrLoading(true);
      (async () => {
        try {
          const res = await apiClient.setup2FA();
          if (cancelled || !res?.success) {
            setQrLoading(false);
            return;
          }
          setSetupSecret(res.secret || null);
          if (res.otpauthUri) {
            const QRCode = await import('qrcode');
            const url = await QRCode.toDataURL(res.otpauthUri, { margin: 1, scale: 8 });
            if (!cancelled) setQrDataUrl(url);
          }
        } catch {
          // Network issue — keep the placeholder
        } finally {
          if (!cancelled) setQrLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }
    setQrDataUrl(null);
    setSetupSecret(null);
  }, [activeModal]);

  // STEP 3.5: Real support session — fetch existing active session on open
  useEffect(() => {
    if (activeModal === 'remote-session') {
      (async () => {
        try {
          const data = await apiClient.getActiveRemoteSession();
          if (data?.session) setActiveRemoteSession(data.session);
          else {
            const started = await apiClient.startRemoteSession();
            setActiveRemoteSession(started?.session || started);
          }
        } catch {}
      })();
    } else {
      setActiveRemoteSession(null);
    }
  }, [activeModal]);

  // STEP 3.6: Refresh uploaded files list when the file modal opens
  useEffect(() => {
    if (activeModal === 'file-upload') {
      (async () => {
        try {
          setUploadedFiles(await apiClient.getUploadedFiles());
        } catch {}
      })();
    }
  }, [activeModal]);

  // STEP 3.2: Regenerate Support PIN via POST /api/v1/user/regenerate-pin
  const handleGenerateNewPin = async () => {
    const res = await apiClient.regenerateSupportPin();
    if (res.success) {
      setSupportPinConfigured(true);
      showToast('Support PIN regenerated securely. Contact support when assistance is required.');
    } else {
      showToast(res.error || 'Unable to regenerate the Support PIN.');
    }
  };

  // STEP 3.3: Toggle 2FA via POST /api/v1/user/2fa/toggle
  const handleToggle2FAState = async (active: boolean, stepUp?: { currentPassword: string; totpCode: string }) => {
    try {
      const res = await apiClient.toggle2FA(active, stepUp);
      if (res.success) {
        setTwoFactorActive(res.twoFactorActive);
        showToast(`2FA status updated to ${res.twoFactorActive ? 'Active (TOTP)' : 'Disabled'}`);
        return true;
      }
      showToast(res.error || 'Unable to update 2FA status.');
    } catch {
      showToast('Unable to update 2FA status. Please try again.');
    }
    return false;
  };

  return (
    <main className="app-content">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="theme-toast mb-6 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/60 hover:text-white">✕</button>
        </div>
      )}

      {/* Page Heading */}
      <h1 className="page-heading">User Settings</h1>

      {/* 2-COLUMN GRID LAYOUT MATCHING USER SETTINGS REFERENCE */}
      <div className="user-settings-grid">
        
        {/* LEFT COLUMN: VERTICAL SUB-NAV */}
        <nav className="user-settings-subnav">
          <button
            onClick={() => setActiveTab('security')}
            className={`user-settings-subnav-link cursor-pointer ${activeTab === 'security' ? 'active' : ''}`}
          >
            Login and security
          </button>
          <button
            onClick={() => setActiveTab('signature')}
            className={`user-settings-subnav-link cursor-pointer ${activeTab === 'signature' ? 'active' : ''}`}
          >
            Name and signature
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`user-settings-subnav-link cursor-pointer ${activeTab === 'appearance' ? 'active' : ''}`}
          >
            Appearance
          </button>
          <button
            onClick={() => setActiveTab('team-access')}
            className={`user-settings-subnav-link cursor-pointer ${activeTab === 'team-access' ? 'active' : ''}`}
          >
            Team access
          </button>
        </nav>

        {/* RIGHT COLUMN: MAIN CONTENT PANEL */}
        <div className="user-settings-main">

          {isLoading ? (
            <div className="p-12 text-center text-[#656b6b] font-mono text-xs border border-[#dedfdf] rounded-xl bg-white">
              Loading profile and security settings…
            </div>
          ) : activeTab === 'team-access' ? (
            <TeamAccessContent embedded />
          ) : activeTab === 'security' ? (
            <>
              {/* BLOCK 1: ACCOUNT CREDENTIALS & INK TABLE */}
              <section className="ink-block-wrapper">
                <div className="ink-block-header">
                  <h2 className="ink-block-title font-serif text-base font-medium">Account credentials</h2>
                </div>

                <div className="responsive-table-container">
                  <table className="ink-table-wrapper">
                    <tbody>
                    
                    {/* ROW 1: PRIMARY EMAIL */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">Primary email</th>
                      <td className="ink-table-td">
                        <span className="font-semibold text-[#1a1a1a]">{primaryEmail}</span>
                        {secondaryEmails.length > 0 && (
                          <div className="text-xs text-[#656b6b] mt-0.5">
                            Secondary: {secondaryEmails.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="ink-table-td-action relative">
                        <button 
                          onClick={() => setOpenActionRow(openActionRow === 'email' ? null : 'email')}
                          className="p-1.5 rounded hover:bg-[#f1f1f1] cursor-pointer font-bold"
                          title="Actions"
                        >
                          •••
                        </button>
                        {openActionRow === 'email' && (
                          <div className="absolute right-0 top-10 w-48 bg-white border border-[#dedfdf] rounded shadow-xl py-1 z-50 text-xs text-left">
                            <button 
                              onClick={() => { setActiveModal('change-email'); setOpenActionRow(null); }} 
                              className="w-full px-3 py-2 hover:bg-[#f1f1f1] text-left cursor-pointer"
                            >
                              Change primary email
                            </button>
                            <button 
                              onClick={() => { setActiveModal('add-secondary-email'); setOpenActionRow(null); }} 
                              className="w-full px-3 py-2 hover:bg-[#f1f1f1] text-left cursor-pointer"
                            >
                              Add secondary email
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* ROW 2: PASSWORD */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">Password</th>
                      <td className="ink-table-td text-[#656b6b]">Protected via 100,000-iteration PBKDF2 cryptographic salt</td>
                      <td className="ink-table-td-action">
                        <button 
                          onClick={() => setActiveModal('change-password')}
                          className="btn-secondary py-1 px-3 text-xs cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>

                    {/* ROW 3: SSH KEYS */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">Public SSH Keys</th>
                      <td className="ink-table-td">
                        {sshKeys && sshKeys.trim().length > 0 ? (
                          <span className="font-semibold text-[#1a1a1a]">Configured</span>
                        ) : (
                          <span className="text-[#656b6b]">Not configured</span>
                        )}
                        <div className="text-xs text-[#656b6b] mt-0.5">Used for Cloud-Init VM injections</div>
                      </td>
                      <td className="ink-table-td-action">
                        <button 
                          onClick={() => setActiveModal('edit-ssh-keys')}
                          className="btn-secondary py-1 px-3 text-xs cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>

                    {/* ROW 4: TWO-FACTOR AUTH (2FA) */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">2FA Authenticator</th>
                      <td className="ink-table-td">
                        {twoFactorActive ? (
                          <span className="bg-[#dcfce7] text-[#15803d] px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse"></span>
                            Active (TOTP)
                          </span>
                        ) : (
                          <span className="bg-[#f1f1f1] text-[#656b6b] px-2.5 py-1 rounded text-xs font-semibold">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="ink-table-td-action relative">
                        <button 
                          onClick={() => setOpenActionRow(openActionRow === '2fa' ? null : '2fa')}
                          className="p-1.5 rounded hover:bg-[#f1f1f1] cursor-pointer font-bold"
                          title="Actions"
                        >
                          •••
                        </button>
                        {openActionRow === '2fa' && (
                          <div className="absolute right-0 top-10 w-48 bg-white border border-[#dedfdf] rounded shadow-xl py-1 z-50 text-xs text-left">
                            <button 
                              onClick={() => { setActiveModal('reconfigure-2fa'); setOpenActionRow(null); }} 
                              className="w-full px-3 py-2 hover:bg-[#f1f1f1] text-left cursor-pointer"
                            >
                              Reconfigure TOTP app
                            </button>
                            <button 
                              onClick={() => { setActiveModal('disable-2fa'); setOpenActionRow(null); }} 
                              className="w-full px-3 py-2 hover:bg-[#f1f1f1] text-left text-[#dc2626] cursor-pointer"
                            >
                              Disable 2FA
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* ROW 4: PHONE NUMBER */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">Phone number</th>
                      <td className="ink-table-td text-[#656b6b]">
                        {phoneNumber ? (
                          <span className="font-mono text-[#1a1a1a] font-semibold">{phoneNumber}</span>
                        ) : (
                          'No phone number added'
                        )}
                      </td>
                      <td className="ink-table-td-action">
                        <button 
                          onClick={() => setActiveModal('add-phone')}
                          className="text-xs text-[#2563eb] hover:underline font-semibold cursor-pointer"
                        >
                          {phoneNumber ? 'Edit phone' : '+ Add phone number'}
                        </button>
                      </td>
                    </tr>

                    {/* ROW 5: PASSKEY MANAGER */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">Passkey Manager</th>
                      <td className="ink-table-td text-[#656b6b]">
                        {passkeys.join(', ')}
                      </td>
                      <td className="ink-table-td-action">
                        <button 
                          onClick={() => setActiveModal('add-passkey')}
                          className="text-xs text-[#2563eb] hover:underline font-semibold cursor-pointer"
                        >
                          + Add passkey
                        </button>
                      </td>
                    </tr>

                  </tbody>
                  </table>
                </div>
              </section>

              {/* BLOCK 2: SUPPORT & LIVE REMOTE ASSISTANCE */}
              <section className="ink-block-wrapper">
                <div className="ink-block-header">
                  <h2 className="ink-block-title font-serif text-base font-medium">Support and remote access</h2>
                </div>

                <div className="responsive-table-container">
                  <table className="ink-table-wrapper">
                    <tbody>
                    
                    {/* ROW 1: SUPPORT PIN */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">Support PIN</th>
                      <td className="ink-table-td">
                        <div className="flex items-center gap-3">
                          <span
                            className="font-mono text-xs font-semibold text-[#1a1a1a] bg-[#f1f1f1] px-2.5 py-1 rounded border border-[#dedfdf]"
                            aria-label={supportPinConfigured ? 'Support PIN configured' : 'Support PIN not configured'}
                          >
                            {supportPinConfigured ? 'Configured' : 'Not configured'}
                          </span>
                          <button
                            type="button"
                            onClick={handleGenerateNewPin}
                            className="text-xs text-[#2563eb] hover:underline font-semibold cursor-pointer"
                          >
                            Regenerate
                          </button>
                        </div>
                        <p className="ink-description-text">
                          Provide this 6-digit support PIN when contacting Votion One™ Support engineers to grant temporary access to your cluster nodes.
                        </p>
                      </td>
                      <td className="ink-table-td-action"></td>
                    </tr>

                    {/* ROW 2: REMOTE LIVE ASSISTANCE */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">Remote assistance</th>
                      <td className="ink-table-td">
                        <p className="text-xs text-[#656b6b]">
                          Start a secure live remote session with VOTION cloud architects.
                        </p>
                      </td>
                      <td className="ink-table-td-action">
                        <button 
                          onClick={() => setActiveModal('remote-session')}
                          className="btn-primary py-1 px-3 text-xs cursor-pointer"
                        >
                          Start session
                        </button>
                      </td>
                    </tr>

                    {/* ROW 3: SHARE FILE WITH VOTION */}
                    <tr className="ink-table-row">
                      <th className="ink-table-th">Share file with VOTION</th>
                      <td className="ink-table-td">
                        <p className="ink-description-text">
                          Upload encrypted system diagnostic logs, storage pool manifests, or cluster crash dumps directly to VOTION security.
                        </p>
                      </td>
                      <td className="ink-table-td-action">
                        <button 
                          onClick={() => setActiveModal('file-upload')}
                          className="btn-secondary py-1 px-3 text-xs cursor-pointer"
                        >
                          Upload securely
                        </button>
                      </td>
                    </tr>

                  </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : activeTab === 'appearance' ? (
            <section className="ink-block-wrapper appearance-settings-panel">
              <div className="ink-block-header">
                <h2 className="ink-block-title font-serif text-base font-medium">Appearance</h2>
                <p className="ink-description-text">Choose how Votion One™ looks on this device. System follows your operating system preference.</p>
              </div>
              <div className="p-6">
                <div className="appearance-setting-row">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1a1a1a]">Theme preference</h3>
                    <p className="mt-1 text-xs leading-5 text-[#656b6b]">Your selection is saved locally and applies across this browser.</p>
                  </div>
                  <label className="appearance-select-label">
                    <span className="sr-only">Theme preference</span>
                    <select
                      value={themeMode}
                      onChange={(event) => handleThemeModeChange(event.target.value as ThemeMode)}
                      className="appearance-select"
                    >
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                </div>
                <div className="appearance-mode-grid" role="group" aria-label="Theme preference options">
                  {([
                    ['system', 'System', 'Follow the device appearance'],
                    ['light', 'Light', 'Use the current light interface'],
                    ['dark', 'Dark', 'Use a deep black interface'],
                  ] as const).map(([mode, label, description]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleThemeModeChange(mode)}
                      className={`appearance-mode-card ${themeMode === mode ? 'is-selected' : ''}`}
                      aria-pressed={themeMode === mode}
                    >
                      <span className="appearance-mode-card-title">{label}</span>
                      <span className="appearance-mode-card-description">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            /* NAME AND SIGNATURE TAB */
            <section className="ink-block-wrapper">
              <div className="ink-block-header">
                <h2 className="ink-block-title font-serif text-base font-medium">Name and signature details</h2>
              </div>

              <div className="p-6">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fullName = `${firstName} ${lastName}`.trim();
                  const res = await apiClient.updateUserProfile({
                    email: primaryEmail,
                    name: fullName,
                  });
                  if (res.success) {
                    showToast('Profile updated successfully.');
                  } else {
                    showToast(res.error || 'Failed to update profile');
                  }
                }} className="flex flex-col gap-5 max-w-[500px]">
                  
                  <div>
                    <label className="block text-[13px] font-bold text-[#1a1a1a] mb-1.5">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full p-2.5 text-[13px] border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a] focus:ring-1 focus:ring-[#1a1a1a] transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-[#1a1a1a] mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full p-2.5 text-[13px] border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a] focus:ring-1 focus:ring-[#1a1a1a] transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-[#1a1a1a] mb-1.5">Title / Role in Organization</label>
                    <input
                      type="text"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      className="w-full p-2.5 text-[13px] border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a] focus:ring-1 focus:ring-[#1a1a1a] transition-all"
                      required
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit"
                      className="bg-[#1a1a1a] text-white hover:bg-black font-bold py-2 px-5 text-[13px] rounded cursor-pointer transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>

                </form>
              </div>
            </section>
          )}

        </div>

      </div>

      {/* ==========================================================================
         INTERACTIVE USER SETTINGS MODALS SUITE
         ========================================================================== */}
      
      {/* 1. CHANGE PRIMARY EMAIL MODAL */}
      {activeModal === 'change-email' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[440px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3">
              <h3 className="text-base font-bold text-[#1a1a1a]">Change Primary Email</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#656b6b] font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!inputEmail.trim()) return;
              try {
                const res = await apiClient.changePrimaryEmail(inputEmail.trim());
                if (res.success) {
                  setPrimaryEmail(inputEmail.trim());
                  localStorage.setItem('votion_user_email', inputEmail.trim());
                  showToast('Primary email updated successfully.');
                  setActiveModal(null);
                  setInputEmail('');
                  loadUserProfile();
                } else {
                  showToast(`⚠️ ${res.error || 'Failed to update email'}`);
                }
              } catch {
                showToast('⚠️ Network error — email not changed.');
              }
            }} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Current Email</label>
                <input type="email" value={primaryEmail} disabled className="w-full p-2 bg-[#f1f1f1] border border-[#dedfdf] rounded text-[#656b6b]" />
              </div>
              <div>
                <label className="block font-semibold mb-1">New Primary Email</label>
                <input 
                  type="email" 
                  value={inputEmail} 
                  onChange={(e) => setInputEmail(e.target.value)} 
                  placeholder="new.email@votioncloud.org"
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a]" 
                  required 
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#dedfdf] mt-2">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Update Email</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD SECONDARY EMAIL MODAL */}
      {activeModal === 'add-secondary-email' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[440px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3">
              <h3 className="text-base font-bold text-[#1a1a1a]">Add Secondary Backup Email</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#656b6b] font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!inputEmail.trim()) return;
              try {
                const data = await apiClient.addSecondaryEmail(inputEmail.trim());
                if (data.success) {
                  setSecondaryEmails([...secondaryEmails, inputEmail.trim()]);
                  showToast('Backup email saved successfully.');
                } else {
                  showToast(`⚠️ ${data.error || 'Failed to add secondary email'}`);
                }
              } catch {
                showToast('⚠️ Network error — secondary email not saved.');
              }
              setActiveModal(null);
              setInputEmail('');
            }} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Secondary Backup Email</label>
                <input 
                  type="email" 
                  value={inputEmail} 
                  onChange={(e) => setInputEmail(e.target.value)} 
                  placeholder="secondary@gmail.com"
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a]" 
                  required 
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#dedfdf] mt-2">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add Backup Email</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2.5 EDIT SSH KEYS MODAL */}
      {activeModal === 'edit-ssh-keys' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[440px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3">
              <h3 className="text-base font-bold text-[#1a1a1a]">Public SSH Keys</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#656b6b] font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiClient.updateUserProfile({
                email: primaryEmail,
                sshKeys: sshKeys,
              });
              if (res.success) {
                showToast('SSH Keys saved to profile successfully.');
                setActiveModal(null);
              } else {
                showToast(`❌ ${res.error || 'Failed to update SSH keys'}`);
              }
            }} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Your Public SSH Keys</label>
                <textarea 
                  value={sshKeys} 
                  onChange={(e) => setSshKeys(e.target.value)} 
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a] h-32 font-mono text-[10px]" 
                  placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ... user@host"
                />
                <p className="text-[#656b6b] mt-1">Paste your public keys (e.g. ~/.ssh/id_rsa.pub) separated by newlines.</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#dedfdf] mt-2">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Keys</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CHANGE PASSWORD MODAL */}
      {activeModal === 'change-password' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[440px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3">
              <h3 className="text-base font-bold text-[#1a1a1a]">Change Account Password</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#656b6b] font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (inputNewPassword !== inputConfirmPassword) {
                showToast('⚠️ New passwords do not match');
                return;
              }
              const res = await apiClient.changePassword(inputPassword, inputNewPassword);
              if (res.success) {
                showToast('Password changed successfully.');
                setActiveModal(null);
                setInputPassword('');
                setInputNewPassword('');
                setInputConfirmPassword('');
              } else {
                showToast(`⚠️ ${res.error || 'Failed to update password'}`);
              }
            }} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Current Password</label>
                <input 
                  type="password" 
                  value={inputPassword} 
                  onChange={(e) => setInputPassword(e.target.value)} 
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a]" 
                  required 
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">New Password</label>
                <input 
                  type="password" 
                  value={inputNewPassword} 
                  onChange={(e) => setInputNewPassword(e.target.value)} 
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a]" 
                  required 
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Confirm New Password</label>
                <input 
                  type="password" 
                  value={inputConfirmPassword} 
                  onChange={(e) => setInputConfirmPassword(e.target.value)} 
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a]" 
                  required 
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#dedfdf] mt-2">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. RECONFIGURE 2FA MODAL */}
      {activeModal === 'reconfigure-2fa' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[460px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4 text-center">
            <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3 text-left">
              <h3 className="text-base font-bold text-[#1a1a1a]">Reconfigure 2FA TOTP App</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#656b6b] font-bold cursor-pointer">✕</button>
            </div>
            <div className="flex flex-col items-center gap-3 text-xs text-[#656b6b]">
              <p>Scan this QR code with 1Password, Google Authenticator, or Authy:</p>
              <div className="w-36 h-36 bg-white p-2 border border-[#dedfdf] rounded flex items-center justify-center">
                <img src={qrDataUrl || undefined} alt="2FA QR" className="max-w-full max-h-full" />
              </div>
              <div className="font-mono text-xs text-[#1a1a1a] bg-[#f1f1f1] px-3 py-1.5 rounded border">
                Manual key: {setupSecret || 'LOADING...'}
              </div>
              <input 
                type="text" 
                placeholder="Enter 6-digit code from your TOTP app" 
                value={inputTotpCode}
                onChange={(e) => setInputTotpCode(e.target.value)}
                maxLength={6}
                className="w-full p-2 border border-[#dedfdf] rounded font-mono text-center text-sm outline-none mt-2" 
              />
              <button 
                onClick={async () => {
                  if (inputTotpCode.length !== 6) {
                    showToast('⚠️ Please enter your 6-digit TOTP code from your authenticator app');
                    return;
                  }
                  try {
                    const data = await apiClient.verify2FA(inputTotpCode);
                    if (data.success && data.verified) {
                          showToast('2FA activated — the code matched your authenticator app');
                    } else {
                      showToast(`⚠️ ${data.error || 'Invalid TOTP code — 2FA was NOT activated. Try again.'}`);
                      return;
                    }
                  } catch {
                    showToast('⚠️ Network error — could not verify code with the server. 2FA NOT activated.');
                    return;
                  }
                  setActiveModal(null);
                  setInputTotpCode('');
                }} 
                className="btn-primary w-full py-2 cursor-pointer"
              >
                Verify & Activate 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. DISABLE 2FA MODAL */}
      {activeModal === 'disable-2fa' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[420px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4 text-center">
            <h3 className="text-base font-bold text-[#dc2626]">Disable 2FA Authentication?</h3>
            <p className="text-xs text-[#656b6b]">Disabling 2FA reduces account security. Confirm your current password and a fresh authenticator code to continue.</p>
            <div className="flex flex-col gap-3 text-left">
              <label className="text-xs font-semibold text-[#1a1a1a]">
                Current password
                <input
                  type="password"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full mt-1 p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a]"
                />
              </label>
              <label className="text-xs font-semibold text-[#1a1a1a]">
                Authenticator code
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputTotpCode}
                  onChange={(e) => setInputTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  className="w-full mt-1 p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a] font-mono tracking-[0.3em]"
                />
              </label>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setActiveModal(null)} className="btn-secondary w-1/2 py-2 cursor-pointer">Keep 2FA</button>
              <button
                onClick={async () => {
                  if (!inputPassword || inputTotpCode.length !== 6) {
                    showToast('Enter your current password and a 6-digit authenticator code.');
                    return;
                  }
                  const disabled = await handleToggle2FAState(false, { currentPassword: inputPassword, totpCode: inputTotpCode });
                  if (disabled) {
                    setInputPassword('');
                    setInputTotpCode('');
                    setActiveModal(null);
                  }
                }}
                className="theme-destructive-button btn-primary bg-[#dc2626] hover:bg-[#b91c1c] w-1/2 py-2 cursor-pointer"
              >
                Disable 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADD PHONE NUMBER MODAL */}
      {activeModal === 'add-phone' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[440px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3">
              <h3 className="text-base font-bold text-[#1a1a1a]">Add Phone Number</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#656b6b] font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (inputPhone.trim()) {
                const res = await apiClient.updateUserProfile({
                  email: primaryEmail,
                  phone: inputPhone.trim(),
                });
                if (res.success) {
                  setPhoneNumber(inputPhone.trim());
                  showToast('Phone number updated successfully.');
                  setActiveModal(null);
                  setInputPhone('');
                }
              }
            }} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Mobile Phone Number</label>
                <input 
                  type="tel" 
                  value={inputPhone} 
                  onChange={(e) => setInputPhone(e.target.value)} 
                  placeholder="+1 (555) 019-2834"
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a]" 
                  required 
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#dedfdf] mt-2">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Phone</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. ADD PASSKEY MODAL */}
      {activeModal === 'add-passkey' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[440px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4 text-center">
            <h3 className="text-base font-bold text-[#1a1a1a]">Register Hardware Passkey</h3>
            <p className="text-xs text-[#656b6b]">Touch your YubiKey or authenticate with Touch ID / Windows Hello biometrics...</p>
            <div className="p-4 bg-[#f1f1f1] border border-[#dedfdf] rounded font-mono text-xs animate-pulse">
              🔑 WebAuthn Biometric Scan Active
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setActiveModal(null)} className="btn-secondary w-1/2 py-2 cursor-pointer">Cancel</button>
              <button onClick={async () => {
                try {
                  // Real WebAuthn credential creation with a random server-acceptable challenge
                  const challenge = new Uint8Array(32);
                  crypto.getRandomValues(challenge);
                  const challengeB64 = btoa(String.fromCharCode(...challenge))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                  const userId = crypto.getRandomValues(new Uint8Array(32));
                  const userIdB64 = btoa(String.fromCharCode(...userId))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                  const credential = await navigator.credentials.create({
                    publicKey: {
                      challenge,
                      rp: { name: 'VOTION ONE Platform', id: window.location.hostname || 'votioncloud.org' },
                      user: { id: userId, name: primaryEmail, displayName: `${firstName} ${lastName}`.trim() || primaryEmail },
                      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
                      timeout: 60000,
                    },
                  }) as PublicKeyCredential | null;
                  if (!credential) throw new Error('No credential created');
                  const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                  const res = await apiClient.registerPasskey(credId, `Passkey ${new Date().toLocaleDateString()}`);
                  if (res.success) {
                    showToast('Passkey registered successfully.');
                    loadPasskeys();
                  } else {
                    showToast(`⚠️ ${res.error || 'Failed to register passkey'}`);
                  }
                } catch {
                  showToast('⚠️ WebAuthn not supported or passkey registration cancelled');
                }
                setActiveModal(null);
              }} className="btn-primary w-1/2 py-2 cursor-pointer">Register Key</button>
            </div>
          </div>
        </div>
      )}

      {/* 8. REMOTE SESSION MODAL */}
      {activeModal === 'remote-session' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[480px] bg-[#1a1a1a] text-white border border-[#333333] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#333333] pb-3">
              <h3 className="text-base font-bold text-white">Live Remote Assistance Active</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#a7aaaa] hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            {activeRemoteSession ? (
              <div className="flex flex-col gap-3 text-xs font-mono text-[#10b981]">
                <p>Session ID: <span className="text-white">{activeRemoteSession.session_id || activeRemoteSession.id || '—'}</span></p>
                <p>Support verification: <span className="text-white">{supportPinConfigured ? 'Configured' : 'Not configured'}</span></p>
                <p>Expires: <span className="text-white">{activeRemoteSession.expires_at ? new Date(activeRemoteSession.expires_at).toLocaleString() : '60 minutes'}</span></p>
                <div className="p-3 bg-black border border-[#222222] rounded text-white text-[11px]">
                  Votion One™ Support is authorized to connect to this panel. Verification is handled through this authorized session. The session closes automatically at expiry or when you disconnect.
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#f87171] font-mono">Unable to establish the session — the server could not create a support session record.</p>
            )}
            <button onClick={async () => {
              try {
                const res = await apiClient.disconnectRemoteSession();
                showToast(res?.success ? 'Support session ended.' : res?.error || 'Could not end session.');
              } catch {
                showToast('⚠️ Network error — session may still be active on the server');
              }
              setActiveRemoteSession(null);
              setActiveModal(null);
            }} className="theme-destructive-button btn-primary bg-[#dc2626] hover:bg-[#b91c1c] w-full py-2 cursor-pointer">Disconnect Session</button>
          </div>
        </div>
      )}

      {/* 9. FILE UPLOAD MODAL */}
      {activeModal === 'file-upload' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[460px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3">
              <h3 className="text-base font-bold text-[#1a1a1a]">Encrypted File Upload to VOTION</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#656b6b] font-bold cursor-pointer">✕</button>
            </div>
            <div className="border-2 border-dashed border-[#dedfdf] hover:border-[#1a1a1a] rounded-lg p-8 text-center text-xs text-[#656b6b] cursor-pointer transition-colors"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.log,.tar.gz,.conf,.json,.txt';
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFileObj(file);
                    setSelectedFileName(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
                  }
                };
                input.click();
              }}
            >
              {selectedFileName ? (
                <div className="font-semibold text-[#1a1a1a]">
                  📄 {selectedFileName}
                </div>
              ) : (
                <>
                  <span className="text-2xl block mb-1">📁</span>
                  <span>Click to select or drag & drop diagnostic log (.log, .tar.gz, .conf)</span>
                </>
              )}
            </div>
            {uploadedFiles.length > 0 && (
              <div className="text-xs border border-[#dedfdf] rounded p-3 max-h-32 overflow-y-auto">
                <p className="font-semibold mb-1">Previously uploaded:</p>
                {uploadedFiles.map((f: any, i: number) => (
                  <div key={i} className="flex justify-between py-0.5 text-[#656b6b]">
                    <span>{f.original_name || f.filename}</span>
                    <span>{Math.round((f.size || 0) / 1024)} KB</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setActiveModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={async () => {
                if (!selectedFileObj) {
                  showToast('⚠️ Please select a file to upload');
                  return;
                }
                try {
                  showToast(`Uploading ${selectedFileName} to VOTION secure storage...`);
                  const data = await apiClient.uploadFile(selectedFileObj);
                  if (data.success) {
                    showToast(data.message || `File ${selectedFileName} uploaded successfully`);
                    setUploadedFiles(await apiClient.getUploadedFiles());
                    setSelectedFileObj(null);
                    setSelectedFileName(null);
                  } else {
                    showToast(`⚠️ ${data.error || 'Upload failed'}`);
                  }
                } catch {
                  showToast('⚠️ Upload failed — check server connection');
                }
              }} className="btn-primary">Upload File</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
};
