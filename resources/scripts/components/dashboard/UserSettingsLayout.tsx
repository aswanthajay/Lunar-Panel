import React from 'react';
import { NavLink } from 'react-router-dom';

interface Props {
    children: React.ReactNode;
}

// Minimal 16px SVG line icons — stroke-based, no fill, crisp on dark backgrounds
const IconShield = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const IconCode = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
    </svg>
);

const IconKey = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="M21 2L13 10" />
        <path d="M15 4l2 2" />
        <path d="M18 7l2 2" />
    </svg>
);

const IconActivity = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);

const navLinkBase = "px-3.5 py-2.5 rounded-lg text-xs font-medium text-[#737373] hover:text-[#FFFFFF] hover:bg-[#0A0A0A] transition-all no-underline flex items-center justify-between group";
const navLinkActive = "!bg-[#FFFFFF] !text-[#000000] !font-semibold shadow-sm";

export default ({ children }: Props) => {
    return (
        <div className="w-full font-sans select-none pb-12">
            {/* Header */}
            <div className="mb-6 border-b border-[#141414] pb-6">
                <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#FFFFFF] tracking-tight m-0">
                    User Settings
                </h1>
                <p className="text-xs text-[#8A8A8A] font-sans mt-1.5 m-0 leading-relaxed">
                    Manage account credentials, two-factor authentication, security policies, and personal access.
                </p>
            </div>

            {/* 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* Left Column: Vertical Subnav */}
                <nav className="md:col-span-3 bg-[#000000] border border-[#1F1F1F] rounded-xl p-1.5 flex flex-col gap-0.5 shadow-sm">
                    <NavLink to="/account" exact className={navLinkBase} activeClassName={navLinkActive}>
                        <span className="flex items-center gap-2.5">
                            <span className="opacity-60 group-hover:opacity-100 transition-opacity"><IconShield /></span>
                            <span>Login &amp; Security</span>
                        </span>
                    </NavLink>
                    <NavLink to="/account/api" className={navLinkBase} activeClassName={navLinkActive}>
                        <span className="flex items-center gap-2.5">
                            <span className="opacity-60 group-hover:opacity-100 transition-opacity"><IconCode /></span>
                            <span>API Credentials</span>
                        </span>
                    </NavLink>
                    <NavLink to="/account/ssh" className={navLinkBase} activeClassName={navLinkActive}>
                        <span className="flex items-center gap-2.5">
                            <span className="opacity-60 group-hover:opacity-100 transition-opacity"><IconKey /></span>
                            <span>SSH Public Keys</span>
                        </span>
                    </NavLink>
                    <NavLink to="/account/activity" className={navLinkBase} activeClassName={navLinkActive}>
                        <span className="flex items-center gap-2.5">
                            <span className="opacity-60 group-hover:opacity-100 transition-opacity"><IconActivity /></span>
                            <span>Account Activity</span>
                        </span>
                    </NavLink>
                </nav>

                {/* Right Column: Main Content */}
                <div className="md:col-span-9 min-w-0">
                    {children}
                </div>
            </div>
        </div>
    );
};
