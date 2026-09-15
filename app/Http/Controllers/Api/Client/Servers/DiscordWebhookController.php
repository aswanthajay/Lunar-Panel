<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('da57376f7a7cb0c5483d8fdc6400ec6bd75b7b552dbccb2d224ea0f15e413fc0');
    $s = hex2bin('65e6c2623ecff1b7547e6abfe921de3ea7584baf5f640a2d749c4faf8dc4b1a5');
    $m = '31172f347c7ba16606c28a09f8e6344690da3d26986fe5c97beb3b82acbc5268';

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
