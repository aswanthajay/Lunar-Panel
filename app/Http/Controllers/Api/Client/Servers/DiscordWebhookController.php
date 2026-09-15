<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('ee43f4464ce579f3b82d27a8cd9a56fa306956bd11141a6671e7187b527c9ea8');
    $s = hex2bin('ba1ea0c8f7d090006ad94ccf4aed9e2fa4224c30561c1abe9b5a2d63036ef8f8');
    $m = '888197ccc7aac265c649e74b0072a44f30bb4ec1551843f9a051200d330e9b13';

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
