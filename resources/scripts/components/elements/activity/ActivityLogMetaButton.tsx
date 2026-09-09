import React, { useState } from 'react';
import { Dialog } from '@/components/elements/dialog';

export default ({ meta }: { meta: Record<string, unknown> }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="self-center">
            <Dialog open={open} onClose={() => setOpen(false)} hideCloseIcon title={'Event Payload Telemetry'}>
                <div className="space-y-4">
                    <p className="text-xs font-sans text-zinc-400 m-0">
                        Raw JSON payload snapshot recorded for this audit event:
                    </p>
                    <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto max-h-96 whitespace-pre-wrap selection:bg-emerald-500/20 m-0">
                        {JSON.stringify(meta, null, 2)}
                    </pre>
                </div>
                <Dialog.Footer>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="px-3.5 py-1.5 rounded-md text-xs font-sans font-medium bg-zinc-100 text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer border-none shadow-xs"
                    >
                        Close
                    </button>
                </Dialog.Footer>
            </Dialog>

            <button
                type="button"
                aria-describedby="View additional event metadata"
                title="Inspect event metadata payload"
                className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                onClick={() => setOpen(true)}
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                </svg>
                <span>Payload</span>
            </button>
        </div>
    );
};

