export const randomInt = (low: number, high: number) => Math.floor(Math.random() * (high - low) + low);

export const cleanDirectoryPath = (path: string) => path.replace(/(\/(\/*))|(^$)/g, '/');

export function fileBitsToString(mode: string, directory: boolean): string {
    const m = parseInt(mode, 8);

    let buf = '';
    'dalTLDpSugct?'.split('').forEach((c, i) => {
        if ((m & (1 << (32 - 1 - i))) !== 0) {
            buf = buf + c;
        }
    });

    if (buf.length === 0) {
        // If the file is directory, make sure it has the directory flag.
        if (directory) {
            buf = 'd';
        } else {
            buf = '-';
        }
    }

    'rwxrwxrwx'.split('').forEach((c, i) => {
        if ((m & (1 << (9 - 1 - i))) !== 0) {
            buf = buf + c;
        } else {
            buf = buf + '-';
        }
    });

    return buf;
}

/**
 * URL-encodes the segments of a path.
 * This allows to use the path as part of a URL while preserving the slashes.
 * @param path the path to encode
 */
export function encodePathSegments(path: string): string {
    return path
        .split('/')
        .map((s) => encodeURIComponent(s))
        .join('/');
}

export function hashToPath(hash: string): string {
    return hash.length > 0 ? decodeURIComponent(hash.substr(1)) : '/';
}

export interface RecentDownloadItem {
    id: string;
    name: string;
    url?: string;
    type: 'file' | 'backup' | 'log';
    timestamp: number;
}

export function trackRecentDownload(name: string, url?: string, type: 'file' | 'backup' | 'log' = 'file') {
    try {
        const raw = localStorage.getItem('votion_recent_downloads');
        const list: RecentDownloadItem[] = raw ? JSON.parse(raw) : [];
        const duplicateIndex = list.findIndex((item) => item.name === name && Date.now() - item.timestamp < 3000);
        if (duplicateIndex >= 0) {
            list.splice(duplicateIndex, 1);
        }
        list.unshift({
            id: Math.random().toString(36).substring(2, 9),
            name,
            url: url || '',
            type,
            timestamp: Date.now(),
        });
        localStorage.setItem('votion_recent_downloads', JSON.stringify(list.slice(0, 30)));
        window.dispatchEvent(new CustomEvent('votion:download'));
    } catch {
        // ignore
    }
}

export function formatDownloadTime(timestamp: number): string {
    const elapsed = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (elapsed < 60) return 'Just now';
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
    return `${Math.floor(elapsed / 86400)}d ago`;
}

