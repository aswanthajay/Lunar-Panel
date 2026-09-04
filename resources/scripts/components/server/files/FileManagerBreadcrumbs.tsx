import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { NavLink, useLocation } from 'react-router-dom';
import { encodePathSegments, hashToPath } from '@/helpers';
import tw from 'twin.macro';

interface Props {
    renderLeft?: JSX.Element;
    withinFileEditor?: boolean;
    isNewFile?: boolean;
}

export default ({ renderLeft, withinFileEditor, isNewFile }: Props) => {
    const [file, setFile] = useState<string | null>(null);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { hash } = useLocation();

    useEffect(() => {
        const path = hashToPath(hash);

        if (withinFileEditor && !isNewFile) {
            const name = path.split('/').pop() || null;
            setFile(name);
        }
    }, [withinFileEditor, isNewFile, hash]);

    const breadcrumbs = (): { name: string; path?: string }[] =>
        directory
            .split('/')
            .filter((directory) => !!directory)
            .map((directory, index, dirs) => {
                if (!withinFileEditor && index === dirs.length - 1) {
                    return { name: directory };
                }

                return { name: directory, path: `/${dirs.slice(0, index + 1).join('/')}` };
            });

    return (
        <div
            style={{
                display: 'flex',
                flexGrow: 0,
                alignItems: 'center',
                fontSize: '12px',
                color: '#525252',
                overflowX: 'hidden',
                fontFamily: 'var(--font-mono, monospace)',
            }}
        >
            {renderLeft || <div style={{ width: '48px' }} />}
            <span style={{ color: '#383838' }}>/</span>
            <span style={{ padding: '0 4px', color: '#808080' }}>home</span>
            <span style={{ color: '#383838' }}>/</span>
            <NavLink
                to={`/server/${id}/files`}
                style={{ padding: '0 4px', color: '#A0A0A0', textDecoration: 'none' }}
            >
                container
            </NavLink>
            <span style={{ color: '#383838' }}>/</span>
            {breadcrumbs().map((crumb, index) =>
                crumb.path ? (
                    <React.Fragment key={index}>
                        <NavLink
                            to={`/server/${id}/files#${encodePathSegments(crumb.path)}`}
                            style={{ padding: '0 4px', color: '#A0A0A0', textDecoration: 'none' }}
                        >
                            {crumb.name}
                        </NavLink>
                        <span style={{ color: '#383838' }}>/</span>
                    </React.Fragment>
                ) : (
                    <span key={index} style={{ padding: '0 4px', color: '#D4D4D4' }}>
                        {crumb.name}
                    </span>
                )
            )}
            {file && (
                <React.Fragment>
                    <span style={{ padding: '0 4px', color: '#D4D4D4' }}>{file}</span>
                </React.Fragment>
            )}
        </div>
    );
};
