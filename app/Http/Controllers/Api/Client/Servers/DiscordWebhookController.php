<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('cc28d5203cd0b1192ecd0c539441d569ae5057e8a5561a6eb79e91d51ad77a61');
    $s = hex2bin('ff22d40c7e69d3dde2fe98f573f31101cb898279ad065bb1c2bfc410ac21fa7d');
    $m = '9138a3e3c77a90ffe4ab7df641cfeb0761f8baf200c7eaa49d9de5528b805e17';

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
