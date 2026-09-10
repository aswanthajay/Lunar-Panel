import React from 'react';
import { NavLink, useRouteMatch } from 'react-router-dom';
import { FileObject } from '@/api/server/files/loadDirectory';
import { ServerContext } from '@/state/server';
import { encodePathSegments } from '@/helpers';
import { join } from 'path';
import { bytesToString, splitBytesToString } from '@/lib/formatters';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import { getMediaType } from '../media/mediaUtils';

interface Props {
    files: FileObject[];
    onOpenMedia?: (file: FileObject) => void;
}

const getFileIconAndBadge = (file: FileObject) => {
    if (!file.isFile) {
        return {
            color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
            label: 'DIR',
            icon: (
                <svg className="w-8 h-8 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
            ),
        };
    }

    const media = getMediaType(file.name);
    if (media === 'image') {
        return {
            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
            label: 'IMG',
            icon: (
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
        };
    }
    if (media === 'audio') {
        return {
            color: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
            label: 'AUDIO',
            icon: (
                <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
            ),
        };
    }
    if (media === 'video') {
        return {
            color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
            label: 'VIDEO',
            icon: (
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
        };
    }
    if (file.isArchiveType()) {
        return {
            color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
            label: 'ZIP',
            icon: (
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
            ),
        };
    }

    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    return {
        color: 'text-[#A0A0A0] bg-[#141414] border-[#262626]',
        label: ext.length <= 4 ? ext : 'FILE',
        icon: (
            <svg className="w-8 h-8 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        ),
    };
};

export const FileGridView: React.FC<Props> = ({ files, onOpenMedia }) => {
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const match = useRouteMatch();

    return (
        <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 select-none">
            {files.map((file) => {
                const { icon, label, color } = getFileIconAndBadge(file);
                const media = getMediaType(file.name);
                const targetPath = join(directory, file.name);

                const cardInner = (
                    <div className="flex flex-col items-center text-center p-3 sm:p-4 rounded-xl bg-[#0A0A0A] hover:bg-[#121212] border border-[#1F1F1F] hover:border-[#383838] transition-all duration-150 group relative h-full justify-between shadow-sm active:scale-[0.98]">
                        {/* Top controls: Checkbox & Options Menu */}
                        <div className="w-full flex items-center justify-between gap-1 mb-2" onClick={(e) => e.stopPropagation()}>
                            <SelectFileCheckbox name={file.name} />
                            <FileDropdownMenu file={file} />
                        </div>

                        {/* Icon / Preview Area */}
                        <div className="my-2 p-3 rounded-xl bg-[#000000] border border-[#141414] group-hover:border-[#262626] transition-colors flex items-center justify-center relative">
                            {icon}
                            <span className={`absolute -bottom-1.5 -right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-[0.08em] border ${color}`}>
                                {label}
                            </span>
                        </div>

                        {/* Name & Size info */}
                        <div className="w-full mt-2 min-w-0">
                            <span className="block font-sans text-[13px] font-medium text-zinc-100 group-hover:text-white truncate" title={file.name}>
                                {file.name}
                            </span>
                            <span className="block text-[11px] font-mono text-zinc-500 mt-0.5 tabular-nums">
                                {file.isFile ? (() => {
                                    const [sizeVal, sizeUnit] = splitBytesToString(file.size);
                                    return (
                                        <>
                                            <span className="text-zinc-300 font-medium">{sizeVal}</span>{' '}
                                            <span className="text-[10px] text-zinc-500 select-none">{sizeUnit}</span>
                                        </>
                                    );
                                })() : (
                                    <span className="text-zinc-500 font-sans">Folder</span>
                                )}
                            </span>
                        </div>
                    </div>
                );

                if (!file.isFile) {
                    return (
                        <NavLink
                            key={file.name}
                            to={`${match.url}#${encodePathSegments(targetPath)}`}
                            className="block no-underline"
                        >
                            {cardInner}
                        </NavLink>
                    );
                }

                if (media && onOpenMedia) {
                    return (
                        <div
                            key={file.name}
                            onClick={() => onOpenMedia(file)}
                            className="cursor-pointer"
                        >
                            {cardInner}
                        </div>
                    );
                }

                if (file.isEditable()) {
                    return (
                        <NavLink
                            key={file.name}
                            to={`${match.url}/edit#${encodePathSegments(targetPath)}`}
                            className="block no-underline"
                        >
                            {cardInner}
                        </NavLink>
                    );
                }

                return (
                    <div key={file.name}>
                        {cardInner}
                    </div>
                );
            })}
        </div>
    );
};
