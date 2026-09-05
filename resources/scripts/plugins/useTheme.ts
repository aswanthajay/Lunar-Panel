import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'votion_theme';
const ATTR = 'data-theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function resolve(mode: ThemeMode): EffectiveTheme {
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
    }
    return 'light';
}

function applyTheme(mode: ThemeMode) {
    if (typeof document === 'undefined') return;
    const effective = resolve(mode);
    const html = document.documentElement;
    if (effective === 'dark') {
        html.setAttribute(ATTR, 'dark');
        html.classList.add('dark');
    } else {
        html.removeAttribute(ATTR);
        html.classList.remove('dark');
    }
    html.style.colorScheme = effective;
}

export function getStoredThemeMode(): ThemeMode {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    } catch {
        // Fallback for private browsing
    }
    return 'system';
}

export function setThemeMode(mode: ThemeMode) {
    try {
        localStorage.setItem(STORAGE_KEY, mode);
    } catch {
        // Fallback
    }
    applyTheme(mode);
}

export function useTheme() {
    const [mode, setModeState] = useState<ThemeMode>(() => getStoredThemeMode());

    useEffect(() => {
        applyTheme(mode);

        const media = window.matchMedia?.(MEDIA_QUERY);
        const handleChange = () => {
            if (getStoredThemeMode() === 'system') {
                applyTheme('system');
            }
        };
        media?.addEventListener('change', handleChange);
        return () => media?.removeEventListener('change', handleChange);
    }, [mode]);

    const setMode = (newMode: ThemeMode) => {
        setThemeMode(newMode);
        setModeState(newMode);
    };

    const toggleTheme = () => {
        const currentEffective = resolve(mode);
        const nextMode: ThemeMode = currentEffective === 'dark' ? 'light' : 'dark';
        setMode(nextMode);
    };

    return {
        theme: mode,
        effectiveTheme: resolve(mode),
        setTheme: setMode,
        toggleTheme,
    };
}
