<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = 'LGgO+JbGSjFaIonAOzENXM+t9dWAcnyQ1lwIpcP4AqFPVK5DbrlORVJBn9IddeCDg8Xp5qBJCH9Cgq9vWerhqyES2WuLoyrz68UhanKjOtxt+Z833bpwddMngxNJUXHT9GTJLxCrS4mJGEtlQCdxphoTrUGYnffvprlyaLNhyI4SCOL+EuxMiD1rjP/KMgvifef+w+s9SB2r+W2MTI/uPYiCq3lh8B2YGhzzBTVpm7lC7zVCuJbT1VMlJNcLuKv1b2Embqnvlaeug7bIbMoGb+49r/J4cX2EIjGjOMkrwazYGoyzwDJjZoe+gyhOmz2a/Rf3GSJe+N7hYsSgi2AOoU4SvhxPoijgSD8OtHiPcA/agttQE15AIQv4lGd8ctDRpTP/2B3ztD28Kugqv6zhByblAG1o0L31S6CckY6clpGqf6Kj+Dx2HAF6FFly1v/0Pg0is71ONRutX6iQhlNlDGi3TWbtkq9lA2Vfb1kteQXLRTysbjpQLwWGx5FAnzYWJTgJiDAPnfNqCjXQIJyKs+Xt9T4MGWL/yxdV7rznZpUKQGC772tcTZGdKTxtv//Sh+NhOsZU9ej0aJgUr19SYnThEs1uHx25fy0qGNENE6mwmH++OxTl5Gj+bFJM4+E6A52YMTEhhiwA2klgSTwqYrWTX0UMovHBqX2YCr3WLW472FOVSm1QEaDRbk98+2n8ACjYGMrlCYb3c2RfzreVztiGX/Adb8gMqv5swPLxlRzxcmI+RTVXqgpr5YrLsOoQ1C0Lj8tbvm7+1+U/7LO5YHUfjgmh2licwP3tnLKyMCQllhSQzr1CUzI5oVW6gIX0b/inohMJWcOQsF6231T5YXSEgMg4abPo9U8oT3wYnM2NRBo8wQBTcLcunZ3KB+TjrfSHVpwvRmbhwsyOQQX4Z/iGU9gHHNF70hTtfuYLV6azUZ2YAY0722XcYJQiQYlO+dJ2bZ1yhKLTjj/Hm8mffQiQd5a/UcXce6myhZ/GEawQq4DU25wzGQl+T/LWd7POQRsUn3AjQryTjBTETrEngbDnCJuxMkJOKvMqjmt6pcDQumOmIHAuhvO0ImLGiAFwMkPA6YCV8FJmlhQo+cTCIzbi4BGS+FNJltiwcJQXJHm6Dp/Wdqi76qg1bVYaICvNE+f05Jcb9HjpbduPq2jKcKEZ0KcGEaxKafDmlA5/0/1WW5Nn+FAov2qoFp9WIQIzMDtlXs2QSbAdBBkf49jyj2HHNRICghVrey4JzASOK/4Dk6UIrQvrj+v1Zq3nYEsAjI4V7JOEHh+5dDwmHLmTB3V8ZfTyWnKurkZ1BWIz6JbKaZgUsK6NbHkRAsRBFfWGqV7UaUVHGDZitHe2jdk5zAMGzfdg4Nu7JdW0q/gwe3pMw6O72Sj3G7ROAUzWNeyZMNqQYf7080TSbFaP5Z4PI6dsMFH6pfHi6vdrzLA4akFlSF/78GrUMjT+CmrbvnG7DqBk9Hs0whuk/ZNlWNg11d8MzMYcXS2khSe7tWVrrWGq5nmazxyDy8LPCGxczEp4aJ8YO0AoSK09TLY2+koReh3VEMDSRC4ydse9oOtafkjFG42hmKZukDu8TBi6Fd4bEGPNt9nMpGTzIK3VMWDxwN51eh5rArYk2+Pn8PvSkcBzcCspYWFinnlbyTbq8WdbnYvVr1g/Lr+qG/rVEVHp5y+YqB0iGfU/ih/TrG6fG/bVBVmJXcNF4Of4XObxmjyD7WWsBiz3JAsNYpbwNsC9J2opl4beNqTAW2SkFsNx0ZFeRMUttBKfud3tiKDDnEkGtGWMAMvS3KzAw/mzdodyb2OxA6+ok9YSBYg3QRlBwu9P3RIEup/KOlb7wHo57XgXNd8vBqbpuTa/rt0sFjXXX/C+FtFfohlorGmBxZoR30jETAABIiXyunKx5/1EHLUeDdnax0JOx6rnXcRz8+yKRd8bo3yOCsesV2v7fEglhMl0lC/rb6nhUxInLDL8mBLq76GZglQwxtIviC15eQgBjnkxoAyTRO2OolZRIeaSmqXl/daZPgOQwWgS5rODWL7MRzCMCenQDqvh/C/VDxzcK5uyGsKt6XLg57LCGA7zoX67h4bgHhRV+/+t/tGKb/VU4yuF1ELXtud0sUK8yS07yNFcaxIFGUwcrDeNTd2o6rn9zPQmQEyQ9aldqhl3AXgym+Rv6plWDLhpptMRq3mDbj49aPCTlbiIQpXc2pnzLjU6zeZ++YxQLeS2zlZO/RuDPRWMt//zxIpNMIz6ANTDtLzxvdbVUHXu6QoFUvdozrY0DRJOZZBHurTJvM3c01Uxz8H9vz1GCiYUSCAMOLMoH7YDCUwLIcKNLfFeIxg3tesFG9cV+IqErx8PB7ffFpJ6NxnMbMxy3a2D/2gfRLLBHHk8+JQQTj8VVR35r02Gfk1mbkM4VSZ2UuzgBhPB8/EG9q6etxlinEzUdvXLapKZONwc//VKqFE7x4u11lZdV6LzIwfi7KIKgO1aXqaLBKpdcACNtKa9G3UyW+/sk1m880RUC3yvWSPG9vvupD6krWiy1dE1buPPMNDvNSUdQbg7XYgJOCTsgUoIIurqbwk1ziIqNg4MSvp91C/Sb/KpUeS3gVhWOkJIlJs2Z8x19NE2kAS3QXzFAb0A5bqCeXR7nh2JimFWQXFdwHTX6p+5WZRV6SQnd7kb5YNSe3FGVAo8q1yj5CDb0vYqIDWuc9JDRZJ/b48bjcM6N9g6CGnwgoAtt6bU2WKZK82yv2lUtbZ5ZzKGaNQANZXUqW8xgCmcBXX6ITMhPkTdsPyUKSqxC/gk2JdMru2BH6DlD8/N23mxOTRrnXa1e+Oh7R4MF6Q0Yd6tz9Xvyfzsis1aT/nXomWmQfcRRVN7r+x5qMeJvsiR8I2bRkviNqEQBx8BLBm7ac+cKjzIJ/ii5phcDFcBYr0I0Iocbe9SxXVFath717Shv2rqHfeAQ/Fzzli8sZx90HwVOUa4fPq46KZAWeIpofblTgRb1Wl+uY1RWzQfjBhVg5R0fcbh8tu4Bf7HsaeNGb8w/BThL4sVEj2o+cX85+R9sHCGylhMVmBl93682DnAsnuThSLRK9IPV0WkdDUbN8OgmnM5rOh19oIbipqEKdyqLllgZPc19nEcBF7w7ktbkhdVIDTwpHztOZZoDRjFq6bdZ9hrj6LwxCre3SOv0xW5+J5wZI9n3qcGZ9T6TahrfB804JnTBdYYA9B+/hBmkmW2KP3W1NmmiWBd1DwcVLr0/+QSxoVOwtQ0NV+4wsLCtbTTZneDprjL4g/Pq4iMNGCo7ZyCV9iQsB9+mPLHhUE6mAcAZOV5qGsrJqXEqJnd8qOfuX015Q7GfYi/8zJnQhPTyK2kU59qs3e2o2UhR/pzL0kJ7/bZR5v7WASTwTO+qx36jJzR3Qbo1grxJvHspT+5lmLNHY6eRwoR8pUrGp07aC4cc9jvxdt21sKUe4vOjAFCZkbdg1t5smXslo2cb9xPwzZP0wF8HHBc25RC5cjnwM2UeHolWaB0rz/PQDBSMoaIW9gc1K6EJxJI4tCbcd4av/v7I+lmgJmBT8u1rZUiuriYHlestMK0x0QpxX+mMm09ySxnLVo9bE0CdOtBaVGWOcB3qMcas3Gmd96x7T0HhIArKcKFI37Pa5NT0jLTRcq12BZyeoc3FC2u7684+I5bqCXa37R7Osb7QKckkccz8QEf1qHa1pH9NIjmVQcwOt8teIi2nLPsZvi1BDLofzy2z88poCqk1BMtzDUkWeVmn00cG1xaYXr+ClFO7GuZEijOd1gCsx1VHLu+MEmcJ2s5fjiw1eyzPrk+lLniWJqV6LQKsR90Hwt8g34ayM2P5Pgvnc0itnqiuVFHkFOgBqx4a/V1/NUJxhwDbnrwPxCNOayDZhm3sn++z1RCl04yCOrr77Zvs6pfZd+V0KRPUA+jn1pEb88CsNeBUM8ylQzEmZKUF9R63IL59l/bjMBMOO7SqqoM2V2lylkKV7V0ft/e0j6LmRNA7WkJzdpX2rlfV5/P6FrpLECUImq80m+0a5Lca+d2FvprZAGd49PyNYVd+pWQ8kmGkjKM8jrDPxuE+B6XDGRvOHxw8UwvNTpn0SMrtrVM4un45lid0NFogKxyQeozhuR7Pgss3421hF43jr2l0ytuTFqZU9rPdUPfDOIWbTqcaRZ3two7amnB72M3+1gBWM3d2O2kY6ugYYw+BeW7hGfY4+UHUIY3+LPReuA+7azXtj4+AtMADgmHu2Ea0GYPc8zckugv6JAL/yV6umk+yumEZXUHR6gf/iaQ';
    $k = hex2bin('c01b3a59377355b9e7386307cfd626220e325a7d9c9e9f2412b7a3dc98d38c9a');
    $s = hex2bin('9052abd0f3cf967546fa29365bdf4e606e310441336abdae0e1a2753252d6416');
    $m = 'a04df7f48309f4486a96548ee8271ec2ecf6187e84385c189a7c704e3307699a';

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
