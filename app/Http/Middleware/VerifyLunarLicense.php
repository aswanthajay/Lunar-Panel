<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('e2d5a9ec118c5c17d37d34fb893dd63b7a94e4a380e5cfbe2da46fa1380526ef');
    $s = hex2bin('835520579f18c75f90890f0bf04cc79edb5f00e57b7deabb71c6184ebba4a029');
    $m = '9d1f8c7bb41d470d92a6d1df36c53f5a1b87fe9faaee74b9c0b581e19e6fff10';

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
