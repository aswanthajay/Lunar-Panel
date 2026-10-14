import { encodePathSegments } from '@/helpers';
import { format, formatDistanceToNow } from 'date-fns';
import React, { memo } from 'react';
import { FileObject } from '@/api/server/files/loadDirectory';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import { ServerContext } from '@/state/server';
import { NavLink, useRouteMatch } from 'react-router-dom';
import isEqual from 'react-fast-compare';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import { usePermissions } from '@/plugins/usePermissions';
import { join } from 'path';
import { bytesToString, splitBytesToString } from '@/lib/formatters';
import styles from './style.module.css';
import { getMediaType } from './media/mediaUtils';
import Tooltip from '@/components/elements/tooltip/Tooltip';

const Clickable: React.FC<{ file: FileObject }> = memo(({ file, children }) => {
    const [canRead] = usePermissions(['file.read']);
    const [canReadContents] = usePermissions(['file.read-content']);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const match = useRouteMatch();
    const media = file.isFile ? getMediaType(file.name) : null;

    if (media) {
        return (
            <div
                className={styles.details}
                style={{ cursor: 'pointer' }}
                onClick={() => window.dispatchEvent(new CustomEvent('lunar:files:open-media', { detail: file }))}
            >
                {children}
            </div>
        );
    }

    return (file.isFile && (!file.isEditable() || !canReadContents)) || (!file.isFile && !canRead) ? (
        <div className={styles.details}>{children}</div>
    ) : (
        <NavLink
            className={styles.details}
            to={`${match.url}${file.isFile ? '/edit' : ''}#${encodePathSegments(join(directory, file.name))}`}
        >
            {children}
        </NavLink>
    );
}, isEqual);

const FileObjectRow = ({ file }: { file: FileObject }) => {
    const media = file.isFile ? getMediaType(file.name) : null;

    const isSuspicious =
        file.isFile &&
        file.size === 0 &&
        (file.name.startsWith('import ') ||
            file.name.startsWith('export ') ||
            file.name.startsWith('const ') ||
            file.name.startsWith('let ') ||
            file.name.startsWith('function ') ||
            file.name === '=' ||
            file.name === '==' ||
            file.name === ';' ||
            file.name.includes('{') ||
            file.name.includes('}') ||
            file.name.startsWith('`') ||
            file.name.startsWith('"') ||
            file.name.startsWith("'"));

    return (
        <div
            className={`group ${styles.file_row}`}
            key={file.name}
            onContextMenu={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent(`pterodactyl:files:ctx:${file.key}`, { detail: e.clientX }));
            }}
        >
            <SelectFileCheckbox name={file.name} />
            <Clickable file={file}>
                <div
                    style={{
                        flexShrink: 0,
                        marginRight: '12px',
                    }}
                    className="flex items-center justify-center w-4 h-4"
                >
                    {!file.isFile ? (
                        <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                    ) : media === 'image' ? (
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    ) : media === 'video' || media === 'audio' ? (
                        <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ) : file.isArchiveType() ? (
                        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                    ) : isSuspicious ? (
                        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    )}
                </div>
                <div
                    style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#E5E5E5',
                        fontFamily: 'var(--font-sans, Inter, sans-serif)',
                        fontSize: '13px',
                        fontWeight: 400,
                    }}
                    className="flex items-center gap-2 min-w-0"
                >
                    <span className={`truncate ${isSuspicious ? 'text-amber-200/80 font-mono text-xs' : ''}`}>{file.name}</span>
                    {!file.isFile && (
                        <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 ml-1 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    )}
                    {isSuspicious && (
                        <Tooltip content="Zero-byte file with syntax artifact name. Likely an interrupted upload or shell redirection.">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono text-amber-400 shrink-0">
                                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>artifact (0B)</span>
                            </span>
                        </Tooltip>
                    )}
                </div>
                <div
                    style={{ width: '12%', textAlign: 'right', marginRight: '16px' }}
                    className="hidden sm:block shrink-0"
                >
                    {file.isFile ? (() => {
                        const [sizeVal, sizeUnit] = splitBytesToString(file.size);
                        return (
                            <span className="font-mono tabular-nums text-right inline-flex items-baseline justify-end">
                                <span className="text-xs font-medium text-zinc-200">{sizeVal}</span>
                                <span className="text-[10px] font-normal text-zinc-500 ml-1 select-none">{sizeUnit}</span>
                            </span>
                        );
                    })() : (
                        <span className="text-zinc-600 font-sans select-none text-xs">—</span>
                    )}
                </div>
                <div
                    style={{ width: '18%', textAlign: 'right', marginRight: '16px' }}
                    className="hidden md:block shrink-0 text-right"
                    title={format(file.modifiedAt, 'MMM d, yyyy h:mm:ss a')}
                >
                    <span className="font-mono text-[11px] font-normal text-zinc-500 tabular-nums">
                        {formatDistanceToNow(file.modifiedAt, { addSuffix: true })}
                    </span>
                </div>
            </Clickable>
            <FileDropdownMenu file={file} />
        </div>
    );
};

export default memo(FileObjectRow, (prevProps, nextProps) => {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const { isArchiveType, isEditable, ...prevFile } = prevProps.file;
    const { isArchiveType: nextIsArchiveType, isEditable: nextIsEditable, ...nextFile } = nextProps.file;
    /* eslint-enable @typescript-eslint/no-unused-vars */

    return isEqual(prevFile, nextFile);
});
