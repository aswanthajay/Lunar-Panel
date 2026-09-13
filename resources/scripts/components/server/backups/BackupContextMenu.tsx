import React, { useState } from 'react';
import {
    faBoxOpen,
    faCloudDownloadAlt,
    faEllipsisH,
    faLock,
    faTrashAlt,
    faUnlock,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DropdownMenu, { DropdownButtonRow } from '@/components/elements/DropdownMenu';
import getBackupDownloadUrl from '@/api/server/backups/getBackupDownloadUrl';
import useFlash from '@/plugins/useFlash';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import deleteBackup from '@/api/server/backups/deleteBackup';
import Can from '@/components/elements/Can';
import tw from 'twin.macro';
import getServerBackups from '@/api/swr/getServerBackups';
import { ServerBackup } from '@/api/server/types';
import { ServerContext } from '@/state/server';
import Input from '@/components/elements/Input';
import { restoreServerBackup } from '@/api/server/backups';
import http, { httpErrorToHuman } from '@/api/http';
import { Dialog } from '@/components/elements/dialog';
import { trackRecentDownload } from '@/helpers';

interface Props {
    backup: ServerBackup;
}

export default ({ backup }: Props) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);
    const [modal, setModal] = useState('');
    const [loading, setLoading] = useState(false);
    const [truncate, setTruncate] = useState(false);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const { mutate } = getServerBackups();

    const doDownload = () => {
        setLoading(true);
        clearFlashes('backups');
        getBackupDownloadUrl(uuid, backup.uuid)
            .then((url) => {
                trackRecentDownload(`${backup.name || 'backup'}.tar.gz`, url, 'backup');
                // @ts-expect-error this is valid
                window.location = url;
            })
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ key: 'backups', error });
            })
            .then(() => setLoading(false));
    };

    const doDeletion = () => {
        setLoading(true);
        clearFlashes('backups');
        deleteBackup(uuid, backup.uuid)
            .then(() =>
                mutate(
                    (data) => ({
                        ...data,
                        items: data.items.filter((b) => b.uuid !== backup.uuid),
                        backupCount: data.backupCount - 1,
                    }),
                    false
                )
            )
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ key: 'backups', error });
                setLoading(false);
                setModal('');
            });
    };

    const doRestorationAction = () => {
        setLoading(true);
        clearFlashes('backups');
        restoreServerBackup(uuid, backup.uuid, truncate)
            .then(() =>
                setServerFromState((s) => ({
                    ...s,
                    status: 'restoring_backup',
                }))
            )
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ key: 'backups', error });
            })
            .then(() => setLoading(false))
            .then(() => setModal(''));
    };

    const onLockToggle = () => {
        if (backup.isLocked && modal !== 'unlock') {
            return setModal('unlock');
        }

        http.post(`/api/client/servers/${uuid}/backups/${backup.uuid}/lock`)
            .then(() =>
                mutate(
                    (data) => ({
                        ...data,
                        items: data.items.map((b) =>
                            b.uuid !== backup.uuid
                                ? b
                                : {
                                      ...b,
                                      isLocked: !b.isLocked,
                                  }
                        ),
                    }),
                    false
                )
            )
            .catch((error) => alert(httpErrorToHuman(error)))
            .then(() => setModal(''));
    };

    return (
        <>
            <Dialog.Confirm
                open={modal === 'unlock'}
                onClose={() => setModal('')}
                title={`Unlock "${backup.name}"`}
                onConfirmed={onLockToggle}
            >
                <p className="text-neutral-300 text-sm leading-relaxed" style={{ WebkitFontSmoothing: 'antialiased' }}>
                    This backup will no longer be protected from automated retention or accidental deletions.
                </p>
            </Dialog.Confirm>

            <Dialog.Confirm
                open={modal === 'restore'}
                onClose={() => setModal('')}
                confirm={'Restore'}
                title={`Restore "${backup.name}"`}
                onConfirmed={() => doRestorationAction()}
            >
                <p className="text-neutral-300 text-sm leading-relaxed" style={{ WebkitFontSmoothing: 'antialiased' }}>
                    Your server will be stopped. You will not be able to control power state, access the file manager, or create additional backups until restoration finishes.
                </p>
                <div className="mt-4 bg-[#0A0A0A] border border-[#1F1F1F] p-3 rounded-lg">
                    <label htmlFor="restore_truncate" className="text-xs text-neutral-300 flex items-center cursor-pointer select-none">
                        <input
                            type="checkbox"
                            id="restore_truncate"
                            checked={truncate}
                            onChange={() => setTruncate((s) => !s)}
                            className="w-4 h-4 mr-2.5 accent-rose-500 rounded border-neutral-700 bg-neutral-900 cursor-pointer"
                        />
                        <span>Delete all existing container files before restoring backup.</span>
                    </label>
                </div>
            </Dialog.Confirm>

            <Dialog.Confirm
                title={`Delete "${backup.name}"`}
                confirm={'Delete'}
                open={modal === 'delete'}
                onClose={() => setModal('')}
                onConfirmed={doDeletion}
            >
                <p className="text-neutral-300 text-sm leading-relaxed" style={{ WebkitFontSmoothing: 'antialiased' }}>
                    This is a permanent operation. The snapshot archive and all contained data cannot be recovered once deleted.
                </p>
            </Dialog.Confirm>

            <SpinnerOverlay visible={loading} fixed />

            <div className="flex items-center gap-1.5 shrink-0" style={{ WebkitFontSmoothing: 'antialiased' }}>
                {backup.isSuccessful ? (
                    <>
                        <Can action={'backup.restore'}>
                            <button
                                type="button"
                                onClick={() => setModal('restore')}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#0A0A0A] hover:bg-[#141414] text-[#EDEDED] hover:text-white border border-[#1F1F1F] hover:border-[#383838] cursor-pointer inline-flex items-center gap-1.5 select-none"
                                title="Restore server from this snapshot"
                            >
                                <FontAwesomeIcon icon={faBoxOpen} className="text-xs text-neutral-400" />
                                <span className="hidden sm:inline">Restore</span>
                            </button>
                        </Can>

                        <Can action={'backup.download'}>
                            <button
                                type="button"
                                onClick={doDownload}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#0A0A0A] hover:bg-[#141414] text-[#EDEDED] hover:text-white border border-[#1F1F1F] hover:border-[#383838] cursor-pointer inline-flex items-center gap-1.5 select-none"
                                title="Download compressed archive (.tar.gz)"
                            >
                                <FontAwesomeIcon icon={faCloudDownloadAlt} className="text-xs text-neutral-400" />
                                <span className="hidden sm:inline">Download</span>
                            </button>
                        </Can>

                        <Can action={'backup.delete'}>
                            <button
                                type="button"
                                onClick={onLockToggle}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer inline-flex items-center gap-1.5 select-none ${
                                    backup.isLocked
                                        ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                                        : 'bg-[#0A0A0A] hover:bg-[#141414] text-neutral-400 hover:text-neutral-200 border-[#1F1F1F] hover:border-[#383838]'
                                }`}
                                title={backup.isLocked ? 'Unlock backup (allow deletion)' : 'Lock backup (prevent deletion)'}
                            >
                                <FontAwesomeIcon icon={backup.isLocked ? faLock : faUnlock} className="text-xs" />
                                <span className="hidden md:inline">{backup.isLocked ? 'Locked' : 'Lock'}</span>
                            </button>

                            {!backup.isLocked && (
                                <button
                                    type="button"
                                    onClick={() => setModal('delete')}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 cursor-pointer inline-flex items-center gap-1.5 select-none"
                                    title="Permanently delete snapshot"
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} className="text-xs" />
                                    <span className="hidden sm:inline">Delete</span>
                                </button>
                            )}
                        </Can>
                    </>
                ) : (
                    <Can action={'backup.delete'}>
                        <button
                            type="button"
                            onClick={() => setModal('delete')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 cursor-pointer inline-flex items-center gap-1.5 select-none"
                            title="Purge failed backup"
                        >
                            <FontAwesomeIcon icon={faTrashAlt} className="text-xs" />
                            <span>Purge Failed</span>
                        </button>
                    </Can>
                )}
            </div>
        </>
    );
};
