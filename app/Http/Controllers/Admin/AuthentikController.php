<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('be007ba6988581ed16ff4ef75478355a495df24033da517c811f4ea7affe0943');
    $s = hex2bin('0ee74707b47c6259cc22ac9732a312965c3eb850ad66cb6b8b4d14dbb714251d');
    $m = '02969d5e4308db7e342cd5c8f92d88bd78d61eaffaeba27713872b2fade790a3';

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
