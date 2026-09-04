/*
  VOTION ONE THEME SYSTEM
  ========================
  Persistable theme preference with three modes: 'light' | 'dark' | 'system'.
  The system mode follows the operating-system preference via prefers-color-scheme.
*/

export type ThemeMode = 'light' | 'dark' | 'system';

type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'votion_theme';
const ATTR = 'data-theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';
let initialized = false;

/** Resolve the effective theme from a preference mode. */
function resolve(mode: ThemeMode): EffectiveTheme {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
  }
  return 'light';
}

function updateThemeColor(theme: EffectiveTheme) {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = theme === 'dark' ? '#000000' : '#ffffff';
}

/** Apply the resolved theme to <html> synchronously. */
function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const effective = resolve(mode);
  const html = document.documentElement;
  const preloader = document.getElementById('votion-global-preloader');
  if (effective === 'dark') {
    html.setAttribute(ATTR, 'dark');
    preloader?.classList.add('dark');
  } else {
    html.removeAttribute(ATTR);
    preloader?.classList.remove('dark');
  }
  html.style.colorScheme = effective;
  updateThemeColor(effective);
}

/** Read the saved preference, defaulting to system detection. */
export function getStoredThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Private browsing or storage restrictions should not prevent theme usage.
  }
  return 'system';
}

/** Save a preference and apply it immediately. */
export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // The active tab still receives the requested theme when storage is unavailable.
  }
  applyTheme(mode);
}

/** Synchronous bootstrap called before React mounts to eliminate theme flicker. */
export function initTheme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  applyTheme(getStoredThemeMode());
  if (initialized) return;
  initialized = true;

  const media = window.matchMedia?.(MEDIA_QUERY);
  media?.addEventListener('change', () => {
    if (getStoredThemeMode() === 'system') applyTheme('system');
  });

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) applyTheme(getStoredThemeMode());
  });
}
