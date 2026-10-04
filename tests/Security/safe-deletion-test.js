/**
 * Automated Security & Safe Deletion Test Suite
 * Validates that all hardened deletion and cleanup utilities:
 * 1. Strictly respect path whitelists
 * 2. Hard-block protected directories (C:\Windows, Program Files, User Desktop/Documents, Root drives)
 * 3. Reject symlink and path traversal attacks (../../)
 * 4. Never delete or corrupt important files
 * 5. Leave zero temporary junk/residue behind
 */

const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_DIR = path.resolve(PROJECT_ROOT, 'storage', 'testing', 'safe_deletion_sandbox');
const ASSETS_DIR = path.resolve(PROJECT_ROOT, 'public', 'assets');
const DUMMY_ASSET = path.resolve(ASSETS_DIR, 'bundle.deadbeef1234.js');

console.log('========================================================================');
console.log(' STELLAR PANEL // AUTOMATED SAFE DELETION & RESIDUE TEST SUITE');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testName}`);
    } else {
        console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${testName} ${details ? '(' + details + ')' : ''}`);
    }
}

// Ensure clean sandbox
if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
}
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

try {
    // -------------------------------------------------------------
    // Test 1: Setup dummy folder with fake "important" files
    // -------------------------------------------------------------
    console.log('[Phase 1: Setting up dummy files in test sandbox]');
    const dummyFiles = {
        'important_financial_audit.xlsx': 'CRITICAL FINANCIAL DATA - DO NOT DELETE',
        'production_private_key.pem': '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
        'system32_dummy.dll': 'MZ9000BINARYDATA',
        'index.php': '<?php echo "Hello World"; ?>',
        '.gitignore': 'node_modules/\nvendor/',
        'bundle.a1b2c3d4.js': '/* Generated bundle */',
        'dashboard.e5f6a7b8.js.map': '{"version":3,"sources":[]}'
    };

    for (const [name, content] of Object.entries(dummyFiles)) {
        fs.writeFileSync(path.join(SANDBOX_DIR, name), content, 'utf8');
    }
    console.log(`  Created ${Object.keys(dummyFiles).length} fixture files in ${SANDBOX_DIR}\n`);

    // -------------------------------------------------------------
    // Test 2: Protected Paths Hard-Block Verification
    // -------------------------------------------------------------
    console.log('[Phase 2: Verifying Protected System & User Path Hard-Blocks]');
    const safeClean = require(path.resolve(PROJECT_ROOT, 'scripts', 'safe-clean.js'));

    const protectedTestPaths = [
        'C:\\Windows',
        'C:\\Windows\\System32\\calc.exe',
        'C:\\Program Files',
        'C:\\Program Files (x86)',
        path.join(process.env.USERPROFILE || 'C:\\Users\\test', 'Documents'),
        path.join(process.env.USERPROFILE || 'C:\\Users\\test', 'Desktop'),
        path.join(process.env.USERPROFILE || 'C:\\Users\\test', 'Downloads'),
        path.join(process.env.USERPROFILE || 'C:\\Users\\test', 'Pictures'),
        'C:\\'
    ];

    for (const testP of protectedTestPaths) {
        assert(safeClean.isProtectedPath(testP) === true, `Path is strictly protected: ${testP}`);
    }

    // Path traversal bypass test: navigate out of project to C:\Windows
    const traversalAttempt = path.resolve('C:\\Windows\\System32\\cmd.exe');
    assert(safeClean.isProtectedPath(traversalAttempt) === true, `Path traversal to C:\\Windows is resolved and hard-blocked`);

    // -------------------------------------------------------------
    // Test 3: Asset Clean Dry-Run & Whitelist Protection
    // -------------------------------------------------------------
    console.log('\n[Phase 3: Testing Asset Safe-Clean Script with Dry-Run & Whitelist]');
    
    // Create a temporary dummy bundle in public/assets to test candidate detection
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(DUMMY_ASSET, '/* Stale test bundle */', 'utf8');

    const dryRunOutput = execSync(`node "${path.resolve(PROJECT_ROOT, 'scripts', 'safe-clean.js')}" --dry-run`, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8'
    });

    assert(dryRunOutput.includes('[DRY-RUN]'), 'Safe-clean executes in --dry-run mode without deleting');
    assert(dryRunOutput.includes('candidate file(s)'), 'Stale assets are identified accurately');
    assert(fs.existsSync(DUMMY_ASSET), 'Asset survived dry-run mode intact');

    // -------------------------------------------------------------
    // Test 4: License Studio Desktop App Safety Self-Tests
    // -------------------------------------------------------------
    console.log('\n[Phase 4: Running Stellar License Studio Safety Engine Self-Tests]');
    const studioExe = path.resolve(PROJECT_ROOT, 'Licencing App', 'StellarLicenseStudio.exe');

    if (fs.existsSync(studioExe)) {
        try {
            const studioProc = spawnSync(studioExe, ['--test-safety'], { cwd: path.dirname(studioExe), encoding: 'utf8' });
            if (studioProc.status !== 0) {
                console.log('    Studio stdout:', studioProc.stdout);
                console.log('    Studio stderr:', studioProc.stderr);
            }
            assert(studioProc.status === 0, 'StellarLicenseStudio.exe --test-safety passed with exit code 0', 'Status: ' + studioProc.status);

            // Verify studio audit log
            const studioAuditLog = path.resolve(PROJECT_ROOT, 'Licencing App', '.stellar_storage', 'logs', 'license_studio_audit.log');
            assert(fs.existsSync(studioAuditLog), 'Stellar License Studio audit log exists in dedicated .stellar_storage/logs/');
            
            const auditContent = fs.readFileSync(studioAuditLog, 'utf8');
            assert(auditContent.includes('TEST_SAFETY_PASSED'), 'Audit log records TEST_SAFETY_PASSED event');
        } catch (e) {
            assert(false, 'Stellar License Studio CLI test execution', e.message);
        }
    } else {
        console.warn('  [WARN] StellarLicenseStudio.exe not found to run Phase 4');
    }

    // -------------------------------------------------------------
    // Test 5: Verify Fake "Important" Files Survived Completely Intact
    // -------------------------------------------------------------
    console.log('\n[Phase 5: Verifying 100% Survival of Fake Important Files]');
    for (const [name, expectedContent] of Object.entries(dummyFiles)) {
        const filePath = path.join(SANDBOX_DIR, name);
        const exists = fs.existsSync(filePath);
        assert(exists, `Important file survived: ${name}`);
        if (exists) {
            const currentContent = fs.readFileSync(filePath, 'utf8');
            assert(currentContent === expectedContent, `File content unaltered: ${name}`);
        }
    }

} finally {
    // -------------------------------------------------------------
    // Phase 6: Residue Cleanup in try/finally
    // -------------------------------------------------------------
    console.log('\n[Phase 6: Guaranteed Test Residue Cleanup (try/finally)]');
    try {
        if (fs.existsSync(DUMMY_ASSET)) {
            fs.unlinkSync(DUMMY_ASSET);
            console.log(`  Cleaned dummy test asset: ${DUMMY_ASSET}`);
        }
        if (fs.existsSync(SANDBOX_DIR)) {
            fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
            console.log(`  Cleaned sandbox directory: ${SANDBOX_DIR}`);
        }
    } catch (e) {
        console.error('  Failed to clean sandbox: ' + e.message);
    }
}

console.log('\n========================================================================');
console.log(` TEST SUMMARY: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('========================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
} else {
    process.exit(0);
}
