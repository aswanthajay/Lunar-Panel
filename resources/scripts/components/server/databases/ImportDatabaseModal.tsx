import React, { useRef, useState } from 'react';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import { ServerDatabase } from '@/api/server/databases/getServerDatabases';
import { ServerContext } from '@/state/server';
import { importDatabase } from '@/api/server/databases/databaseManagement';
import { httpErrorToHuman } from '@/api/http';
import { bytesToString } from '@/lib/formatters';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faUpload, faExclamationTriangle, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import tw from 'twin.macro';

interface Props {
    database: ServerDatabase;
    visible: boolean;
    onDismissed: () => void;
    onSuccess?: () => void;
}

export default ({ database, visible, onDismissed, onSuccess }: Props) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const resetState = () => {
        setFile(null);
        setSubmitting(false);
        setUploadProgress(0);
        setError(null);
        setSuccessMessage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selected = e.target.files[0];
            const name = selected.name.toLowerCase();
            if (!name.endsWith('.sql') && !name.endsWith('.gz') && !name.endsWith('.txt')) {
                setError('Invalid file format. Please choose a .sql or .sql.gz file.');
                setFile(null);
                return;
            }
            setError(null);
            setFile(selected);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (submitting) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const selected = e.dataTransfer.files[0];
            const name = selected.name.toLowerCase();
            if (!name.endsWith('.sql') && !name.endsWith('.gz') && !name.endsWith('.txt')) {
                setError('Invalid file format. Please drop a .sql or .sql.gz file.');
                setFile(null);
                return;
            }
            setError(null);
            setFile(selected);
        }
    };

    const handleImport = async () => {
        if (!file) {
            setError('Please select a .sql or .sql.gz file to import.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);
        setUploadProgress(0);

        try {
            const res = await importDatabase(uuid, database.id, file, (progressEvent) => {
                if (progressEvent.total) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percent);
                }
            });

            setSuccessMessage(res.message || 'Database imported successfully!');
            setTimeout(() => {
                if (onSuccess) onSuccess();
            }, 1500);
        } catch (err: any) {
            console.error(err);
            setError(httpErrorToHuman(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            visible={visible}
            dismissable={!submitting}
            showSpinnerOverlay={submitting && uploadProgress === 100}
            onDismissed={() => {
                resetState();
                onDismissed();
            }}
        >
            <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded bg-cyan-500/10 text-cyan-400">
                    <FontAwesomeIcon icon={faFileImport} className="text-xl" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-neutral-100">Import SQL Database</h2>
                    <p className="text-xs text-neutral-400">Target database: <strong className="text-neutral-200 font-mono">{database.name}</strong></p>
                </div>
            </div>

            <div className="p-3 mb-4 rounded bg-amber-950/40 border border-amber-500/40 flex items-start space-x-2 text-xs text-amber-300">
                <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5 text-amber-400 flex-shrink-0" />
                <span>
                    Importing an SQL dump will execute commands against this database. Existing tables and records may be overwritten or modified. Please make sure you have a backup before proceeding.
                </span>
            </div>

            {error && (
                <div className="p-3 mb-4 rounded bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="p-3 mb-4 rounded bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-300 flex items-center space-x-2">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-400" />
                    <span>{successMessage}</span>
                </div>
            )}

            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                    file
                        ? 'border-cyan-500/60 bg-cyan-950/20'
                        : 'border-neutral-700 hover:border-neutral-500 bg-neutral-900/50'
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql,.gz,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={submitting}
                />
                <FontAwesomeIcon icon={faUpload} className="text-2xl text-neutral-400 mb-2" />
                {file ? (
                    <div>
                        <p className="text-sm font-medium text-neutral-100">{file.name}</p>
                        <p className="text-xs text-neutral-400">{bytesToString(file.size)}</p>
                        <p className="text-[11px] text-cyan-400 mt-1">Click or drop another file to replace</p>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm font-medium text-neutral-200">Click to browse or drag &amp; drop a file here</p>
                        <p className="text-xs text-neutral-500 mt-1">Supported formats: .sql, .sql.gz (up to 100MB)</p>
                    </div>
                )}
            </div>

            {submitting && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-neutral-400 mb-1">
                        <span>{uploadProgress < 100 ? 'Uploading SQL file...' : 'Executing SQL statements...'}</span>
                        <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-cyan-500 h-2 transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="mt-6 flex items-center justify-end space-x-3">
                <Button
                    type="button"
                    isSecondary
                    disabled={submitting}
                    onClick={() => {
                        resetState();
                        onDismissed();
                    }}
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    disabled={!file || submitting || !!successMessage}
                    onClick={handleImport}
                >
                    {submitting ? 'Importing...' : 'Start Import'}
                </Button>
            </div>
        </Modal>
    );
};
