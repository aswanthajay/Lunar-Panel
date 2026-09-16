<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('e5d0bc47d45a566000b8415bd71f05d24af0875cd51e9b27115ce5cc16af45bc');
    $s = hex2bin('ddc2dc89e4c34165e5148441503e5f7de5964f0ff79e40a51797a9f592f75ebd');
    $m = 'a2df4657b8134fd58b43828fc4ccbb6f34453209a358ba835359e13f06bf7d8d';

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
