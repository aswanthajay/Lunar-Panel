import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';

const MOD_LOADERS = new Set(['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'modloader', 'risugamis-modloader']);
const getDirectoryForLoader = (loader: string) => (loader && MOD_LOADERS.has(loader.toLowerCase()) ? '/mods' : '/plugins');

const isMcVersion = (s: string) => /^\d+\.\d+/.test(s);
const sortMcVersions = (arr: string[]) =>
    [...arr].sort((a, b) => {
        const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
        const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const d = (pb[i] || 0) - (pa[i] || 0);
            if (d) return d;
        }
        return 0;
    });

const CF_LOADERS = new Set(['Forge', 'Fabric', 'NeoForge', 'Quilt', 'LiteLoader', 'ModLoader', 'Cauldron', 'forge', 'fabric', 'neoforge', 'quilt', 'liteloader']);
const isCfLoader = (s: string) => CF_LOADERS.has(s);

const cap = (s: any) => (s && typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : String(s ?? ''));

function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface InstalledPlugin {
    file_name: string;
    name: string;
    version: string | null;
    author: string | null;
    description: string | null;
    website: string | null;
    size: number;
    enabled: boolean;
    modified_at: string;
    type?: string;
}

interface PluginUpdateInfo {
    has_update: boolean;
    current_version: string;
    latest_version: string;
    download_url: string;
    new_file_name: string;
    provider: string;
    icon_url?: string | null;
}

const MODRINTH_LOADERS = [
    ['paper', 'PaperMC'],
    ['spigot', 'Spigot'],
    ['bukkit', 'Bukkit'],
    ['purpur', 'Purpur'],
    ['bungeecord', 'BungeeCord'],
    ['velocity', 'Velocity'],
    ['waterfall', 'Waterfall'],
    ['fabric', 'Fabric'],
    ['forge', 'Forge'],
    ['neoforge', 'NeoForge'],
    ['quilt', 'Quilt'],
];

const CF_LOADER_OPTS = [
    ['fabric', 'Fabric'],
    ['forge', 'Forge'],
    ['neoforge', 'NeoForge'],
    ['quilt', 'Quilt'],
];

const SORT_OPTIONS: Record<string, string[][]> = {
    modrinth: [['downloads', 'Downloads'], ['newest', 'Newest'], ['updated', 'Updated'], ['relevance', 'Relevance']],
    curseforge: [['6', 'Downloads'], ['12', 'Rating'], ['2', 'Popularity'], ['11', 'Newest'], ['3', 'Updated']],
    hangar: [['-downloads', 'Downloads'], ['-stars', 'Stars'], ['-views', 'Views'], ['-newest', 'Newest'], ['-updated', 'Updated']],
    spigotmc: [['-downloads', 'Downloads'], ['-rating', 'Rating'], ['-likes', 'Likes'], ['-updateDate', 'Updated'], ['-releaseDate', 'Latest']],
};

const DEFAULT_SORT: Record<string, string> = { modrinth: 'downloads', curseforge: '6', hangar: '-downloads', spigotmc: '-downloads' };
const DEFAULT_LOADER: Record<string, string> = { modrinth: 'paper', curseforge: 'fabric' };

interface ToastItem {
    id: number;
    msg: string;
    type: 'success' | 'error';
}

export default function PluginsContainer() {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id || '';
    const isMinecraft = Boolean(server?.isMinecraft);

    // Navigation Tab
    const [activeTab, setActiveTab] = useState<'installed' | 'browse'>('installed');

    // Installed Plugins State
    const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
    const [installedLoading, setInstalledLoading] = useState(false);
    const [installedError, setInstalledError] = useState<string | null>(null);
    const [targetDir, setTargetDir] = useState<'/plugins' | '/mods'>('/plugins');
    const [installedSearch, setInstalledSearch] = useState('');
    const [installedFilter, setInstalledFilter] = useState<'all' | 'enabled' | 'disabled' | 'updates'>('all');
    const [updatesMap, setUpdatesMap] = useState<Record<string, PluginUpdateInfo>>({});
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<InstalledPlugin | null>(null);
    const [updateTarget, setUpdateTarget] = useState<{ plugin: InstalledPlugin; update: PluginUpdateInfo } | null>(null);
    const [updating, setUpdating] = useState(false);

    // Browse & Install State
    const [plugins, setPlugins] = useState<any[]>([]);
    const [pagination, setPagination] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activePlugin, setActivePlugin] = useState<any>(null);
    const [provider, setProvider] = useState('modrinth');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const [search, setSearch] = useState('');
    const [searchDebounced, setSDebounced] = useState('');
    const [loader, setLoader] = useState('paper');
    const [sortBy, setSortBy] = useState('downloads');
    const [minecraftVersion, setMinecraftVersion] = useState('');
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [versions, setVersions] = useState<any[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [selMc, setSelMc] = useState<string | null>(null);
    const [selLoader, setSelLoader] = useState<string | null>(null);
    const [mcVersionsList, setMcVersionsList] = useState<string[]>([]);

    const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    };

    // Load installed plugins
    const loadInstalledPlugins = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        setInstalledLoading(true);
        setInstalledError(null);
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/plugins/installed`, {
                params: { directory: targetDir },
                timeout: 15000,
            });
            setInstalledPlugins(Array.isArray(data.plugins) ? data.plugins : []);
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to load installed plugins.';
            setInstalledError(msg);
            addToast(msg, 'error');
        } finally {
            setInstalledLoading(false);
        }
    }, [uuid, isMinecraft, targetDir]);

    useEffect(() => {
        if (uuid && isMinecraft) {
            loadInstalledPlugins();
        }
    }, [uuid, isMinecraft, targetDir, loadInstalledPlugins]);

    // Check updates for installed plugins
    const handleCheckUpdates = async () => {
        if (!uuid || installedPlugins.length === 0) return;
        setCheckingUpdates(true);
        try {
            const payload = installedPlugins.map((p) => ({
                name: p.name,
                version: p.version || '',
                file_name: p.file_name,
            }));

            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/plugins/check-updates`, {
                plugins: payload,
            });

            const updates = data.updates || {};
            setUpdatesMap(updates);

            const count = Object.keys(updates).length;
            if (count > 0) {
                addToast(`Found ${count} update${count > 1 ? 's' : ''} available!`, 'success');
            } else {
                addToast('All identified plugins are up to date.', 'success');
            }
        } catch (err: any) {
            addToast(err?.response?.data?.error || 'Failed to check for updates.', 'error');
        } finally {
            setCheckingUpdates(false);
        }
    };

    // Toggle plugin enable/disable (.jar <-> .jar.disabled)
    const handleToggle = async (plugin: InstalledPlugin) => {
        setActionBusy(plugin.file_name);
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/plugins/toggle`, {
                directory: targetDir,
                file_name: plugin.file_name,
            });
            addToast(data.message || (data.enabled ? 'Plugin enabled.' : 'Plugin disabled.'), 'success');
            setInstalledPlugins((prev) =>
                prev.map((p) =>
                    p.file_name === plugin.file_name
                        ? { ...p, file_name: data.new_file_name, enabled: data.enabled }
                        : p
                )
            );
            if (updatesMap[plugin.file_name]) {
                setUpdatesMap((prev) => {
                    const next = { ...prev };
                    next[data.new_file_name] = next[plugin.file_name];
                    delete next[plugin.file_name];
                    return next;
                });
            }
        } catch (err: any) {
            addToast(err?.response?.data?.error || err?.response?.data?.message || 'Failed to toggle plugin.', 'error');
        } finally {
            setActionBusy(null);
        }
    };

    // Remove / Delete plugin
    const handleRemove = async () => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        setActionBusy(target.file_name);
        try {
            await http.post(`/api/client/servers/${uuid}/minecraft/plugins/remove`, {
                directory: targetDir,
                file_name: target.file_name,
            });
            addToast(`Removed ${target.name} (${target.file_name}).`, 'success');
            setInstalledPlugins((prev) => prev.filter((p) => p.file_name !== target.file_name));
            setDeleteTarget(null);
        } catch (err: any) {
            addToast(err?.response?.data?.error || err?.response?.data?.message || 'Failed to remove plugin.', 'error');
        } finally {
            setActionBusy(null);
        }
    };

    // Execute plugin update
    const handleUpdate = async () => {
        if (!updateTarget) return;
        const { plugin, update } = updateTarget;
        setUpdating(true);
        try {
            await http.post(`/api/client/servers/${uuid}/minecraft/plugins/update`, {
                directory: targetDir,
                file_name: plugin.file_name,
                download_url: update.download_url,
            });
            addToast(`Updated ${plugin.name} to v${update.latest_version}.`, 'success');
            setUpdateTarget(null);
            setUpdatesMap((prev) => {
                const next = { ...prev };
                delete next[plugin.file_name];
                return next;
            });
            loadInstalledPlugins();
        } catch (err: any) {
            addToast(err?.response?.data?.error || err?.response?.data?.message || 'Failed to update plugin.', 'error');
        } finally {
            setUpdating(false);
        }
    };

    // Filtered installed plugins
    const filteredInstalledPlugins = useMemo(() => {
        return installedPlugins.filter((p) => {
            if (installedFilter === 'enabled' && !p.enabled) return false;
            if (installedFilter === 'disabled' && p.enabled) return false;
            if (installedFilter === 'updates' && !updatesMap[p.file_name]) return false;

            if (installedSearch.trim()) {
                const q = installedSearch.toLowerCase();
                const matchName = p.name.toLowerCase().includes(q);
                const matchFile = p.file_name.toLowerCase().includes(q);
                const matchAuthor = (p.author || '').toLowerCase().includes(q);
                const matchDesc = (p.description || '').toLowerCase().includes(q);
                if (!matchName && !matchFile && !matchAuthor && !matchDesc) return false;
            }

            return true;
        });
    }, [installedPlugins, installedFilter, installedSearch, updatesMap]);

    const enabledCount = useMemo(() => installedPlugins.filter((p) => p.enabled).length, [installedPlugins]);
    const disabledCount = useMemo(() => installedPlugins.filter((p) => !p.enabled).length, [installedPlugins]);
    const updatesCount = useMemo(() => Object.keys(updatesMap).length, [updatesMap]);

    useEffect(() => {
        fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json')
            .then((r) => r.json())
            .then((d) => setMcVersionsList(d.versions.filter((v: any) => v.type === 'release').map((v: any) => v.id)))
            .catch(() => {});
    }, []);

    useEffect(() => {
        setSortBy(DEFAULT_SORT[provider] || 'downloads');
        setPage(1);
    }, [provider]);

    useEffect(() => {
        setPage(1);
    }, [pageSize]);

    useEffect(() => {
        const t = setTimeout(() => {
            setSDebounced(search);
            setPage(1);
            if (search === '') {
                setMinecraftVersion('');
                setLoader(DEFAULT_LOADER[provider] || '');
                setSortBy(DEFAULT_SORT[provider] || 'downloads');
            }
        }, 350);
        return () => clearTimeout(t);
    }, [search, provider]);

    useEffect(() => {
        if (!uuid || !isMinecraft || activeTab !== 'browse') return;
        setLoading(true);
        const controller = new AbortController();

        http.get(`/api/client/servers/${uuid}/minecraft/plugins`, {
            params: {
                provider,
                page,
                page_size: pageSize,
                search_query: searchDebounced,
                loader,
                sort_by: sortBy,
                minecraft_version: minecraftVersion,
            },
            signal: controller.signal,
        })
            .then(({ data }) => {
                setPlugins(data.data || []);
                setPagination(data.pagination || null);
            })
            .catch((err) => {
                if (err.name !== 'CanceledError') {
                    setPlugins([]);
                    setPagination(null);
                }
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [uuid, isMinecraft, activeTab, provider, page, pageSize, searchDebounced, loader, sortBy, minecraftVersion]);

    const openInstallModal = (plugin: any) => {
        setActivePlugin(plugin);
        setVersions([]);
        setSelMc(null);
        setSelLoader(null);
        setVersionsLoading(true);

        http.get(`/api/client/servers/${uuid}/minecraft/plugins/versions`, {
            params: { provider: plugin.provider, pluginId: plugin.id },
        })
            .then(({ data }) => setVersions(Array.isArray(data.data) ? data.data : []))
            .catch(() => addToast('Failed to load version list.', 'error'))
            .finally(() => setVersionsLoading(false));
    };

    const modalMcVersions = useMemo(() => {
        if (!activePlugin) return [];
        if (activePlugin.provider === 'modrinth') {
            const seen = new Set<string>();
            versions.forEach((v) => (v.game_versions || []).forEach((gv: string) => seen.add(gv)));
            return sortMcVersions([...seen]);
        }
        if (activePlugin.provider === 'curseforge') {
            const seen = new Set<string>();
            versions.forEach((v) => (v.game_versions || []).filter(isMcVersion).forEach((gv: string) => seen.add(gv)));
            return sortMcVersions([...seen]);
        }
        return [];
    }, [versions, activePlugin]);

    const modalLoaders = useMemo(() => {
        if (!selMc || !activePlugin) return [];
        const seen = new Set<string>();
        versions.forEach((v) => {
            const gv = v.game_versions || [];
            if (activePlugin.provider === 'modrinth' && gv.includes(selMc)) {
                (v.loaders || []).forEach((l: string) => l && seen.add(l));
            }
            if (activePlugin.provider === 'curseforge' && gv.includes(selMc)) {
                gv.filter((x: string) => !isMcVersion(x) && isCfLoader(x)).forEach((l: string) => l && seen.add(l));
            }
        });
        return [...seen];
    }, [versions, selMc, activePlugin]);

    const modalMatchingVersion = useMemo(() => {
        if (!selMc || !selLoader || !activePlugin) return null;
        if (activePlugin.provider === 'modrinth') {
            return versions.find((v) => (v.game_versions || []).includes(selMc) && (v.loaders || []).includes(selLoader)) || null;
        }
        if (activePlugin.provider === 'curseforge') {
            return versions.find((v) => (v.game_versions || []).includes(selMc) && (v.game_versions || []).includes(selLoader)) || null;
        }
        return null;
    }, [versions, selMc, selLoader, activePlugin]);

    const hangarPlatforms = useMemo(() => {
        if (!activePlugin || activePlugin.provider !== 'hangar') return [];
        return [...new Set(versions.map((v) => (v.versionId || '').split(' - ')[1]).filter(Boolean))];
    }, [versions, activePlugin]);

    const hangarMatch = useMemo(() => {
        if (!activePlugin || activePlugin.provider !== 'hangar' || !selLoader) return null;
        return versions.find((v) => (v.versionId || '').endsWith(' - ' + selLoader)) || null;
    }, [versions, selLoader, activePlugin]);

    const canInstall = Boolean(
        activePlugin &&
            (activePlugin.provider === 'spigotmc' ||
                (activePlugin.provider === 'hangar' && Boolean(hangarMatch)) ||
                Boolean(modalMatchingVersion))
    );

    const handleInstallSubmit = async () => {
        if (!activePlugin) return;
        setInstalling(true);
        try {
            let versionId: string | null = null;
            let dir = '/plugins';
            if (activePlugin.provider === 'hangar') {
                versionId = hangarMatch?.versionId || null;
            } else if (activePlugin.provider !== 'spigotmc') {
                versionId = modalMatchingVersion?.versionId || null;
                dir = getDirectoryForLoader(selLoader || '');
            }

            await http.post(`/api/client/servers/${uuid}/minecraft/plugins/install`, {
                provider: activePlugin.provider,
                pluginId: activePlugin.id,
                versionId,
                directory: dir,
            });

            addToast(`${activePlugin.name} installed successfully to ${dir}.`, 'success');
            setActivePlugin(null);
            loadInstalledPlugins();
        } catch (err: any) {
            addToast(err?.response?.data?.message || 'Failed to install plugin.', 'error');
        } finally {
            setInstalling(false);
        }
    };

    if (!isMinecraft) {
        return (
            <ServerContentBlock title="Plugins & Mods">
                <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-8 text-center max-w-xl mx-auto my-12">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Minecraft Only Feature</h3>
                    <p className="text-sm text-[#A0A0A0] leading-relaxed">
                        The Plugin & Mod Manager is configured exclusively for Minecraft servers. To enable this feature for this server, configure the Game Server Type as Minecraft in the admin panel.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    const showVersionFilter = provider !== 'spigotmc';
    const showLoaderFilter = provider === 'modrinth' || provider === 'curseforge';
    const loaderOptions = provider === 'curseforge' ? CF_LOADER_OPTS : MODRINTH_LOADERS;
    const sortList = SORT_OPTIONS[provider] || [];
    const versionsDisplayList = provider === 'hangar' ? [...new Set(mcVersionsList.map((v) => v.split('.').slice(0, 2).join('.')))] : mcVersionsList;

    return (
        <ServerContentBlock title="Minecraft Plugins & Mods">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header Tab Navigation Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-4">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('installed')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
                                activeTab === 'installed'
                                    ? 'bg-white text-black shadow-sm'
                                    : 'bg-[#0A0A0A] border border-[#1F1F1F] text-[#A0A0A0] hover:text-white hover:border-[#333333]'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <span>Installed Plugins</span>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    activeTab === 'installed' ? 'bg-black/15 text-black' : 'bg-[#1F1F1F] text-[#D4D4D4]'
                                }`}
                            >
                                {installedPlugins.length}
                            </span>
                            {updatesCount > 0 && (
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title={`${updatesCount} update(s) available`} />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('browse')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
                                activeTab === 'browse'
                                    ? 'bg-white text-black shadow-sm'
                                    : 'bg-[#0A0A0A] border border-[#1F1F1F] text-[#A0A0A0] hover:text-white hover:border-[#333333]'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <span>Browse & Install</span>
                        </button>
                    </div>

                    {/* Quick actions for Installed tab */}
                    {activeTab === 'installed' && (
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={loadInstalledPlugins}
                                disabled={installedLoading}
                                className="px-3 py-1.5 bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#333333] hover:text-white text-[#A0A0A0] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                title="Refresh directory files"
                            >
                                <svg
                                    className={`w-3.5 h-3.5 ${installedLoading ? 'animate-spin' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Refresh</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleCheckUpdates}
                                disabled={checkingUpdates || installedPlugins.length === 0}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                            >
                                {checkingUpdates ? (
                                    <>
                                        <Spinner size="small" />
                                        <span>Checking Updates…</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        <span>Check for Updates</span>
                                        {updatesCount > 0 && (
                                            <span className="bg-cyan-400 text-black px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                                                {updatesCount}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* ========================================================================= */}
                {/* 1. INSTALLED PLUGINS TAB */}
                {/* ========================================================================= */}
                {activeTab === 'installed' && (
                    <div className="space-y-5">
                        {/* Directory Switcher & Search & Filter Bar */}
                        <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-4 sm:p-5 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Search input */}
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] pointer-events-none">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        value={installedSearch}
                                        onChange={(e) => setInstalledSearch(e.target.value)}
                                        placeholder="Search installed plugins by name, filename, author…"
                                        className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg pl-9 pr-3 py-2 text-xs outline-none transition-colors placeholder:text-[#737373]"
                                    />
                                    {installedSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setInstalledSearch('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white text-xs"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* Directory Selector: /plugins vs /mods */}
                                <div className="flex items-center gap-1.5 bg-[#0A0A0A] border border-[#1F1F1F] p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setTargetDir('/plugins')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                            targetDir === '/plugins'
                                                ? 'bg-[#1F1F1F] text-white font-semibold'
                                                : 'text-[#A0A0A0] hover:text-white'
                                        }`}
                                    >
                                        /plugins
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetDir('/mods')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                            targetDir === '/mods'
                                                ? 'bg-[#1F1F1F] text-white font-semibold'
                                                : 'text-[#A0A0A0] hover:text-white'
                                        }`}
                                    >
                                        /mods
                                    </button>
                                </div>
                            </div>

                            {/* Status Filter Pills */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1F1F1F]">
                                <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider mr-1">
                                    Filter:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setInstalledFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        installedFilter === 'all'
                                            ? 'bg-white text-black font-semibold'
                                            : 'bg-[#0A0A0A] border border-[#1F1F1F] text-[#A0A0A0] hover:text-white'
                                    }`}
                                >
                                    All ({installedPlugins.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInstalledFilter('enabled')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        installedFilter === 'enabled'
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                                            : 'bg-[#0A0A0A] border border-[#1F1F1F] text-[#A0A0A0] hover:text-emerald-400'
                                    }`}
                                >
                                    Enabled ({enabledCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInstalledFilter('disabled')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        installedFilter === 'disabled'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                                            : 'bg-[#0A0A0A] border border-[#1F1F1F] text-[#A0A0A0] hover:text-amber-400'
                                    }`}
                                >
                                    Disabled ({disabledCount})
                                </button>
                                {updatesCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setInstalledFilter('updates')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                            installedFilter === 'updates'
                                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                                                : 'bg-[#0A0A0A] border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10'
                                        }`}
                                    >
                                        ⚡ Updates Available ({updatesCount})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Installed Plugins Grid */}
                        {installedLoading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-3">
                                <Spinner size="large" />
                                <span className="text-xs text-[#A0A0A0]">Scanning {targetDir} directory…</span>
                            </div>
                        ) : installedError ? (
                            <div className="bg-[#050505] border border-amber-500/20 rounded-xl p-10 text-center max-w-md mx-auto">
                                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-semibold text-white mb-1">Failed to Scan {targetDir}</h3>
                                <p className="text-xs text-[#A0A0A0] mb-4 leading-relaxed">{installedError}</p>
                                <button
                                    type="button"
                                    onClick={() => loadInstalledPlugins()}
                                    className="bg-white hover:bg-[#E5E5E5] text-black font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
                                >
                                    Retry Scan
                                </button>
                            </div>
                        ) : installedPlugins.length === 0 ? (
                            <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-12 text-center">
                                <div className="w-12 h-12 rounded-full bg-[#111111] border border-[#262626] flex items-center justify-center mx-auto mb-3 text-[#737373]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-semibold text-white mb-1">No Plugins or Mods Found</h3>
                                <p className="text-xs text-[#737373] max-w-md mx-auto mb-4">
                                    No jar or mod files were found in <code className="text-white bg-[#141414] px-1.5 py-0.5 rounded font-mono">{targetDir}</code>.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('browse')}
                                    className="bg-white hover:bg-[#E5E5E5] text-black font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
                                >
                                    Browse & Install Plugins
                                </button>
                            </div>
                        ) : filteredInstalledPlugins.length === 0 ? (
                            <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-12 text-center">
                                <p className="text-xs text-[#737373]">No installed plugins match your search or filter.</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInstalledSearch('');
                                        setInstalledFilter('all');
                                    }}
                                    className="mt-3 text-xs text-white underline hover:text-[#EDEDED]"
                                >
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredInstalledPlugins.map((plugin) => {
                                    const updateInfo = updatesMap[plugin.file_name];
                                    const isBusy = actionBusy === plugin.file_name;
                                    const isUnknown = plugin.name === 'Unknown Plugin';

                                    return (
                                        <div
                                            key={plugin.file_name}
                                            className={`bg-[#0A0A0A] border rounded-xl p-5 flex flex-col justify-between gap-4 transition-all duration-150 shadow-sm relative group ${
                                                !plugin.enabled
                                                    ? 'border-[#1F1F1F] opacity-75 hover:opacity-100'
                                                    : updateInfo
                                                    ? 'border-cyan-500/30 hover:border-cyan-500/50'
                                                    : 'border-[#1F1F1F] hover:border-[#333333]'
                                            }`}
                                        >
                                            {/* Top info section */}
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                                        {/* Avatar / Icon */}
                                                        <div
                                                            className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden ${
                                                                updateInfo?.icon_url
                                                                    ? 'bg-[#111111] border-[#242424]'
                                                                    : plugin.enabled
                                                                    ? 'bg-gradient-to-br from-[#161616] to-[#0D0D0D] border-[#2A2A2A]'
                                                                    : 'bg-[#141414] border-[#202020]'
                                                            }`}
                                                        >
                                                            {updateInfo?.icon_url ? (
                                                                <img
                                                                    src={updateInfo.icon_url}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e: any) => {
                                                                        e.target.style.display = 'none';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span
                                                                    className={`text-sm font-black uppercase ${
                                                                        isUnknown ? 'text-amber-400' : plugin.enabled ? 'text-white' : 'text-[#737373]'
                                                                    }`}
                                                                >
                                                                    {isUnknown ? '?' : plugin.name.charAt(0)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <h4
                                                                    className={`text-sm font-semibold truncate m-0 ${
                                                                        plugin.enabled ? 'text-white' : 'text-[#A0A0A0] line-through decoration-[#555555]'
                                                                    }`}
                                                                    title={plugin.name}
                                                                >
                                                                    {plugin.name}
                                                                </h4>
                                                                {isUnknown && (
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                                                                        Unidentified
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center flex-wrap gap-1.5 mt-1 text-[11px] text-[#737373]">
                                                                {plugin.version ? (
                                                                    <span className="font-mono text-[10px] bg-[#141414] border border-[#222222] px-1.5 py-0.5 rounded text-[#D4D4D4]">
                                                                        v{plugin.version}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-[#666666]">v?</span>
                                                                )}
                                                                <span>•</span>
                                                                <span>{formatBytes(plugin.size)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div>
                                                        {plugin.enabled ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                                Disabled
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* File name */}
                                                <div className="bg-[#050505] border border-[#161616] rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-[#888888] truncate">
                                                    📄 {plugin.file_name}
                                                </div>

                                                {/* Description or author note */}
                                                {plugin.description ? (
                                                    <p className="text-xs text-[#888888] line-clamp-2 leading-relaxed m-0">
                                                        {plugin.description}
                                                    </p>
                                                ) : isUnknown ? (
                                                    <p className="text-xs text-amber-500/80 italic m-0">
                                                        Internal metadata could not be recognized. You can still manage or delete this jar file.
                                                    </p>
                                                ) : null}

                                                {plugin.author && (
                                                    <div className="text-[11px] text-[#666666] flex items-center gap-1">
                                                        <span>Author:</span>
                                                        <span className="text-[#A0A0A0] font-medium">{plugin.author}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Update Notice Banner if available */}
                                            {updateInfo && (
                                                <div className="bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-lg p-2.5 flex items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                                                            Update Available
                                                        </div>
                                                        <div className="text-xs text-white font-medium truncate">
                                                            Latest release: <span className="font-mono text-cyan-300">v{updateInfo.latest_version}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setUpdateTarget({ plugin, update: updateInfo })}
                                                        disabled={isBusy}
                                                        className="bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold px-2.5 py-1 rounded-md transition-colors shrink-0 shadow-sm"
                                                    >
                                                        Update Now
                                                    </button>
                                                </div>
                                            )}

                                            {/* Action Buttons Row */}
                                            <div className="flex items-center justify-between pt-3 border-t border-[#1F1F1F]">
                                                <div className="flex items-center gap-2">
                                                    {/* Toggle Disable / Enable */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggle(plugin)}
                                                        disabled={isBusy}
                                                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                                            plugin.enabled
                                                                ? 'bg-[#111111] hover:bg-[#1A1A1A] border-[#262626] text-amber-400 hover:text-amber-300'
                                                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300 font-semibold'
                                                        } disabled:opacity-40`}
                                                    >
                                                        {isBusy ? (
                                                            <Spinner size="small" />
                                                        ) : plugin.enabled ? (
                                                            <>
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                                </svg>
                                                                <span>Disable</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                <span>Enable</span>
                                                            </>
                                                        )}
                                                    </button>

                                                    {/* Optional website link */}
                                                    {plugin.website && (
                                                        <a
                                                            href={plugin.website}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-xs text-[#737373] hover:text-white px-2 py-1 transition-colors"
                                                            title="Website"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Remove / Delete Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget(plugin)}
                                                    disabled={isBusy}
                                                    className="text-[#737373] hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-40"
                                                    title="Delete plugin file"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    <span>Remove</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 2. BROWSE & INSTALL TAB */}
                {/* ========================================================================= */}
                {activeTab === 'browse' && (
                    <div className="space-y-6">
                        {/* Search & Filter Header Bar */}
                        <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-5 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                                {/* Search field */}
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-2">
                                        Search Resources
                                    </label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-3 text-[#737373] pointer-events-none">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </span>
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search by title, keyword…"
                                            className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg pl-9 pr-3 py-2 text-sm outline-none transition-colors placeholder:text-[#737373]"
                                        />
                                    </div>
                                </div>

                                {/* Provider select */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-2">
                                        Provider
                                    </label>
                                    <select
                                        value={provider}
                                        onChange={(e) => {
                                            const p = e.target.value;
                                            setProvider(p);
                                            setSortBy((SORT_OPTIONS[p] || [['']])[0][0]);
                                            setMinecraftVersion('');
                                            setLoader(DEFAULT_LOADER[p] || '');
                                            setSearch('');
                                        }}
                                        className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                                    >
                                        <option value="modrinth">Modrinth</option>
                                        <option value="curseforge">CurseForge</option>
                                        <option value="spigotmc">SpigotMC</option>
                                        <option value="hangar">Hangar</option>
                                    </select>
                                </div>

                                {/* Sort select */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-2">
                                        Sort Order
                                    </label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                                    >
                                        {sortList.map(([val, label]) => (
                                            <option key={val} value={val}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Minecraft Version */}
                                {showVersionFilter && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-2">
                                            MC Version
                                        </label>
                                        <select
                                            value={minecraftVersion}
                                            onChange={(e) => setMinecraftVersion(e.target.value)}
                                            className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                                        >
                                            <option value="">Any Version</option>
                                            {versionsDisplayList.map((v) => (
                                                <option key={v} value={v}>
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Loader select */}
                                {showLoaderFilter && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-2">
                                            Loader
                                        </label>
                                        <select
                                            value={loader}
                                            onChange={(e) => setLoader(e.target.value)}
                                            className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                                        >
                                            {loaderOptions.map(([val, label]) => (
                                                <option key={val} value={val}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Plugin Cards List */}
                        {loading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-3">
                                <Spinner size="large" />
                                <span className="text-xs text-[#A0A0A0]">Loading {cap(provider)} catalog…</span>
                            </div>
                        ) : plugins.length === 0 ? (
                            <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-12 text-center">
                                <p className="text-[#A0A0A0] text-sm">No plugins or mods found matching your query.</p>
                            </div>
                        ) : (
                            <div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {plugins.map((plugin) => (
                                        <div
                                            key={plugin.id + plugin.provider}
                                            className="bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#333333] hover:bg-[#0D0D0D] rounded-xl p-5 flex flex-col justify-between gap-4 transition-all duration-150 shadow-sm group"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-[#111111] border border-[#242424] overflow-hidden shrink-0 flex items-center justify-center">
                                                    {plugin.icon ? (
                                                        <img
                                                            src={plugin.icon}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                            onError={(e: any) => {
                                                                e.target.style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-bold text-[#A0A0A0] uppercase">
                                                            {(plugin.name?.[0] ?? '?').toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-sm font-semibold text-white truncate m-0 group-hover:text-[#EDEDED] transition-colors">
                                                        {plugin.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#737373]">
                                                        <span>{cap(plugin.provider)}</span>
                                                        <span>•</span>
                                                        <span>{(plugin.downloads || 0).toLocaleString()} downloads</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-xs text-[#909090] line-clamp-3 leading-relaxed m-0 flex-1">
                                                {plugin.description || 'No description provided.'}
                                            </p>

                                            <div className="flex items-center justify-between pt-3 border-t border-[#1F1F1F]">
                                                <a
                                                    href={plugin.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-[#737373] hover:text-white flex items-center gap-1 transition-colors"
                                                >
                                                    <span>View details</span>
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </a>

                                                {plugin.installable ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openInstallModal(plugin)}
                                                        className="bg-white hover:bg-[#E5E5E5] text-black text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer"
                                                    >
                                                        Install
                                                    </button>
                                                ) : (
                                                    <a
                                                        href={plugin.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="bg-[#111111] hover:bg-[#1A1A1A] border border-[#242424] text-[#EDEDED] hover:text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        Download ↗
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {pagination && pagination.total_pages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-8">
                                        <button
                                            type="button"
                                            disabled={page <= 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            className="px-3 py-1.5 bg-[#0A0A0A] border border-[#1F1F1F] text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#141414] transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-xs text-[#A0A0A0] px-2">
                                            Page {page} of {pagination.total_pages}
                                        </span>
                                        <button
                                            type="button"
                                            disabled={page >= pagination.total_pages}
                                            onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                                            className="px-3 py-1.5 bg-[#0A0A0A] border border-[#1F1F1F] text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#141414] transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 3. MODALS */}
                {/* ========================================================================= */}

                {/* Confirm Delete Plugin Modal */}
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
                            <div className="p-6">
                                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-semibold text-white mb-2">
                                    Remove {deleteTarget.name}?
                                </h3>
                                <p className="text-xs text-[#A0A0A0] leading-relaxed mb-4">
                                    Are you sure you want to delete <code className="text-white bg-[#141414] px-1.5 py-0.5 rounded font-mono">{deleteTarget.file_name}</code> from <code className="text-white bg-[#141414] px-1.5 py-0.5 rounded font-mono">{targetDir}</code>?
                                    <br /><br />
                                    This will delete the jar file permanently. Any saved configuration or database folders created by the plugin will remain intact.
                                </p>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget(null)}
                                        disabled={actionBusy === deleteTarget.file_name}
                                        className="px-4 py-2 bg-[#141414] hover:bg-[#1E1E1E] text-[#D4D4D4] rounded-lg text-xs font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemove}
                                        disabled={actionBusy === deleteTarget.file_name}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
                                    >
                                        {actionBusy === deleteTarget.file_name ? (
                                            <>
                                                <Spinner size="small" />
                                                <span>Deleting…</span>
                                            </>
                                        ) : (
                                            <span>Delete Plugin</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Update Plugin Modal */}
                {updateTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
                            <div className="p-6">
                                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-semibold text-white mb-2">
                                    Update {updateTarget.plugin.name}?
                                </h3>
                                <div className="text-xs text-[#A0A0A0] leading-relaxed space-y-2 mb-5">
                                    <p>
                                        This will update <strong className="text-white">{updateTarget.plugin.name}</strong> from{' '}
                                        <span className="font-mono text-amber-400">v{updateTarget.update.current_version || 'current'}</span> to{' '}
                                        <span className="font-mono text-cyan-400 font-bold">v{updateTarget.update.latest_version}</span>.
                                    </p>
                                    <div className="bg-[#050505] border border-[#161616] rounded-lg p-2.5 text-[11px] font-mono space-y-1">
                                        <div className="text-rose-400">✕ Deleting: {updateTarget.plugin.file_name}</div>
                                        <div className="text-emerald-400">✓ Pulling: {updateTarget.update.new_file_name}</div>
                                    </div>
                                    <p className="text-[11px] text-[#737373]">
                                        Your configuration folders and settings will be preserved. Remember to restart your server after updating.
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setUpdateTarget(null)}
                                        disabled={updating}
                                        className="px-4 py-2 bg-[#141414] hover:bg-[#1E1E1E] text-[#D4D4D4] rounded-lg text-xs font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleUpdate}
                                        disabled={updating}
                                        className="px-4 py-2 bg-white hover:bg-[#E5E5E5] text-black rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
                                    >
                                        {updating ? (
                                            <>
                                                <Spinner size="small" />
                                                <span>Updating…</span>
                                            </>
                                        ) : (
                                            <span>Confirm & Update</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Installation Modal (Browse tab) */}
                {activePlugin && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F1F]">
                                <div className="flex items-center gap-3 min-w-0">
                                    {activePlugin.icon && (
                                        <img src={activePlugin.icon} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                    )}
                                    <div className="truncate">
                                        <h3 className="text-sm font-semibold text-white truncate m-0 font-sans">
                                            Install {activePlugin.name}
                                        </h3>
                                        <span className="text-[11px] text-[#A0A0A0]">
                                            Provider: {cap(activePlugin.provider)}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActivePlugin(null)}
                                    className="text-[#737373] hover:text-white p-1 transition-colors"
                                >
                                    <svg className={'w-5 h-5'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                        <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M6 18L18 6M6 6l12 12'} />
                                    </svg>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 overflow-y-auto space-y-4">
                                {versionsLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                                        <Spinner size="small" />
                                        <span className="text-xs text-[#737373]">Loading version index…</span>
                                    </div>
                                ) : activePlugin.provider === 'spigotmc' ? (
                                    <div className="text-center py-4">
                                        <p className="text-xs text-[#A0A0A0] mb-4">
                                            Installs the latest compatible release directly into your server&apos;s <code className="text-white bg-[#141414] px-1.5 py-0.5 rounded font-mono">/plugins</code> folder.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleInstallSubmit}
                                            disabled={installing}
                                            className="w-full bg-white hover:bg-[#E5E5E5] text-black font-semibold py-2.5 rounded-xl text-sm transition-colors shadow disabled:opacity-50"
                                        >
                                            {installing ? 'Installing…' : 'Install Latest Version'}
                                        </button>
                                    </div>
                                ) : activePlugin.provider === 'hangar' ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-[#D4D4D4] mb-2 font-sans">
                                                Select Platform Build
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {hangarPlatforms.map((p) => (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => setSelLoader(p)}
                                                        className={`p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                                                            selLoader === p
                                                                ? 'border-white bg-white text-black font-semibold'
                                                                : 'border-[#1F1F1F] bg-[#050505] text-[#A0A0A0] hover:border-[#333333] hover:text-white'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleInstallSubmit}
                                            disabled={!canInstall || installing}
                                            className="w-full bg-white hover:bg-[#E5E5E5] text-black font-semibold py-2.5 rounded-xl text-sm transition-colors shadow disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {installing ? 'Installing…' : 'Confirm Installation'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-[#D4D4D4] mb-2 font-sans">
                                                1. Target Minecraft Version
                                            </label>
                                            <select
                                                value={selMc || ''}
                                                onChange={(e) => {
                                                    setSelMc(e.target.value);
                                                    setSelLoader(null);
                                                }}
                                                className="w-full bg-[#050505] border border-[#1F1F1F] text-white rounded-lg p-2.5 text-xs outline-none focus:border-[#404040]"
                                            >
                                                <option value="">Choose version…</option>
                                                {modalMcVersions.map((v) => (
                                                    <option key={v} value={v}>
                                                        {v}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {selMc && (
                                            <div>
                                                <label className="block text-xs font-semibold text-[#D4D4D4] mb-2 font-sans">
                                                    2. Server / Mod Loader
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {modalLoaders.map((l) => (
                                                        <button
                                                            key={l}
                                                            type="button"
                                                            onClick={() => setSelLoader(l)}
                                                            className={`p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                                                                selLoader === l
                                                                    ? 'border-white bg-white text-black font-semibold'
                                                                    : 'border-[#1F1F1F] bg-[#050505] text-[#A0A0A0] hover:border-[#333333] hover:text-white'
                                                            }`}
                                                        >
                                                            {cap(l)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleInstallSubmit}
                                            disabled={!canInstall || installing}
                                            className="w-full bg-white hover:bg-[#E5E5E5] text-black font-semibold py-2.5 rounded-xl text-sm transition-colors shadow disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {installing ? 'Installing…' : 'Install to Server'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Toasts */}
                {toasts.length > 0 && (
                    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
                        {toasts.map((t) => (
                            <div
                                key={t.id}
                                className={`px-4 py-3 rounded-lg border text-xs font-medium shadow-2xl flex items-center justify-between gap-3 ${
                                    t.type === 'success'
                                        ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                                        : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                                }`}
                            >
                                <span>{t.msg}</span>
                                <button
                                    onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                                    className="text-white/60 hover:text-white transition-colors"
                                >
                                    <svg className={'w-4 h-4'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                        <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M6 18L18 6M6 6l12 12'} />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ServerContentBlock>
    );
}
