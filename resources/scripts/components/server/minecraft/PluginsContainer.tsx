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
        }, 5000);
    };

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
        if (!uuid || !isMinecraft) return;
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
    }, [uuid, isMinecraft, provider, page, pageSize, searchDebounced, loader, sortBy, minecraftVersion]);

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
        } catch (err: any) {
            addToast(err?.response?.data?.message || 'Failed to install plugin.', 'error');
        } finally {
            setInstalling(false);
        }
    };

    if (!isMinecraft) {
        return (
            <ServerContentBlock title="Plugins & Mods">
                <div className="bg-[#0f0b1a] border border-[#231b3a] rounded-xl p-8 text-center max-w-xl mx-auto my-12">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Minecraft Only Feature</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
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
                {/* Search & Filter Header Bar */}
                <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-5 shadow-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                        {/* Search field */}
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                                Search Resources
                            </label>
                            <div className="relative flex items-center">
                                <span className="absolute left-3 text-neutral-500 pointer-events-none">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by title, keyword…"
                                    className="w-full bg-[#140e24] border border-[#2c2247] focus:border-purple-500 text-white rounded-lg pl-9 pr-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-600"
                                />
                            </div>
                        </div>

                        {/* Provider select */}
                        <div>
                            <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
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
                                className="w-full bg-[#140e24] border border-[#2c2247] focus:border-purple-500 text-white rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                            >
                                <option value="modrinth">Modrinth</option>
                                <option value="curseforge">CurseForge</option>
                                <option value="spigotmc">SpigotMC</option>
                                <option value="hangar">Hangar</option>
                            </select>
                        </div>

                        {/* Sort select */}
                        <div>
                            <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                                Sort Order
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full bg-[#140e24] border border-[#2c2247] focus:border-purple-500 text-white rounded-lg px-3 py-2 text-sm outline-none transition-colors"
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
                                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                                    MC Version
                                </label>
                                <select
                                    value={minecraftVersion}
                                    onChange={(e) => setMinecraftVersion(e.target.value)}
                                    className="w-full bg-[#140e24] border border-[#2c2247] focus:border-purple-500 text-white rounded-lg px-3 py-2 text-sm outline-none transition-colors"
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
                                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                                    Loader
                                </label>
                                <select
                                    value={loader}
                                    onChange={(e) => setLoader(e.target.value)}
                                    className="w-full bg-[#140e24] border border-[#2c2247] focus:border-purple-500 text-white rounded-lg px-3 py-2 text-sm outline-none transition-colors"
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
                        <span className="text-xs text-neutral-400">Loading {cap(provider)} catalog…</span>
                    </div>
                ) : plugins.length === 0 ? (
                    <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-12 text-center">
                        <p className="text-neutral-400 text-sm">No plugins or mods found matching your query.</p>
                    </div>
                ) : (
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {plugins.map((plugin) => (
                                <div
                                    key={plugin.id + plugin.provider}
                                    className="bg-[#0c0915] border border-[#1e172e] hover:border-purple-500/50 rounded-xl p-5 flex flex-col justify-between gap-4 transition-all duration-150 shadow-md group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-[#18112b] border border-[#2d214c] overflow-hidden shrink-0 flex items-center justify-center">
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
                                                <span className="text-sm font-bold text-neutral-400 uppercase">
                                                    {(plugin.name?.[0] ?? '?').toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-semibold text-white truncate m-0 group-hover:text-purple-300 transition-colors">
                                                {plugin.name}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                                                <span>{cap(plugin.provider)}</span>
                                                <span>•</span>
                                                <span>{(plugin.downloads || 0).toLocaleString()} downloads</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-neutral-400 line-clamp-3 leading-relaxed m-0 flex-1">
                                        {plugin.description || 'No description provided.'}
                                    </p>

                                    <div className="flex items-center justify-between pt-3 border-t border-[#1e172e]">
                                        <a
                                            href={plugin.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
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
                                                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow"
                                            >
                                                Install
                                            </button>
                                        ) : (
                                            <a
                                                href={plugin.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
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
                                    className="px-3 py-1.5 bg-[#140e24] border border-[#2c2247] text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1d1433] transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-neutral-400 px-2">
                                    Page {page} of {pagination.total_pages}
                                </span>
                                <button
                                    type="button"
                                    disabled={page >= pagination.total_pages}
                                    onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                                    className="px-3 py-1.5 bg-[#140e24] border border-[#2c2247] text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1d1433] transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Installation Modal */}
                {activePlugin && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-[#0e0a19] border border-[#2c2247] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-[#231b3a]">
                                <div className="flex items-center gap-3 min-w-0">
                                    {activePlugin.icon && (
                                        <img src={activePlugin.icon} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                    )}
                                    <div className="truncate">
                                        <h3 className="text-sm font-semibold text-white truncate m-0">
                                            Install {activePlugin.name}
                                        </h3>
                                        <span className="text-[11px] text-neutral-400">
                                            Provider: {cap(activePlugin.provider)}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActivePlugin(null)}
                                    className="text-neutral-400 hover:text-white p-1 transition-colors"
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
                                        <span className="text-xs text-neutral-400">Loading version index…</span>
                                    </div>
                                ) : activePlugin.provider === 'spigotmc' ? (
                                    <div className="text-center py-4">
                                        <p className="text-xs text-neutral-300 mb-4">
                                            Installs the latest compatible release directly into your server&apos;s <code className="text-purple-400">/plugins</code> folder.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleInstallSubmit}
                                            disabled={installing}
                                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow disabled:opacity-50"
                                        >
                                            {installing ? 'Installing…' : 'Install Latest Version'}
                                        </button>
                                    </div>
                                ) : activePlugin.provider === 'hangar' ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-300 mb-2">
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
                                                                ? 'border-purple-500 bg-purple-500/20 text-white'
                                                                : 'border-[#2c2247] bg-[#140e24] text-neutral-300 hover:border-purple-500/40'
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
                                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {installing ? 'Installing…' : 'Confirm Installation'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-300 mb-2">
                                                1. Target Minecraft Version
                                            </label>
                                            <select
                                                value={selMc || ''}
                                                onChange={(e) => {
                                                    setSelMc(e.target.value);
                                                    setSelLoader(null);
                                                }}
                                                className="w-full bg-[#140e24] border border-[#2c2247] text-white rounded-lg p-2.5 text-xs outline-none"
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
                                                <label className="block text-xs font-semibold text-neutral-300 mb-2">
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
                                                                    ? 'border-purple-500 bg-purple-500/20 text-white'
                                                                    : 'border-[#2c2247] bg-[#140e24] text-neutral-300 hover:border-purple-500/40'
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
                                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow disabled:opacity-40 disabled:cursor-not-allowed"
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
