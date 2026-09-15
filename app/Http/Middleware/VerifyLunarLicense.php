<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = 'dVU7t1qkBXK4fJkq2JLfhNeKT+uIInBgRZCmEBvTKFWqNv1OMhTOd6nc0ib/36O6ziWT64JcdtbCtpb8axLRlYVQows299At26eYUKTzPk0zGo0fAjYjwuKgyZ7iX1pZnQLbQBtdlwELXuUI5JgrWSqrxw5SCbfDbbDusL5E+/g17HkjSHFFQvk/a0WsBV6OCubLoLXmbP2jDVJ1XaGUHi307ti3Jt8SeD9q9mexea/zZCHwrNtOU6i//cMDoxFU5/RFcdp03iiFpdljOxtB0F1q1igFC8L9T3TXI2LeTCIkO57FSuuRo0t4W2t+soaKBsHmjwpC+GK8YwRvx9jbA3I30mBiA8t4xzUAKdmvt0309z1wpGdam09BS3Sr3ZiibVKDK0RYSAZPTlEzuHeSPptzgOntBe4Fmd6g7cnoj8PUBVT0WhDTRYqiWt2yuMA86nRYifXv8ZTDNM641EcqDsRAP5K2CWKRG04IaNSdQaPXbQCCsgej+fjHuk+1VQfrFkahmgmG/721rCCinI72XptIxlLOUZuJZfYCrE+agMeJv3311MrBpRibfwRBWcUbtlSOIi3JWbYGmhH+Ve89jx26y7PveGkd7O3Qhg+C0VAq2r7jkajSZj4rRr17AV+VTRl/LWbANOVzmk/wBl86s6peBfhzFEC97Ak8bhic/wlJkI6UHHffTrMTB4OsUgHJOBAgy2bPGbT8dmsga1y6qPxmO1YmurqSi7WpG26PDxd57v3sNq/xqr9mZ8DzTwyKUtC98X3FZeoRjSCd8tEGlkpNI+VBWGocs3uKbUM1FI5f2Jao45hf5PfMRJ3bYEE2B69yLgaPkWLiNi+b46j/wRUfOntkIYzSAOX/NhGV07WSKVNviqkufRovfzXytmyngIQHWGHkrZb1RpxSPeqQ5KcMpy0Mur8v70md25NbOrZ49ru6fhj5vO1BsRQtV98SlUbtiT9d5FsWKOc8YROF4C3w1s7xKDnVZFljlUe8+xAbE39QtRjtMH6ylNejlV2DjYcqUwMuYJF0UAqNueqEWZIjCrzGHhkJyDj7ZnRF6LOuph5pIFzdhI/hbJohI3z+U3MRFCdHqouK7w+M4CDQv5OzZP51DC1VEpXWFxjVI41tPyGeSHcspjOfRvEzAaP9vYPSh47ZpuL+bVoexCIiKECRRETJ/g2+ZCLKQEqvq09zW8mMwucO84puPCB0yMbCW2tWxFoMXSxckgDvaI6/0lzIf/7WTZqZ9bSaVTMK2MRr31MEVCQ/oV6D0Y41mzBoOmpJCooduXGV22/wHjJyIqj7KqhLEcVFoGUyd1XbdPs85X7QA0nq48f+zkZFxEYIn0oUjkYmsLctrKcS/+1+VdCuYfiy9ksaKxt0Q8H4W6XwnxPcuoFvlclLuyiyk+AIWBo0IWDZNF2HJSW0ceBD969p+TufJrMrf66V2VhIfte11JQuuHuDdBmD2V0Nq/QhtERyDWwOeN6SZJrG1pAUdOZeRznp62Qi6yXC7okoJQZrXqDIOmEM410jMLGOqokYnR62vh/HU40L6Sb5lDcRpms8grjCrklj6O3+ackh2hKa8duDaqBHPLm3bOcOO2QteJvpAWCM2+Tb7W12eMXuwhV7qdJGunVMAzcLzE9H83gkN4nP8EXxmtxZ4sBzi2xVxIUG/hgdS5WpJLcMTgxE32UxhLqq4Kv/P8rgs3Iinnbpv5kaUMpsZKw8xadB0TN5KljpiC+TwAkddBmDhaOnPeculQg0lqJl6jockg7uAZf9XR8KQ+yfzG6rX3aV0+5bdKMIB14eInt4ez86JOaA1C2wWd1gnSJ0LrYTbB91R4Uq8mA17i2SupgexN1ZAZYxlC8Cr0nwSwzOn6aoPwgXXObJg04OT8MRp8cslBNIjUvhTWLglcVQIRp2Wai0sbrRb3C6qN9v/ggoqTNaZefugi+s9xwwN/WMNJKnW0gZUVn2AVReM+fFuxWHq6bknj6DGihIEI7HtqRrjIr3wwyFWKSJRHNMyrAd1EIQw7IGhqyKOeTjKcf5Lc8rc5w/XHKuzliuk15tkt5bGtRQj4kIVIPLOrdPnDFRZvHCYu+J3iiFPWwSXTokdwt7p7g/QAwWJ8MEdeQDMY5a5exn18oW4A6CO4ZtvNFW3eSfRhnc+pzRLn2kcFNWCsh5t0zMwr6MoLIOUChC/YWSoXCZ6HgrEOC3Bj4slIj+pjMeYo6msXub8nn7CXiO4IXyiLEEXxPL9P4LFdnK3TFIXanTJzvg/pbq5YFHDZLvlys3OIml5bQxIVPFYChA9bJczliykWXrI3LP5bAvY+h8GYcZPIHk3mcvkG9eJci3GyMUIpJHr6Sj8mloDT6n19WNv/QjDk+iYzB5dx7aq5LcbmOOBQRzIyXPQcyIAjsoqNXsP43fgv2fj7vrUms6CE4po13bFpvXoZup1BHNFDLfWmTKKyL3xGHVM3soUTbz5gpWqYeXHK1Wqm4GDPI4L9P/jACNNx+xXjgVaOByCJM3brrTV1ws11K7qk0EVlG94r1uiB4vRyvfd16xTpp3sgyniKvf0TdGCU0ayLKd4luO9zplp57wowx9Kh3PNz0rZD+3fZCI8JK3qDocDvdmu4iGmAbV9Pantmx1zaKHduJG6yo/FoeSEg58IwVZtNgeU7OkSkcFDg1oJ9I997fAnoB+VcjN3MRTKrHXbBXOFKI3AU3nArOy2M4ZkL13fnG9xMU87Typ2fo2663U+JWUjHC8eTXvLN+AOpVMGp9qO1FHosvuH0EXryycrFbvvtrHKPFXzrnzwGIZkwA/WZCqnGAEITHdRGvI88dQo2SLHm5CB+wTiPM7z6bGXscfrLWGb+eHexFxvmntwz3LYsUHEy1xHqaGWHo4H26e6YhKEmYG/0pbuR1wo2jhEKL79QVamohfzjZS8Kmo/VsU/B2uUnQCsXFRzlojmaWRI9N0k9I1/JToqlPkAiCoDIrRbhXhb4P9ND98mGrGs3JT8UlQK4u4TPIP9/ArhI/KhKr5ruOpY5bprj7SSYA8il7Y9GDLHVpUXg4lmrHOXHPhL1m+xBUmfRI4isiUuTC7zbNe+/zrsA9qoLW6fETRbKPJpnjON/28Ki5SkzQCPojq6XG8j/LJMcCL4zc2M+8a1e0e4nDhCSpFI5g8YEWE8yzb6C2Sp8OjnpDE4NQn7xJdEJ5HIOrekuruEBAXG8D6UttDPhOUDkfetlCFjPOsbjNS6/K++9yqMMu0/cW8JAM/Ssjl8c35fT9V2ciENoxwzAhrxTN9KLiz+f6HooPHTbDiyiu6hDB3DTRybe6fwCKy1wyGRx007b1b8Ogg6Ph2FeMeVBBgYWT+7p/hjxWS14zW+02JdAv6INZwMk9DrhQQNkDXNo5gUx1uUA358Z7+gcoiXi30OgDJBblx8ta0uR8UBUPc9ePzZxZ3EI8=';
    $k = hex2bin('bfedb32272b63b39081233a3f9077ff0f8b0623d55868932e40a5daec44c695f');
    $s = hex2bin('356ae3b3f89044afbd2a324c171bab3539db75786f5bc8d8f61119b97f91cd91');
    $m = '919b73c19b8cfbc423b00b253e40cfeabb97088435021477c6b16b167dcefe16';

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
