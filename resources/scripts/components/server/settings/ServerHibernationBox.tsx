import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import { Button } from '@/components/elements/button/index';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { getServerHibernation, setServerHibernation, HibernationStatus } from '@/api/server/settings/hibernation';
import { httpErrorToHuman } from '@/api/http';
import tw from 'twin.macro';

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const isMinecraft = ServerContext.useStoreState((state) => state.server.data?.isMinecraft);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState<HibernationStatus>({ enabled: true, is_frozen: false, active_connections: 0 });
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!isMinecraft) return;
        setLoading(true);
        getServerHibernation(uuid)
            .then((data) => {
                setStatus(data);
                setLoading(false);
            })
            .catch((err) => {
                setMessage({ type: 'error', text: httpErrorToHuman(err) });
                setLoading(false);
            });
    }, [uuid, isMinecraft]);

    if (!isMinecraft) {
        return null;
    }

    const handleToggle = async () => {
        setMessage(null);
        setSubmitting(true);
        const targetState = !status.enabled;

        try {
            const res = await setServerHibernation(uuid, targetState);
            setStatus((prev) => ({
                ...prev,
                enabled: res.enabled,
                is_frozen: targetState ? prev.is_frozen : false,
            }));
            setMessage({
                type: 'success',
                text: targetState
                    ? 'Autonomous Zero-Player Hibernation enabled for this server.'
                    : 'Autonomous Zero-Player Hibernation disabled for this server.',
            });
        } catch (err) {
            setMessage({ type: 'error', text: httpErrorToHuman(err) });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <TitledGreyBox
            title={
                <div className="flex items-center justify-between w-full">
                    <span className="font-sans font-semibold text-sm text-[#FFFFFF]">Zero-Player Hibernation</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold bg-[#2A1500] text-[#F59E0B] border border-[#F59E0B]/40 uppercase">
                        Admin Feature
                    </span>
                </div>
            }
            css={tw`relative`}
        >
            <SpinnerOverlay visible={loading || submitting} />

            <div className="space-y-4">
                <p className="text-xs text-[#9A9AA2] leading-relaxed m-0 font-sans">
                    Autonomous Zero-Player Hibernation freezes idle Minecraft instances to 0% CPU via cgroups v2 after 15 minutes of zero active players, paging inactive JVM heap memory into compressed zswap. Inbound player packets on the veth interface instantaneously thaw the instance in under 200ms.
                </p>

                {message && (
                    <div
                        className={`text-xs p-3 rounded border font-sans ${
                            message.type === 'success'
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                : 'bg-red-950/40 border-red-500/40 text-red-300'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="flex items-center justify-between p-3.5 bg-[#050505] border border-[#1F1F1F] rounded-lg">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#D4D4D4] font-sans">Engine Status:</span>
                            {status.enabled ? (
                                status.is_frozen ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                        Hibernating (Frozen 0% CPU)
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Active & Monitoring
                                    </span>
                                )
                            ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#141414] text-[#737373] border border-[#262626] flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#525252]" />
                                    Disabled
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-[#737373] m-0 font-mono">
                            {status.enabled
                                ? `Active sockets: ${status.active_connections ?? 0} | Idle timeout: 15m | Wake-on-packet: <200ms`
                                : 'Server process will never be frozen and runs uninterrupted.'}
                        </p>
                    </div>

                    <Button
                        type="button"
                        onClick={handleToggle}
                        disabled={loading || submitting}
                        className={`text-xs !py-1.5 !px-4 ${
                            status.enabled
                                ? '!bg-amber-600/80 hover:!bg-amber-600 text-[#FFFFFF]'
                                : '!bg-emerald-600 hover:!bg-emerald-500 text-[#FFFFFF]'
                        }`}
                    >
                        {status.enabled ? 'Turn Off' : 'Turn On'}
                    </Button>
                </div>
            </div>
        </TitledGreyBox>
    );
};
