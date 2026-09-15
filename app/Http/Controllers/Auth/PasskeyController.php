<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('0818af4078a20757379e0d7b5cde4d6f69f82aaf21627d1243b839dc3b5be5d7');
    $s = hex2bin('098611e446a308aff36b17f668d210edde535adff5b08c8cd4ebfe56c3fed582');
    $m = '28342f784500b21165ed523516f5b2224b8d185b90d179a5d99fabfe2c3475b4';

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
