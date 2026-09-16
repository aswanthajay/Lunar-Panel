<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('2ed7dbbf6a6ee03bffb6881eb45550604f322b0b882defd0b0bc6718795d1f06');
    $s = hex2bin('eb77c500f4bea92ee9aa51a313fc3b3504678bfc73add7356b1ec9c9613c78db');
    $m = '13e5ba55b6b456b6203e5a4380b629e064f970b487f658cc3c589c3596c119ec';

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
