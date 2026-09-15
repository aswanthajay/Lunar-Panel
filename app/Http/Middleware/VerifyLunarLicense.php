<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('6b630c5fc38c71cfe344990484af25a2b400cf989c2d2eb413b514b8fd4418fe');
    $s = hex2bin('2e3549fe26e2af4407f708f2f204fa6de5b747875f5d37d44f8b068eb3de6ddf');
    $m = 'f6e7715eb24dfc54fe38c28f761f488ab652cb2ca6b9ca68fd449aa6908f45f5';

    $raw = base64_decode($p, true);
    if ($raw === false || strlen($raw) <= 16) {
        header('HTTP/1.1 500 Core Integrity Failure');
        exit("Fatal error: Lunar Panel core container is corrupted.\n");
    }

    // Cryptographic self-integrity verification
    if (!hash_equals($m, hash_hmac('sha256', $raw, $s))) {
        header('HTTP/1.1 500 Core Integrity Violation');
        exit("Fatal error: Lunar Panel core integrity violation. Code has been tampered with or modified.\n");
    }

    $iv = substr($raw, 0, 16);
    $ct = substr($raw, 16);
    $dec = openssl_decrypt($ct, 'AES-256-CBC', $k, OPENSSL_RAW_DATA, $iv);

    if ($dec === false) {
        header('HTTP/1.1 500 Core Decryption Failure');
        exit("Fatal error: Failed to initialize Lunar Panel core runtime.\n");
    }

    unset($p, $k, $s, $m, $raw, $iv, $ct);
    eval($dec);
})();
