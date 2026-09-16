<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('95eae500f4799f8adc15ee8a559b2b68dacf43acd7092037cbd17d84757c8b68');
    $s = hex2bin('16234a0bc51b7fdfdc26f5244ac13c05bc67bff4e77372050e94f69778bcc1a2');
    $m = 'f723add9c366f8f81aa5d9eada675e2274839d3a1aa640e0afeb2a08f2ec8628';

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
