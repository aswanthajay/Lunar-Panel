<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('104816666cc237f6d925e10ab7c1a11d38d61b6314e9a6f7df5b4cfae02882c5');
    $s = hex2bin('423a1ca298719f882a2fce0126b4b3a72e9e9d24ff1d666246e66a6cfea2a9ab');
    $m = '11ff9f382378f05fefc6bda47d449615a3d76119837a5c0e399890a12f32c218';

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
