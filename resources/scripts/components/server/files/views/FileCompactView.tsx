import React from 'react';
import { NavLink, useRouteMatch } from 'react-router-dom';
import { FileObject } from '@/api/server/files/loadDirectory';
import { ServerContext } from '@/state/server';
import { encodePathSegments } from '@/helpers';
import { join } from 'path';
import { bytesToString } from '@/lib/formatters';
import { format, formatDistanceToNow } from 'date-fns';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import { getMediaType } from '../media/mediaUtils';

interface Props {
    files: FileObject[];
    onOpenMedia?: (file: FileObject) => void;
}

export const FileCompactView: React.FC<Props> = ({ files, onOpenMedia }) => {
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const match = useRouteMatch();

    return (
        <div className="divide-y divide-[#141414] select-none">
            {files.map((file) => {
                const targetPath = join(directory, file.name);
                const media = getMediaType(file.name);

                const renderName = (
                    <div className="group flex items-center gap-2 min-w-0 flex-1 py-1.5 px-3">
                        <span className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                            {!file.isFile ? (
                                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>
                            ) : media === 'image' ? (
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            ) : media === 'video' || media === 'audio' ? (
                                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : file.isArchiveType() ? (
                                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                            ) : (
                                <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            )}
                        </span>
                        <span className="font-mono text-xs text-[#E5E5E5] group-hover:text-white truncate" title={file.name}>
                            {file.name}
                        </span>
                        {!file.isFile && (
                            <svg className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 ml-1 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        )}
                    </div>
                );

                return (
                    <div
                        key={file.name}
                        className="flex items-center justify-between hover:bg-[#0A0A0A] transition-colors px-2 py-0.5 text-xs font-mono"
                    >
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                            <SelectFileCheckbox name={file.name} />

                            {!file.isFile ? (
                                <NavLink
                                    to={`${match.url}#${encodePathSegments(targetPath)}`}
                                    className="flex-1 min-w-0 flex items-center no-underline"
                                >
                                    {renderName}
                                </NavLink>
                            ) : media && onOpenMedia ? (
                                <div
                                    onClick={() => onOpenMedia(file)}
                                    className="flex-1 min-w-0 flex items-center cursor-pointer"
                                >
                                    {renderName}
                                </div>
                            ) : file.isEditable() ? (
                                <NavLink
                                    to={`${match.url}/edit#${encodePathSegments(targetPath)}`}
                                    className="flex-1 min-w-0 flex items-center no-underline"
                                >
                                    {renderName}
                                </NavLink>
                            ) : (
                                <div className="flex-1 min-w-0 flex items-center">
                                    {renderName}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4 shrink-0 text-[#737373] text-[11px] pr-2">
                            <span className="w-20 text-right hidden sm:inline">
                                {file.isFile ? bytesToString(file.size) : '—'}
                            </span>
                            <span
                                className="w-24 text-right hidden md:inline truncate"
                                title={format(file.modifiedAt, 'MMM d, yyyy h:mm:ss a')}
                            >
                                {formatDistanceToNow(file.modifiedAt, { addSuffix: true })}
                            </span>
                            <FileDropdownMenu file={file} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
