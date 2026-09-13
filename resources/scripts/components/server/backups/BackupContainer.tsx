import React, { useContext, useEffect, useState, useMemo } from 'react';
import CardListSkeleton from '@/components/elements/CardListSkeleton';
import useFlash from '@/plugins/useFlash';
import Can from '@/components/elements/Can';
import CreateBackupButton from '@/components/server/backups/CreateBackupButton';
import FlashMessageRender from '@/components/FlashMessageRender';
import BackupRow from '@/components/server/backups/BackupRow';
import getServerBackups, { Context as ServerBackupContext } from '@/api/swr/getServerBackups';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Pagination from '@/components/elements/Pagination';
import Fade from '@/components/elements/Fade';
import { bytesToString } from '@/lib/formatters';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArchive, faSearch, faLock } from '@fortawesome/free-solid-svg-icons';

const BackupContainer = () => {
    const { page, setPage } = useContext(ServerBackupContext);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const { data: backups, error, isValidating } = getServerBackups();
    const [search, setSearch] = useState('');

    const backupLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.backups);

    useEffect(() => {
        if (!error) {
            clearFlashes('backups');
            return;
        }

        clearAndAddHttpError({ error, key: 'backups' });
    }, [error]);

    const totalBytes = useMemo(() => {
        return (backups?.items || []).reduce((acc, b) => acc + (b.bytes || 0), 0);
    }, [backups]);

    const lockedCount = useMemo(() => {
        return (backups?.items || []).filter((b) => b.isLocked).length;
    }, [backups]);

    if (!backups || (error && isValidating)) {
        return (
            <ServerContentBlock title={'Backups'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] h-28 animate-pulse" />
                    <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] h-28 animate-pulse" />
                    <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] h-28 animate-pulse" />
                </div>
                <CardListSkeleton count={4} height={70} />
            </ServerContentBlock>
        );
    }

    const quotaPercentage = backupLimit > 0 ? Math.min(100, Math.round((backups.backupCount / backupLimit) * 100)) : 0;
    const canCreate = backupLimit > 0 && backups.backupCount < backupLimit;

    return (
        <ServerContentBlock title={'Backups'}>
            <div style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
                <FlashMessageRender byKey={'backups'} className="mb-4" />

                {/* Top Bento Header */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Bento Card 1: Backup Quota */}
                    <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-mono uppercase text-neutral-500 font-semibold tracking-wider">
                                Backup Quota
                            </span>
                            <span
                                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                    quotaPercentage >= 100
                                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                        : 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20'
                                }`}
                            >
                                {quotaPercentage}% Allocated
                            </span>
                        </div>

                        <div className="my-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-medium text-white font-mono">{backups.backupCount}</span>
                                <span className="text-xs text-neutral-500 font-mono">
                                    / {backupLimit > 0 ? backupLimit : '0'} allocated
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-1.5 bg-[#141414] rounded-full overflow-hidden mt-3">
                                <div
                                    className={`h-full transition-all duration-300 ${
                                        quotaPercentage >= 100 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'
                                    }`}
                                    style={{ width: `${quotaPercentage}%` }}
                                />
                            </div>
                        </div>

                        <p className="text-[11px] text-neutral-500 mt-2 font-sans">
                            {backupLimit > 0
                                ? backupLimit - backups.backupCount > 0
                                    ? `${backupLimit - backups.backupCount} snapshot slots remaining`
                                    : 'Quota limit fully reached'
                                : 'Backups disabled for this server'}
                        </p>
                    </div>

                    {/* Bento Card 2: Storage Footprint */}
                    <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-mono uppercase text-neutral-500 font-semibold tracking-wider">
                                Storage Footprint
                            </span>
                            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Compressed
                            </span>
                        </div>

                        <div className="my-1 flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-lg bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center text-neutral-300 shrink-0">
                                <FontAwesomeIcon icon={faArchive} className="text-sm" />
                            </div>
                            <div>
                                <p className="text-2xl font-medium text-white font-mono">{bytesToString(totalBytes)}</p>
                                <p className="text-xs text-neutral-500 font-mono">
                                    {backups.items.filter((b) => b.isSuccessful).length} active snapshots
                                </p>
                            </div>
                        </div>

                        <p className="text-[11px] text-neutral-500 mt-2 font-sans">
                            Format: .tar.gz archive • SHA-256 verified
                        </p>
                    </div>

                    {/* Bento Card 3: Protection & Policy */}
                    <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-mono uppercase text-neutral-500 font-semibold tracking-wider">
                                Immutable Protection
                            </span>
                            <span className="text-[11px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                Disaster Recovery
                            </span>
                        </div>

                        <div className="my-1 flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-lg bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center text-amber-400 shrink-0">
                                <FontAwesomeIcon icon={faLock} className="text-sm" />
                            </div>
                            <div>
                                <p className="text-2xl font-medium text-white font-mono">{lockedCount}</p>
                                <p className="text-xs text-neutral-500 font-sans">
                                    Protected from automated pruning
                                </p>
                            </div>
                        </div>

                        <p className="text-[11px] text-neutral-500 mt-2 font-sans">
                            Point-in-time container file & database restores
                        </p>
                    </div>
                </div>

                {/* Filter & Toolbar Header */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#1F1F1F]">
                    <div className="relative flex-1 max-w-sm">
                        <FontAwesomeIcon
                            icon={faSearch}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 text-xs"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter backups by name or checksum..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-hidden focus:border-[#3F3F46] transition-colors"
                        />
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                        {backups.items.length > 0 && (
                            <span className="text-xs text-neutral-500 font-mono">
                                {backups.backupCount} total {backups.backupCount === 1 ? 'backup' : 'backups'}
                            </span>
                        )}

                        <Can action={'backup.create'}>
                            {canCreate ? (
                                <CreateBackupButton buttonText="Create Backup" />
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-mono bg-[#141414] text-neutral-500 border border-[#1F1F1F] cursor-not-allowed select-none"
                                >
                                    {backupLimit === 0 ? 'Backups Disabled' : 'Quota Reached'}
                                </button>
                            )}
                        </Can>
                    </div>
                </div>

                {/* Main List */}
                <Pagination data={backups} onPageSelect={setPage}>
                    {({ items }) => {
                        const filtered = !search.trim()
                            ? items
                            : items.filter(
                                  (b) =>
                                      b.name.toLowerCase().includes(search.toLowerCase()) ||
                                      (b.checksum && b.checksum.toLowerCase().includes(search.toLowerCase()))
                              );

                        if (!items.length) {
                            return (
                                <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-10 text-center my-6">
                                    <div className="w-12 h-12 rounded-xl bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center text-neutral-400 mx-auto mb-3">
                                        <FontAwesomeIcon icon={faArchive} className="text-lg" />
                                    </div>
                                    <h4 className="text-sm font-semibold text-white mb-1 tracking-tight">
                                        {page > 1 ? 'No Backups on This Page' : 'No Server Backups Stored'}
                                    </h4>
                                    <p className="text-xs text-neutral-500 max-w-md mx-auto mb-5 leading-relaxed">
                                        {page > 1
                                            ? "Looks like we've run out of backups to show you on this page. Try navigating back a page."
                                            : backupLimit > 0
                                            ? 'No snapshots have been stored for this server yet. Create a backup to protect your game files, databases, and configuration settings.'
                                            : 'Backups cannot be created for this server because the backup limit is set to 0.'}
                                    </p>
                                    {page === 1 && canCreate && (
                                        <Can action={'backup.create'}>
                                            <CreateBackupButton buttonText="Create First Backup" />
                                        </Can>
                                    )}
                                </div>
                            );
                        }

                        if (!filtered.length && search.trim()) {
                            return (
                                <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-8 text-center my-6">
                                    <p className="text-xs text-neutral-400 font-mono">
                                        No backups matched your search &quot;{search}&quot;.
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <Fade timeout={150}>
                                <div>
                                    {filtered.map((backup) => (
                                        <BackupRow key={backup.uuid} backup={backup} />
                                    ))}
                                </div>
                            </Fade>
                        );
                    }}
                </Pagination>
            </div>
        </ServerContentBlock>
    );
};

export default () => {
    const [page, setPage] = useState<number>(1);
    return (
        <ServerBackupContext.Provider value={{ page, setPage }}>
            <BackupContainer />
        </ServerBackupContext.Provider>
    );
};
