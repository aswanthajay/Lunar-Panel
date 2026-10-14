import React, { useEffect, useState, useRef } from 'react';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import isEqual from 'react-fast-compare';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { ip, bytesToString } from '@/lib/formatters';
import {
    getSftpTransfers,
    testSftpConnection,
    startSftpTransfer,
    getSftpTransferStatus,
    cancelSftpTransfer,
    deleteSftpTransfer,
    SftpTransferRecord,
    TestConnectionResponse,
} from '@/api/server/transfer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDownload,
    faUpload,
    faTerminal,
    faSync,
    faTrash,
    faFolder,
    faFile,
    faEye,
    faEyeSlash,
    faCopy,
    faCheck,
} from '@fortawesome/free-solid-svg-icons';
import copy from 'copy-to-clipboard';

export default () => {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server!.uuid;
    const serverId = server?.id;
    const sftpDetails = ServerContext.useStoreState((state) => state.server.data!.sftpDetails, isEqual);
    const currentUsername = useStoreState((state) => state.user.data?.username);
    const { addFlash, clearFlashes } = useFlash();

    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState<'import' | 'export'>('import');
    const [host, setHost] = useState('');
    const [port, setPort] = useState(2022);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remotePath, setRemotePath] = useState('/');
    const [wipeExisting, setWipeExisting] = useState(false);

    // Active transfer & history
    const [activeTransfer, setActiveTransfer] = useState<SftpTransferRecord | null>(null);
    const [history, setHistory] = useState<SftpTransferRecord[]>([]);

    // Testing connection
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Starting & cancelling transfer
    const [starting, setStarting] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Log modal
    const [viewingLogTransfer, setViewingLogTransfer] = useState<SftpTransferRecord | null>(null);
    const [copiedLog, setCopiedLog] = useState(false);

    const logBoxRef = useRef<HTMLPreElement>(null);
    const pollIntervalRef = useRef<any>(null);

    const loadData = async () => {
        try {
            const data = await getSftpTransfers(uuid);
            setActiveTransfer(data.active);
            setHistory(data.history);
        } catch (error) {
            console.error(error);
            addFlash({
                key: 'transfer',
                type: 'error',
                message: httpErrorToHuman(error),
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        clearFlashes('transfer');
        loadData();
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [uuid]);

    // Setup polling when an active transfer exists and is not finished
    useEffect(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }

        if (
            activeTransfer &&
            !['completed', 'failed', 'cancelled'].includes(activeTransfer.status)
        ) {
            pollIntervalRef.current = setInterval(async () => {
                try {
                    const updated = await getSftpTransferStatus(uuid, activeTransfer.id);
                    setActiveTransfer(updated);

                    if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                        loadData();
                    }
                } catch (err) {
                    console.error('Failed to poll status', err);
                }
            }, 2500);
        }

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [activeTransfer?.id, activeTransfer?.status]);

    // Auto scroll log to bottom
    useEffect(() => {
        if (logBoxRef.current) {
            logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
        }
    }, [activeTransfer?.log]);

    const sanitizeHostAndPort = (inputHost: string, currentPort: number): { cleanHost: string; cleanPort: number } => {
        let clean = inputHost.trim();
        let p = currentPort;

        if (/^[a-zA-Z0-9+\.-]+:\/\//.test(clean)) {
            try {
                const url = new URL(clean);
                if (url.hostname) {
                    clean = url.hostname;
                    if (url.port) {
                        p = Number(url.port);
                    }
                }
            } catch {
                clean = clean.replace(/^[a-zA-Z0-9+\.-]+:\/\//, '');
            }
        }

        clean = clean.split('/')[0];

        const colonIdx = clean.lastIndexOf(':');
        if (colonIdx > 0 && !clean.includes(']')) {
            const potentialPort = clean.substring(colonIdx + 1);
            if (!isNaN(Number(potentialPort)) && Number(potentialPort) > 0) {
                p = Number(potentialPort);
                clean = clean.substring(0, colonIdx);
            }
        }

        return { cleanHost: clean, cleanPort: p };
    };

    const handleHostChange = (val: string) => {
        const { cleanHost, cleanPort } = sanitizeHostAndPort(val, port);
        setHost(cleanHost);
        if (cleanPort && cleanPort !== port) {
            setPort(cleanPort);
        }
    };

    const handleTestConnection = async () => {
        const { cleanHost, cleanPort } = sanitizeHostAndPort(host, Number(port) || 2022);
        if (!cleanHost || !username || !password) {
            addFlash({
                key: 'transfer',
                type: 'error',
                message: 'Host, port, username, and password are required to test connection.',
            });
            return;
        }

        clearFlashes('transfer');
        setTesting(true);
        setShowPreview(false);
        setTestResult(null);

        try {
            const res = await testSftpConnection(uuid, {
                host: cleanHost,
                port: cleanPort,
                username: username.trim(),
                password,
                remote_path: remotePath || '/',
            });
            setTestResult(res);
            if (res.success) {
                setShowPreview(true);
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: httpErrorToHuman(error),
            });
        } finally {
            setTesting(false);
        }
    };

    const handleStartTransfer = async () => {
        const { cleanHost, cleanPort } = sanitizeHostAndPort(host, Number(port) || 2022);
        if (!cleanHost || !username || !password) {
            addFlash({
                key: 'transfer',
                type: 'error',
                message: 'Host, port, username, and password are required to start transfer.',
            });
            return;
        }

        if (wipeExisting && direction === 'import') {
            if (
                !confirm(
                    'WARNING: You have chosen to wipe existing files on this server! All current server files will be permanently deleted before importing. Are you sure you want to continue?'
                )
            ) {
                return;
            }
        }

        clearFlashes('transfer');
        setStarting(true);

        try {
            const newTransfer = await startSftpTransfer(uuid, {
                direction,
                host: cleanHost,
                port: cleanPort,
                username: username.trim(),
                password,
                remote_path: remotePath || '/',
                wipe_existing: wipeExisting && direction === 'import',
            });
            setActiveTransfer(newTransfer);
            addFlash({
                key: 'transfer',
                type: 'success',
                message: `SFTP ${direction} transfer started successfully.`,
            });
            setPassword('');
            setTestResult(null);
        } catch (error) {
            addFlash({
                key: 'transfer',
                type: 'error',
                message: httpErrorToHuman(error),
            });
        } finally {
            setStarting(false);
        }
    };

    const handleCancelTransfer = async () => {
        if (!activeTransfer) return;

        if (!confirm('Are you sure you want to cancel this transfer? Any in-flight operations will be stopped.')) {
            return;
        }

        setCancelling(true);
        try {
            const updated = await cancelSftpTransfer(uuid, activeTransfer.id);
            setActiveTransfer(updated);
            addFlash({
                key: 'transfer',
                type: 'warning',
                message: 'Transfer cancellation requested.',
            });
            loadData();
        } catch (error) {
            addFlash({
                key: 'transfer',
                type: 'error',
                message: httpErrorToHuman(error),
            });
        } finally {
            setCancelling(false);
        }
    };

    const handleDeleteHistory = async (id: number) => {
        if (!confirm('Delete this transfer record from history?')) return;

        try {
            await deleteSftpTransfer(uuid, id);
            setHistory((prev) => prev.filter((h) => h.id !== id));
            if (activeTransfer?.id === id) {
                setActiveTransfer(null);
            }
        } catch (error) {
            addFlash({
                key: 'transfer',
                type: 'error',
                message: httpErrorToHuman(error),
            });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Pending</span>;
            case 'connecting':
                return <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-200 border border-zinc-700 animate-pulse">Connecting</span>;
            case 'transferring':
                return <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-200 border border-zinc-700 animate-pulse">Transferring</span>;
            case 'extracting':
                return <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-200 border border-zinc-700 animate-pulse">Unpacking</span>;
            case 'completed':
                return <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Completed</span>;
            case 'failed':
                return <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Failed</span>;
            case 'cancelled':
                return <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-400 border border-zinc-700">Cancelled</span>;
            default:
                return <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{status}</span>;
        }
    };

    const calculatePercentage = (t: SftpTransferRecord) => {
        if (t.status === 'completed') return 100;
        if (t.totalFiles > 0) {
            return Math.min(100, Math.round((t.transferredFiles / t.totalFiles) * 100));
        }
        return 0;
    };

    const isRunning = Boolean(
        activeTransfer &&
        !['completed', 'failed', 'cancelled'].includes(activeTransfer.status)
    );

    return (
        <ServerContentBlock title={'SFTP Transfer'}>
            <FlashMessageRender byKey={'transfer'} className="mb-4" />

            <div className="relative">
                <SpinnerOverlay visible={loading} />

                {/* Clean Native Header with Segmented Direction Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white font-sans">SFTP Server Transfer</h2>
                        <p className="text-xs text-zinc-400 mt-1 font-sans">
                            Transfer server files directly between this server and another Pterodactyl host or external SFTP server.
                        </p>
                    </div>

                    <div className="flex items-center rounded-lg bg-[#0A0A0A] border border-[#1F1F1F] p-0.5 select-none self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setDirection('import');
                                setTestResult(null);
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium font-sans transition-colors flex items-center gap-1.5 ${
                                direction === 'import'
                                    ? 'bg-[#1F1F1F] text-white shadow-xs'
                                    : 'text-[#737373] hover:text-white'
                            }`}
                        >
                            <FontAwesomeIcon icon={faDownload} className="text-xs" />
                            Import to this Server
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDirection('export');
                                setTestResult(null);
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium font-sans transition-colors flex items-center gap-1.5 ${
                                direction === 'export'
                                    ? 'bg-[#1F1F1F] text-white shadow-xs'
                                    : 'text-[#737373] hover:text-white'
                            }`}
                        >
                            <FontAwesomeIcon icon={faUpload} className="text-xs" />
                            Export to Remote Host
                        </button>
                    </div>
                </div>

                {/* Active Transfer Progress Monitor */}
                {activeTransfer && (
                    <div className="mb-6 p-5 rounded-xl bg-[#09090b] border border-[#27272a]">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-[#1c1c21]">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-xs font-mono uppercase text-zinc-500 font-semibold tracking-wider">
                                    Active Transfer:
                                </span>
                                <span className="text-zinc-200 text-xs font-mono">
                                    {activeTransfer.direction === 'import' ? 'Import from' : 'Export to'}{' '}
                                    {activeTransfer.host}:{activeTransfer.port}
                                </span>
                                {getStatusBadge(activeTransfer.status)}
                            </div>

                            <div className="flex items-center gap-2">
                                {isRunning && (
                                    <button
                                        type="button"
                                        onClick={handleCancelTransfer}
                                        disabled={cancelling}
                                        className="px-2.5 py-1 text-xs font-medium rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors disabled:opacity-50"
                                    >
                                        {cancelling ? 'Cancelling...' : 'Cancel Transfer'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setViewingLogTransfer(activeTransfer)}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-[#18181b] hover:bg-[#27272a] text-zinc-300 border border-[#27272a] transition-colors flex items-center gap-1.5"
                                >
                                    <FontAwesomeIcon icon={faTerminal} className="text-xs" />
                                    Full Logs
                                </button>
                            </div>
                        </div>

                        {/* Progress Bar & Indicators */}
                        <div className="mt-4">
                            <div className="flex justify-between items-center text-xs mb-2 font-mono">
                                <span className="text-zinc-400">
                                    {activeTransfer.currentFile
                                        ? `Processing: ${activeTransfer.currentFile}`
                                        : activeTransfer.status === 'extracting'
                                        ? 'Unpacking files on node...'
                                        : activeTransfer.status === 'completed'
                                        ? 'Transfer completed.'
                                        : 'Connecting & scanning...'}
                                </span>
                                <span className="text-zinc-200 font-semibold">
                                    {calculatePercentage(activeTransfer)}%
                                </span>
                            </div>

                            <div className="w-full bg-[#18181b] rounded-full h-1.5 overflow-hidden border border-[#27272a]">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        activeTransfer.status === 'completed' ? 'bg-emerald-500' : 'bg-white'
                                    }`}
                                    style={{ width: `${calculatePercentage(activeTransfer)}%` }}
                                />
                            </div>

                            {/* Bento Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
                                <div className="p-3 rounded-lg bg-[#121215] border border-[#222227]">
                                    <span className="text-zinc-500 font-mono uppercase text-[10px] tracking-wider block">
                                        Files
                                    </span>
                                    <span className="text-zinc-200 font-mono text-xs mt-1 block">
                                        {activeTransfer.transferredFiles} / {activeTransfer.totalFiles}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-[#121215] border border-[#222227]">
                                    <span className="text-zinc-500 font-mono uppercase text-[10px] tracking-wider block">
                                        Data
                                    </span>
                                    <span className="text-zinc-200 font-mono text-xs mt-1 block">
                                        {bytesToString(activeTransfer.transferredBytes)} / {bytesToString(activeTransfer.totalBytes)}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-[#121215] border border-[#222227]">
                                    <span className="text-zinc-500 font-mono uppercase text-[10px] tracking-wider block">
                                        Remote Path
                                    </span>
                                    <span className="text-zinc-200 font-mono text-xs mt-1 block truncate">
                                        {activeTransfer.remotePath || '/'}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-[#121215] border border-[#222227]">
                                    <span className="text-zinc-500 font-mono uppercase text-[10px] tracking-wider block">
                                        Status
                                    </span>
                                    <span className="text-zinc-200 font-mono text-xs mt-1 block capitalize">
                                        {activeTransfer.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Live Log Box */}
                        {activeTransfer.log && (
                            <div className="mt-4">
                                <pre
                                    ref={logBoxRef}
                                    className="p-3 rounded-lg bg-[#050507] border border-[#1f1f24] text-zinc-300 font-mono text-xs max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text"
                                >
                                    {activeTransfer.log}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                {/* Configuration Section: Form (Left) & This Server SFTP Details (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* Remote SFTP Form */}
                    <div className="lg:col-span-2 p-5 rounded-xl bg-[#09090b] border border-[#27272a]">
                        <div className="pb-3 mb-4 border-b border-[#27272a]">
                            <h3 className="text-sm font-semibold text-zinc-200 font-sans">
                                {direction === 'import' ? 'Remote Source SFTP' : 'Remote Destination SFTP'}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-0.5 font-sans">
                                {direction === 'import'
                                    ? 'Enter connection credentials of the server you want to copy files from.'
                                    : 'Enter connection credentials where you want to export this server.'}
                            </p>
                        </div>

                        <div className="space-y-4 font-sans">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <Label>Remote Host or IP Address</Label>
                                    <Input
                                        type="text"
                                        placeholder="e.g. sftp.otherpanel.com or 192.168.1.50"
                                        value={host}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleHostChange(e.target.value)}
                                        disabled={isRunning}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <Label>Port</Label>
                                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                            <button
                                                type="button"
                                                onClick={() => setPort(2022)}
                                                className="text-zinc-500 hover:text-zinc-200 transition-colors"
                                            >
                                                2022
                                            </button>
                                            <span className="text-zinc-700">|</span>
                                            <button
                                                type="button"
                                                onClick={() => setPort(22)}
                                                className="text-zinc-500 hover:text-zinc-200 transition-colors"
                                            >
                                                22
                                            </button>
                                        </div>
                                    </div>
                                    <Input
                                        type="number"
                                        placeholder="2022"
                                        value={port}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPort(Number(e.target.value))}
                                        disabled={isRunning}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>SFTP Username</Label>
                                    <Input
                                        type="text"
                                        placeholder="username.server_id"
                                        value={username}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                                        disabled={isRunning}
                                    />
                                    {username.trim().length > 0 && !username.includes('.') ? (
                                        <div className="mt-2 border-l-2 border-amber-500/80 pl-2.5 py-1 font-sans">
                                            <p className="text-[11px] text-amber-300/90 m-0 leading-relaxed">
                                                Pterodactyl SFTP requires the server identifier (e.g. <span className="font-mono text-amber-200">{username.trim()}.&lt;server_id&gt;</span>). Copy your exact username from the remote server&apos;s Settings &rarr; SFTP Details page.
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-zinc-500 mt-1 font-sans">
                                            For Pterodactyl panels, the username is formatted as <span className="font-mono text-zinc-400">username.server_id</span>.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label>SFTP Password</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Remote account password"
                                            value={password}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                            disabled={isRunning}
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-sm"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 mt-1 font-sans">
                                        Your panel login password for the remote server.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <Label>Remote Directory Path</Label>
                                <Input
                                    type="text"
                                    placeholder="/"
                                    value={remotePath}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemotePath(e.target.value)}
                                    disabled={isRunning}
                                />
                                <p className="text-[11px] text-zinc-500 mt-1 font-sans">
                                    Root directory on the remote server (default is <span className="font-mono text-zinc-400">/</span>).
                                </p>
                            </div>

                            {/* Clean Wipe Option (Import Only) */}
                            {direction === 'import' && (
                                <div className="p-3.5 rounded-lg bg-[#121215] border border-[#222227] flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="wipeExistingCheck"
                                        checked={wipeExisting}
                                        onChange={(e) => setWipeExisting(e.target.checked)}
                                        disabled={isRunning}
                                        className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-white cursor-pointer"
                                    />
                                    <label htmlFor="wipeExistingCheck" className="text-xs cursor-pointer select-none">
                                        <span className="text-zinc-200 font-medium block font-sans">
                                            Clean Wipe: Delete current files before importing
                                        </span>
                                        <span className="text-zinc-500 block mt-0.5 text-[11px] font-sans">
                                            All existing files and folders in this server will be deleted before migration begins.
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* Test Connection Result Alert */}
                            {testResult && (
                                <div
                                    className={`p-3 rounded-lg border text-xs leading-relaxed font-sans ${
                                        testResult.success
                                            ? 'bg-[#0d1612] border-emerald-900/40 text-emerald-300'
                                            : 'bg-[#180f11] border-rose-900/40 text-rose-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>{testResult.message}</span>
                                        {testResult.success && testResult.preview && (
                                            <button
                                                type="button"
                                                onClick={() => setShowPreview(!showPreview)}
                                                className="underline text-emerald-400 hover:text-emerald-200 ml-3 shrink-0"
                                            >
                                                {showPreview ? 'Hide Files' : `Preview Files (${testResult.file_count || 0})`}
                                            </button>
                                        )}
                                    </div>

                                    {testResult.success && showPreview && testResult.preview && (
                                        <div className="mt-2.5 pt-2.5 border-t border-emerald-900/40">
                                            <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
                                                {testResult.preview.map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between p-1 rounded bg-[#050507] text-zinc-300"
                                                    >
                                                        <span className="flex items-center gap-1.5 truncate">
                                                            <FontAwesomeIcon
                                                                icon={item.type === 'dir' ? faFolder : faFile}
                                                                className={item.type === 'dir' ? 'text-amber-400' : 'text-zinc-400'}
                                                            />
                                                            {item.name}
                                                        </span>
                                                        <span className="text-zinc-500 text-[10px] ml-2 shrink-0">
                                                            {item.type === 'dir' ? 'DIR' : item.size_formatted}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Form Action Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleTestConnection}
                                    disabled={testing || isRunning}
                                    className="px-3.5 py-2 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-200 text-xs font-medium font-sans transition-colors disabled:opacity-50"
                                >
                                    {testing ? (
                                        <span className="flex items-center gap-1.5">
                                            <FontAwesomeIcon icon={faSync} className="fa-spin text-xs" />
                                            Testing...
                                        </span>
                                    ) : (
                                        'Test Connection'
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleStartTransfer}
                                    disabled={starting || isRunning}
                                    className="px-4 py-2 rounded-md bg-white hover:bg-zinc-200 text-black text-xs font-semibold font-sans shadow-xs transition-colors disabled:opacity-50"
                                >
                                    {starting ? (
                                        <span className="flex items-center gap-1.5">
                                            <FontAwesomeIcon icon={faSync} className="fa-spin text-xs" />
                                            Starting...
                                        </span>
                                    ) : direction === 'import' ? (
                                        'Start Server Import'
                                    ) : (
                                        'Start Server Export'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: This Server's SFTP Reference */}
                    <div className="rounded-xl bg-[#09090b] border border-[#27272a] p-5 flex flex-col justify-between">
                        <div>
                            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono mb-4">
                                This Server&apos;s SFTP Details
                            </h3>
                            <div className="space-y-4 text-xs font-sans">
                                <div>
                                    <Label>Server Address</Label>
                                    <CopyOnClick text={sftpDetails ? `sftp://${ip(sftpDetails.ip)}:${sftpDetails.port}` : ''}>
                                        <Input
                                            type="text"
                                            value={sftpDetails ? `sftp://${ip(sftpDetails.ip)}:${sftpDetails.port}` : 'Loading...'}
                                            readOnly
                                        />
                                    </CopyOnClick>
                                </div>
                                <div>
                                    <Label>Username</Label>
                                    <CopyOnClick text={currentUsername && serverId ? `${currentUsername}.${serverId}` : ''}>
                                        <Input
                                            type="text"
                                            value={currentUsername && serverId ? `${currentUsername}.${serverId}` : 'Loading...'}
                                            readOnly
                                        />
                                    </CopyOnClick>
                                </div>
                                <div className="border-l-2 border-zinc-700 pl-3 py-1 mt-4">
                                    <p className="text-xs text-zinc-400 m-0 font-sans leading-relaxed">
                                        When transferring from another Pterodactyl server, look for its address and username under that server&apos;s <strong>Settings &rarr; SFTP Details</strong> tab.
                                    </p>
                                </div>
                                <div className="border-l-2 border-zinc-700 pl-3 py-1 mt-2">
                                    <p className="text-xs text-zinc-400 m-0 font-sans leading-relaxed">
                                        The SFTP password is the same password you use to log into that panel.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-[#1c1c21]">
                            <p className="text-[11px] text-zinc-500 m-0 font-sans">
                                Transfers run directly on the node daemon in the background. You can navigate away at any time.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Transfer History Table */}
                <div className="rounded-xl bg-[#09090b] border border-[#27272a] p-5">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#27272a]">
                        <h3 className="text-sm font-semibold text-zinc-200 font-sans">
                            Transfer History
                        </h3>
                        <button
                            type="button"
                            onClick={loadData}
                            className="px-2.5 py-1 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 text-xs font-medium font-sans transition-colors flex items-center gap-1.5"
                        >
                            <FontAwesomeIcon icon={faSync} className="text-xs" />
                            Refresh
                        </button>
                    </div>

                    {history.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 text-xs font-sans">
                            No previous transfers recorded for this server.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-sans">
                                <thead>
                                    <tr className="border-b border-[#27272a] text-zinc-500 font-mono uppercase text-[10px] tracking-wider">
                                        <th className="py-2 px-3">Type</th>
                                        <th className="py-2 px-3">Remote Host</th>
                                        <th className="py-2 px-3">Files / Size</th>
                                        <th className="py-2 px-3">Status</th>
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1c1c21]">
                                    {history.map((t) => (
                                        <tr key={t.id} className="hover:bg-[#121215] transition-colors">
                                            <td className="py-2.5 px-3 font-medium text-zinc-200">
                                                {t.direction === 'import' ? 'Import' : 'Export'}
                                            </td>
                                            <td className="py-2.5 px-3 text-zinc-300 font-mono">
                                                {t.host}:{t.port}
                                            </td>
                                            <td className="py-2.5 px-3 text-zinc-400 font-mono">
                                                {t.transferredFiles > 0
                                                    ? `${t.transferredFiles} files (${bytesToString(t.transferredBytes)})`
                                                    : '—'}
                                            </td>
                                            <td className="py-2.5 px-3">{getStatusBadge(t.status)}</td>
                                            <td className="py-2.5 px-3 text-zinc-400 font-mono">
                                                {t.startedAt ? new Date(t.startedAt).toLocaleString() : '—'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewingLogTransfer(t)}
                                                        className="p-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 transition-colors"
                                                        title="View Log"
                                                    >
                                                        <FontAwesomeIcon icon={faTerminal} className="text-xs" />
                                                    </button>
                                                    {!['pending', 'connecting', 'transferring', 'extracting'].includes(
                                                        t.status
                                                    ) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteHistory(t.id)}
                                                            className="p-1.5 rounded bg-[#18181b] hover:bg-rose-900/30 border border-[#27272a] text-zinc-400 hover:text-rose-300 transition-colors"
                                                            title="Delete Record"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Viewing Full Log */}
            {viewingLogTransfer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
                    <div className="w-full max-w-3xl rounded-xl bg-[#09090b] border border-[#27272a] shadow-2xl p-5 flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
                            <div className="flex items-center gap-2.5">
                                <h3 className="text-sm font-semibold text-zinc-200 font-sans">
                                    Transfer #{viewingLogTransfer.id} Log Output
                                </h3>
                                {getStatusBadge(viewingLogTransfer.status)}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        copy(viewingLogTransfer.log || 'No logs available.');
                                        setCopiedLog(true);
                                        setTimeout(() => setCopiedLog(false), 2000);
                                    }}
                                    className="px-2.5 py-1 text-xs rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 transition-colors flex items-center gap-1.5"
                                >
                                    <FontAwesomeIcon icon={copiedLog ? faCheck : faCopy} className="text-xs" />
                                    {copiedLog ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewingLogTransfer(null)}
                                    className="text-zinc-400 hover:text-zinc-200 text-base ml-2 px-1"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div className="mt-3.5 flex-1 overflow-hidden flex flex-col">
                            <pre className="p-3.5 rounded-lg bg-[#050507] border border-[#1f1f24] text-zinc-300 font-mono text-xs overflow-y-auto whitespace-pre-wrap leading-relaxed flex-1 select-text">
                                {viewingLogTransfer.log || 'No logs recorded for this transfer.'}
                            </pre>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#27272a] flex justify-end">
                            <button
                                type="button"
                                onClick={() => setViewingLogTransfer(null)}
                                className="px-3 py-1.5 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 text-xs font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ServerContentBlock>
    );
};
