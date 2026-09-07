import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faFileArchive, faFileImport, faFolder } from '@fortawesome/free-solid-svg-icons';
import { encodePathSegments } from '@/helpers';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import React, { memo } from 'react';
import { FileObject } from '@/api/server/files/loadDirectory';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import { ServerContext } from '@/state/server';
import { NavLink, useRouteMatch } from 'react-router-dom';
import tw from 'twin.macro';
import isEqual from 'react-fast-compare';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import { usePermissions } from '@/plugins/usePermissions';
import { join } from 'path';
import { bytesToString } from '@/lib/formatters';
import styles from './style.module.css';
import { getMediaType } from './media/mediaUtils';

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
    const iconColor = !file.isFile
        ? '#E5A93C'
        : media === 'audio'
        ? '#A78BFA'
        : media === 'video'
        ? '#60A5FA'
        : media === 'image'
        ? '#34D399'
        : '#707070';

    return (
        <div
            className={styles.file_row}
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
                        color: iconColor,
                        marginLeft: '20px',
                        marginRight: '14px',
                        fontSize: '15px',
                    }}
                >
                    {file.isFile ? (
                        <FontAwesomeIcon
                            icon={file.isSymlink ? faFileImport : file.isArchiveType() ? faFileArchive : faFileAlt}
                        />
                    ) : (
                        <FontAwesomeIcon icon={faFolder} />
                    )}
                </div>
            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#E5E5E5', fontFamily: 'var(--font-sans, Inter, sans-serif)', fontSize: '13px', fontWeight: 400 }}>
                {file.name}
            </div>
            <div
                style={{ width: '12%', textAlign: 'right', marginRight: '16px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: '#737373' }}
                className="hidden sm:block shrink-0"
            >
                {file.isFile ? bytesToString(file.size) : null}
            </div>
            <div
                style={{ width: '18%', textAlign: 'right', marginRight: '16px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: '#737373' }}
                className="hidden md:block shrink-0"
                title={file.modifiedAt.toString()}
            >
                {Math.abs(differenceInHours(file.modifiedAt, new Date())) > 48
                    ? format(file.modifiedAt, 'MMM do, yyyy h:mma')
                    : formatDistanceToNow(file.modifiedAt, { addSuffix: true })}
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
