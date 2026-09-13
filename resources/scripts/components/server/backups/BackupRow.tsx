import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArchive, faLock, faCopy, faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { bytesToString } from '@/lib/formatters';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import BackupContextMenu from '@/components/server/backups/BackupContextMenu';
import getServerBackups from '@/api/swr/getServerBackups';
import { ServerBackup } from '@/api/server/types';
import { SocketEvent } from '@/components/server/events';

interface Props {
    backup: ServerBackup;
    className?: string;
}

export default ({ backup, className }: Props) => {
    const { mutate } = getServerBackups();
    const [copiedChecksum, setCopiedChecksum] = useState(false);

    useWebsocketEvent(`${SocketEvent.BACKUP_COMPLETED}:${backup.uuid}` as SocketEvent, (data) => {
        try {
            const parsed = JSON.parse(data);

            mutate(
                (data) => ({
                    ...data,
                    items: data.items.map((b) =>
                        b.uuid !== backup.uuid
                            ? b
                            : {
                                  ...b,
                                  isSuccessful: parsed.is_successful || true,
                                  checksum: (parsed.checksum_type || '') + ':' + (parsed.checksum || ''),
                                  bytes: parsed.file_size || 0,
                                  completedAt: new Date(),
                              }
                    ),
                }),
                false
            );
        } catch (e) {
            console.warn(e);
        }
    });

    const handleCopyChecksum = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!backup.checksum) return;
        navigator.clipboard.writeText(backup.checksum);
        setCopiedChecksum(true);
        setTimeout(() => setCopiedChecksum(false), 2000);
    };

    const isGenerating = backup.completedAt === null;
    const isFailed = backup.completedAt !== null && !backup.isSuccessful;
    const isReady = backup.completedAt !== null && backup.isSuccessful;

    return (
        <div
            className={`p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] hover:border-[#2D2D2D] transition-all duration-200 mb-3 shadow-sm ${className || ''}`}
            style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
        >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Icon, Name, Badges & Meta */}
                <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center shrink-0 mt-0.5">
                        {isGenerating ? (
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : isFailed ? (
                            <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-400 text-sm" />
                        ) : backup.isLocked ? (
                            <FontAwesomeIcon icon={faLock} className="text-amber-400 text-sm" />
                        ) : (
                            <FontAwesomeIcon icon={faArchive} className="text-neutral-300 text-sm" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        {/* Title & Badges row */}
                        <div className="flex items-center flex-wrap gap-2">
                            <span className="font-sans font-semibold text-sm text-white tracking-tight truncate max-w-sm sm:max-w-md" title={backup.name}>
                                {backup.name}
                            </span>

                            {isGenerating && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
                                    Generating Snapshot...
                                </span>
                            )}

                            {isFailed && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    Failed
                                </span>
                            )}

                            {isReady && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Completed
                                </span>
                            )}

                            {backup.isLocked && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                                    <FontAwesomeIcon icon={faLock} className="text-[9px]" />
                                    <span>Protected</span>
                                </span>
                            )}

                            {isReady && backup.bytes > 0 && (
                                <span className="text-[11px] font-mono text-neutral-300 bg-[#0A0A0A] px-2 py-0.5 rounded border border-[#141414]">
                                    {bytesToString(backup.bytes)}
                                </span>
                            )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center flex-wrap gap-2 text-xs text-neutral-500 mt-1.5">
                            <span title={format(backup.createdAt, 'EEEE, MMMM do, yyyy HH:mm:ss')}>
                                Created {formatDistanceToNow(backup.createdAt, { addSuffix: true })}
                            </span>

                            {backup.checksum && (
                                <>
                                    <span className="text-neutral-700">&bull;</span>
                                    <button
                                        type="button"
                                        onClick={handleCopyChecksum}
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] text-[11px] font-mono text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                                        title={`Full Checksum: ${backup.checksum} (Click to copy)`}
                                    >
                                        <span className="text-neutral-500 text-[10px]">SHA-256</span>
                                        <span className="text-neutral-300 truncate max-w-[130px] sm:max-w-[170px]">
                                            {backup.checksum.length > 20
                                                ? `${backup.checksum.slice(0, 8)}...${backup.checksum.slice(-8)}`
                                                : backup.checksum}
                                        </span>
                                        <FontAwesomeIcon
                                            icon={copiedChecksum ? faCheck : faCopy}
                                            className={copiedChecksum ? 'text-emerald-400 text-[10px]' : 'text-neutral-500 text-[10px]'}
                                        />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Actions Toolbar */}
                <div className="self-end lg:self-center shrink-0">
                    <BackupContextMenu backup={backup} />
                </div>
            </div>
        </div>
    );
};
