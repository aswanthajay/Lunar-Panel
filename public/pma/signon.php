<?php

declare(strict_types=1);

// Bootstrap Laravel cleanly without triggering HTTP routing / session middleware
require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$token = $_GET['token'] ?? null;

if (!empty($token) && \Illuminate\Support\Facades\Cache::has('pma_sso_' . $token)) {
    $data = \Illuminate\Support\Facades\Cache::pull('pma_sso_' . $token);

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
        || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443);

    ini_set('session.use_cookies', '1');
    ini_set('session.use_only_cookies', '1');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_name('PterodactylPMA');
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $targetHost = $data['host'] ?? '127.0.0.1';
    $targetPort = (int) ($data['port'] ?? 3306);

    // If host is an external FQDN or IP, check if it is reachable from loopback.
    // If blocked or not listening on external IP, fallback to 127.0.0.1 / localhost.
    if ($targetHost !== '127.0.0.1' && $targetHost !== 'localhost') {
        $fp = @fsockopen($targetHost, $targetPort, $errno, $errstr, 1);
        if ($fp) {
            fclose($fp);
        } else {
            $fpLocal = @fsockopen('127.0.0.1', $targetPort, $errno, $errstr, 1);
            if ($fpLocal) {
                fclose($fpLocal);
                $targetHost = '127.0.0.1';
            } else {
                $targetHost = 'localhost';
            }
        }
    }

    $_SESSION['PMA_single_signon_user'] = $data['user'];
    $_SESSION['PMA_single_signon_password'] = $data['password'];
    $_SESSION['PMA_single_signon_host'] = $targetHost;
    $_SESSION['PMA_single_signon_port'] = $targetPort;
    $_SESSION['PMA_single_signon_HMAC_secret'] = hash('sha1', uniqid(strval(random_int(0, mt_getrandmax())), true));
    $_SESSION['PMA_single_signon_cfg']['db'] = $data['db'] ?? '';

    session_write_close();

    $targetUrl = '/pma/index.php?server=1';
    if (!empty($data['db'])) {
        $targetUrl .= '&route=/database/structure&db=' . urlencode($data['db']);
    }

    header('Location: ' . $targetUrl);
    exit;
}

// If token is missing, expired, or direct visit, send to phpMyAdmin direct login (server=2)
header('Location: /pma/index.php?server=2');
exit;
