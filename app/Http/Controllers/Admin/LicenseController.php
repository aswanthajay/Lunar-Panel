<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = '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';
    $k = hex2bin('8f8ce660821423c7890f59c5770bafe7b3bdaafe322ac7e08945031db3cdbb10');
    $s = hex2bin('6ad5ef50ce06715cac9b1ceb2c257a6058cb5d3d862923d68a6294012b10a9b1');
    $m = '65c35289f6a0519cafcf2e2f135f8fb63c2838b279b4e1d92e0d4a354d39bad9';

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
