<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('33a4e1224beea076dd84e14f0b56a2339aff77010adbc3211af64e654c918668');
    $s = hex2bin('90f62a46a5e12dd34f96f53e86b0457f20d5527f8c1bbd100f200c369b8d56df');
    $m = 'd149844bcd4f685929be95d5a6c9f3a91cadb2338bb6e40d19fc4331dbb9baed';

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
