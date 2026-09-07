import React from 'react';
import { NavLink, useRouteMatch } from 'react-router-dom';
import { FileObject } from '@/api/server/files/loadDirectory';
import { ServerContext } from '@/state/server';
import { encodePathSegments } from '@/helpers';
import { join } from 'path';
import { bytesToString } from '@/lib/formatters';
import { formatDistanceToNow } from 'date-fns';
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
                    <div className="flex items-center gap-2 min-w-0 flex-1 py-1.5 px-3">
                        <span className="shrink-0 text-xs">
                            {!file.isFile ? (
                                <span className="text-amber-400">📁</span>
                            ) : media ? (
                                <span className="text-emerald-400">🎬</span>
                            ) : file.isArchiveType() ? (
                                <span className="text-purple-400">📦</span>
                            ) : (
                                <span className="text-[#737373]">📄</span>
                            )}
                        </span>
                        <span className="font-mono text-xs text-[#E5E5E5] hover:text-white truncate" title={file.name}>
                            {file.name}
                        </span>
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
                                {file.isFile ? bytesToString(file.size) : 'DIR'}
                            </span>
                            <span className="w-24 text-right hidden md:inline truncate">
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
