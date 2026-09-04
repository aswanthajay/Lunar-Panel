import React, { useState } from 'react';
import { Dialog } from '@/components/elements/dialog';

export default ({ meta }: { meta: Record<string, unknown> }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="self-center">
            <Dialog open={open} onClose={() => setOpen(false)} hideCloseIcon title={'Event Payload Telemetry'}>
                <div className="space-y-4">
                    <p className="text-xs font-sans text-[#737373] m-0">
                        Raw JSON payload snapshot recorded for this audit event:
                    </p>
                    <pre className="bg-[#050505] border border-[#1F1F1F] rounded-lg p-4 font-mono text-xs text-[#10B981] leading-relaxed overflow-x-auto max-h-96 whitespace-pre-wrap selection:bg-[#10B981]/20 m-0">
                        {JSON.stringify(meta, null, 2)}
                    </pre>
                </div>
                <Dialog.Footer>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="px-4 py-1.5 rounded-md text-xs font-sans font-semibold bg-[#FFFFFF] text-[#000000] hover:bg-[#E5E5E5] transition-colors cursor-pointer border-none shadow-sm"
                    >
                        Close
                    </button>
                </Dialog.Footer>
            </Dialog>

            <button
                type="button"
                aria-describedby="View additional event metadata"
                title="Inspect event metadata payload"
                className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-[#0A0A0A] hover:bg-[#141414] text-[#737373] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
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

