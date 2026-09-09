import React, { useState } from 'react';
import Modal from '@/components/elements/Modal';
import { ServerDatabase } from '@/api/server/databases/getServerDatabases';
import { ServerContext } from '@/state/server';
import { executeDatabaseQuery, DatabaseQueryResponse } from '@/api/server/databases/databaseManagement';
import Button from '@/components/elements/Button';

interface Props {
    database: ServerDatabase;
    visible: boolean;
    onDismissed: () => void;
}

const TEMPLATES = [
    { label: 'SHOW TABLES', query: 'SHOW FULL TABLES;' },
    { label: 'TABLE SIZES', query: 'SELECT table_name AS Table, ROUND((data_length + index_length) / 1024 / 1024, 2) AS Size_MB FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY (data_length + index_length) DESC;' },
    { label: 'PROCESSLIST', query: 'SHOW PROCESSLIST;' },
    { label: 'STATUS', query: "SHOW STATUS LIKE 'Uptime%';" },
];

export const SqlConsoleModal: React.FC<Props> = ({ database, visible, onDismissed }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [query, setQuery] = useState('SHOW FULL TABLES;');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<DatabaseQueryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleExecute = () => {
        if (!query.trim() || running) return;
        setRunning(true);
        setError(null);
        setResult(null);

        executeDatabaseQuery(uuid, database.id, query)
            .then((res) => {
                if (res.success) {
                    setResult(res);
                } else {
                    setError(res.message || 'Query execution failed.');
                }
            })
            .catch((err) => {
                setError(err.response?.data?.message || err.message || 'An error occurred while running the query.');
            })
            .finally(() => setRunning(false));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleExecute();
        }
    };

    return (
        <Modal visible={visible} onDismissed={onDismissed} showSpinnerOverlay={false}>
            <div className="w-full max-w-4xl p-2">
                <div className="flex items-center justify-between pb-4 border-b border-[#1F1F1F]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-medium text-white tracking-tight">SQL Console</h3>
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#141414] text-neutral-400 border border-[#1F1F1F]">
                                    {database.name}
                                </span>
                            </div>
                            <p className="text-xs text-neutral-500">Run queries directly against your database instance</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onDismissed}
                        className="text-neutral-500 hover:text-white p-1 rounded-md transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex items-center gap-1.5 py-3 overflow-x-auto select-none">
                    <span className="text-[11px] text-neutral-500 font-mono mr-1">Quick:</span>
                    {TEMPLATES.map((tmpl) => (
                        <button
                            key={tmpl.label}
                            type="button"
                            onClick={() => setQuery(tmpl.query)}
                            className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#141414] text-neutral-400 hover:text-white border border-[#1F1F1F] transition-colors shrink-0"
                        >
                            {tmpl.label}
                        </button>
                    ))}
                </div>

                <div className="relative rounded-lg overflow-hidden border border-[#1F1F1F] bg-[#050505] focus-within:border-emerald-500/50 transition-colors">
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={4}
                        placeholder="Enter SQL statement (e.g. SELECT * FROM users LIMIT 10;)..."
                        className="w-full bg-transparent p-3 text-xs font-mono text-neutral-200 placeholder-neutral-600 resize-y focus:outline-hidden leading-relaxed"
                    />
                    <div className="flex items-center justify-between px-3 py-2 bg-[#0A0A0A] border-t border-[#141414] text-[11px] text-neutral-500">
                        <span className="font-mono">Press Ctrl + Enter to run</span>
                        <div className="flex items-center gap-2">
                            {result?.execution_ms !== undefined && (
                                <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                    {result.execution_ms} ms
                                </span>
                            )}
                            <Button
                                type="button"
                                size="small"
                                disabled={running || !query.trim()}
                                onClick={handleExecute}
                                className="flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{running ? 'Executing...' : 'Run Query'}</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-mono">
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="break-all">{error}</span>
                        </div>
                    </div>
                )}

                {result && (
                    <div className="mt-3">
                        {result.type === 'execute' ? (
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono">
                                Query executed successfully. Affected rows: {result.affected_rows ?? 0} ({result.execution_ms} ms)
                            </div>
                        ) : result.columns && result.columns.length > 0 ? (
                            <div className="rounded-lg border border-[#1F1F1F] bg-[#050505] overflow-hidden">
                                <div className="px-3 py-2 bg-[#0A0A0A] border-b border-[#141414] flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                                    <span>{result.row_count} rows returned</span>
                                    <span>Capped to 100 max</span>
                                </div>
                                <div className="max-h-72 overflow-auto custom-scrollbar">
                                    <table className="w-full text-left text-xs font-mono border-collapse">
                                        <thead className="bg-[#0A0A0A] sticky top-0 z-10">
                                            <tr>
                                                {result.columns.map((col) => (
                                                    <th
                                                        key={col}
                                                        className="px-3 py-2 border-b border-[#1F1F1F] text-neutral-300 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap"
                                                    >
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#141414]">
                                            {result.rows && result.rows.length > 0 ? (
                                                result.rows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                                        {result.columns!.map((col) => (
                                                            <td
                                                                key={col}
                                                                className="px-3 py-1.5 text-neutral-300 truncate max-w-xs whitespace-nowrap"
                                                                title={String(row[col] ?? 'NULL')}
                                                            >
                                                                {row[col] === null ? (
                                                                    <span className="text-neutral-600 italic">NULL</span>
                                                                ) : (
                                                                    String(row[col])
                                                                )}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td
                                                        colSpan={result.columns.length}
                                                        className="px-3 py-4 text-center text-neutral-500 italic"
                                                    >
                                                        Empty set (0 rows)
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 rounded-lg bg-[#0A0A0A] border border-[#1F1F1F] text-xs text-neutral-400 font-mono text-center">
                                Query returned empty result set.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
