<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('fb4a88eb223e890fe46a262d3a096ae0f574df1b2e3265594aea8965112e7cf3');
    $s = hex2bin('6f9b8a48b5d9a63956993a6788d0ae1912909a5e2e57b6295fa4bc55af4cc8ea');
    $m = '4e7810671f3b0695b9ea044f6d923712f0fa3c18e44e528505d92b8db01cbf4c';

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
