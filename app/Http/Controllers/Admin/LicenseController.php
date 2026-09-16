<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('11315d98ea47512b693c07dac4e736535a5cb0d264cf7b47b83da757a17021f4');
    $s = hex2bin('d7613abaa0fde6adfb06fc89827852feba50abadc39c38a3f9d454c6bcdec5c9');
    $m = '7348d2fc8bbeca4d59bd0843cba685c94f0108b45eefcffd707723ef2df9e166';

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
