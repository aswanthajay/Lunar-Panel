<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('7fa18d4a03dce19abc20202eabea223b2c582b977218ea86137621ce758f71f7');
    $s = hex2bin('d3bee89163a66bcaa165a0a91e19d5373866bee15f6bff55a03beee50ec03b9f');
    $m = 'd0ff0e1f776792843566d3ba330e0f180c600e596d7ddaa402c22718e3ae8686';

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
