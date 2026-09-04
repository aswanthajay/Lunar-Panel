import React, { forwardRef } from 'react';
import { Form } from 'formik';
import FlashMessageRender from '@/components/FlashMessageRender';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
};

export default forwardRef<HTMLFormElement, Props>(({ title, ...props }, ref) => (
    <div className="min-h-screen w-full bg-[#08090c] flex flex-col items-center justify-center p-4 selection:bg-[#10b981] selection:text-white">
        <div className="w-full max-w-[460px] flex flex-col items-center">
            {/* Lunar Brand Logo & Heading */}
            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#059669] to-[#10b981] flex items-center justify-center shadow-2xl shadow-[#10b981]/30 mb-4 ring-4 ring-[#10b981]/15">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white font-header">Lunar Panel</h1>
                <p className="text-xs text-[#8b949e] mt-1.5">Sign in to manage your high performance game servers</p>
            </div>

            {/* Flash error messages */}
            <div className="w-full mb-3">
                <FlashMessageRender byKey={'auth'} />
            </div>

            {/* Obsidian Dark Card */}
            <div className="w-full rounded-3xl bg-[#101216] border border-[#1e2229] p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#10b981]/10 rounded-full blur-2xl pointer-events-none" />
                
                {title && <h2 className="text-lg font-bold text-white mb-6 text-center">{title}</h2>}

                <Form {...props} ref={ref} className="space-y-4">
                    {props.children}
                </Form>
            </div>

            {/* Footer */}
            <p className="text-center text-[#4b5563] text-xs mt-6">
                &copy; {new Date().getFullYear()} Lunar Panel Software. All rights reserved.
            </p>
        </div>
    </div>
));