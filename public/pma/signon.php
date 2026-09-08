<?php

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
);

$token = $_GET['token'] ?? null;

if (!empty($token) && \Illuminate\Support\Facades\Cache::has('pma_sso_' . $token)) {
    $data = \Illuminate\Support\Facades\Cache::pull('pma_sso_' . $token);

    session_name('PterodactylPMA');
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $_SESSION['PMA_single_signon_user'] = $data['user'];
    $_SESSION['PMA_single_signon_password'] = $data['password'];
    $_SESSION['PMA_single_signon_host'] = $data['host'];
    $_SESSION['PMA_single_signon_port'] = (int) $data['port'];
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
