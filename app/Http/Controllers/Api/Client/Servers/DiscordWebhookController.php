<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('e6e30193e178534f3e7b5327d63f7cddd265109a2199e3f248b2a8e3e4354f55');
    $s = hex2bin('116f8e144f1909ed71b9f8b886aabbab23f183203fa5ead1d8b9020a4e1845f0');
    $m = 'b68df0757d067ee9839e8df15225fd8be25f8d3bfc45ba9b85705c86fcacb886';

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
