<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('c41e370d1938734ee6b2e89e58d3dac51d2732d04c598a36fb86a45605ffaaaf');
    $s = hex2bin('33076057d1db6cabf97e34f7b587b12a3ee20f9231a2ae39c2f78fa4234bbab4');
    $m = 'a5d9d132b5b9e6cba75666b2b6ee3f2e22719653990c18c527cfc8d35649cc49';

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
