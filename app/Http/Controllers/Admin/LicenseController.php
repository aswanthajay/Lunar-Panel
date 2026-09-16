<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('ec1666a73f3e6da09946127f22a6881e82d4453428722a52bca8e73b6b9e08e4');
    $s = hex2bin('e61c15fce3d711711171bd0250019d5a10e9fec172b82dae732150102f59dc70');
    $m = '172ab023f03976bb5f344141e60417d52c968e7070cbc36f3837b91f13326db2';

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
