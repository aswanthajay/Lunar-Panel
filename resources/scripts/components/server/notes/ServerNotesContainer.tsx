import React, { useEffect, useState, useRef } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { Button } from '@/components/elements/button/index';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import {
    getServerNotes,
    saveServerNotes,
    saveAdminScratchpad,
    ServerNotesAuthor,
} from '@/api/server/notes';
import { httpErrorToHuman } from '@/api/http';
import { format, formatDistanceToNow } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faStickyNote,
    faUserShield,
    faSave,
    faCopy,
    faCheck,
    faEye,
    faEdit,
    faTasks,
    faListUl,
    faCode,
    faHeading,
    faShieldAlt,
} from '@fortawesome/free-solid-svg-icons';
import copy from 'copy-to-clipboard';
import tw from 'twin.macro';

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'shared' | 'admin'>('shared');
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');

    // Shared Notes State
    const [notes, setNotes] = useState('');
    const [savedNotes, setSavedNotes] = useState('');
    const [notesUpdatedAt, setNotesUpdatedAt] = useState<string | null>(null);
    const [notesAuthor, setNotesAuthor] = useState<ServerNotesAuthor | null>(null);

    // Admin Scratchpad State
    const [adminNotes, setAdminNotes] = useState('');
    const [savedAdminNotes, setSavedAdminNotes] = useState('');
    const [adminUpdatedAt, setAdminUpdatedAt] = useState<string | null>(null);
    const [adminAuthor, setAdminAuthor] = useState<ServerNotesAuthor | null>(null);

    const [isAdmin, setIsAdmin] = useState(false);
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const sharedTextAreaRef = useRef<HTMLTextAreaElement>(null);
    const adminTextAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setLoading(true);
        getServerNotes(uuid)
            .then((data) => {
                const fetchedNotes = data.notes || '';
                setNotes(fetchedNotes);
                setSavedNotes(fetchedNotes);
                setNotesUpdatedAt(data.updated_at);
                setNotesAuthor(data.updated_by);

                setIsAdmin(Boolean(data.is_admin));

                if (data.is_admin && data.admin_notes !== undefined) {
                    const fetchedAdmin = data.admin_notes || '';
                    setAdminNotes(fetchedAdmin);
                    setSavedAdminNotes(fetchedAdmin);
                    setAdminUpdatedAt(data.admin_updated_at || null);
                    setAdminAuthor(data.admin_updated_by || null);
                }
            })
            .catch((err) => {
                console.error(err);
                setFeedback({ type: 'error', text: httpErrorToHuman(err) });
            })
            .finally(() => setLoading(false));
    }, [uuid]);

    // Handle Ctrl+S / Cmd+S
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.code === 'KeyS')) {
                e.preventDefault();
                if (activeTab === 'shared') {
                    handleSaveShared();
                } else if (isAdmin) {
                    handleSaveAdmin();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, notes, adminNotes, isAdmin]);

    const handleSaveShared = () => {
        setSaving(true);
        setFeedback(null);
        saveServerNotes(uuid, notes)
            .then((res) => {
                setSavedNotes(res.notes);
                setNotesUpdatedAt(res.updated_at);
                setNotesAuthor(res.updated_by);
                setFeedback({ type: 'success', text: 'Server notes saved successfully.' });
            })
            .catch((err) => {
                setFeedback({ type: 'error', text: httpErrorToHuman(err) });
            })
            .finally(() => setSaving(false));
    };

    const handleSaveAdmin = () => {
        setSaving(true);
        setFeedback(null);
        saveAdminScratchpad(uuid, adminNotes)
            .then((res) => {
                setSavedAdminNotes(res.admin_notes);
                setAdminUpdatedAt(res.admin_updated_at);
                setAdminAuthor(res.admin_updated_by);
                setFeedback({ type: 'success', text: 'Admin scratchpad saved successfully.' });
            })
            .catch((err) => {
                setFeedback({ type: 'error', text: httpErrorToHuman(err) });
            })
            .finally(() => setSaving(false));
    };

    const handleCopy = () => {
        const textToCopy = activeTab === 'shared' ? notes : adminNotes;
        copy(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const insertSnippet = (snippet: string) => {
        const textarea = activeTab === 'shared' ? sharedTextAreaRef.current : adminTextAreaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = activeTab === 'shared' ? notes : adminNotes;
        const newText = currentText.substring(0, start) + snippet + currentText.substring(end);

        if (activeTab === 'shared') {
            setNotes(newText);
        } else {
            setAdminNotes(newText);
        }

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + snippet.length, start + snippet.length);
        }, 50);
    };

    const insertTemplate = (type: 'rules' | 'maintenance' | 'checklist') => {
        let template = '';
        if (type === 'rules') {
            template = `\n## 📜 Server Rules & Guidelines\n1. Respect server resource limits (CPU / RAM).\n2. Schedule heavy backups outside peak player hours.\n3. Verify all mod updates in staging before production.\n`;
        } else if (type === 'maintenance') {
            template = `\n## 🛠️ Maintenance Schedule\n- Date: ${format(new Date(), 'yyyy-MM-dd')}\n- Purpose: Routine restart & plugin updates\n- Estimated Downtime: 10 minutes\n- Status: Pending\n`;
        } else if (type === 'checklist') {
            template = `\n### ✅ Task Checklist\n- [ ] Backup game world and player database\n- [ ] Update server jar file\n- [ ] Verify port allocations and firewall\n- [ ] Test player connections\n`;
        }
        insertSnippet(template);
    };

    const activeText = activeTab === 'shared' ? notes : adminNotes;
    const isDirty = activeTab === 'shared' ? notes !== savedNotes : adminNotes !== savedAdminNotes;
    const charCount = activeText.length;
    const wordCount = activeText.trim() ? activeText.trim().split(/\s+/).length : 0;

    const renderMarkdownPreview = (content: string) => {
        if (!content.trim()) {
            return (
                <div className="text-neutral-500 italic p-6 text-center text-sm">
                    Nothing to preview. Start typing in Edit mode.
                </div>
            );
        }

        const lines = content.split('\n');
        return (
            <div className="p-4 space-y-2 text-sm text-neutral-200 leading-relaxed font-sans">
                {lines.map((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('### ')) {
                        return <h3 key={idx} className="text-base font-bold text-white mt-3 mb-1">{trimmed.substring(4)}</h3>;
                    }
                    if (trimmed.startsWith('## ')) {
                        return <h2 key={idx} className="text-lg font-bold text-white border-b border-neutral-800 pb-1 mt-4 mb-2">{trimmed.substring(3)}</h2>;
                    }
                    if (trimmed.startsWith('# ')) {
                        return <h1 key={idx} className="text-xl font-bold text-white border-b border-neutral-700 pb-1 mt-4 mb-2">{trimmed.substring(2)}</h1>;
                    }
                    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
                        return (
                            <div key={idx} className="flex items-center space-x-2 text-neutral-400 line-through">
                                <input type="checkbox" checked readOnly className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 pointer-events-none" />
                                <span>{trimmed.substring(6)}</span>
                            </div>
                        );
                    }
                    if (trimmed.startsWith('- [ ] ')) {
                        return (
                            <div key={idx} className="flex items-center space-x-2 text-neutral-200">
                                <input type="checkbox" checked={false} readOnly className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 pointer-events-none" />
                                <span>{trimmed.substring(6)}</span>
                            </div>
                        );
                    }
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                        return (
                            <li key={idx} className="ml-4 list-disc text-neutral-300">
                                {trimmed.substring(2)}
                            </li>
                        );
                    }
                    if (trimmed.startsWith('```')) {
                        return <div key={idx} className="font-mono text-xs bg-neutral-950 p-2 rounded border border-neutral-800 text-cyan-300 my-1">{trimmed}</div>;
                    }
                    if (!trimmed) {
                        return <div key={idx} className="h-2" />;
                    }
                    return <p key={idx} className="m-0 text-neutral-300">{line}</p>;
                })}
            </div>
        );
    };

    return (
        <ServerContentBlock title={'Notes & Scratchpad'}>
            <div className="relative">
                <SpinnerOverlay visible={loading || saving} />

                {/* Top Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800">
                    <div className="flex items-center space-x-2">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('shared');
                                setMode('edit');
                            }}
                            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'shared'
                                    ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                            }`}
                        >
                            <FontAwesomeIcon icon={faStickyNote} className={activeTab === 'shared' ? 'text-cyan-400' : 'text-neutral-500'} />
                            <span>Server Notes</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 font-mono">Shared</span>
                        </button>

                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('admin');
                                    setMode('edit');
                                }}
                                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === 'admin'
                                        ? 'bg-amber-950/40 text-amber-200 border border-amber-600/50 shadow-sm'
                                        : 'text-neutral-400 hover:text-amber-300 hover:bg-neutral-900'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUserShield} className={activeTab === 'admin' ? 'text-amber-400' : 'text-neutral-500'} />
                                <span>Admin Scratchpad</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 font-mono">Staff Only</span>
                            </button>
                        )}
                    </div>

                    {/* Right action controls */}
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-xs">
                            <button
                                type="button"
                                onClick={() => setMode('edit')}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                    mode === 'edit' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                                }`}
                            >
                                <FontAwesomeIcon icon={faEdit} className="mr-1 text-[11px]" />
                                Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('preview')}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                    mode === 'preview' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                                }`}
                            >
                                <FontAwesomeIcon icon={faEye} className="mr-1 text-[11px]" />
                                Preview
                            </button>
                        </div>

                        <Button.Text
                            variant={Button.Variants.Secondary}
                            onClick={handleCopy}
                            type={'button'}
                            css={tw`text-xs py-1.5`}
                            title="Copy to clipboard"
                        >
                            <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-emerald-400 mr-1.5' : 'mr-1.5'} />
                            {copied ? 'Copied' : 'Copy'}
                        </Button.Text>

                        <Button
                            onClick={activeTab === 'shared' ? handleSaveShared : handleSaveAdmin}
                            type={'button'}
                            disabled={!isDirty || saving}
                            css={tw`text-xs py-1.5`}
                            title="Save changes (Ctrl+S)"
                        >
                            <FontAwesomeIcon icon={faSave} className="mr-1.5" />
                            Save
                        </Button>
                    </div>
                </div>

                {/* Feedback message banner */}
                {feedback && (
                    <div
                        className={`p-3 rounded-lg mb-4 text-xs font-medium border flex items-center justify-between ${
                            feedback.type === 'success'
                                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                                : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                        }`}
                    >
                        <span>{feedback.text}</span>
                        <button type="button" onClick={() => setFeedback(null)} className="text-neutral-400 hover:text-white ml-2 text-sm font-bold">
                            ✕
                        </button>
                    </div>
                )}

                {/* Subtitle / Scope Notice */}
                <div className="mb-3 flex items-center justify-between">
                    {activeTab === 'shared' ? (
                        <p className="text-xs text-neutral-400 m-0 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span>
                            <span>
                                Shared with server owner and subusers. Great for to-do items, mod configs, and team notes.
                            </span>
                        </p>
                    ) : (
                        <p className="text-xs text-amber-300/90 m-0 flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faShieldAlt} className="text-amber-400" />
                            <span>
                                Private Staff Scratchpad — Strictly hidden from server owners and subusers.
                            </span>
                        </p>
                    )}

                    <div className="flex items-center space-x-2 text-[11px] font-mono">
                        {isDirty ? (
                            <span className="inline-flex items-center text-amber-400 bg-amber-950/40 border border-amber-600/30 px-2 py-0.5 rounded">
                                ● Unsaved changes
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-emerald-400 bg-emerald-950/40 border border-emerald-600/30 px-2 py-0.5 rounded">
                                ✓ All saved
                            </span>
                        )}
                        <span className="text-neutral-500 hidden sm:inline">Ctrl+S to save</span>
                    </div>
                </div>

                {/* Snippets Toolbar (Visible in Edit mode) */}
                {mode === 'edit' && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-2 p-2 bg-neutral-900/60 rounded-lg border border-neutral-800 text-xs">
                        <span className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wider mr-1 select-none">
                            Snippets:
                        </span>
                        <button
                            type="button"
                            onClick={() => insertSnippet('### ')}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition-colors"
                            title="Insert Heading"
                        >
                            <FontAwesomeIcon icon={faHeading} className="mr-1 text-[10px]" />
                            Heading
                        </button>
                        <button
                            type="button"
                            onClick={() => insertSnippet('- [ ] ')}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition-colors"
                            title="Insert Task Checkbox"
                        >
                            <FontAwesomeIcon icon={faTasks} className="mr-1 text-[10px]" />
                            Task
                        </button>
                        <button
                            type="button"
                            onClick={() => insertSnippet('- ')}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition-colors"
                            title="Insert Bullet List"
                        >
                            <FontAwesomeIcon icon={faListUl} className="mr-1 text-[10px]" />
                            List
                        </button>
                        <button
                            type="button"
                            onClick={() => insertSnippet('```\n\n```')}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition-colors"
                            title="Insert Code Block"
                        >
                            <FontAwesomeIcon icon={faCode} className="mr-1 text-[10px]" />
                            Code
                        </button>

                        <span className="h-4 w-px bg-neutral-800 mx-1"></span>

                        <button
                            type="button"
                            onClick={() => insertTemplate('checklist')}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-cyan-300 hover:text-cyan-200 text-xs transition-colors"
                        >
                            + Checklist
                        </button>
                        <button
                            type="button"
                            onClick={() => insertTemplate('maintenance')}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-300 hover:text-amber-200 text-xs transition-colors"
                        >
                            + Maintenance Log
                        </button>
                        <button
                            type="button"
                            onClick={() => insertTemplate('rules')}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-emerald-300 hover:text-emerald-200 text-xs transition-colors"
                        >
                            + Server Rules
                        </button>
                    </div>
                )}

                {/* Main Content Area */}
                <div
                    className={`rounded-lg border overflow-hidden transition-colors ${
                        activeTab === 'shared'
                            ? 'border-neutral-800 bg-[#0d0e12]'
                            : 'border-amber-700/40 bg-[#100c06]'
                    }`}
                >
                    {mode === 'edit' ? (
                        activeTab === 'shared' ? (
                            <textarea
                                ref={sharedTextAreaRef}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Type server notes, reminders, mod configurations, or checklists here... (supports Markdown formatting)"
                                rows={18}
                                className="w-full p-4 bg-transparent text-neutral-100 placeholder-neutral-600 font-mono text-xs sm:text-sm border-none outline-none resize-y min-h-[380px] focus:ring-0 leading-relaxed"
                            />
                        ) : (
                            <textarea
                                ref={adminTextAreaRef}
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Enter private staff notes, customer communication records, node flags, or investigation logs here... (Only panel administrators can view this)"
                                rows={18}
                                className="w-full p-4 bg-transparent text-amber-100 placeholder-amber-700/50 font-mono text-xs sm:text-sm border-none outline-none resize-y min-h-[380px] focus:ring-0 leading-relaxed"
                            />
                        )
                    ) : (
                        <div className="min-h-[380px] max-h-[600px] overflow-y-auto">
                            {renderMarkdownPreview(activeText)}
                        </div>
                    )}

                    {/* Bottom Status Bar */}
                    <div
                        className={`px-4 py-2.5 border-t flex flex-wrap items-center justify-between text-xs font-mono select-none ${
                            activeTab === 'shared'
                                ? 'border-neutral-800/80 bg-neutral-900/40 text-neutral-400'
                                : 'border-amber-800/30 bg-amber-950/20 text-amber-400/80'
                        }`}
                    >
                        <div className="flex items-center space-x-3">
                            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                            <span className="text-neutral-600">•</span>
                            <span>{charCount} characters</span>
                        </div>

                        <div>
                            {activeTab === 'shared' ? (
                                notesUpdatedAt && notesAuthor ? (
                                    <span>
                                        Last edited by <strong className="text-neutral-200">{notesAuthor.name || notesAuthor.username}</strong>{' '}
                                        {formatDistanceToNow(new Date(notesUpdatedAt), { addSuffix: true })}
                                    </span>
                                ) : (
                                    <span className="text-neutral-500 italic">No previous edits recorded</span>
                                )
                            ) : adminUpdatedAt && adminAuthor ? (
                                <span>
                                    Staff record updated by <strong className="text-amber-200">{adminAuthor.name || adminAuthor.username}</strong>{' '}
                                    {formatDistanceToNow(new Date(adminUpdatedAt), { addSuffix: true })}
                                </span>
                            ) : (
                                <span className="text-amber-600/70 italic">No admin notes recorded</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ServerContentBlock>
    );
};
