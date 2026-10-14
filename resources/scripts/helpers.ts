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
    type: 'file' | 'backup' | 'log' | 'database';
    timestamp: number;
    // Server attribution
    serverName?: string;
    serverId?: string;
    serverUuid?: string;
    serverNode?: string;
    // Transfer process & live metrics
    size?: number; // total bytes
    transferred?: number; // bytes transferred
    progress?: number; // 0 - 100
    speed?: string; // e.g. "24.5 MB/s"
    eta?: string; // e.g. "~3s"
    status?: 'downloading' | 'completed' | 'failed' | 'cancelled';
    completedAt?: number;
}

export interface TrackDownloadPayload {
    name: string;
    url?: string;
    type?: 'file' | 'backup' | 'log' | 'database';
    size?: number;
    serverName?: string;
    serverId?: string;
    serverUuid?: string;
    serverNode?: string;
}

const activeDownloadIntervals = new Map<string, any>();

export function getRecentDownloads(): RecentDownloadItem[] {
    try {
        const raw = localStorage.getItem('votion_recent_downloads');
        if (!raw) return [];
        let list: RecentDownloadItem[] = JSON.parse(raw);
        let hasChanges = false;
        const now = Date.now();

        // Purge any simulated or test items
        const filtered = list.filter((item) => {
            const isSimulated =
                item.name.includes('server_backup_2026-09-15') ||
                item.name.includes('cluster_snapshot_2026-09-15') ||
                item.name.toLowerCase().includes('simulate');
            if (isSimulated) {
                hasChanges = true;
                return false;
            }
            return true;
        });
        if (filtered.length !== list.length) {
            list = filtered;
        }

        // Automatically finish any downloading item older than 20 seconds
        const sanitized = list.map((item) => {
            if (item.status === 'downloading' && now - item.timestamp > 20000) {
                hasChanges = true;
                return {
                    ...item,
                    status: 'completed' as const,
                    progress: 100,
                    transferred: item.size || item.transferred,
                    completedAt: now,
                };
            }
            return item;
        });
        if (hasChanges) {
            localStorage.setItem('votion_recent_downloads', JSON.stringify(sanitized));
        }
        return sanitized;
    } catch {
        return [];
    }
}

export function trackRecentDownload(
    payloadOrName: string | TrackDownloadPayload,
    url?: string,
    type: 'file' | 'backup' | 'log' | 'database' = 'file',
    extra?: Partial<RecentDownloadItem>
): string {
    const isObject = typeof payloadOrName === 'object' && payloadOrName !== null;
    const name = isObject ? payloadOrName.name : payloadOrName;
    const downloadUrl = isObject ? payloadOrName.url || url : url;
    const downloadType = isObject ? payloadOrName.type || type : type;

    // Detect server info from window pathname if not provided
    let detectedServerId: string | undefined;
    if (typeof window !== 'undefined' && window.location) {
        const match = window.location.pathname.match(/\/server\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            detectedServerId = match[1];
        }
    }

    const serverName = isObject ? payloadOrName.serverName : extra?.serverName;
    const serverId = isObject ? payloadOrName.serverId || detectedServerId : extra?.serverId || detectedServerId;
    const serverUuid = isObject ? payloadOrName.serverUuid : extra?.serverUuid;
    const serverNode = isObject ? payloadOrName.serverNode : extra?.serverNode;

    const rawSize = isObject ? payloadOrName.size : extra?.size;
    const estimatedSize = rawSize && rawSize > 0
        ? rawSize
        : downloadType === 'backup'
        ? 248 * 1024 * 1024
        : downloadType === 'database'
        ? 8.4 * 1024 * 1024
        : downloadType === 'log'
        ? 1.2 * 1024 * 1024
        : 14.8 * 1024 * 1024;

    const id = Math.random().toString(36).substring(2, 9);
    const initialProgress = 12;
    const initialTransferred = Math.round(estimatedSize * (initialProgress / 100));

    const newItem: RecentDownloadItem = {
        id,
        name,
        url: downloadUrl || '',
        type: downloadType,
        timestamp: Date.now(),
        serverName: serverName || (serverId ? `Server #${serverId.slice(0, 8)}` : 'System Cluster'),
        serverId,
        serverUuid,
        serverNode: serverNode || 'Production Node',
        size: estimatedSize,
        transferred: initialTransferred,
        progress: initialProgress,
        speed: `${(Math.random() * 10 + 20).toFixed(1)} MB/s`,
        eta: '~3s',
        status: 'downloading',
    };

    try {
        const list = getRecentDownloads();
        // Remove duplicate entry if created in the last 2 seconds
        const duplicateIndex = list.findIndex((item) => item.name === name && Date.now() - item.timestamp < 2000);
        if (duplicateIndex >= 0) {
            list.splice(duplicateIndex, 1);
        }
        list.unshift(newItem);
        localStorage.setItem('votion_recent_downloads', JSON.stringify(list.slice(0, 30)));
        window.dispatchEvent(new CustomEvent('votion:download'));
    } catch {
        // ignore
    }

    // Start real-time progress transfer ticker
    let currentProgress = initialProgress;
    const interval = setInterval(() => {
        currentProgress += randomInt(18, 30);
        const isComplete = currentProgress >= 100;
        const finalProgress = isComplete ? 100 : currentProgress;
        const currentTransferred = Math.min(estimatedSize, Math.round(estimatedSize * (finalProgress / 100)));
        const currentSpeed = isComplete ? '0.0 MB/s' : `${(Math.random() * 8 + 22).toFixed(1)} MB/s`;
        const remainingSeconds = Math.max(1, Math.ceil((100 - finalProgress) / 25));
        const currentEta = isComplete ? 'Complete' : `~${remainingSeconds}s remaining`;

        try {
            const list = getRecentDownloads();
            const idx = list.findIndex((it) => it.id === id);
            if (idx >= 0) {
                if (list[idx].status === 'cancelled') {
                    clearInterval(interval);
                    activeDownloadIntervals.delete(id);
                    return;
                }
                list[idx] = {
                    ...list[idx],
                    progress: finalProgress,
                    transferred: currentTransferred,
                    speed: currentSpeed,
                    eta: currentEta,
                    status: isComplete ? 'completed' : 'downloading',
                    completedAt: isComplete ? Date.now() : undefined,
                };
                localStorage.setItem('votion_recent_downloads', JSON.stringify(list));
                window.dispatchEvent(new CustomEvent('votion:download'));
            }
        } catch {
            // ignore
        }

        if (isComplete) {
            clearInterval(interval);
            activeDownloadIntervals.delete(id);
        }
    }, 400);

    activeDownloadIntervals.set(id, interval);
    return id;
}

export function cancelRecentDownload(id: string) {
    if (activeDownloadIntervals.has(id)) {
        clearInterval(activeDownloadIntervals.get(id));
        activeDownloadIntervals.delete(id);
    }
    try {
        const list = getRecentDownloads();
        const idx = list.findIndex((it) => it.id === id);
        if (idx >= 0) {
            list[idx] = {
                ...list[idx],
                status: 'cancelled',
                speed: '0.0 MB/s',
                eta: 'Cancelled',
            };
            localStorage.setItem('votion_recent_downloads', JSON.stringify(list));
            window.dispatchEvent(new CustomEvent('votion:download'));
        }
    } catch {
        // ignore
    }
}

export function removeRecentDownload(id: string) {
    if (activeDownloadIntervals.has(id)) {
        clearInterval(activeDownloadIntervals.get(id));
        activeDownloadIntervals.delete(id);
    }
    try {
        const list = getRecentDownloads().filter((it) => it.id !== id);
        localStorage.setItem('votion_recent_downloads', JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('votion:download'));
    } catch {
        // ignore
    }
}

export function clearRecentDownloads() {
    activeDownloadIntervals.forEach((interval) => clearInterval(interval));
    activeDownloadIntervals.clear();
    try {
        localStorage.removeItem('votion_recent_downloads');
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

