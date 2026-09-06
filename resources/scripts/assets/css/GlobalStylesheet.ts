import tw from 'twin.macro';
import { createGlobalStyle } from 'styled-components/macro';

export default createGlobalStyle`
    /* ── Google Fonts import ──────────────────────────────────────────── */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700&display=swap');

    :root {
        /* Base surfaces - pure black editorial */
        --s-bg:          #000000;   /* page background */
        --s-surface-0:   #000000;   /* deepest surface */
        --s-surface-1:   #0A0A0A;   /* card / panel bg */
        --s-surface-2:   #111111;   /* hover state surface */
        --s-surface-3:   #171717;   /* active / selected */

        /* Borders */
        --s-border:      #1F1F1F;   /* default hairline */
        --s-border-2:    #2B2B2B;   /* subtle dividers */
        --s-border-hover:#383838;   /* hovered borders */

        /* Typography */
        --s-text-1:  #FFFFFF;       /* primary / headings */
        --s-text-2:  #A0A0A0;       /* secondary body */
        --s-text-3:  #525252;       /* tertiary / labels */
        --s-text-4:  #333333;       /* disabled / ghost */

        /* Accent */
        --s-green:   #10B981;
        --s-amber:   #F59E0B;
        --s-red:     #EF4444;
        --s-blue:    #3B82F6;
        --s-purple:  #A855F7;
        --s-cyan:    #06B6D4;

        /* Font families */
        --font-display: "Inter", system-ui, -apple-system, sans-serif;
        --font-sans:    "Inter", system-ui, -apple-system, sans-serif;
        --font-mono:    "JetBrains Mono", ui-monospace, "Cascadia Code", monospace;
    }

    html, body, #app {
        height: 100%;
        overflow: hidden;
        margin: 0;
        padding: 0;
    }

    body {
        font-family: var(--font-sans);
        font-size: 13px;
        line-height: 1.6;
        letter-spacing: -0.01em;
        color: var(--s-text-2);
        background-color: var(--s-bg);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
    }

    /* ── Headings — modern signature sans ──────────────────────────────────── */
    h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-sans);
        font-weight: 600;
        color: var(--s-text-1);
        letter-spacing: -0.02em;
        line-height: 1.2;
        margin: 0;
    }

    h1 { font-size: 28px; font-weight: 700; }
    h2 { font-size: 20px; font-weight: 600; }
    h3 { font-size: 16px; font-weight: 600; }

    .font-serif  { font-family: var(--font-sans)    !important; }
    .font-sans   { font-family: var(--font-sans)    !important; }
    .font-mono   { font-family: var(--font-mono)    !important; }

    p { color: var(--s-text-2); line-height: 1.65; margin: 0; }

    form { margin: 0; }

    textarea, select, input, button {
        font-family: var(--font-sans);
        outline: none;
    }

    button { cursor: pointer; }

    a { text-decoration: none; color: inherit; }
    a:hover { text-decoration: none; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none !important;
        margin: 0;
    }
    input[type=number] { -moz-appearance: textfield !important; }

    /* ── Scrollbars ───────────────────────────────────────────────────── */
    ::-webkit-scrollbar         { width: 4px; height: 4px; }
    ::-webkit-scrollbar-thumb   { background: #282828; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #383838; }
    ::-webkit-scrollbar-track   { background: transparent; }

    ::selection { background: #FFFFFF; color: #000000; }

    /* ── Utility block ────────────────────────────────────────────────── */
    .ink-panel {
        background-color: var(--s-surface-1);
        border: 1px solid var(--s-border);
        border-radius: 6px;
        overflow: hidden;
    }
    .ink-panel-header {
        padding: 10px 16px;
        border-bottom: 1px solid var(--s-border);
        font-family: var(--font-sans);
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--s-text-3);
    }

    /* ── Votion Auth autofill override for white auth panel ──────────── */
    .votion-auth-input:-webkit-autofill,
    .votion-auth-input:-webkit-autofill:hover,
    .votion-auth-input:-webkit-autofill:focus,
    .votion-auth-input:-webkit-autofill:active,
    input.votion-auth-input:-webkit-autofill,
    input.votion-auth-input:-webkit-autofill:hover,
    input.votion-auth-input:-webkit-autofill:focus,
    input.votion-auth-input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
        box-shadow: 0 0 0 1000px #ffffff inset !important;
        -webkit-text-fill-color: #1a1a1a !important;
        color: #1a1a1a !important;
        caret-color: #1a1a1a !important;
        border-color: #111111 !important;
        transition: background-color 5000s ease-in-out 0s !important;
    }

    /* ── Accessibility (a11y) & Focus Management ────────────────────── */
    :focus,
    :focus-visible,
    *:focus,
    *:focus-visible {
        outline: none !important;
        outline-offset: 0 !important;
    }

    button:focus,
    button:focus-visible,
    a:focus,
    a:focus-visible,
    input:focus,
    input:focus-visible,
    textarea:focus,
    textarea:focus-visible,
    select:focus,
    select:focus-visible,
    [role="button"]:focus,
    [role="button"]:focus-visible,
    [role="combobox"]:focus,
    [role="combobox"]:focus-visible,
    .outline-none:focus,
    .outline-none:focus-visible {
        outline: none !important;
        outline-offset: 0 !important;
        box-shadow: none !important;
    }

    /* Screen reader only utility class */
    .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
    }

    /* Respect user preference for reduced motion */
    @media (prefers-reduced-motion: reduce) {
        *, ::before, ::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
        }
    }

    /* ── Mobile-Only Responsive Styles (Strictly <= 768px) ───────────── */
    @media (max-width: 768px) {
        html, body, #app {
            max-width: 100vw !important;
            overflow-x: hidden !important;
        }

        .app-container {
            max-width: 100vw !important;
            overflow-x: hidden !important;
        }

        /* Smooth momentum scrolling for responsive tables & scroll containers */
        .overflow-x-auto, [class*="overflow-x-"] {
            -webkit-overflow-scrolling: touch;
            max-width: 100%;
        }
    }
`;
