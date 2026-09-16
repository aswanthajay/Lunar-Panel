<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('3e4acbab9f67370c8766814a2cd48f653dd4c8e1365b653de3a9e6c3b3bdf137');
    $s = hex2bin('cdcaca74e75fb7e1643eeeceee4dfc65b57aa51fd64b7a41fefe9ba77066121d');
    $m = '7bc30271380092a857f82881daf5d1b9b70ece325f04339b08204d651cadcee2';

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
