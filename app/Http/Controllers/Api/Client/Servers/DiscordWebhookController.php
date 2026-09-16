<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('8670ef720ba5ebc528cceb3e5e0a4e11489993b7d44b7ffb79269118e825f745');
    $s = hex2bin('e2dfed23b079e3ac5cb314fad48a386559ee3b5fa09e1e884d904fb8cc4a7235');
    $m = 'd42be55c0718c4bdaab4ab9cf4c8375f35794a8daa3c6f50caba81a405b2fce3';

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
