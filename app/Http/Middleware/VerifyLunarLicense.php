<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('61037beb62ccb7c89bb44f6b2a4c571ee2ae57fae97b42166372e1d3cb6ccc70');
    $s = hex2bin('a5126dfb80557a1dd4bec10c32e180aed8ab4ae29cc1e131c1a401c7cd7d55a9');
    $m = '337453ccc23cb39278830eb06fbf2100be56ead6fed7e96e234d84a2455bdbd6';

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
