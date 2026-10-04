/**
 * Stellar Panel Safe Asset Clean Engine
 * Hardened file removal utility with protected-path blocking, whitelist validation,
 * audit logging, and --dry-run support.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.resolve(WORKSPACE_ROOT, 'public', 'assets');
const LOGS_DIR = path.resolve(WORKSPACE_ROOT, 'storage', 'logs');

// 1. Whitelist definition - ONLY assets inside public/assets are eligible
const ALLOWED_EXTENSIONS = new Set(['.js', '.map', '.txt', '.css']);
const BLOCKED_FILE_NAMES = new Set(['.gitignore', '.gitkeep', 'robots.txt', 'index.php']);

// 2. Hard-blocked system & user paths
function isProtectedPath(targetPath) {
    const norm = path.normalize(path.resolve(targetPath)).toLowerCase();

    const protectedRoots = [
        path.parse(norm).root.toLowerCase(), // Drive root e.g. C:\
        process.env.WINDIR ? process.env.WINDIR.toLowerCase() : 'c:\\windows',
        process.env['ProgramFiles'] ? process.env['ProgramFiles'].toLowerCase() : 'c:\\program files',
        process.env['ProgramFiles(x86)'] ? process.env['ProgramFiles(x86)'].toLowerCase() : 'c:\\program files (x86)',
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'documents').toLowerCase() : '',
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'desktop').toLowerCase() : '',
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'downloads').toLowerCase() : '',
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'pictures').toLowerCase() : '',
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'music').toLowerCase() : '',
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'videos').toLowerCase() : '',
    ].filter(Boolean);

    for (const p of protectedRoots) {
        if (norm === p || norm.startsWith(p + path.sep)) {
            return true;
        }
    }

    return false;
}

// 3. Audit logger with timestamps
function logAudit(entry) {
    try {
        if (!fs.existsSync(LOGS_DIR)) {
            fs.mkdirSync(LOGS_DIR, { recursive: true });
        }
        const logFile = path.join(LOGS_DIR, 'file_deletion_audit.log');
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${entry}\n`;
        fs.appendFileSync(logFile, line, 'utf8');
    } catch (e) {
        // Silently continue if log cannot be appended
    }
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function run() {
    const isDryRun = process.argv.includes('--dry-run');
    const isForce = process.argv.includes('--force');

    console.log(`[SafeClean] Scanning target: ${TARGET_DIR}`);
    if (isDryRun) {
        console.log(`[SafeClean] MODE: --dry-run (Simulated execution, no files will be deleted)`);
    }

    if (!fs.existsSync(TARGET_DIR)) {
        console.log(`[SafeClean] Target directory does not exist: ${TARGET_DIR}`);
        return;
    }

    // Resolve real canonical path to prevent symlink/junction/.. traversal
    let canonicalTarget;
    try {
        canonicalTarget = fs.realpathSync(TARGET_DIR);
    } catch (e) {
        canonicalTarget = TARGET_DIR;
    }

    // Whitelist check: Target MUST be strictly within WORKSPACE_ROOT/public/assets
    if (!canonicalTarget.toLowerCase().startsWith(path.resolve(WORKSPACE_ROOT, 'public').toLowerCase())) {
        console.error(`[SafeClean] BLOCKED: Target directory is outside approved public folder!`);
        logAudit(`[BLOCKED_WHITELIST] Attempted to clean non-whitelisted path: ${canonicalTarget}`);
        process.exit(1);
    }

    if (isProtectedPath(canonicalTarget)) {
        console.error(`[SafeClean] BLOCKED: Target matches a hard-blocked system path!`);
        logAudit(`[BLOCKED_PROTECTED] Target path is protected: ${canonicalTarget}`);
        process.exit(1);
    }

    const entries = fs.readdirSync(canonicalTarget, { withFileTypes: true });
    const candidates = [];
    let totalBytes = 0;

    for (const entry of entries) {
        if (!entry.isFile()) continue;

        const fileName = entry.name;
        const ext = path.extname(fileName).toLowerCase();

        if (BLOCKED_FILE_NAMES.has(fileName.toLowerCase())) {
            continue;
        }

        // Whitelist: only delete generated bundles and map files
        if (fileName === 'manifest.json' || !ALLOWED_EXTENSIONS.has(ext)) {
            continue;
        }

        // Only delete bundle assets that follow Webpack hash format or maps
        const isBundleOrMap = /^(bundle|\d+|vendors|dashboard|server|auth)\.[a-f0-9]+\.(js|css)(\.map)?$/i.test(fileName)
            || fileName.endsWith('.map');

        if (!isBundleOrMap) {
            continue;
        }

        const fullPath = path.join(canonicalTarget, fileName);

        // Individual file safety check
        if (isProtectedPath(fullPath)) {
            console.warn(`[SafeClean] Skipping protected file: ${fullPath}`);
            continue;
        }

        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch {
            continue;
        }

        candidates.push({ path: fullPath, name: fileName, size: stat.size });
        totalBytes += stat.size;
    }

    if (candidates.length === 0) {
        console.log(`[SafeClean] Clean complete: 0 stale bundle files found.`);
        return;
    }

    console.log(`[SafeClean] Found ${candidates.length} candidate file(s) (${formatBytes(totalBytes)}):`);
    candidates.forEach((c) => {
        console.log(`  - ${c.name} (${formatBytes(c.size)})`);
    });

    if (isDryRun) {
        console.log(`[SafeClean] [DRY-RUN] ${candidates.length} file(s) would be deleted (${formatBytes(totalBytes)}). No action taken.`);
        logAudit(`[DRY_RUN] Scanned ${candidates.length} files (${totalBytes} bytes) in ${canonicalTarget}`);
        return;
    }

    // Perform hardened deletion with try/finally per file
    let deletedCount = 0;
    let deletedBytes = 0;

    for (const c of candidates) {
        let success = false;
        try {
            fs.unlinkSync(c.path);
            success = true;
            deletedCount++;
            deletedBytes += c.size;
            logAudit(`[DELETED] File: ${c.path} (${c.size} bytes)`);
        } catch (err) {
            console.error(`[SafeClean] Failed to delete ${c.name}: ${err.message}`);
            logAudit(`[FAILED_DELETE] File: ${c.path} - Error: ${err.message}`);
        }
    }

    console.log(`[SafeClean] Successfully and safely cleaned ${deletedCount}/${candidates.length} file(s) (${formatBytes(deletedBytes)}). Logged to storage/logs/file_deletion_audit.log.`);
}

module.exports = {
    isProtectedPath,
    logAudit,
    formatBytes,
    run
};

if (require.main === module) {
    run();
}
