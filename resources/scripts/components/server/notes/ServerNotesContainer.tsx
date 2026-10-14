import React, { useEffect, useState, useRef } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
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
            template = `\n## Server Rules & Guidelines\n1. Respect server resource limits (CPU / RAM).\n2. Schedule heavy backups outside peak player hours.\n3. Verify all mod updates in staging before production.\n`;
        } else if (type === 'maintenance') {
            template = `\n## Maintenance Schedule\n- Date: ${format(new Date(), 'yyyy-MM-dd')}\n- Purpose: Routine restart & plugin updates\n- Estimated Downtime: 10 minutes\n- Status: Pending\n`;
        } else if (type === 'checklist') {
            template = `\n### Task Checklist\n- [ ] Backup game world and player database\n- [ ] Update server jar file\n- [ ] Verify port allocations and firewall\n- [ ] Test player connections\n`;
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
                <div className="text-[#737373] italic p-6 text-center text-sm">
                    Nothing to preview. Start typing in Edit mode.
                </div>
            );
        }

        const lines = content.split('\n');
        return (
            <div className="p-4 space-y-2 text-sm text-[#EDEDED] leading-relaxed font-sans bg-[#050505]">
                {lines.map((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('### ')) {
                        return <h3 key={idx} className="text-base font-bold text-white mt-3 mb-1">{trimmed.substring(4)}</h3>;
                    }
                    if (trimmed.startsWith('## ')) {
                        return <h2 key={idx} className="text-lg font-bold text-white border-b border-[#1F1F1F] pb-1 mt-4 mb-2">{trimmed.substring(3)}</h2>;
                    }
                    if (trimmed.startsWith('# ')) {
                        return <h1 key={idx} className="text-xl font-bold text-white border-b border-[#1F1F1F] pb-1 mt-4 mb-2">{trimmed.substring(2)}</h1>;
                    }
                    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
                        return (
                            <div key={idx} className="flex items-center space-x-2 text-[#737373] line-through">
                                <input type="checkbox" checked readOnly className="rounded border-[#242424] bg-[#111111] text-white pointer-events-none" />
                                <span>{trimmed.substring(6)}</span>
                            </div>
                        );
                    }
                    if (trimmed.startsWith('- [ ] ')) {
                        return (
                            <div key={idx} className="flex items-center space-x-2 text-[#EDEDED]">
                                <input type="checkbox" checked={false} readOnly className="rounded border-[#242424] bg-[#111111] text-white pointer-events-none" />
                                <span>{trimmed.substring(6)}</span>
                            </div>
                        );
                    }
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                        return (
                            <li key={idx} className="ml-4 list-disc text-[#A0A0A0]">
                                {trimmed.substring(2)}
                            </li>
                        );
                    }
                    if (trimmed.startsWith('```')) {
                        return <div key={idx} className="font-mono text-xs bg-[#111111] p-2 rounded border border-[#242424] text-[#EDEDED] my-1">{trimmed}</div>;
                    }
                    if (!trimmed) {
                        return <div key={idx} className="h-2" />;
                    }
                    return <p key={idx} className="m-0 text-[#A0A0A0]">{line}</p>;
                })}
            </div>
        );
    };

    return (
        <ServerContentBlock title={'Notes & Scratchpad'}>
            <div className="relative">
                <SpinnerOverlay visible={loading || saving} />

                {/* Top Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#1F1F1F]">
                    <div className="flex items-center space-x-2">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('shared');
                                setMode('edit');
                            }}
                            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'shared'
                                    ? 'bg-white text-black shadow-sm'
                                    : 'bg-[#111111] text-[#A0A0A0] hover:text-white border border-[#242424]'
                            }`}
                        >
                            <FontAwesomeIcon icon={faStickyNote} className={activeTab === 'shared' ? 'text-black' : 'text-[#737373]'} />
                            <span>Server Notes</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${activeTab === 'shared' ? 'bg-black/10 text-black' : 'bg-[#1A1A1A] text-[#737373]'}`}>Shared</span>
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
                                        ? 'bg-[#1C1C1C] text-white border border-[#333333] shadow-sm'
                                        : 'bg-[#111111] text-[#A0A0A0] hover:text-white border border-[#242424]'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUserShield} className={activeTab === 'admin' ? 'text-white' : 'text-[#737373]'} />
                                <span>Admin Scratchpad</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#242424] text-[#A0A0A0] font-mono">Staff Only</span>
                            </button>
                        )}
                    </div>

                    {/* Right action controls */}
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center bg-[#0A0A0A] p-0.5 rounded-lg border border-[#1F1F1F] text-xs">
                            <button
                                type="button"
                                onClick={() => setMode('edit')}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                                    mode === 'edit' ? 'bg-[#1C1C1C] text-white' : 'text-[#737373] hover:text-white'
                                }`}
                            >
                                <FontAwesomeIcon icon={faEdit} className="mr-1 text-[11px]" />
                                Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('preview')}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                                    mode === 'preview' ? 'bg-[#1C1C1C] text-white' : 'text-[#737373] hover:text-white'
                                }`}
                            >
                                <FontAwesomeIcon icon={faEye} className="mr-1 text-[11px]" />
                                Preview
                            </button>
                        </div>

                        <button
                            onClick={handleCopy}
                            type={'button'}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[#242424] bg-[#111111] hover:bg-[#1A1A1A] text-[#EDEDED] transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Copy to clipboard"
                        >
                            <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-white mr-1' : 'mr-1'} />
                            {copied ? 'Copied' : 'Copy'}
                        </button>

                        <button
                            onClick={activeTab === 'shared' ? handleSaveShared : handleSaveAdmin}
                            type={'button'}
                            disabled={!isDirty || saving}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#E5E5E5] disabled:bg-[#111111] disabled:text-[#737373] text-black transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                            title="Save changes (Ctrl+S)"
                        >
                            <FontAwesomeIcon icon={faSave} className="mr-1" />
                            Save
                        </button>
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
                        <button type="button" onClick={() => setFeedback(null)} className="text-[#737373] hover:text-white ml-2 text-sm font-bold">
                            ✕
                        </button>
                    </div>
                )}

                {/* Subtitle / Scope Notice */}
                <div className="mb-3 flex items-center justify-between">
                    {activeTab === 'shared' ? (
                        <p className="text-xs text-[#A0A0A0] m-0 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-white inline-block"></span>
                            <span>
                                Shared with server owner and subusers. Great for to-do items, mod configs, and team notes.
                            </span>
                        </p>
                    ) : (
                        <p className="text-xs text-[#A0A0A0] m-0 flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faShieldAlt} className="text-[#EDEDED]" />
                            <span>
                                Private Staff Scratchpad — Strictly hidden from server owners and subusers.
                            </span>
                        </p>
                    )}

                    <div className="flex items-center space-x-2 text-[11px] font-mono">
                        {isDirty ? (
                            <span className="inline-flex items-center text-[#EDEDED] bg-[#141414] border border-[#262626] px-2 py-0.5 rounded">
                                ● Unsaved changes
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-[#A0A0A0] bg-[#111111] border border-[#242424] px-2 py-0.5 rounded">
                                ✓ All saved
                            </span>
                        )}
                        <span className="text-[#737373] hidden sm:inline">Ctrl+S to save</span>
                    </div>
                </div>

                {/* Snippets Toolbar (Visible in Edit mode) */}
                {mode === 'edit' && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-2 p-2 bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] text-xs">
                        <span className="text-[11px] text-[#737373] font-semibold uppercase tracking-wider mr-1 select-none">
                            Snippets:
                        </span>
                        <button
                            type="button"
                            onClick={() => insertSnippet('### ')}
                            className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#1A1A1A] border border-[#242424] text-[#EDEDED] hover:text-white text-xs transition-colors"
                            title="Insert Heading"
                        >
                            <FontAwesomeIcon icon={faHeading} className="mr-1 text-[10px]" />
                            Heading
                        </button>
                        <button
                            type="button"
                            onClick={() => insertSnippet('- [ ] ')}
                            className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#1A1A1A] border border-[#242424] text-[#EDEDED] hover:text-white text-xs transition-colors"
                            title="Insert Task Checkbox"
                        >
                            <FontAwesomeIcon icon={faTasks} className="mr-1 text-[10px]" />
                            Task
                        </button>
                        <button
                            type="button"
                            onClick={() => insertSnippet('- ')}
                            className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#1A1A1A] border border-[#242424] text-[#EDEDED] hover:text-white text-xs transition-colors"
                            title="Insert Bullet List"
                        >
                            <FontAwesomeIcon icon={faListUl} className="mr-1 text-[10px]" />
                            List
                        </button>
                        <button
                            type="button"
                            onClick={() => insertSnippet('```\n\n```')}
                            className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#1A1A1A] border border-[#242424] text-[#EDEDED] hover:text-white text-xs transition-colors"
                            title="Insert Code Block"
                        >
                            <FontAwesomeIcon icon={faCode} className="mr-1 text-[10px]" />
                            Code
                        </button>

                        <span className="h-4 w-px bg-[#1F1F1F] mx-1"></span>

                        <button
                            type="button"
                            onClick={() => insertTemplate('checklist')}
                            className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#1A1A1A] border border-[#242424] text-[#EDEDED] hover:text-white text-xs transition-colors"
                        >
                            + Checklist
                        </button>
                        <button
                            type="button"
                            onClick={() => insertTemplate('maintenance')}
                            className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#1A1A1A] border border-[#242424] text-[#EDEDED] hover:text-white text-xs transition-colors"
                        >
                            + Maintenance Log
                        </button>
                        <button
                            type="button"
                            onClick={() => insertTemplate('rules')}
                            className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#1A1A1A] border border-[#242424] text-[#EDEDED] hover:text-white text-xs transition-colors"
                        >
                            + Server Rules
                        </button>
                    </div>
                )}

                {/* Main Content Area */}
                <div
                    className="rounded-xl border border-[#1F1F1F] bg-[#0A0A0A] overflow-hidden transition-colors"
                >
                    {mode === 'edit' ? (
                        activeTab === 'shared' ? (
                            <textarea
                                ref={sharedTextAreaRef}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Type server notes, reminders, mod configurations, or checklists here... (supports Markdown formatting)"
                                rows={18}
                                className="w-full p-4 bg-[#050505] text-[#EDEDED] placeholder-[#737373] font-mono text-xs sm:text-sm border-none outline-none resize-y min-h-[380px] focus:ring-0 leading-relaxed"
                            />
                        ) : (
                            <textarea
                                ref={adminTextAreaRef}
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Enter private staff notes, customer communication records, node flags, or investigation logs here... (Only panel administrators can view this)"
                                rows={18}
                                className="w-full p-4 bg-[#050505] text-[#EDEDED] placeholder-[#737373] font-mono text-xs sm:text-sm border-none outline-none resize-y min-h-[380px] focus:ring-0 leading-relaxed"
                            />
                        )
                    ) : (
                        <div className="min-h-[380px] max-h-[600px] overflow-y-auto">
                            {renderMarkdownPreview(activeText)}
                        </div>
                    )}

                    {/* Bottom Status Bar */}
                    <div
                        className="px-4 py-2.5 border-t border-[#1F1F1F] bg-[#050505] flex flex-wrap items-center justify-between text-xs font-mono select-none text-[#737373]"
                    >
                        <div className="flex items-center space-x-3">
                            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                            <span className="text-[#333333]">•</span>
                            <span>{charCount} characters</span>
                        </div>

                        <div>
                            {activeTab === 'shared' ? (
                                notesUpdatedAt && notesAuthor ? (
                                    <span>
                                        Last edited by <strong className="text-white">{notesAuthor.name || notesAuthor.username}</strong>{' '}
                                        {formatDistanceToNow(new Date(notesUpdatedAt), { addSuffix: true })}
                                    </span>
                                ) : (
                                    <span className="text-[#737373] italic">No previous edits recorded</span>
                                )
                            ) : adminUpdatedAt && adminAuthor ? (
                                <span>
                                    Staff record updated by <strong className="text-white">{adminAuthor.name || adminAuthor.username}</strong>{' '}
                                    {formatDistanceToNow(new Date(adminUpdatedAt), { addSuffix: true })}
                                </span>
                            ) : (
                                <span className="text-[#737373] italic">No admin notes recorded</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ServerContentBlock>
    );
};
