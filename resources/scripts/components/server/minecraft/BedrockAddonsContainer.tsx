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
                <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-8 text-center max-w-xl mx-auto my-12">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 font-sans">Minecraft Only Feature</h3>
                    <p className="text-sm text-[#737373] leading-relaxed font-sans">
                        Bedrock Addons is configured exclusively for Minecraft servers. To enable this feature for this server, configure the Game Server Type as Minecraft in the admin panel.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title="Minecraft Bedrock Addons">
            <div className="max-w-4xl mx-auto space-y-6" style={{ fontFamily: 'var(--font-sans)' }}>
                {/* Active World Banner */}
                {world && (
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-[#A0A0A0]">
                            <span className="w-2 h-2 rounded-full bg-white"></span>
                            <span>Target World:</span>
                            <span className="font-semibold text-white">{world}</span>
                        </div>
                        <span className="text-[11px] text-[#737373]">
                            Behavior & resource packs are bound to this world
                        </span>
                    </div>
                )}

                {/* Notifications */}
                {notice && (
                    <div
                        className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                            notice.type === 'ok'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        }`}
                    >
                        <span>{notice.text}</span>
                        <button onClick={() => setNotice(null)} className="text-[#737373] hover:text-white transition-colors">
                            <svg className={'w-4 h-4'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M6 18L18 6M6 6l12 12'} />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Drag and Drop Upload Card */}
                <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-6 shadow-xl">
                    <h3 className="text-xs font-semibold font-sans text-[#A0A0A0] uppercase tracking-wider mb-3">
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
                                ? 'border-white bg-[#141414]'
                                : 'border-[#1F1F1F] hover:border-[#333333] bg-[#050505]'
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

                        <div className="w-12 h-12 rounded-full bg-[#111111] border border-[#242424] text-[#EDEDED] flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </div>

                        <p className="text-sm font-semibold text-white mb-1 font-sans">
                            {uploading ? 'Installing addon to server…' : 'Drop .mcaddon, .mcpack, or .zip here'}
                        </p>
                        <p className="text-xs text-[#737373] mb-4 font-sans">
                            Files are automatically extracted to behavior_packs or resource_packs and activated
                        </p>

                        <button
                            type="button"
                            disabled={uploading}
                            className="bg-white hover:bg-[#E5E5E5] text-black font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow disabled:opacity-50 cursor-pointer"
                        >
                            {uploading ? 'Installing…' : 'Select File from Device'}
                        </button>
                    </div>
                </div>

                {/* Installed Addons List */}
                <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-6 shadow-xl">
                    <h3 className="text-xs font-semibold font-sans text-[#A0A0A0] uppercase tracking-wider mb-4">
                        Installed Packs ({packs.length})
                    </h3>

                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2">
                            <Spinner size="small" />
                            <span className="text-xs text-[#737373]">Scanning installed packs…</span>
                        </div>
                    ) : packs.length === 0 ? (
                        <p className="text-sm text-[#737373] text-center py-8 font-sans">
                            No Bedrock addons installed yet. Use the upload box above to install one.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {packs.map((pk) => {
                                const isBusy = Boolean(processing[pk.uuid]);

                                return (
                                    <div
                                        key={pk.uuid}
                                        className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="text-sm font-semibold text-white truncate font-sans">
                                                    {pk.nombre}
                                                </span>
                                                <span
                                                    className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                                                        pk.tipo === 'behavior'
                                                            ? 'bg-[#111111] text-[#EDEDED] border border-[#242424]'
                                                            : 'bg-[#141414] text-[#D4D4D4] border border-[#262626]'
                                                    }`}
                                                >
                                                    {pk.tipo === 'behavior' ? 'Behavior Pack' : 'Resource Pack'}
                                                </span>
                                                <span
                                                    className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                                                        pk.activo
                                                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                                            : 'bg-[#111111] text-[#737373] border border-[#1F1F1F]'
                                                    }`}
                                                >
                                                    {pk.activo ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            {pk.descripcion && (
                                                <p className="text-xs text-[#737373] line-clamp-2 m-0 font-sans">
                                                    {pk.descripcion}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => togglePack(pk)}
                                                className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                                    pk.activo
                                                        ? 'bg-[#111111] hover:bg-[#1A1A1A] text-[#EDEDED] border-[#242424]'
                                                        : 'bg-white hover:bg-[#E5E5E5] text-black border-white'
                                                }`}
                                            >
                                                {isBusy ? '…' : pk.activo ? 'Deactivate' : 'Activate'}
                                            </button>

                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => setConfirmDelete(pk)}
                                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl w-full max-w-md p-6 shadow-2xl">
                            <h3 className="text-base font-semibold text-white mb-2 font-sans">Delete {confirmDelete.nombre}?</h3>
                            <p className="text-xs text-[#737373] mb-6 leading-relaxed font-sans">
                                This will permanently remove the addon files from the server and unregister it from the active world. Players will no longer download this pack when joining.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(null)}
                                    className="px-4 py-2 rounded-lg bg-[#111111] border border-[#242424] text-[#EDEDED] hover:bg-[#1A1A1A] text-xs font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => deletePack(confirmDelete)}
                                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
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
