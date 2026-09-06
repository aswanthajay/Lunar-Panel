import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';

interface AddonPack {
    carpeta: string;
    carpetaBase: string;
    tipo: 'behavior' | 'resource';
    uuid: string;
    nombre: string;
    descripcion: string;
    version: number[];
    activo: boolean;
}

export default function BedrockAddonsContainer() {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id || '';
    const isMinecraft = Boolean(server?.isMinecraft);

    const [loading, setLoading] = useState(true);
    const [packs, setPacks] = useState<AddonPack[]>([]);
    const [world, setWorld] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
    const [processing, setProcessing] = useState<Record<string, boolean>>({});
    const [confirmDelete, setConfirmDelete] = useState<AddonPack | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadAddons = useCallback(async () => {
        if (!uuid || !isMinecraft) {
            setLoading(false);
            return;
        }

        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/addons`);
            setPacks(data.paquetes || []);
            setWorld(data.mundo || '');
        } catch (err: any) {
            setNotice({ type: 'error', text: err?.response?.data?.message || 'Could not connect to server.' });
        } finally {
            setLoading(false);
        }
    }, [uuid, isMinecraft]);

    useEffect(() => {
        loadAddons();
    }, [loadAddons]);

    const handleFileUpload = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['mcaddon', 'mcpack', 'zip'].includes(ext || '')) {
            setNotice({ type: 'error', text: 'Only .mcaddon, .mcpack or .zip files are supported.' });
            return;
        }

        setUploading(true);
        setNotice(null);

        const form = new FormData();
        form.append('addon', file);

        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/addons`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const okCount = (data.instalados || []).length;
            const failCount = (data.errores || []).length;

            if (failCount > 0) {
                setNotice({ type: 'ok', text: `${okCount} installed, ${failCount} failed. Check file formats.` });
            } else {
                setNotice({ type: 'ok', text: `Installed ${okCount} addon(s) successfully.` });
            }

            await loadAddons();
        } catch (err: any) {
            setNotice({ type: 'error', text: err?.response?.data?.error || 'Addon installation failed.' });
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer?.files?.[0];
        if (f) handleFileUpload(f);
    };

    const togglePack = async (pk: AddonPack) => {
        setProcessing((prev) => ({ ...prev, [pk.uuid]: true }));
        try {
            await http.post(`/api/client/servers/${uuid}/minecraft/addons/${encodeURIComponent(pk.uuid)}/toggle`, {
                tipo: pk.tipo,
                activo: !pk.activo,
            });
            await loadAddons();
        } catch (err: any) {
            setNotice({ type: 'error', text: err?.response?.data?.message || 'Failed to toggle pack.' });
        } finally {
            setProcessing((prev) => ({ ...prev, [pk.uuid]: false }));
        }
    };

    const deletePack = async (pk: AddonPack) => {
        setProcessing((prev) => ({ ...prev, [pk.uuid]: true }));
        setConfirmDelete(null);

        try {
            await http.delete(`/api/client/servers/${uuid}/minecraft/addons/${encodeURIComponent(pk.carpeta)}`, {
                params: { tipo: pk.tipo, uuid: pk.uuid },
            });
            setNotice({ type: 'ok', text: `Pack "${pk.nombre}" deleted.` });
            await loadAddons();
        } catch (err: any) {
            setNotice({ type: 'error', text: err?.response?.data?.message || 'Failed to delete pack.' });
        } finally {
            setProcessing((prev) => ({ ...prev, [pk.uuid]: false }));
        }
    };

    if (!isMinecraft) {
        return (
            <ServerContentBlock title="Bedrock Addons">
                <div className="bg-[#0f0b1a] border border-[#231b3a] rounded-xl p-8 text-center max-w-xl mx-auto my-12">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Minecraft Only Feature</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                        Bedrock Addons is configured exclusively for Minecraft servers. To enable this feature for this server, configure the Game Server Type as Minecraft in the admin panel.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title="Minecraft Bedrock Addons">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Active World Banner */}
                {world && (
                    <div className="bg-[#0c0915] border border-[#1e172e] rounded-xl px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            <span>Target World:</span>
                            <span className="font-semibold text-white">{world}</span>
                        </div>
                        <span className="text-[11px] text-neutral-500">
                            Behavior & resource packs are bound to this world
                        </span>
                    </div>
                )}

                {/* Notifications */}
                {notice && (
                    <div
                        className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                            notice.type === 'ok'
                                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                                : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
                        }`}
                    >
                        <span>{notice.text}</span>
                        <button onClick={() => setNotice(null)} className="text-white/60 hover:text-white transition-colors">
                            <svg className={'w-4 h-4'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M6 18L18 6M6 6l12 12'} />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Drag and Drop Upload Card */}
                <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-6 shadow-xl">
                    <h3 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-3">
                        Install Addon or Pack
                    </h3>

                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                            isDragging
                                ? 'border-purple-500 bg-purple-500/10'
                                : 'border-[#2d2247] hover:border-purple-500/50 bg-[#0e0a19]'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".mcaddon,.mcpack,.zip"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileUpload(f);
                                e.target.value = '';
                            }}
                        />

                        <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </div>

                        <p className="text-sm font-medium text-white mb-1">
                            {uploading ? 'Installing addon to server…' : 'Drop .mcaddon, .mcpack, or .zip here'}
                        </p>
                        <p className="text-xs text-neutral-500 mb-4">
                            Files are automatically extracted to behavior_packs or resource_packs and activated
                        </p>

                        <button
                            type="button"
                            disabled={uploading}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow disabled:opacity-50"
                        >
                            {uploading ? 'Installing…' : 'Select File from Device'}
                        </button>
                    </div>
                </div>

                {/* Installed Addons List */}
                <div className="bg-[#090710] border border-[#1e172e] rounded-xl p-6 shadow-xl">
                    <h3 className="text-xs font-semibold font-sans text-neutral-400 uppercase tracking-wider mb-4">
                        Installed Packs ({packs.length})
                    </h3>

                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2">
                            <Spinner size="small" />
                            <span className="text-xs text-neutral-500">Scanning installed packs…</span>
                        </div>
                    ) : packs.length === 0 ? (
                        <p className="text-sm text-neutral-500 text-center py-8">
                            No Bedrock addons installed yet. Use the upload box above to install one.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {packs.map((pk) => {
                                const isBusy = Boolean(processing[pk.uuid]);

                                return (
                                    <div
                                        key={pk.uuid}
                                        className="bg-[#0e0a19] border border-[#1e172e] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="text-sm font-semibold text-white truncate">
                                                    {pk.nombre}
                                                </span>
                                                <span
                                                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                                        pk.tipo === 'behavior'
                                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                    }`}
                                                >
                                                    {pk.tipo === 'behavior' ? 'Behavior Pack' : 'Resource Pack'}
                                                </span>
                                                <span
                                                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                                        pk.activo
                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                                                    }`}
                                                >
                                                    {pk.activo ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            {pk.descripcion && (
                                                <p className="text-xs text-neutral-400 line-clamp-2 m-0">
                                                    {pk.descripcion}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => togglePack(pk)}
                                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                                                    pk.activo
                                                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                                                        : 'bg-emerald-600/80 hover:bg-emerald-500 text-white border-emerald-500/50'
                                                }`}
                                            >
                                                {isBusy ? '…' : pk.activo ? 'Deactivate' : 'Activate'}
                                            </button>

                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => setConfirmDelete(pk)}
                                                className="bg-rose-900/60 hover:bg-rose-700 text-rose-200 border border-rose-800 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Delete Confirmation Modal */}
                {confirmDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-[#0e0a19] border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                            <h3 className="text-base font-semibold text-white mb-2">Delete {confirmDelete.nombre}?</h3>
                            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                                This will permanently remove the addon files from the server and unregister it from the active world. Players will no longer download this pack when joining.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(null)}
                                    className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => deletePack(confirmDelete)}
                                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                                >
                                    Confirm Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ServerContentBlock>
    );
}
