# Votion Carta Ink & Luxury Dark Theme — Integration Guide
*Prepared for **The New Lunar Panel** Project*

---

## 1. Overview & Files Included

This directory contains the complete frontend codebase, compiled production build, theme configurations, and visual assets exported directly from Votion One Panel:

```
votion-frontend/
├── src/                          # Full React + TypeScript frontend source code
│   ├── components/               # All UI components (Cards, Tables, Modals, Charts, Sidebar)
│   │   ├── Sidebar.tsx           # Signature navigation sidebar with status pills & user drawer
│   │   ├── OverviewDashboard.tsx # Editorial Carta Ink client overview dashboard
│   │   ├── DashboardContent.tsx  # Executive administrator command center
│   │   ├── ClientPanelContent.tsx# Server/VM detail panel (metrics, graphs, power actions)
│   │   ├── OvhManager.tsx        # Router Manager & Anti-DDoS telemetry console
│   │   ├── CarrierIcons.tsx      # SVG carrier badges (OVH, Hetzner, Proxmox)
│   │   └── ...                   # CommandPalette, SupportCenter, Billing, Modals
│   ├── services/                 # Theme state, date/time formatters, API client
│   │   ├── theme.ts              # Theme toggle context (dark / light / system)
│   │   └── dateTime.ts           # Consistent UTC/local timezone formatting
│   ├── index.css                 # Master CSS styling: CSS variables, scrollbars, cards
│   ├── App.tsx                   # Main layout container & routing wrapper
│   └── main.tsx                  # React DOM mount point
├── dist/                         # Compiled, optimized production build (HTML, CSS, JS chunks)
├── public/                       # Visual assets (metallic logos, favicons, branding)
├── index.html                    # HTML template with Google Fonts (Newsreader, Inter, JetBrains Mono)
├── tailwind.config.js            # Tailwind color palettes, font definitions, and extensions
├── postcss.config.js             # PostCSS configuration
├── vite.config.ts                # Vite build bundler configuration
└── package.json                  # Dependencies reference (@headlessui, @heroicons, etc.)
```

---

## 2. Core Theme Color Tokens

The Votion theme uses a dual **Carta Ink (Editorial Light)** and **Signature Pure Black (Enterprise Dark)** palette:

### Dark Theme (Signature Black)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Canvas Background** | `#000000` / `#0a0a0a` | Global application background |
| **Card Surface** | `#121212` / `#141414` | Dashboard cards, tables, modal containers |
| **Elevated Hover** | `#1a1a1a` / `#1f1f1f` | Hover states, active dropdown items |
| **Border Subtle** | `#262626` / `#313131` | Card dividers, table borders, input strokes |
| **Text Primary** | `#f3f4f6` / `#ffffff` | High-contrast headings and active labels |
| **Text Muted** | `#a0a0a0` / `#656b6b` | Secondary descriptions, timestamps, breadcrumbs |
| **Accent Emerald** | `#10b981` / `#16a34a` | Healthy status pills, uptime metrics, online indicators |
| **Accent Red** | `#ef4444` / `#dc2626` | Emergency banners, active scrubbing alerts, danger buttons |

### Light Theme (Carta Ink)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Canvas Background** | `#fbfaf9` (Warm stone) | Editorial light canvas |
| **Card Surface** | `#ffffff` | Crisp white cards |
| **Border Subtle** | `#dedfdf` | Clean hairline borders |
| **Text Primary** | `#1a1a1a` | Dark charcoal text |
| **Text Muted** | `#656b6b` | Subtle captions and metadata |

---

## 3. Typography Setup

Add the following font imports to your `index.html` or Blade template (`resources/views/templates/wrapper.blade.php`):

```html
<!-- Google Fonts: Inter (Sans), Newsreader (Serif), JetBrains Mono (Code/Telemetry) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
```

---

## 4. Integrating into `The New Lunar Panel`'s `tailwind.config.js`

In your `The New Lunar Panel/tailwind.config.js`, merge the `fontFamily` and `colors` extensions:

```javascript
module.exports = {
    content: [
        './resources/scripts/**/*.{js,ts,tsx}',
        './resources/views/**/*.blade.php',
    ],
    darkMode: 'class', // Enables standard dark: utility classes
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Inter"', 'system-ui', 'sans-serif'],
                serif: ['"Newsreader"', '"Playfair Display"', 'Georgia', 'serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            colors: {
                black: '#000000',
                ink: {
                    bg: '#ffffff',
                    dark: '#1a1a1a',
                    border: '#dedfdf',
                    subtle: '#656b6b',
                    gray10: '#f1f1f1',
                    gray20: '#e9eaea',
                    brown10: '#fbfaf9',
                },
                lunar: {
                    bg: '#0a0a0a',
                    card: '#121212',
                    'card-hover': '#1a1a1a',
                    border: '#262626',
                    muted: '#656b6b',
                    subtext: '#a0a0a0',
                    green: '#10b981',
                },
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms')({ strategy: 'class' }),
    ],
};
```

---

## 5. Master CSS Classes (`index.css`)

Copy these signature utility classes from `src/index.css` into your panel's CSS entry point:

```css
/* Signature Minimal Button Styles */
.btn-primary {
  background-color: #1a1a1a;
  color: #ffffff;
  border: 1px solid #1a1a1a;
  transition: all 150ms ease-in-out;
}
.dark .btn-primary {
  background-color: #ffffff;
  color: #000000;
  border: 1px solid #ffffff;
}
.btn-primary:hover {
  opacity: 0.90;
}

.btn-secondary {
  background-color: transparent;
  color: #1a1a1a;
  border: 1px solid #dedfdf;
  transition: all 150ms ease-in-out;
}
.dark .btn-secondary {
  color: #f3f4f6;
  border-color: #262626;
  background-color: #141414;
}
.btn-secondary:hover {
  background-color: #f5f5f5;
}
.dark .btn-secondary:hover {
  background-color: #1f1f1f;
}

/* Custom Sleek Scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.25);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 120, 120, 0.45);
}
```

---

## 6. How to Preview the Exported Frontend Right Now

You can immediately preview the standalone frontend running directly from the exported directory:

1. Open a terminal in `The New Lunar Panel/votion-frontend`:
   ```bash
   cd "C:\Users\aghil\OneDrive\Desktop\The New Lunar Panel\votion-frontend"
   ```
2. Install frontend packages and start the Vite dev server:
   ```bash
   npm install
   npx vite
   ```
3. Open `http://localhost:5173` to explore all interactive layouts, charts, and dark/light mode toggles.
