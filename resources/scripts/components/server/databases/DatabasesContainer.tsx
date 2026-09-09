import React, { useEffect, useState, useMemo } from 'react';
import getServerDatabases from '@/api/server/databases/getServerDatabases';
import { ServerContext } from '@/state/server';
import { httpErrorToHuman } from '@/api/http';
import FlashMessageRender from '@/components/FlashMessageRender';
import DatabaseRow from '@/components/server/databases/DatabaseRow';
import { CardListSkeleton } from '@/components/elements/CardListSkeleton';
import CreateDatabaseButton from '@/components/server/databases/CreateDatabaseButton';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import Fade from '@/components/elements/Fade';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useDeepMemoize } from '@/plugins/useDeepMemoize';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faSearch, faServer, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const databaseLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.databases);

    const { addError, clearFlashes } = useFlash();
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const databases = useDeepMemoize(ServerContext.useStoreState((state) => state.databases.data));
    const setDatabases = ServerContext.useStoreActions((state) => state.databases.setDatabases);

    useEffect(() => {
        setLoading(!databases.length);
        clearFlashes('databases');

        getServerDatabases(uuid)
            .then((databases) => setDatabases(databases))
            .catch((error) => {
                console.error(error);
                addError({ key: 'databases', message: httpErrorToHuman(error) });
            })
            .then(() => setLoading(false));
    }, []);

    const filteredDatabases = useMemo(() => {
        if (!search.trim()) return databases;
        const q = search.toLowerCase();
        return databases.filter(
            (db) => db.name.toLowerCase().includes(q) || db.connectionString.toLowerCase().includes(q)
        );
    }, [databases, search]);

    const percentage = databaseLimit > 0 ? Math.min(100, Math.round((databases.length / databaseLimit) * 100)) : 0;

    return (
        <ServerContentBlock title={'Databases'}>
            <FlashMessageRender byKey={'databases'} className="mb-4" />

            {/* Top Bento Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Quota Bento Card */}
                <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono uppercase text-neutral-500 font-semibold tracking-wider">
                            Database Quota
                        </span>
                        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            {percentage}% Used
                        </span>
                    </div>

                    <div className="my-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-medium text-white font-mono">{databases.length}</span>
                            <span className="text-xs text-neutral-500 font-mono">
                                / {databaseLimit > 0 ? databaseLimit : 'Unlimited'} allocated
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-[#141414] rounded-full overflow-hidden mt-3">
                            <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>

                    <p className="text-[11px] text-neutral-500 mt-2">
                        {databaseLimit > 0
                            ? databaseLimit - databases.length > 0
                                ? `${databaseLimit - databases.length} available remaining`
                                : 'Quota fully allocated'
                            : 'Unlimited database creation'}
                    </p>
                </div>

                {/* Host & Protocol Bento Card */}
                <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono uppercase text-neutral-500 font-semibold tracking-wider">
                            Engine & Protocol
                        </span>
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Ready
                        </span>
                    </div>

                    <div className="my-1 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center text-neutral-300">
                            <FontAwesomeIcon icon={faServer} className="text-sm" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white font-mono">MySQL / MariaDB</p>
                            <p className="text-xs text-neutral-500 font-mono">Port 3306 • TCP/IP</p>
                        </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#141414] flex items-center justify-between">
                        <p className="text-[11px] text-neutral-500">
                            Port 3306 • TCP/IP
                        </p>
                        <a
                            href="/pma/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                            title="Open built-in phpMyAdmin database manager"
                        >
                            <span>Launch phpMyAdmin</span>
                            <FontAwesomeIcon icon={faExternalLinkAlt} className="text-[10px]" />
                        </a>
                    </div>
                </div>

                {/* Actions & Launch Bento Card */}
                <div className="p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono uppercase text-neutral-500 font-semibold tracking-wider">
                            Quick Provision
                        </span>
                        <FontAwesomeIcon icon={faDatabase} className="text-xs text-neutral-600" />
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed">
                        Instantly deploy an isolated MySQL database with auto-generated credentials.
                    </p>

                    <div className="mt-3">
                        <Can action={'database.create'}>
                            {databaseLimit > 0 && databaseLimit !== databases.length ? (
                                <CreateDatabaseButton />
                            ) : (
                                <button
                                    disabled
                                    className="w-full py-2 px-3 text-xs font-mono rounded-lg bg-[#141414] text-neutral-500 cursor-not-allowed border border-[#1F1F1F]"
                                >
                                    Allocation Limit Reached
                                </button>
                            )}
                        </Can>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            {databases.length > 0 && (
                <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                        <FontAwesomeIcon
                            icon={faSearch}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 text-xs"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter databases by name or endpoint..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-hidden focus:border-cyan-500/50 transition-colors"
                        />
                    </div>
                    <span className="text-xs text-neutral-500 font-mono">
                        Showing {filteredDatabases.length} of {databases.length}
                    </span>
                </div>
            )}

            {/* Database List */}
            {!databases.length && loading ? (
                <CardListSkeleton count={2} height={120} />
            ) : (
                <Fade timeout={150}>
                    <>
                        {filteredDatabases.length > 0 ? (
                            filteredDatabases.map((database) => (
                                <DatabaseRow key={database.id} database={database} />
                            ))
                        ) : databases.length > 0 ? (
                            <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-8 text-center my-6">
                                <p className="text-xs text-neutral-400 font-mono">
                                    No databases matched your filter &quot;{search}&quot;.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-[#050505] border border-[#1F1F1F] rounded-xl p-10 text-center my-6">
                                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto mb-3">
                                    <FontAwesomeIcon icon={faDatabase} className="text-lg" />
                                </div>
                                <h4 className="text-sm font-medium text-white mb-1">No Databases Provisioned</h4>
                                <p className="text-xs text-neutral-500 max-w-md mx-auto mb-4">
                                    {databaseLimit > 0
                                        ? 'You have not created any databases for this server yet. Create your first database to store application data.'
                                        : 'Databases cannot be created for this server (allocation limit is 0).'}
                                </p>
                                {databaseLimit > 0 && (
                                    <Can action={'database.create'}>
                                        <CreateDatabaseButton />
                                    </Can>
                                )}
                            </div>
                        )}
                    </>
                </Fade>
            )}
        </ServerContentBlock>
    );
};
