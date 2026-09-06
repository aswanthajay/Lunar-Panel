import React, { useState, useEffect, useCallback } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';

interface WorldDimension {
    type: 'nether' | 'end';
    name: string;
}

interface WorldItem {
    name: string;
    active: boolean;
    modified?: string | null;
    dimensions?: WorldDimension[];
}

interface WorldProperties {
    'gamemode'?: string;
    'force-gamemode'?: string;
    'hardcore'?: string;
    'pvp'?: string;
    'spawn-protection'?: string;
    'generate-structures'?: string;
    'allow-nether'?: string;
    'spawn-animals'?: string;
    'spawn-monsters'?: string;
    'spawn-npcs'?: string;
    'view-distance'?: string;
    'simulation-distance'?: string;
    'max-world-size'?: string;
    [key: string]: string | undefined;
}

export default function WorldManagerContainer() {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id || '';
    const isMinecraft = Boolean(server?.isMinecraft);

    const [loading, setLoading] = useState(true);
    const [worlds, setWorlds] = useState<WorldItem[]>([]);
    const [activeWorld, setActiveWorld] = useState<string | null>(null);
    const [isBedrock, setIsBedrock] = useState(false);

    // Seed state
    const [seed, setSeed] = useState<string | null>(null);
    const [seedLoading, setSeedLoading] = useState(false);
    const [seedError, setSeedError] = useState<string | null>(null);

    // World creation state
    const [newName, setNewName] = useState('');
    const [newSeed, setNewSeed] = useState('');
    const [newType, setNewType] = useState('minecraft:normal');
    const [creating, setCreating] = useState(false);

    // Properties state
    const [propsForm, setPropsForm] = useState<WorldProperties>({});
    const [savingProps, setSavingProps] = useState(false);
    const [showProps, setShowProps] = useState(false);

    // Difficulty state
    const [difficulty, setDifficulty] = useState('normal');
    const [applyingDifficulty, setApplyingDifficulty] = useState(false);

    // Action & notice state
    const [switchingWorld, setSwitchingWorld] = useState<string | null>(null);
    const [restartPending, setRestartPending] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

    // Delete modal
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    const loadWorlds = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        setLoading(true);
        setNotice(null);

        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/worlds`);
            setWorlds(data.worlds || []);
            setActiveWorld(data.active || null);
            setIsBedrock(Boolean(data.bedrock));
            if (data.properties) {
                setPropsForm(data.properties);
                if (data.properties.difficulty) {
                    setDifficulty(data.properties.difficulty);
                }
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to load server worlds.',
            });
        } finally {
            setLoading(false);
        }
    }, [uuid, isMinecraft]);

    useEffect(() => {
        loadWorlds();
    }, [loadWorlds]);

    const handleRevealSeed = async () => {
        setSeedLoading(true);
        setSeedError(null);
        setSeed(null);

        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/worlds/seed`);
            setSeed(data.seed);
        } catch (err: any) {
            setSeedError(err?.response?.data?.error || 'Could not retrieve world seed. Server must be online.');
        } finally {
            setSeedLoading(false);
        }
    };

    const handleSwitchWorld = async (name: string) => {
        setSwitchingWorld(name);
        setNotice(null);

        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/worlds/activate`, { name });
            if (data.ok) {
                setActiveWorld(name);
                setRestartPending(true);
                setSeed(null);
                setNotice({
                    type: 'ok',
                    text: `Active world set to "${name}". A server restart is required to load it.`,
                });
                loadWorlds();
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Could not switch active world.',
            });
        } finally {
            setSwitchingWorld(null);
        }
    };

    const handleCreateWorld = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newName.trim();
        if (!trimmed) return;

        if (worlds.some((w) => w.name.toLowerCase() === trimmed.toLowerCase())) {
            setNotice({ type: 'error', text: `A world named "${trimmed}" already exists.` });
            return;
        }

        setCreating(true);
        setNotice(null);

        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/worlds/activate`, {
                name: trimmed,
                seed: newSeed.trim() || undefined,
                level_type: newType || undefined,
            });

            if (data.ok) {
                setNewName('');
                setNewSeed('');
                setNewType('minecraft:normal');
                setRestartPending(true);
                setNotice({
                    type: 'ok',
                    text: `World "${trimmed}" created and activated. Restart the server to generate and play it.`,
                });
                loadWorlds();
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to create new world.',
            });
        } finally {
            setCreating(false);
        }
    };

    const handleRestartServer = async () => {
        setRestarting(true);
        setNotice(null);

        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/worlds/restart`);
            if (data.ok) {
                setRestartPending(false);
                setNotice({
                    type: 'ok',
                    text: 'Server restart signal dispatched successfully.',
                });
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to restart server.',
            });
        } finally {
            setRestarting(false);
        }
    };

    const handleSaveProperties = async () => {
        setSavingProps(true);
        setNotice(null);

        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/worlds/properties`, {
                properties: propsForm,
            });

            if (data.ok) {
                setRestartPending(true);
                setNotice({
                    type: 'ok',
                    text: 'World properties updated. Restart the server for changes to take effect.',
                });
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to update world properties.',
            });
        } finally {
            setSavingProps(false);
        }
    };

    const handleApplyDifficulty = async (val: string) => {
        if (!activeWorld) return;
        setApplyingDifficulty(true);
        setNotice(null);

        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/worlds/${encodeURIComponent(activeWorld)}/difficulty`, {
                value: val,
            });
            if (data.ok) {
                setDifficulty(val);
                setNotice({
                    type: 'ok',
                    text: `Active world difficulty set to ${val}.`,
                });
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Could not update world difficulty.',
            });
        } finally {
            setApplyingDifficulty(false);
        }
    };

    const handleDeleteWorld = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setNotice(null);

        try {
            const { data } = await http.delete(`/api/client/servers/${uuid}/minecraft/worlds/${encodeURIComponent(deleteTarget)}`);
            if (data.ok) {
                setNotice({
                    type: 'ok',
                    text: `World "${deleteTarget}" was permanently deleted.`,
                });
                setDeleteTarget(null);
                setDeleteConfirmText('');
                loadWorlds();
            }
        } catch (err: any) {
            setNotice({
                type: 'error',
                text: err?.response?.data?.error || 'Could not delete world.',
            });
        } finally {
            setDeleting(false);
        }
    };

    if (!isMinecraft) {
        return (
            <ServerContentBlock title={'World Manager'}>
                <div className={'bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-8 text-center max-w-lg mx-auto mt-12'}>
                    <div className={'w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4'}>
                        <svg className={'w-6 h-6'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                            <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'} />
                        </svg>
                    </div>
                    <h3 className={'text-lg font-bold text-white mb-2'}>Minecraft Servers Only</h3>
                    <p className={'text-sm text-neutral-400 leading-relaxed'}>
                        World Manager is specially designed for Minecraft servers. To enable this feature, configure the server Game Type to Minecraft in the Admin Panel.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title={'World Manager'}>
            <div className={'w-full max-w-6xl mx-auto space-y-6'}>
                {/* Header title */}
                <div className={'flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5'}>
                    <div>
                        <h1 className={'text-2xl font-bold text-white tracking-tight flex items-center gap-3'}>
                            <div className={'w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center'}>
                                <svg className={'w-5 h-5'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                    <circle cx={'12'} cy={'12'} r={'10'} strokeWidth={2} />
                                    <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z'} />
                                </svg>
                            </div>
                            World Manager
                        </h1>
                        <p className={'text-sm text-neutral-400 mt-1'}>
                            Manage save worlds, switch dimensions, configure generation properties, and reveal seeds.
                        </p>
                    </div>

                    <div className={'flex items-center gap-3'}>
                        <button
                            type={'button'}
                            onClick={() => setShowProps(!showProps)}
                            className={'px-3.5 py-2 rounded-lg text-xs font-semibold border border-neutral-700 bg-neutral-800 hover:bg-neutral-700/80 text-neutral-200 transition-colors flex items-center gap-2'}
                        >
                            <svg className={'w-4 h-4 text-neutral-400'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'} />
                                <circle cx={'12'} cy={'12'} r={'3'} strokeWidth={2} />
                            </svg>
                            {showProps ? 'Hide World Settings' : 'World Settings'}
                        </button>

                        <button
                            type={'button'}
                            onClick={() => loadWorlds()}
                            disabled={loading}
                            className={'px-3.5 py-2 rounded-lg text-xs font-semibold border border-neutral-700 bg-neutral-800 hover:bg-neutral-700/80 text-neutral-200 transition-colors flex items-center gap-2'}
                        >
                            <svg className={`w-4 h-4 text-neutral-400 ${loading ? 'animate-spin' : ''}`} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'} />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Notifications & Restart Banner */}
                {notice && (
                    <div
                        className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
                            notice.type === 'ok'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}
                    >
                        <div className={'mt-0.5'}>
                            {notice.type === 'ok' ? (
                                <svg className={'w-4 h-4'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                    <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M5 13l4 4L19 7'} />
                                </svg>
                            ) : (
                                <svg className={'w-4 h-4'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                    <circle cx={'12'} cy={'12'} r={'10'} strokeWidth={2} />
                                    <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M12 8v4m0 4h.01'} />
                                </svg>
                            )}
                        </div>
                        <div className={'flex-1'}>{notice.text}</div>
                        <button onClick={() => setNotice(null)} className={'text-neutral-400 hover:text-white transition-colors'}>
                            <svg className={'w-4 h-4'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M6 18L18 6M6 6l12 12'} />
                            </svg>
                        </button>
                    </div>
                )}

                {restartPending && (
                    <div className={'p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3'}>
                        <div className={'flex items-center gap-3 text-amber-300 text-sm'}>
                            <div className={'w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0'}>
                                <svg className={'w-4 h-4 text-amber-400'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                    <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'} />
                                </svg>
                            </div>
                            <div>
                                <span className={'font-semibold'}>Server restart recommended:</span> New world settings or active world selection require a restart to apply.
                            </div>
                        </div>
                        <button
                            type={'button'}
                            onClick={handleRestartServer}
                            disabled={restarting}
                            className={'px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm'}
                        >
                            {restarting && <Spinner size={'small'} />}
                            <svg className={'w-3.5 h-3.5'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2.5} d={'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'} />
                            </svg>
                            {restarting ? 'Restarting Server…' : 'Restart Server Now'}
                        </button>
                    </div>
                )}

                {/* Top Section: Active World & Seed */}
                <div className={'grid grid-cols-1 md:grid-cols-3 gap-5'}>
                    {/* Active World Card */}
                    <div className={'md:col-span-2 bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between'}>
                        <div>
                            <div className={'flex items-center justify-between mb-3'}>
                                <span className={'text-xs font-semibold uppercase tracking-wider text-neutral-400'}>Active World</span>
                                <span className={'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}>
                                    <span className={'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse'} />
                                    Loaded
                                </span>
                            </div>
                            <h2 className={'text-xl font-bold text-white tracking-wide break-all'}>
                                {activeWorld || 'world'}
                            </h2>
                            <p className={'text-xs text-neutral-400 mt-1'}>
                                {isBedrock ? 'Configured in bedrock server settings' : 'Configured via level-name in server.properties'}
                            </p>
                        </div>

                        {/* Seed & In-game Difficulty quick bar */}
                        <div className={'mt-5 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3'}>
                            <div className={'flex items-center gap-2.5 text-xs'}>
                                <span className={'text-neutral-400 font-medium'}>Seed:</span>
                                {seedLoading ? (
                                    <span className={'text-neutral-400 italic flex items-center gap-1.5'}>
                                        <Spinner size={'small'} /> Querying console…
                                    </span>
                                ) : seed ? (
                                    <code className={'bg-neutral-800/90 text-emerald-400 px-2.5 py-1 rounded border border-neutral-700/60 font-mono text-xs select-all'}>
                                        {seed}
                                    </code>
                                ) : seedError ? (
                                    <span className={'text-rose-400 text-xs'}>{seedError}</span>
                                ) : (
                                    <button
                                        type={'button'}
                                        onClick={handleRevealSeed}
                                        className={'px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700/80 border border-neutral-700 text-neutral-200 text-xs transition-colors flex items-center gap-1.5'}
                                    >
                                        <svg className={'w-3.5 h-3.5 text-neutral-400'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                            <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M15 12a3 3 0 11-6 0 3 3 0 016 0z'} />
                                            <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'} />
                                        </svg>
                                        Reveal Seed
                                    </button>
                                )}
                            </div>

                            {/* In-game difficulty quick changer */}
                            <div className={'flex items-center gap-2 text-xs'}>
                                <span className={'text-neutral-400 font-medium'}>Difficulty:</span>
                                <select
                                    value={difficulty}
                                    onChange={(e) => handleApplyDifficulty(e.target.value)}
                                    disabled={applyingDifficulty}
                                    className={'bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs rounded px-2 py-1 outline-none focus:border-emerald-500'}
                                >
                                    <option value={'peaceful'}>Peaceful</option>
                                    <option value={'easy'}>Easy</option>
                                    <option value={'normal'}>Normal</option>
                                    <option value={'hard'}>Hard</option>
                                </select>
                                {applyingDifficulty && <Spinner size={'small'} />}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats / Summary Card */}
                    <div className={'bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between'}>
                        <div>
                            <span className={'text-xs font-semibold uppercase tracking-wider text-neutral-400'}>Server Worlds</span>
                            <div className={'mt-3 flex items-baseline gap-2'}>
                                <span className={'text-3xl font-extrabold text-white'}>{worlds.length}</span>
                                <span className={'text-xs text-neutral-400'}>available world save{worlds.length === 1 ? '' : 's'}</span>
                            </div>
                        </div>

                        <div className={'mt-4 pt-3 border-t border-neutral-800/80 text-xs text-neutral-400 leading-relaxed'}>
                            Switching worlds swaps active game folders safely. Sub-dimensions like Nether and End are linked automatically.
                        </div>
                    </div>
                </div>

                {/* World Properties Drawer / Card */}
                {showProps && (
                    <div className={'bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 transition-all'}>
                        <div className={'flex items-center justify-between mb-4 pb-3 border-b border-neutral-800'}>
                            <div>
                                <h2 className={'text-base font-bold text-white flex items-center gap-2'}>
                                    <svg className={'w-4 h-4 text-emerald-400'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                        <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'} />
                                <circle cx={'12'} cy={'12'} r={'3'} strokeWidth={2} />
                            </svg>
                            World Properties (server.properties)
                        </h2>
                        <p className={'text-xs text-neutral-400 mt-0.5'}>
                            Tweak world mechanics, mob spawning, world sizes, and view distance.
                        </p>
                    </div>
                </div>

                <div className={'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'}>
                    {/* Default Gamemode */}
                    <div>
                        <label className={'block text-xs font-medium text-neutral-300 mb-1.5'}>Default Game Mode</label>
                        <select
                            value={propsForm['gamemode'] || 'survival'}
                            onChange={(e) => setPropsForm({ ...propsForm, gamemode: e.target.value })}
                            className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500'}
                        >
                            <option value={'survival'}>Survival</option>
                            <option value={'creative'}>Creative</option>
                            <option value={'adventure'}>Adventure</option>
                            <option value={'spectator'}>Spectator</option>
                        </select>
                    </div>

                    {/* Spawn Protection */}
                    <div>
                        <label className={'block text-xs font-medium text-neutral-300 mb-1.5'}>Spawn Protection Radius (blocks)</label>
                        <input
                            type={'number'}
                            min={0}
                            max={1000}
                            value={propsForm['spawn-protection'] ?? '16'}
                            onChange={(e) => setPropsForm({ ...propsForm, 'spawn-protection': e.target.value })}
                            className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500'}
                        />
                    </div>

                    {/* View Distance */}
                    <div>
                        <label className={'block text-xs font-medium text-neutral-300 mb-1.5'}>View Distance (chunks)</label>
                        <input
                            type={'number'}
                            min={3}
                            max={32}
                            value={propsForm['view-distance'] ?? '10'}
                            onChange={(e) => setPropsForm({ ...propsForm, 'view-distance': e.target.value })}
                            className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500'}
                        />
                    </div>

                    {/* Simulation Distance */}
                    <div>
                        <label className={'block text-xs font-medium text-neutral-300 mb-1.5'}>Simulation Distance (chunks)</label>
                        <input
                            type={'number'}
                            min={3}
                            max={32}
                            value={propsForm['simulation-distance'] ?? '10'}
                            onChange={(e) => setPropsForm({ ...propsForm, 'simulation-distance': e.target.value })}
                            className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500'}
                        />
                    </div>

                    {/* Max World Size */}
                    <div>
                        <label className={'block text-xs font-medium text-neutral-300 mb-1.5'}>Max World Size (radius)</label>
                        <input
                            type={'number'}
                            min={1}
                            max={29999984}
                            value={propsForm['max-world-size'] ?? '29999984'}
                            onChange={(e) => setPropsForm({ ...propsForm, 'max-world-size': e.target.value })}
                            className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500'}
                        />
                    </div>
                </div>

                {/* Toggle Switches */}
                <div className={'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-neutral-800'}>
                    {[
                        { key: 'force-gamemode', label: 'Force Gamemode on Join' },
                        { key: 'hardcore', label: 'Hardcore Mode' },
                        { key: 'pvp', label: 'Player versus Player (PVP)' },
                        { key: 'generate-structures', label: 'Generate Structures' },
                        { key: 'allow-nether', label: 'Allow Nether Dimension' },
                        { key: 'spawn-animals', label: 'Spawn Passive Animals' },
                        { key: 'spawn-monsters', label: 'Spawn Hostile Monsters' },
                        { key: 'spawn-npcs', label: 'Spawn Villagers' },
                    ].map(({ key, label }) => {
                        const isChecked = propsForm[key] === 'true';
                        return (
                            <label key={key} className={'flex items-center gap-3 cursor-pointer group select-none'}>
                                <input
                                    type={'checkbox'}
                                    checked={isChecked}
                                    onChange={() =>
                                        setPropsForm({
                                            ...propsForm,
                                            [key]: isChecked ? 'false' : 'true',
                                        })
                                    }
                                    className={'hidden'}
                                />
                                <div
                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                        isChecked
                                            ? 'bg-emerald-500 border-emerald-400 text-neutral-950'
                                            : 'bg-neutral-800 border-neutral-700 text-transparent'
                                    }`}
                                >
                                    <svg className={'w-3 h-3 stroke-[3]'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                        <path strokeLinecap={'round'} strokeLinejoin={'round'} d={'M5 13l4 4L19 7'} />
                                    </svg>
                                </div>
                                <span className={'text-xs text-neutral-300 group-hover:text-white transition-colors'}>{label}</span>
                            </label>
                        );
                    })}
                </div>

                <div className={'mt-6 pt-4 border-t border-neutral-800 flex justify-end'}>
                    <button
                        type={'button'}
                        onClick={handleSaveProperties}
                        disabled={savingProps}
                        className={'px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm'}
                    >
                        {savingProps && <Spinner size={'small'} />}
                        {savingProps ? 'Saving Properties…' : 'Save Properties'}
                    </button>
                </div>
            </div>
        )}

        {/* Create New World Section */}
        <div className={'bg-neutral-900/60 border border-neutral-800 rounded-xl p-5'}>
            <h2 className={'text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2'}>
                <svg className={'w-4 h-4 text-emerald-400'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                    <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M12 6v6m0 0v6m0-6h6m-6 0H6'} />
                </svg>
                Create New World
            </h2>

            <form onSubmit={handleCreateWorld} className={'grid grid-cols-1 sm:grid-cols-12 gap-4 items-end'}>
                <div className={'sm:col-span-4'}>
                    <label className={'block text-xs font-medium text-neutral-400 mb-1'}>World Name *</label>
                    <input
                        type={'text'}
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={'e.g. survival_v2'}
                        className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none focus:border-emerald-500'}
                    />
                </div>

                <div className={'sm:col-span-4'}>
                    <label className={'block text-xs font-medium text-neutral-400 mb-1'}>Seed (optional)</label>
                    <input
                        type={'text'}
                        value={newSeed}
                        onChange={(e) => setNewSeed(e.target.value)}
                        placeholder={'Leave blank for random'}
                        className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none focus:border-emerald-500'}
                    />
                </div>

                <div className={'sm:col-span-2'}>
                    <label className={'block text-xs font-medium text-neutral-400 mb-1'}>World Type</label>
                    <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500'}
                    >
                        <option value={'minecraft:normal'}>Default</option>
                        <option value={'minecraft:flat'}>Superflat</option>
                        <option value={'minecraft:large_biomes'}>Large Biomes</option>
                        <option value={'minecraft:amplified'}>Amplified</option>
                        <option value={'minecraft:single_biome_surface'}>Single Biome</option>
                    </select>
                </div>

                <div className={'sm:col-span-2'}>
                    <button
                        type={'submit'}
                        disabled={creating || !newName.trim()}
                        className={'w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2'}
                    >
                        {creating && <Spinner size={'small'} />}
                        {creating ? 'Creating…' : 'Create & Use'}
                    </button>
                </div>
            </form>
        </div>

        {/* Worlds List */}
        <div className={'space-y-3'}>
            <h2 className={'text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between'}>
                <span>Available Worlds</span>
                <span className={'text-xs font-normal text-neutral-400'}>{worlds.length} worlds detected</span>
            </h2>

            {loading ? (
                <div className={'p-12 flex justify-center bg-neutral-900/40 border border-neutral-800 rounded-xl'}>
                    <Spinner size={'large'} />
                </div>
            ) : worlds.length === 0 ? (
                <div className={'bg-neutral-900/40 border border-neutral-800 rounded-xl p-8 text-center text-neutral-400 text-sm'}>
                    No worlds found in root server directory. Start the server once to generate initial world files.
                </div>
            ) : (
                <div className={'space-y-3'}>
                    {worlds.map((w) => {
                        const isActive = w.active || w.name === activeWorld;
                        const isSwitching = switchingWorld === w.name;

                        return (
                            <div
                                key={w.name}
                                className={`bg-neutral-900/70 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                                    isActive ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-neutral-800 hover:border-neutral-700'
                                }`}
                            >
                                <div className={'flex flex-col sm:flex-row sm:items-center gap-3'}>
                                    <div className={'w-9 h-9 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 flex-shrink-0'}>
                                        <svg className={'w-5 h-5'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                            <circle cx={'12'} cy={'12'} r={'10'} strokeWidth={2} />
                                            <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z'} />
                                        </svg>
                                    </div>

                                    <div>
                                        <div className={'flex items-center gap-2.5 flex-wrap'}>
                                            <span className={'text-base font-bold text-white'}>{w.name}</span>
                                            {isActive && (
                                                <span className={'px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}>
                                                    Active
                                                </span>
                                            )}
                                            {w.dimensions?.map((dim) => (
                                                <span
                                                    key={dim.name}
                                                    className={'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700'}
                                                >
                                                    <span>{dim.type === 'nether' ? 'Nether' : 'The End'}</span>
                                                    <button
                                                        type={'button'}
                                                        title={`Delete ${dim.name}`}
                                                        onClick={() => {
                                                            setDeleteTarget(dim.name);
                                                            setDeleteConfirmText('');
                                                        }}
                                                        className={'text-rose-400 hover:text-rose-300 transition-colors ml-0.5'}
                                                    >
                                                        <svg className={'w-3 h-3'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                                            <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M6 18L18 6M6 6l12 12'} />
                                                        </svg>
                                                    </button>
                                                </span>
                                            ))}
                                        </div>

                                        {w.modified && (
                                            <p className={'text-xs text-neutral-400 mt-1'}>
                                                Last modified: {new Date(w.modified).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className={'flex items-center gap-2 self-end sm:self-center'}>
                                    {!isActive && (
                                        <button
                                            type={'button'}
                                            onClick={() => handleSwitchWorld(w.name)}
                                            disabled={isSwitching}
                                            className={'px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors flex items-center gap-1.5'}
                                        >
                                            {isSwitching && <Spinner size={'small'} />}
                                            {isSwitching ? 'Switching…' : 'Switch to this world'}
                                        </button>
                                    )}

                                    {!isActive && (
                                        <button
                                            type={'button'}
                                            onClick={() => {
                                                setDeleteTarget(w.name);
                                                setDeleteConfirmText('');
                                            }}
                                            className={'px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors flex items-center gap-1.5'}
                                        >
                                            <svg className={'w-3.5 h-3.5'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'} />
                                            </svg>
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
            <div className={'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'}>
                <div className={'bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4'}>
                    <div className={'flex items-center gap-3 text-rose-400'}>
                        <div className={'w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0'}>
                            <svg className={'w-5 h-5'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'} />
                            </svg>
                        </div>
                        <div>
                            <h3 className={'text-lg font-bold text-white'}>Delete World</h3>
                            <p className={'text-xs text-neutral-400'}>Permanent irreversible action</p>
                        </div>
                    </div>

                    <p className={'text-sm text-neutral-300 leading-relaxed'}>
                        You are about to permanently delete the world directory for{' '}
                        <span className={'font-bold text-white'}>&quot;{deleteTarget}&quot;</span>. All chunk data, builds, and player inventories in this world will be erased.
                    </p>

                    <div>
                        <label className={'block text-xs font-medium text-neutral-400 mb-1.5'}>
                            Type <code className={'text-white font-mono bg-neutral-800 px-1.5 py-0.5 rounded'}>{deleteTarget}</code> to confirm:
                        </label>
                        <input
                            type={'text'}
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={deleteTarget}
                            className={'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-rose-500'}
                            autoFocus
                        />
                    </div>

                    <div className={'flex items-center justify-end gap-3 pt-2'}>
                        <button
                            type={'button'}
                            onClick={() => {
                                setDeleteTarget(null);
                                setDeleteConfirmText('');
                            }}
                            className={'px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors'}
                        >
                            Cancel
                        </button>
                        <button
                            type={'button'}
                            onClick={handleDeleteWorld}
                            disabled={deleting || deleteConfirmText !== deleteTarget}
                            className={'px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-bold transition-colors flex items-center gap-2'}
                        >
                            {deleting && <Spinner size={'small'} />}
                            {deleting ? 'Deleting World…' : 'Permanently Delete'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
</ServerContentBlock>
);
}
