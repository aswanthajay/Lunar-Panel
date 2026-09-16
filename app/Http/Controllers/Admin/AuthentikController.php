<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('677fb79279deb52d3cbf2a058d1858cf6f6f62e2f576f8067589d1450e7cc131');
    $s = hex2bin('5032a91a9aa9c40ac7985f14b88fac31486d5c17ba10ba7079e8f6da686064b2');
    $m = '5450aaf7c59613db264a81f3891ae827d969444466fa283729ba02d2494282c4';

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
