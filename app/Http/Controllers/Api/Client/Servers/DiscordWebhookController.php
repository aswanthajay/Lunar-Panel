<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('d909c4d32c38cfac3e99117fcc71882ea68d458c3eef604543ccd6bb8a563c2b');
    $s = hex2bin('1c84c8de612bf85088f1f7facb76571ec172c35dc426f374e0a5aa75bf07edce');
    $m = '4ce1c458b7b10439719fea66d393bb92132136a3898a81c385f6ad1669c4c8ee';

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
