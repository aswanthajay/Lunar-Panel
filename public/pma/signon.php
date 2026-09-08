<?php

declare(strict_types=1);

// Bootstrap Laravel console kernel to retrieve the cached one-time token
require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$token = $_GET['token'] ?? null;

if (!empty($token) && \Illuminate\Support\Facades\Cache::has('pma_sso_' . $token)) {
    $data = \Illuminate\Support\Facades\Cache::pull('pma_sso_' . $token);

    if (is_array($data) && !empty($data['user']) && isset($data['password'])) {
        $targetHost = $data['host'] ?? '127.0.0.1';
        $targetPort = (int) ($data['port'] ?? 3306);

        // If target host is not localhost, test if directly reachable via TCP; fallback to 127.0.0.1 if not reachable
        if ($targetHost !== '127.0.0.1' && $targetHost !== 'localhost') {
            $fp = @fsockopen($targetHost, $targetPort, $errno, $errstr, 1);
            if ($fp) {
                fclose($fp);
            } else {
                $fpLocal = @fsockopen('127.0.0.1', $targetPort, $errno, $errstr, 1);
                if ($fpLocal) {
                    fclose($fpLocal);
                    $targetHost = '127.0.0.1';
                }
            }
        }

        // Clear any old phpMyAdmin session cookies
        if (isset($_COOKIE['phpMyAdmin'])) {
            setcookie('phpMyAdmin', '', time() - 3600, '/');
            setcookie('phpMyAdmin', '', time() - 3600, '/pma/');
        }
        if (isset($_COOKIE['pmaUser-1'])) {
            setcookie('pmaUser-1', '', time() - 3600, '/');
            setcookie('pmaUser-1', '', time() - 3600, '/pma/');
        }
        if (isset($_COOKIE['pmaAuth-1'])) {
            setcookie('pmaAuth-1', '', time() - 3600, '/');
            setcookie('pmaAuth-1', '', time() - 3600, '/pma/');
        }

        // Configure cookie params to ensure SignonSession is accessible by phpMyAdmin
        ini_set('session.use_cookies', '1');
        $isSecure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $isSecure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_name('SignonSession');
        session_start();

        $_SESSION['PMA_single_signon_user'] = $data['user'];
        $_SESSION['PMA_single_signon_password'] = $data['password'];
        $_SESSION['PMA_single_signon_host'] = $targetHost;
        $_SESSION['PMA_single_signon_port'] = $targetPort;
        $_SESSION['PMA_single_signon_cfgupdate'] = [
            'verbose' => $data['db'] ?? 'MySQL Database',
            'host' => $targetHost,
            'port' => $targetPort,
        ];
        $_SESSION['PMA_single_signon_HMAC_secret'] = hash('sha1', uniqid((string) random_int(0, mt_getrandmax()), true));
        session_write_close();

        $redirectUrl = '/pma/index.php';
        if (!empty($data['db'])) {
            $redirectUrl .= '?route=/database/structure&db=' . urlencode($data['db']) . '&server=1';
        }
        header('Location: ' . $redirectUrl);
        exit;
    }
}

// If token is missing, expired, or visited directly (e.g. after logout), clear SignonSession and redirect to cookie login
if (isset($_COOKIE['SignonSession'])) {
    session_name('SignonSession');
    @session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    @session_destroy();
}

header('Location: /pma/index.php');
exit;
