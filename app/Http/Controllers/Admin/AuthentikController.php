<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('8523f1b7b2387cdaf0438790feaa1a67d615706717478edbe780dea37dcca6a7');
    $s = hex2bin('ee2f1ac1dabd2e30890ac676c6062b8822b3fdb46d096c4395fe0e0fba8d5906');
    $m = '333a761ea9f97b0278df28dd6f7a0fc06d58f6d16d2f8f293eeeeb2cc9619715';

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
