import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDatabase,
    faEye,
    faEyeSlash,
    faTrashAlt,
    faFileExport,
    faFileImport,
    faExternalLinkAlt,
    faSpinner,
    faKey,
    faTerminal,
    faCode,
    faCopy,
    faCheck,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import { Form, Formik, FormikHelpers } from 'formik';
import Field from '@/components/elements/Field';
import { object, string } from 'yup';
import FlashMessageRender from '@/components/FlashMessageRender';
import { ServerContext } from '@/state/server';
import deleteServerDatabase from '@/api/server/databases/deleteServerDatabase';
import { httpErrorToHuman } from '@/api/http';
import RotatePasswordButton from '@/components/server/databases/RotatePasswordButton';
import Can from '@/components/elements/Can';
import { ServerDatabase } from '@/api/server/databases/getServerDatabases';
import useFlash from '@/plugins/useFlash';
import Button from '@/components/elements/Button';
import { exportDatabase, getPhpMyAdminUrl, getDatabaseStats, DatabaseStatsResponse } from '@/api/server/databases/databaseManagement';
import ImportDatabaseModal from '@/components/server/databases/ImportDatabaseModal';
import { SqlConsoleModal } from '@/components/server/databases/SqlConsoleModal';
import { ConnectionCheatSheetModal } from '@/components/server/databases/ConnectionCheatSheetModal';

interface Props {
    database: ServerDatabase;
    className?: string;
}

export default ({ database, className }: Props) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { addError, addFlash, clearFlashes } = useFlash();

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [importVisible, setImportVisible] = useState(false);
    const [sqlConsoleVisible, setSqlConsoleVisible] = useState(false);
    const [cheatSheetVisible, setCheatSheetVisible] = useState(false);

    const [isExporting, setIsExporting] = useState(false);
    const [isPmaLoading, setIsPmaLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const [stats, setStats] = useState<DatabaseStatsResponse | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const appendDatabase = ServerContext.useStoreActions((actions) => actions.databases.appendDatabase);
    const removeDatabase = ServerContext.useStoreActions((actions) => actions.databases.removeDatabase);

    useEffect(() => {
        let isMounted = true;
        setStatsLoading(true);
        getDatabaseStats(uuid, database.id)
            .then((res) => {
                if (isMounted) setStats(res);
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) setStatsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [uuid, database.id]);

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleExport = () => {
        setIsExporting(true);
        clearFlashes('databases');
        exportDatabase(uuid, database.id, database.name)
            .then(() => {
                addFlash({
                    key: 'databases',
                    type: 'success',
                    message: `Exported SQL dump for ${database.name} successfully.`,
                });
            })
            .catch((error) => {
                console.error(error);
                addFlash({
                    key: 'databases',
                    type: 'error',
                    message: `Failed to export database: ${httpErrorToHuman(error)}`,
                });
            })
            .finally(() => setIsExporting(false));
    };

    const handlePma = () => {
        setIsPmaLoading(true);
        clearFlashes('databases');
        getPhpMyAdminUrl(uuid, database.id)
            .then((res) => {
                if (!res.installed) {
                    addFlash({
                        key: 'databases',
                        type: 'warning',
                        title: 'phpMyAdmin Setup Required',
                        message: res.message || 'phpMyAdmin is not installed yet. Run "php artisan lunar:pma-setup" on the server.',
                    });
                } else if (res.url) {
                    window.open(res.url, '_blank');
                }
            })
            .catch((error) => {
                console.error(error);
                addFlash({
                    key: 'databases',
                    type: 'error',
                    message: `Failed to connect to phpMyAdmin: ${httpErrorToHuman(error)}`,
                });
            })
            .finally(() => setIsPmaLoading(false));
    };

    const schema = object().shape({
        confirm: string()
            .required('The database name must be provided.')
            .oneOf([database.name.split('_', 2)[1], database.name], 'The database name must be provided.'),
    });

    const submit = (values: { confirm: string }, { setSubmitting }: FormikHelpers<{ confirm: string }>) => {
        clearFlashes();
        deleteServerDatabase(uuid, database.id)
            .then(() => {
                setDeleteModalVisible(false);
                setTimeout(() => removeDatabase(database.id), 150);
            })
            .catch((error) => {
                console.error(error);
                setSubmitting(false);
                addError({ key: 'database:delete', message: httpErrorToHuman(error) });
            });
    };

    return (
        <>
            {/* Delete Modal */}
            <Formik onSubmit={submit} initialValues={{ confirm: '' }} validationSchema={schema} isInitialValid={false}>
                {({ isSubmitting, isValid, resetForm }) => (
                    <Modal
                        visible={deleteModalVisible}
                        dismissable={!isSubmitting}
                        showSpinnerOverlay={isSubmitting}
                        onDismissed={() => {
                            setDeleteModalVisible(false);
                            resetForm();
                        }}
                    >
                        <FlashMessageRender byKey={'database:delete'} className="mb-4" />
                        <h2 className="text-xl font-medium text-white mb-2">Confirm Database Deletion</h2>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                            Deleting a database is an irreversible action. This will permanently delete{' '}
                            <strong className="text-white font-mono">{database.name}</strong> and purge all associated tables and records.
                        </p>
                        <Form className="m-0 mt-4">
                            <Field
                                type={'text'}
                                id={'confirm_name'}
                                name={'confirm'}
                                label={'Confirm Database Name'}
                                description={'Enter the database name to confirm deletion.'}
                            />
                            <div className="mt-6 flex items-center justify-end gap-2">
                                <Button type={'button'} isSecondary onClick={() => setDeleteModalVisible(false)}>
                                    Cancel
                                </Button>
                                <Button type={'submit'} color={'red'} disabled={!isValid}>
                                    Delete Database
                                </Button>
                            </div>
                        </Form>
                    </Modal>
                )}
            </Formik>

            {/* SQL Console Modal */}
            <SqlConsoleModal
                database={database}
                visible={sqlConsoleVisible}
                onDismissed={() => setSqlConsoleVisible(false)}
            />

            {/* Connection Cheat Sheet Modal */}
            <ConnectionCheatSheetModal
                database={database}
                visible={cheatSheetVisible}
                onDismissed={() => setCheatSheetVisible(false)}
            />

            {/* Import Modal */}
            <ImportDatabaseModal
                database={database}
                visible={importVisible}
                onDismissed={() => setImportVisible(false)}
            />

            {/* Luxury Database Card */}
            <div className={`p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] hover:border-neutral-700/60 transition-all duration-200 mb-3 shadow-sm ${className || ''}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: DB Name, Health & Info */}
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                            <FontAwesomeIcon icon={faDatabase} className="text-base" />
                        </div>
                        <div>
                            <div className="flex items-center flex-wrap gap-2">
                                <span className="text-base font-semibold text-white font-mono tracking-tight">
                                    {database.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(database.name, 'name')}
                                    className="text-neutral-500 hover:text-white p-1 rounded transition-colors"
                                    title="Copy database name"
                                >
                                    <FontAwesomeIcon icon={copiedKey === 'name' ? faCheck : faCopy} className={copiedKey === 'name' ? 'text-emerald-400 text-xs' : 'text-xs'} />
                                </button>

                                {/* Health Badge */}
                                {statsLoading ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#141414] text-neutral-400 border border-[#1F1F1F]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse" />
                                        Checking...
                                    </span>
                                ) : stats?.online ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Online {stats.ping_ms ? `(${stats.ping_ms}ms)` : ''}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        Offline
                                    </span>
                                )}

                                {/* Tables & Size Badge */}
                                {stats?.online && (
                                    <span className="text-[11px] font-mono text-neutral-400 bg-[#0A0A0A] px-2 py-0.5 rounded border border-[#141414]">
                                        {stats.table_count} tables • {stats.size_human}
                                    </span>
                                )}
                            </div>

                            <p className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
                                <span>Engine: <strong className="text-neutral-300 font-mono">{stats?.version || 'MySQL / MariaDB'}</strong></span>
                                <span>•</span>
                                <span>Host: <strong className="text-neutral-300 font-mono">{database.connectionString}</strong></span>
                            </p>
                        </div>
                    </div>

                    {/* Right: Actions Toolbar */}
                    <div className="flex items-center flex-wrap gap-1.5 self-end lg:self-center">
                        <Button
                            type="button"
                            isSecondary
                            size="small"
                            onClick={() => setSqlConsoleVisible(true)}
                            title="Interactive SQL Console"
                        >
                            <FontAwesomeIcon icon={faTerminal} className="mr-1.5 text-emerald-400" />
                            <span className="text-xs">SQL Console</span>
                        </Button>

                        <Button
                            type="button"
                            isSecondary
                            size="small"
                            onClick={() => setCheatSheetVisible(true)}
                            title="Developer Connection Snippets (.env, Prisma, Python, JDBC)"
                        >
                            <FontAwesomeIcon icon={faCode} className="mr-1.5 text-cyan-400" />
                            <span className="text-xs">Connect</span>
                        </Button>

                        <Button
                            type="button"
                            isSecondary
                            size="small"
                            disabled={isExporting}
                            onClick={handleExport}
                            title="Export .sql dump"
                        >
                            <FontAwesomeIcon icon={isExporting ? faSpinner : faFileExport} spin={isExporting} className="mr-1.5 text-amber-400" />
                            <span className="text-xs">Export</span>
                        </Button>

                        <Can action={'database.create'}>
                            <Button
                                type="button"
                                isSecondary
                                size="small"
                                onClick={() => setImportVisible(true)}
                                title="Import .sql or .sql.gz dump"
                            >
                                <FontAwesomeIcon icon={faFileImport} className="mr-1.5 text-purple-400" />
                                <span className="text-xs">Import</span>
                            </Button>
                        </Can>

                        <Button
                            type="button"
                            isSecondary
                            size="small"
                            disabled={isPmaLoading}
                            onClick={handlePma}
                            title="Single-Sign-On to phpMyAdmin"
                        >
                            <span className="text-xs font-semibold mr-1 text-cyan-400">PMA</span>
                            <FontAwesomeIcon icon={isPmaLoading ? faSpinner : faExternalLinkAlt} spin={isPmaLoading} className="text-xs" />
                        </Button>

                        <Can action={'database.update'}>
                            <RotatePasswordButton databaseId={database.id} onUpdate={appendDatabase} />
                        </Can>

                        <Can action={'database.delete'}>
                            <Button
                                color={'red'}
                                isSecondary
                                size="small"
                                title="Delete Database"
                                onClick={() => setDeleteModalVisible(true)}
                            >
                                <FontAwesomeIcon icon={faTrashAlt} />
                            </Button>
                        </Can>
                    </div>
                </div>

                {/* Connection Parameters Grid */}
                <div className="mt-4 pt-3 border-t border-[#141414] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                    {/* Endpoint */}
                    <div
                        onClick={() => handleCopy(database.connectionString, 'endpoint')}
                        className="group flex flex-col p-2 rounded-lg bg-[#0A0A0A] hover:bg-[#121212] border border-[#141414] cursor-pointer transition-colors"
                        title="Click to copy endpoint"
                    >
                        <span className="text-[10px] uppercase text-neutral-500 font-semibold tracking-wider flex items-center justify-between">
                            Endpoint
                            <FontAwesomeIcon icon={copiedKey === 'endpoint' ? faCheck : faCopy} className={copiedKey === 'endpoint' ? 'text-emerald-400' : 'opacity-0 group-hover:opacity-100 text-neutral-400 transition-opacity'} />
                        </span>
                        <span className="text-neutral-200 mt-1 truncate">{database.connectionString}</span>
                    </div>

                    {/* Username */}
                    <div
                        onClick={() => handleCopy(database.username, 'username')}
                        className="group flex flex-col p-2 rounded-lg bg-[#0A0A0A] hover:bg-[#121212] border border-[#141414] cursor-pointer transition-colors"
                        title="Click to copy username"
                    >
                        <span className="text-[10px] uppercase text-neutral-500 font-semibold tracking-wider flex items-center justify-between">
                            Username
                            <FontAwesomeIcon icon={copiedKey === 'username' ? faCheck : faCopy} className={copiedKey === 'username' ? 'text-emerald-400' : 'opacity-0 group-hover:opacity-100 text-neutral-400 transition-opacity'} />
                        </span>
                        <span className="text-neutral-200 mt-1 truncate">{database.username}</span>
                    </div>

                    {/* Password with inline toggle and copy */}
                    <Can action={'database.view_password'}>
                        <div className="flex flex-col p-2 rounded-lg bg-[#0A0A0A] border border-[#141414]">
                            <div className="text-[10px] uppercase text-neutral-500 font-semibold tracking-wider flex items-center justify-between">
                                <span>Password</span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-neutral-400 hover:text-white p-0.5 transition-colors"
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="text-xs" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(database.password || '', 'password')}
                                        className="text-neutral-400 hover:text-white p-0.5 transition-colors"
                                        title="Copy password"
                                    >
                                        <FontAwesomeIcon icon={copiedKey === 'password' ? faCheck : faCopy} className={copiedKey === 'password' ? 'text-emerald-400 text-xs' : 'text-xs'} />
                                    </button>
                                </div>
                            </div>
                            <span className="text-neutral-200 mt-1 truncate select-all">
                                {showPassword ? database.password : '••••••••••••'}
                            </span>
                        </div>
                    </Can>

                    {/* Connections From */}
                    <div className="flex flex-col p-2 rounded-lg bg-[#0A0A0A] border border-[#141414]">
                        <span className="text-[10px] uppercase text-neutral-500 font-semibold tracking-wider">
                            Connections From
                        </span>
                        <span className="text-neutral-200 mt-1 truncate">
                            {database.allowConnectionsFrom === '%' ? '% (Any host)' : database.allowConnectionsFrom}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};
