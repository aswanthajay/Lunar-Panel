<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('83edd5dfa7b2e3acddf72f4c2d6ef0c0948cdfaf48ff6b6dee23897c65e25eb0');
    $s = hex2bin('0b3b34ab9a7034316b48a3fcbb13d1776a64a995de4a0e7972682b451c7d3cd1');
    $m = '92c6986d8c1c1d5cb72742d670f9eacf7c9c865431e3a68b3038f22a3ad064bf';

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
