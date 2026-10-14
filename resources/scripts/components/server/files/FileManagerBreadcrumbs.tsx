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
        <div className="flex flex-grow-0 items-center text-xs font-mono text-zinc-500 overflow-x-hidden select-none py-1">
            {renderLeft ? (
                <div className="mr-3">{renderLeft}</div>
            ) : (
                <svg className="w-4 h-4 text-zinc-400 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
            )}
            <span className="text-zinc-600">/</span>
            <span className="px-1 text-zinc-400">home</span>
            <span className="text-zinc-600">/</span>
            <NavLink
                to={`/server/${id}/files`}
                className="px-1 text-zinc-300 hover:text-white no-underline transition-colors font-medium"
            >
                container
            </NavLink>
            <span className="text-zinc-600">/</span>
            {breadcrumbs().map((crumb, index) =>
                crumb.path ? (
                    <React.Fragment key={index}>
                        <NavLink
                            to={`/server/${id}/files#${encodePathSegments(crumb.path)}`}
                            className="px-1 text-zinc-300 hover:text-white no-underline transition-colors font-medium"
                        >
                            {crumb.name}
                        </NavLink>
                        <span className="text-zinc-600">/</span>
                    </React.Fragment>
                ) : (
                    <span key={index} className="px-1 text-zinc-100 font-semibold">
                        {crumb.name}
                    </span>
                )
            )}
            {file && (
                <React.Fragment>
                    <span className="px-1 text-zinc-100 font-semibold">{file}</span>
                </React.Fragment>
            )}
        </div>
    );
};
