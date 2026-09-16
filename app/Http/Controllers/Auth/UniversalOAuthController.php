<?php
/**
 * LUNAR PANEL — ENCRYPTED & TAMPER-SEALED CORE RUNTIME
 * Copyright (c) 2026 Lunar Panel / Votion Cloud. All rights reserved.
 * UNAUTHORIZED MODIFICATION OR EXTRACTION OF THIS FILE VOIDS ALL SYSTEM LICENSES.
 */
declare(strict_types=1);

(function () {
    $p = 'aDPW3aGE31FNESTvR3HRQYIhxJ7UEfCJonB4blRHnUHZxhKCJCfrUWVIJeJXQEI+5DO1PviQzXUX44wSImg7mfgUcU3t/evqxCEIkLp+oe6OrfhkLy4jizjypCSoLZrzvuuGzbsWYDLiEz2Fefzqeu69cl2+AIazLO02UCzLWvsnmS6uj6vlNATuGDB7SUkWHBuFUSX/Fqv9nQGweNB0E9rdnahHkbnlDSj8hAUzRk09zerZdTp3gHDY5qKARkk6RoVZSiMHFfyou86nQZfRefK6emwrmpKjRoegIlhuPD/5DUJLpkf2T5hWszbVujHiZlLCE+PMOjzYBfHLd9e3HzRKQo0c/5ZsxlSEsf7xveWUxCrpHcxU+/pRIoynOpUpNWAVqiDx7TL33BdmWmwQ0dtFMHiwlzqzLxJkwP/Vx81yYU10YmPLQvEsiBPIHJMvTKbG5ngAEzY6n1qn6AKKU9b+nJMPv/4lmS4rzHOzjByCeHdWMED64K5vKLhqyGg7rskYm3ix0c72wkCvUm5qwPAY47ni4+DbKtTbGgWJntK30ZKgYxTmR/34f27YraU6w9HoRJGVZUl/l7D6VYbaEcMTNHTqcUPmGCn3lD6kFE0BrTYXzwApTuYJnWWAgTcOufE5N5fIy1D4tuhUMHFQeatBVNnoM9a5/bBlxVwe9YDn2PByVYS//z82Nmwm5DYmAgltBM4q8VyfjKNuDFUYVCw3OApCRWnT08wCoWT3cJ01FS94y1hBEwu0qc6OGgCZKiOmch53CKfvD1xQA+WZGePd3es+4PK/Alf60NYzkEgCUc46tNfP/QHvhOlYgrcc5W6vSrhmKGXr4gP3ZppIw5Lk88wHICntaaEK6hx3LpbTx7Au3s2dXWXt2HFSDnDfDUZ8QpVlh8IWOMw/O2pbdnsf2z+z4mqwcqcelH+fev/g2WML6gPHvc5l1D78LB2jdiXASRHM636GOYSgkN4EYvUMT5F1DewfXA/ky1UATHMRIhcKR2FRX1Z9KVSWqMksTXlQWv2MDx2dcXHgWS+XTCyVMbSYq5n/uvYw8JMtLkmCUbeLWaDG1kzfwXFwJo010eLhLg2/nTfcChlgWnYVcvvS2rud9O899IwB5lfqzZieeqkbrmlYLYNUbmcQex7SnTagpt2YJeYUNJ7NIfb8kZfwIP7oJ3xUWlKoDdLBUonN0v2MebcTLayDjQLVOicPQgfy6+LVGKlDrjXe0rQxwDAmx1yh8lDhyWz/CBkVwt43c2riV5cDxWj0dM85K0bZfX9PTlOSsimy/aLEUefr34BeJm9YioTDsXybG+IuRTIeQrXvjAqFle9QSHmsJ/+eYddgEG/GWeZr3h47qWsAa+i/9p90br+92X+TV0OAXUZh0cpOFHjWlcSqz61S7uTSBI/S1f6YVgDtEUMHqzdI1tslYb7aldFZ1EG4VuxIx7qx2pXZXcuQ96Ci3H32QgpSj8yJpx2MsHrdNj4Go/GLyEQ8I3lNZopkP+VIAEASUsF+Wn1XjR4mOvgCEqVTyN75PT7p/dqAMiJT0RL/d/wryJqaLwFXGv2vZXNq45T7SrCJhcu9E4G+sl2zizzm5bCaGF5K8/vMntIZAEwFf0yUcA6XOimmZqsJ/QgNrMKAv4UUW9J8rBQVhB7D719pLiKML/rhjKyD0Mv2LRdFgFfAhDHj41aJlo/q4c7J4jgEXCvUEhNQGuFpg+j1x8wlzjtd442E2tAEKXhwUp3dg9npYFwbOD1XdYb2wud3bKguyGHVnUpMsS9nypXlG6MDwvThQtPQna45bAhfVHJ01il4CaLdGvbyEeg8a9SJ4auPZLnl/r9cx1lF0KnxB9xGzckcu0PgQ3o31fYZmlGUo7eyTJ6yaz/VmZV85a/UDmslr+gdDGgUufBPAFVQ1EAkmxetQqDzHsZZijtkldAfdxaPtZuwnGVL68Rzk9x/NE+a2D7CyEGLPCGgkxTscAtR61h9rPxVo/nNUL+ttQbVDLJLolg5IU5Bv2/IFDZ8syVsu9RTLQRmwq3751IE/ySHqIJWGdodSQpvzzZcxqPuQlVscTmhvtoYMqEyBwPwi2ouZdjii00TvA9nduJl83B0DjWItsVuyyBmac9UR04OJ5Fg/tfm8m9997uB2+PktxLX1dF/uhcA/husUyQC1dVRSdVVcd1E8TTIW+qquD4aCGaejfs9IxXL7uT9J4el5E6QLXTSAWQ8d6Rd9uXJHuZQZUQi/45ubf7ojSCuewF/1eaHTPo2EbnWE5ke9ribCF3IxoqdqJzHKGRc5rAW6Ir5XJcavSTYxF2e0sh54AQ65JOYCcXHp7Qm8MDUQGY3u8Eg7nDqN14tUPtsNQZBhq2ioBNtyL8FAHN4LpgbeyDCEISlbbj/idh+QtRO4gOPRll31QFxRVEn9gcrno6duYPpIH0zlKbATCG5YARfg/M8FNS9weql36CXj62dWIhXy3ps0XT/UAr4H5jOBbeLLK5v6RnUKZMUIqjJ/TfA5Xqdi+6JAvRbO7k97Dyj7VGjoyzzWmKekcSJTEP8XuZvBIHUcl6pvLpKNyMgnEuhxuiVGF93CpNfn2wET7ORv6MAbYUq/XObUiLEAB1nMTFUoixPw3lvMnXsWZPPRXdg8hNeHw7JKxDRRKi+BfdRRrx5LS7blFH2bmjujs0o8nCcunJ3WOA+wm2WEANuh16fkcaaFKIZcSdjq8obqk9sguMHlKh/H3I4fsOB9WWNSyvjU+87TPYdTCyzySCZybnXqMwa5okOkQe9UkfnkPjheTpcri0uYYznRnVwF4Kh9bE85ZK/PZgHZycaQg/FckAGo08N7Kcfm0DHWtdixcwDwaSi9cnvCmtlsJYwALpJrHEH7baqFU9X7HfjKZ9SsV4BZxQLFTXwqtEzx3Tn4E5KFeJknPwG0lWnk6Shi58o9ynCz5BDHdnHkZKmcI6cHJcVJ996BRo2FFYtfajstdAPGWiRHdSeLqH10K7WBVh4nH29vvm2ZYc/tAN1HANhWu3SUygvHaBpTceKRWwvDK2Jl7+2s9FI2pQfP80z8s08mrhZ0sKAtWMeWNRJtSXHmtb7YjgMoCv3WXZ+Iagsi+Nxds17MeBI8tqSkLVdUmG5TRO6h8lfkO509Oq1J776q+9cpb/XTTEFmKeJthJJrIArJj+bbX4Pegi3FZ/SC8gRXIMfjZ+nFoEEKg2Z/TKfO0CN04H+iJfynEK0Nxj4Gu8eMV9XGSUc5ZXGA0BlVuR9JgbjluLCMIVh7/+CKwMAhbPZAy1GAnUdvudGIIDZdbn8cXkS5FDf1K/zoy5Y3iHP5D+chwRUOAP/Mh/qqVlYGTQj5ocVylE6Pl69F3ADP3klEKZatK6Z6WWkRIe+UXJRg9eHwYwUHitmDPOEaddb1+KJWAHKK9/P0jcTfOHjKkhcFdtqVnKOlZJWY04tG7o8JgtCs0Ha4y/GQAMFfIpADfZqVH9M3Lkfr5twfPehzY8ZsYJhy1Yq+Y9PVq01lRVL2ceDS6x21yDnc7HvaPvGHptnsBjiGW2QqkU/4iSYWYjyprnZoJD5osu7yzagmqSdwTeWUZTjwkY12sx+/Nnqg99WWY8EusspnlnbuImZ8ogqvsuBZHoBXf9DwsCJTet301a2jWL4GGfpzi+mYZrJjkNn2Mm6HkaFU/yWaAMqZ1rLXp0i4R+C5GZ8PQGrJlyHy2QhSElhmdgRoBmF5XIvYjeY265c3J9+yd8VaQ2Yl11svsepfT6WDv/4262S1mxUDinLkYMSMn/1+Hu6L/13kvuCtQR2tEboX5ugRYlJ8ODeYgmxsn0H53oaqIT3KZ6sUWDZ3PTWNGGxsljvt/9fS12wN/+vtJPTB3YN2gVnrPIe0e0vx6kr0+Wj87/coF/IA1iUHGgTQ+s6uyb5HwPO14SV7feBYtXiMJrALXmKp8X8B78ltZTcw6Xe8WueyGu02teZZ1a/RN5UDJx33EsKAHIEHnp/bTwbf3eP97kmgLu17WDSzZpfa7OhIFdg8fY+Gda/H+XxtojDK94eGzX5kyyzAlmDg4q5zaMXq1W/l6wJwGWgKac8TOZCrcyMyFRZUDujbp8FLZXkNgr20DESo12eI7E9WCJQqozV3MLJOSDj8cwivJ5HOFh6HhgIpANBIGw7R4gtDmPi4HpVlZ6OIY86pdn+d6aFgKtEb/XVbHTxS3U6WxlkTqnJpDQ2L2LpnEg/vX4KFysuAF9WuDENVGclMJxD8UQvc0cHuWLMCHAWtKV+Bpu7AmdUkm+gao4G6sIasP8jK/NzgyHPmWeedQoSojTefqk1KnCTgqf7pkMfOUIgMag8yr1/QXZ3FCFRAIau9jYmV0/wjgt7aIiHB9jPGowhHP3m6hqnRhMjK/YJkacM9MNjtX0MxKuFv38HjBpl5NykjBWsL2+9mo8a3ibdWd2E0M79she5CoovNj+/9PFM8zIxV7PtJ3oqipgyoeftMol3NQsMyee0PaDWlgFl5pxrfhMgEw==';
    $k = hex2bin('6049080210d91dcba74a1bb07abc4ed41caa2baea105b7c0faccf4eb459eed40');
    $s = hex2bin('779766cd454723c53fcaddc5d2aaf9f5ea130fdddac13e36955818f13b65b2c3');
    $m = 'e2724401243cf9b6acb61b216ca0d6501dfa9f5e65c1c3b88e762a51cc9a9805';

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
