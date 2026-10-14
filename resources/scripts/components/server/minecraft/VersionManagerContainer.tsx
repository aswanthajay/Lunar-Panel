import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';
import { bytesToString } from '@/lib/formatters';
import { formatDistanceToNow } from 'date-fns';

interface EngineOption {
    id: string;
    name: string;
    category: string;
    tagline: string;
    website: string;
    default?: boolean;
}

interface VersionItem {
    version: string;
    group?: string;
    java_required: number;
    is_latest?: boolean;
}

interface RootJarFile {
    name: string;
    size: number;
    modified: string | null;
    is_target: boolean;
}

interface CurrentJarState {
    configured_jar: string;
    target_exists: boolean;
    target_info: RootJarFile | null;
    root_jars: RootJarFile[];
}

interface ToastItem {
    id: number;
    msg: string;
    type: 'success' | 'error';
}

export default function VersionManagerContainer() {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id || '';
    const isMinecraft = Boolean(server?.isMinecraft);

    // States
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [currentJar, setCurrentJar] = useState<CurrentJarState | null>(null);

    const [engines, setEngines] = useState<EngineOption[]>([]);
    const [selectedEngine, setSelectedEngine] = useState<string>('paper');

    const [loadingVersions, setLoadingVersions] = useState(false);
    const [versions, setVersions] = useState<VersionItem[]>([]);
    const [versionSearch, setVersionSearch] = useState('');
    const [groupFilter, setGroupFilter] = useState<string>('all');

    // Install Modal
    const [modalVersion, setModalVersion] = useState<VersionItem | null>(null);
    const [targetFilename, setTargetFilename] = useState('server.jar');
    const [customBuild, setCustomBuild] = useState('');
    const [backupExisting, setBackupExisting] = useState(true);
    const [isInstalling, setIsInstalling] = useState(false);

    // Toasts
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 6000);
    };

    // Load current JAR status
    const fetchCurrentStatus = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/versions/current`);
            setCurrentJar(data);
            if (data.configured_jar) {
                setTargetFilename(data.configured_jar);
            }
        } catch {
            // Keep existing state on error
        } finally {
            setLoadingCurrent(false);
        }
    }, [uuid, isMinecraft]);

    // Load supported software engines
    const fetchEngines = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/versions/software`);
            const engineList: EngineOption[] = data.engines || [];
            setEngines(engineList);
            const def = engineList.find((e) => e.default);
            if (def) {
                setSelectedEngine(def.id);
            } else if (engineList.length > 0) {
                setSelectedEngine(engineList[0].id);
            }
        } catch {
            // Fallback default list
            setEngines([
                { id: 'paper', name: 'Paper', category: 'High Performance', tagline: 'Active security patches and extensive Bukkit/Spigot plugin support.', website: 'https://papermc.io', default: true },
                { id: 'purpur', name: 'Purpur', category: 'Customizable Performance', tagline: 'Drop-in Paper replacement with extreme customization and gameplay tweaks.', website: 'https://purpurmc.org' },
                { id: 'fabric', name: 'Fabric', category: 'Modded Engine', tagline: 'Lightweight modular modding toolchain with rapid snapshot and release updates.', website: 'https://fabricmc.net' },
                { id: 'folia', name: 'Folia', category: 'Multi-Threaded', tagline: 'Experimental regional multi-threading for large player counts.', website: 'https://papermc.io' },
                { id: 'vanilla', name: 'Vanilla', category: 'Official Mojang', tagline: 'The official Minecraft server release distributed by Mojang Studios.', website: 'https://minecraft.net' },
                { id: 'velocity', name: 'Velocity', category: 'Network Proxy', tagline: 'Next-generation high-performance proxy server.', website: 'https://papermc.io' },
                { id: 'waterfall', name: 'Waterfall', category: 'Network Proxy', tagline: 'BungeeCord proxy fork with stability and performance patches.', website: 'https://papermc.io' },
            ]);
        }
    }, [uuid, isMinecraft]);

    // Load versions when selected engine changes
    const fetchVersions = useCallback(
        async (engineId: string) => {
            if (!uuid || !isMinecraft || !engineId) return;
            setLoadingVersions(true);
            setVersionSearch('');
            setGroupFilter('all');
            try {
                const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/versions/list/${engineId}`);
                setVersions(data.versions || []);
            } catch (err: any) {
                const msg = err?.response?.data?.message || `Failed to fetch versions for ${engineId}`;
                addToast(msg, 'error');
                setVersions([]);
            } finally {
                setLoadingVersions(false);
            }
        },
        [uuid, isMinecraft]
    );

    useEffect(() => {
        fetchCurrentStatus();
        fetchEngines();
    }, [fetchCurrentStatus, fetchEngines]);

    useEffect(() => {
        if (selectedEngine) {
            fetchVersions(selectedEngine);
        }
    }, [selectedEngine, fetchVersions]);

    // Available version groups for filtering
    const versionGroups = useMemo(() => {
        const groups = new Set<string>();
        versions.forEach((v) => {
            if (v.group) groups.add(v.group);
        });
        return Array.from(groups);
    }, [versions]);

    // Filtered version list
    const filteredVersions = useMemo(() => {
        const q = versionSearch.trim().toLowerCase();
        return versions.filter((v) => {
            const matchesQuery = !q || v.version.toLowerCase().includes(q);
            const matchesGroup = groupFilter === 'all' || v.group === groupFilter;
            return matchesQuery && matchesGroup;
        });
    }, [versions, versionSearch, groupFilter]);

    // Current active engine meta
    const activeEngineMeta = useMemo(() => {
        return engines.find((e) => e.id === selectedEngine) || null;
    }, [engines, selectedEngine]);

    // Open install modal
    const handleOpenInstall = (ver: VersionItem) => {
        setModalVersion(ver);
        setCustomBuild('');
        setBackupExisting(true);
        if (currentJar?.configured_jar) {
            setTargetFilename(currentJar.configured_jar);
        }
    };

    // Execute install
    const handleConfirmInstall = async () => {
        if (!modalVersion || !uuid) return;
        setIsInstalling(true);

        try {
            const payload = {
                software: selectedEngine,
                version: modalVersion.version,
                build: customBuild.trim() || undefined,
                target_filename: targetFilename.trim() || 'server.jar',
                backup_existing: backupExisting,
            };

            const { data } = await http.post(
                `/api/client/servers/${uuid}/minecraft/versions/install`,
                payload,
                {
                    timeout: 300000, // 5 minutes for downloading large server JARs
                }
            );

            addToast(data.message || `Installed ${modalVersion.version} successfully!`, 'success');
            setModalVersion(null);
            // Refresh current jar status to reflect change
            await fetchCurrentStatus();
        } catch (err: any) {
            let errDetail = err?.response?.data?.message || err?.message || 'Failed to install server JAR.';
            if (err.code === 'ECONNABORTED' || (typeof err.message === 'string' && err.message.toLowerCase().includes('timeout'))) {
                errDetail = 'Download and installation timed out. The upstream provider or server network is slow. Please retry in a few moments.';
            }
            addToast(errDetail, 'error');
        } finally {
            setIsInstalling(false);
        }
    };

    if (!isMinecraft) {
        return (
            <ServerContentBlock title="Minecraft Version Manager">
                <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-8 text-center max-w-xl mx-auto my-12">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 font-sans">Minecraft Only Feature</h3>
                    <p className="text-sm text-[#A0A0A0] leading-relaxed">
                        The Server JAR & Version Manager is exclusive to Minecraft instances. To enable it, ensure your server is configured under a Minecraft egg.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title="Minecraft Server JAR & Version Manager">
            {/* Floating Toast Notifications */}
            <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border text-xs shadow-2xl backdrop-blur-md transition-all animate-fade-in ${
                            t.type === 'success'
                                ? 'bg-[#0A0A0A]/95 border-emerald-500/40 text-[#EDEDED]'
                                : 'bg-[#0A0A0A]/95 border-rose-500/40 text-[#EDEDED]'
                        }`}
                    >
                        <span className={`mt-0.5 shrink-0 ${t.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.type === 'success' ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </span>
                        <div className="flex-1 min-w-0">
                            <span className="font-semibold block text-white mb-0.5">
                                {t.type === 'success' ? 'Operation Completed' : 'Operation Failed'}
                            </span>
                            <span className="text-[#A0A0A0] leading-snug break-words">{t.msg}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header overview card */}
                <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-5 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-white/5 border border-[#1F1F1F] text-white">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </span>
                                <h2 className="text-base font-semibold text-white tracking-tight font-sans">
                                    Server JAR & Version Manager
                                </h2>
                            </div>
                            <p className="text-xs text-[#A0A0A0] max-w-2xl leading-relaxed">
                                Seamlessly switch server software engines (Paper, Purpur, Fabric, Folia, Vanilla, Velocity) or update to the newest Minecraft builds directly from verified upstream mirrors.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    fetchCurrentStatus();
                                    fetchVersions(selectedEngine);
                                }}
                                className="px-3 py-2 bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#333333] text-[#EDEDED] rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Current Server JAR Status Card */}
                <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
                        <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                            Active Server Runtime Status
                        </span>
                        {loadingCurrent ? (
                            <div className="flex items-center gap-2 text-xs text-[#737373]">
                                <Spinner size="small" /> Checking disk…
                            </div>
                        ) : currentJar?.target_exists ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Bootable JAR Detected
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                No Startup JAR Found
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Target file info */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-3.5">
                            <span className="text-[10px] text-[#737373] uppercase tracking-wider font-semibold block mb-1">
                                Configured Startup File
                            </span>
                            <div className="flex items-center gap-2">
                                <code className="text-sm font-mono text-white bg-[#141414] px-2 py-0.5 rounded border border-[#1F1F1F]">
                                    {currentJar?.configured_jar || 'server.jar'}
                                </code>
                                {currentJar?.target_exists ? (
                                    <span className="text-xs text-[#A0A0A0]">
                                        ({bytesToString(currentJar.target_info?.size || 0)})
                                    </span>
                                ) : (
                                    <span className="text-xs text-amber-400 font-medium">Missing</span>
                                )}
                            </div>
                            {currentJar?.target_info?.modified && (
                                <span className="text-[11px] text-[#737373] mt-2 block">
                                    Modified {formatDistanceToNow(new Date(currentJar.target_info.modified), { addSuffix: true })}
                                </span>
                            )}
                        </div>

                        {/* Root Jars Discovered */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-3.5">
                            <span className="text-[10px] text-[#737373] uppercase tracking-wider font-semibold block mb-1">
                                Root JAR Archive Files ({currentJar?.root_jars?.length || 0})
                            </span>
                            {currentJar && currentJar.root_jars.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pt-0.5">
                                    {currentJar.root_jars.map((j) => (
                                        <span
                                            key={j.name}
                                            className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                                j.is_target
                                                    ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                                                    : 'bg-[#141414] border-[#1F1F1F] text-[#A0A0A0]'
                                            }`}
                                            title={`${j.name} (${bytesToString(j.size)})`}
                                        >
                                            {j.name}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-xs text-[#737373]">No .jar files currently present in root</span>
                            )}
                        </div>

                        {/* Java Runtime Guidance */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-3.5">
                            <span className="text-[10px] text-[#737373] uppercase tracking-wider font-semibold block mb-1">
                                Java Runtime Advisory
                            </span>
                            <p className="text-xs text-[#A0A0A0] leading-snug">
                                Ensure your server&apos;s Docker image Java version matches your chosen Minecraft release in the <span className="text-white font-medium">Startup</span> settings.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Software Engine Selection Grid */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                            Choose Software Engine
                        </label>
                        {activeEngineMeta?.website && (
                            <a
                                href={activeEngineMeta.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-[#A0A0A0] hover:text-white inline-flex items-center gap-1 transition-colors"
                            >
                                Visit {activeEngineMeta.name} Official Website
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {engines.map((eng) => {
                            const isSelected = selectedEngine === eng.id;
                            return (
                                <button
                                    key={eng.id}
                                    type="button"
                                    onClick={() => setSelectedEngine(eng.id)}
                                    className={`relative p-4 rounded-xl border text-left transition-all group flex flex-col justify-between ${
                                        isSelected
                                            ? 'bg-[#0A0A0A] border-white shadow-lg ring-1 ring-white/10'
                                            : 'bg-[#050505] border-[#1F1F1F] hover:border-[#333333] hover:bg-[#0A0A0A]'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                                        isSelected
                                                            ? 'bg-white text-black'
                                                            : 'bg-[#141414] border border-[#1F1F1F] text-[#EDEDED] group-hover:text-white'
                                                    }`}
                                                >
                                                    {eng.name.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-sm text-white font-sans">
                                                    {eng.name}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141414] text-[#737373] border border-[#1F1F1F]">
                                                {eng.category}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[#A0A0A0] leading-snug line-clamp-2">
                                            {eng.tagline}
                                        </p>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-[#1F1F1F] flex items-center justify-between text-[11px]">
                                        <span className={isSelected ? 'text-white font-medium' : 'text-[#737373]'}>
                                            {isSelected ? 'Active Selection' : 'Click to Browse'}
                                        </span>
                                        {isSelected && (
                                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Versions Section */}
                <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-5 shadow-sm space-y-4">
                    {/* Filter bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F1F1F] pb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                                Available {activeEngineMeta?.name} Builds ({filteredVersions.length})
                            </span>
                            {loadingVersions && <Spinner size="small" />}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Search box */}
                            <div className="relative min-w-[200px]">
                                <span className="absolute left-3 top-2.5 text-[#737373] pointer-events-none">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    value={versionSearch}
                                    onChange={(e) => setVersionSearch(e.target.value)}
                                    placeholder="Filter version (e.g. 1.21.4)…"
                                    className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none transition-colors placeholder:text-[#737373]"
                                />
                            </div>

                            {/* Group selector */}
                            {versionGroups.length > 0 && (
                                <select
                                    value={groupFilter}
                                    onChange={(e) => setGroupFilter(e.target.value)}
                                    className="bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg px-3 py-1.5 text-xs outline-none transition-colors"
                                >
                                    <option value="all">All Release Groups</option>
                                    {versionGroups.map((grp) => (
                                        <option key={grp} value={grp}>
                                            {grp}.x Releases
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Versions list */}
                    {loadingVersions ? (
                        <div className="py-16 text-center">
                            <Spinner size="large" />
                            <p className="text-xs text-[#737373] mt-3">Fetching build manifests from upstream…</p>
                        </div>
                    ) : filteredVersions.length === 0 ? (
                        <div className="py-12 text-center text-xs text-[#737373]">
                            No matching versions found for your search query.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto pr-1">
                            {filteredVersions.map((v) => (
                                <div
                                    key={v.version}
                                    className="bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#333333] rounded-xl p-4 transition-colors flex items-center justify-between gap-3 group"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-white font-mono">
                                                {v.version}
                                            </span>
                                            {v.is_latest && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                    Latest
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[11px] text-[#A0A0A0]">
                                                Java {v.java_required} required
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleOpenInstall(v)}
                                        className="px-3.5 py-1.5 bg-white hover:bg-[#E5E5E5] text-black font-semibold rounded-lg text-xs transition-colors shrink-0 shadow-sm"
                                    >
                                        Install
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Install Confirmation Modal */}
            {modalVersion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F1F]">
                            <div>
                                <h3 className="text-sm font-semibold text-white font-sans m-0">
                                    Install {activeEngineMeta?.name} {modalVersion.version}
                                </h3>
                                <span className="text-[11px] text-[#737373]">
                                    Engine: {activeEngineMeta?.name} &bull; Minecraft {modalVersion.version}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => !isInstalling && setModalVersion(null)}
                                disabled={isInstalling}
                                className="text-[#737373] hover:text-white p-1 transition-colors disabled:opacity-30"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            {/* Java Runtime Advice Box */}
                            <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-3.5 flex items-start gap-3">
                                <span className="text-emerald-400 mt-0.5 shrink-0">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                <div className="text-xs">
                                    <span className="font-semibold text-white block mb-0.5">
                                        Java {modalVersion.java_required} Environment
                                    </span>
                                    <span className="text-[#A0A0A0] leading-snug">
                                        Minecraft {modalVersion.version} requires Java {modalVersion.java_required}. Please verify your server container Java version in the Startup settings.
                                    </span>
                                </div>
                            </div>

                            {/* Destination Filename */}
                            <div>
                                <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1.5">
                                    Target Destination Filename
                                </label>
                                <input
                                    type="text"
                                    value={targetFilename}
                                    onChange={(e) => setTargetFilename(e.target.value)}
                                    placeholder="server.jar"
                                    disabled={isInstalling}
                                    className="w-full bg-[#050505] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg px-3 py-2 text-xs font-mono outline-none transition-colors disabled:opacity-50"
                                />
                                <span className="text-[11px] text-[#737373] mt-1 block">
                                    Must match the startup JAR configuration of this server.
                                </span>
                            </div>

                            {/* Specific Build ID (Optional for Paper/Purpur) */}
                            {(selectedEngine === 'paper' || selectedEngine === 'purpur' || selectedEngine === 'folia') && (
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1.5">
                                        Build Number (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={customBuild}
                                        onChange={(e) => setCustomBuild(e.target.value)}
                                        placeholder="Leave empty for latest stable build"
                                        disabled={isInstalling}
                                        className="w-full bg-[#050505] border border-[#1F1F1F] focus:border-[#404040] text-white rounded-lg px-3 py-2 text-xs font-mono outline-none transition-colors disabled:opacity-50"
                                    />
                                </div>
                            )}

                            {/* Backup Checkbox */}
                            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                                <input
                                    type="checkbox"
                                    checked={backupExisting}
                                    onChange={(e) => setBackupExisting(e.target.checked)}
                                    disabled={isInstalling}
                                    className="mt-0.5 rounded border-[#1F1F1F] text-white focus:ring-0 focus:ring-offset-0 bg-[#050505]"
                                />
                                <div className="text-xs">
                                    <span className="font-semibold text-white block">
                                        Create Backup of Current JAR
                                    </span>
                                    <span className="text-[#737373] leading-snug">
                                        Safely renames any existing file to <code className="text-[#A0A0A0]">{targetFilename}.bak</code> before downloading.
                                    </span>
                                </div>
                            </label>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1F1F1F] bg-[#050505]">
                            <button
                                type="button"
                                onClick={() => setModalVersion(null)}
                                disabled={isInstalling}
                                className="px-4 py-2 bg-[#0A0A0A] border border-[#1F1F1F] hover:bg-[#141414] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmInstall}
                                disabled={isInstalling || !targetFilename.trim()}
                                className="px-5 py-2 bg-white hover:bg-[#E5E5E5] text-black font-semibold rounded-lg text-xs transition-colors shadow flex items-center gap-2 disabled:opacity-50"
                            >
                                {isInstalling ? (
                                    <>
                                        <Spinner size="small" />
                                        <span>Deploying to Server…</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Install Server JAR</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ServerContentBlock>
    );
}
