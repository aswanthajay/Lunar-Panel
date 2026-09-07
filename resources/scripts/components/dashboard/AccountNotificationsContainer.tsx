import React, { useState, useEffect } from 'react';
import {
    getNotificationConfig,
    subscribeToPush,
    unsubscribeFromPush,
    saveNotificationPreferences,
    sendTestNotification,
    urlBase64ToUint8Array,
    NotificationConfigResponse,
    NotificationPreferences,
} from '@/api/account/pushNotifications';
import Spinner from '@/components/elements/Spinner';

const IconBell = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const IconCheck = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const IconAlertTriangle = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const IconSend = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const IconShield = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const IconServerCrash = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
        <line x1="14" y1="9" x2="18" y2="13" />
        <line x1="18" y1="9" x2="14" y2="13" />
    </svg>
);

const IconServerInstall = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 shrink-0">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const IconServerBackup = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
);

const IconTicketReply = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 shrink-0">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const IconClusterAlert = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
);

const IconDeploy = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" />
        <line x1="20" y1="14" x2="23" y2="14" />
        <line x1="1" y1="9" x2="4" y2="9" />
        <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
);

export default () => {
    const [loading, setLoading] = useState<boolean>(true);
    const [config, setConfig] = useState<NotificationConfigResponse | null>(null);
    const [isSubscribedOnDevice, setIsSubscribedOnDevice] = useState<boolean>(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [testLoading, setTestLoading] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const checkSupportAndSubscription = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            setIsSupported(false);
            return;
        }

        setIsSupported(true);
        setPermissionStatus(Notification.permission);

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribedOnDevice(!!subscription);
        } catch (e) {
            console.error('Failed to inspect local push registration:', e);
        }
    };

    const loadConfig = async () => {
        try {
            setLoading(true);
            const data = await getNotificationConfig();
            setConfig(data);
        } catch (err: any) {
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to load push notification settings.',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkSupportAndSubscription();
        loadConfig();
    }, []);

    const handleToggleDeviceSubscription = async () => {
        if (!isSupported || !config) return;

        setActionLoading(true);
        setStatusMessage(null);

        try {
            const registration = await navigator.serviceWorker.ready;

            if (isSubscribedOnDevice) {
                // Unsubscribe on browser and server
                const existing = await registration.pushManager.getSubscription();
                if (existing) {
                    await unsubscribeFromPush(existing.endpoint);
                    await existing.unsubscribe();
                }
                setIsSubscribedOnDevice(false);
                setStatusMessage({
                    type: 'success',
                    text: 'Desktop notifications disabled on this device.',
                });
            } else {
                // Ask permission if not yet granted
                const perm = await Notification.requestPermission();
                setPermissionStatus(perm);

                if (perm !== 'granted') {
                    setStatusMessage({
                        type: 'error',
                        text: 'Notification permission was not granted by your browser.',
                    });
                    setActionLoading(false);
                    return;
                }

                // Subscribe via PushManager using VAPID public key
                const convertedKey = urlBase64ToUint8Array(config.vapid_public_key);
                const newSub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedKey,
                });

                await subscribeToPush(newSub);
                setIsSubscribedOnDevice(true);
                setStatusMessage({
                    type: 'success',
                    text: 'Background desktop notifications enabled on this device!',
                });
            }

            // Refresh backend stats
            const fresh = await getNotificationConfig();
            setConfig(fresh);
        } catch (err: any) {
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.message || err?.message || 'An error occurred updating push subscription.',
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleTogglePreference = async (key: keyof NotificationPreferences) => {
        if (!config) return;

        const updatedPrefs: NotificationPreferences = {
            ...config.preferences,
            [key]: !config.preferences[key],
        };

        // Optimistic update
        setConfig({
            ...config,
            preferences: updatedPrefs,
        });

        try {
            const saved = await saveNotificationPreferences(updatedPrefs);
            setConfig((prev) => (prev ? { ...prev, preferences: saved } : null));
        } catch (err: any) {
            setStatusMessage({
                type: 'error',
                text: 'Failed to update preferences on server.',
            });
            // Revert
            loadConfig();
        }
    };

    const handleSendTest = async () => {
        setTestLoading(true);
        setStatusMessage(null);
        try {
            const res = await sendTestNotification();
            setStatusMessage({
                type: 'success',
                text: res.message || 'Test notification sent!',
            });
        } catch (err: any) {
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to dispatch test notification.',
            });
        } finally {
            setTestLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Spinner size="large" />
            </div>
        );
    }

    return (
        <div className="space-y-6 select-none font-sans">
            {/* Status Message Banner */}
            {statusMessage && (
                <div
                    className={`px-4 py-3 rounded-lg text-xs flex items-center gap-2.5 transition-all ${
                        statusMessage.type === 'success'
                            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
                            : 'bg-red-500/10 border border-red-500/25 text-red-300'
                    }`}
                >
                    {statusMessage.type === 'success' ? <IconCheck /> : <IconAlertTriangle />}
                    <span>{statusMessage.text}</span>
                </div>
            )}

            {/* Unsupported Browser Warning */}
            {!isSupported && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-xs text-amber-300 flex items-start gap-3">
                    <div className="shrink-0 mt-0.5"><IconAlertTriangle /></div>
                    <div>
                        <div className="font-semibold text-white">Browser Push Not Supported</div>
                        <div className="mt-1 text-amber-300/80 leading-relaxed">
                            Your current browser or environment does not support standard Web Push APIs. Ensure you are accessing the panel over secure HTTPS and not in private browsing mode with service workers disabled.
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 1: DEVICE SUBSCRIPTION STATUS (Bento Card) */}
            <section className="bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-[#050505] border-b border-[#141414] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="font-serif text-base font-normal text-[#FFFFFF] tracking-tight m-0 flex items-center gap-2">
                            <IconBell />
                            <span>Background Desktop Notifications</span>
                        </h2>
                        <p className="text-[11px] font-sans text-[#737373] mt-0.5 m-0">
                            Receive real-time push alerts on your desktop or mobile even when the panel tab is closed.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSubscribedOnDevice ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active on this Device
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-[#141414] text-[#8A8A8A] border border-[#262626]">
                                Inactive
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#141414]">
                        <div>
                            <div className="text-sm font-medium text-white">Device Status</div>
                            <div className="text-xs text-[#8A8A8A] mt-1 leading-relaxed">
                                {isSubscribedOnDevice
                                    ? 'This device is currently enrolled to receive native browser push alerts.'
                                    : 'Enable alerts to allow this browser to show background notifications for critical server events.'}
                            </div>
                            <div className="text-[11px] font-mono text-[#525252] mt-2">
                                Total registered devices on account: <span className="text-[#A3A3A3]">{config?.device_count ?? 0}</span>
                                {permissionStatus === 'denied' && (
                                    <span className="text-red-400 ml-2 inline-flex items-center gap-1">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                        Notifications are blocked in your browser settings.
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            {isSubscribedOnDevice && (
                                <button
                                    type="button"
                                    onClick={handleSendTest}
                                    disabled={testLoading || actionLoading}
                                    className="px-3.5 py-2 rounded-lg text-xs font-medium text-[#A3A3A3] hover:text-white bg-[#0A0A0A] hover:bg-[#141414] border border-[#262626] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    <IconSend />
                                    <span>{testLoading ? 'Sending...' : 'Send Test Alert'}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleToggleDeviceSubscription}
                                disabled={actionLoading || !isSupported}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                                    isSubscribedOnDevice
                                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/25'
                                        : 'bg-white text-black hover:bg-neutral-200 shadow-sm'
                                }`}
                            >
                                {actionLoading ? (
                                    <span>Processing...</span>
                                ) : isSubscribedOnDevice ? (
                                    <span>Disable on this Device</span>
                                ) : (
                                    <span>Enable Notifications</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* VAPID & Protocol details */}
                    <div className="pt-4 flex flex-wrap items-center justify-between text-[11px] font-mono text-[#525252] gap-2">
                        <span>Standard: RFC 8291 / RFC 8292 (VAPID ES256)</span>
                        <span>Service Worker: active</span>
                    </div>
                </div>
            </section>

            {/* SECTION 2: CLIENT & SERVER EVENT PREFERENCES */}
            <section className="bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-[#050505] border-b border-[#141414] px-6 py-4">
                    <h3 className="font-serif text-base font-normal text-[#FFFFFF] tracking-tight m-0">
                        Client &amp; Server Notification Preferences
                    </h3>
                    <p className="text-[11px] font-sans text-[#737373] mt-0.5 m-0">
                        Choose which server and account occurrences trigger a background desktop alert.
                    </p>
                </div>

                <div className="divide-y divide-[#141414] text-xs">
                    {/* Server Crashes */}
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-[#050505] transition-colors">
                        <div>
                            <div className="font-medium text-white flex items-center gap-2.5">
                                <IconServerCrash />
                                <span>Server Crashes &amp; Unexpected Outages</span>
                            </div>
                            <div className="text-[#737373] text-[11px] mt-0.5 pl-6">
                                Instantly alert you when your server crashes, runs out of memory (OOM), or exits abnormally.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleTogglePreference('server_crash')}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                config?.preferences.server_crash ? 'bg-emerald-500' : 'bg-[#262626]'
                            }`}
                        >
                            <span
                                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                                    config?.preferences.server_crash ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Server Installation */}
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-[#050505] transition-colors">
                        <div>
                            <div className="font-medium text-white flex items-center gap-2.5">
                                <IconServerInstall />
                                <span>Installation &amp; Reinstallations</span>
                            </div>
                            <div className="text-[#737373] text-[11px] mt-0.5 pl-6">
                                Alert when initial server provisioning or operating system reinstallation finishes.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleTogglePreference('server_install')}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                config?.preferences.server_install ? 'bg-emerald-500' : 'bg-[#262626]'
                            }`}
                        >
                            <span
                                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                                    config?.preferences.server_install ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Backup Status */}
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-[#050505] transition-colors">
                        <div>
                            <div className="font-medium text-white flex items-center gap-2.5">
                                <IconServerBackup />
                                <span>Server Backup Status</span>
                            </div>
                            <div className="text-[#737373] text-[11px] mt-0.5 pl-6">
                                Alert when server backups successfully complete or encounter a storage failure.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleTogglePreference('server_backup')}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                config?.preferences.server_backup ? 'bg-emerald-500' : 'bg-[#262626]'
                            }`}
                        >
                            <span
                                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                                    config?.preferences.server_backup ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Support Ticket Replies */}
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-[#050505] transition-colors">
                        <div>
                            <div className="font-medium text-white flex items-center gap-2.5">
                                <IconTicketReply />
                                <span>Support Ticket Replies</span>
                            </div>
                            <div className="text-[#737373] text-[11px] mt-0.5 pl-6">
                                Alert when support staff respond or update one of your helpdesk tickets.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleTogglePreference('ticket_reply')}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                config?.preferences.ticket_reply ? 'bg-emerald-500' : 'bg-[#262626]'
                            }`}
                        >
                            <span
                                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                                    config?.preferences.ticket_reply ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </section>

            {/* SECTION 3: ADMINISTRATOR NOTIFICATION PREFERENCES (Admin only) */}
            {config?.is_admin && (
                <section className="bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-[#050505] border-b border-[#141414] px-6 py-4 flex items-center justify-between">
                        <div>
                            <h3 className="font-serif text-base font-normal text-[#FFFFFF] tracking-tight m-0 flex items-center gap-2">
                                <IconShield />
                                <span>Administrator Cluster Alerts</span>
                            </h3>
                            <p className="text-[11px] font-sans text-[#737373] mt-0.5 m-0">
                                Staff-only notifications for cluster health, daemon events, and client tickets.
                            </p>
                        </div>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                            Root Admin
                        </span>
                    </div>

                    <div className="divide-y divide-[#141414] text-xs">
                        {/* Node & Daemon Status */}
                        <div className="flex items-center justify-between px-6 py-4 hover:bg-[#050505] transition-colors">
                            <div>
                                <div className="font-medium text-white flex items-center gap-2.5">
                                    <IconClusterAlert />
                                    <span>Node Outages &amp; Daemon Warnings</span>
                                </div>
                                <div className="text-[#737373] text-[11px] mt-0.5 pl-6">
                                    Alert when a node disconnects, Wings loses connectivity, or critical daemon issues occur.
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTogglePreference('admin_node_status')}
                                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                    config?.preferences.admin_node_status ? 'bg-amber-500' : 'bg-[#262626]'
                                }`}
                            >
                                <span
                                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                                        config?.preferences.admin_node_status ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* New Support Tickets */}
                        <div className="flex items-center justify-between px-6 py-4 hover:bg-[#050505] transition-colors">
                            <div>
                                <div className="font-medium text-white flex items-center gap-2.5">
                                    <IconTicketReply />
                                    <span>New Customer Tickets &amp; Follow-ups</span>
                                </div>
                                <div className="text-[#737373] text-[11px] mt-0.5 pl-6">
                                    Alert when users submit new support inquiries or add messages to open tickets.
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTogglePreference('admin_new_ticket')}
                                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                    config?.preferences.admin_new_ticket ? 'bg-amber-500' : 'bg-[#262626]'
                                }`}
                            >
                                <span
                                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                                        config?.preferences.admin_new_ticket ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* New Server Deployments */}
                        <div className="flex items-center justify-between px-6 py-4 hover:bg-[#050505] transition-colors">
                            <div>
                                <div className="font-medium text-white flex items-center gap-2.5">
                                    <IconDeploy />
                                    <span>New Server Deployments &amp; Orders</span>
                                </div>
                                <div className="text-[#737373] text-[11px] mt-0.5 pl-6">
                                    Alert when a new server instance is deployed or assigned on the cluster.
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTogglePreference('admin_server_deploy')}
                                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                    config?.preferences.admin_server_deploy ? 'bg-amber-500' : 'bg-[#262626]'
                                }`}
                            >
                                <span
                                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                                        config?.preferences.admin_server_deploy ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};
