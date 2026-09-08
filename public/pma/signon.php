<?php

declare(strict_types=1);

// Bootstrap Laravel console kernel to retrieve the cached one-time token
require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$token = $_GET['token'] ?? null;

if (!empty($token) && \Illuminate\Support\Facades\Cache::has('pma_sso_' . $token)) {
    $data = \Illuminate\Support\Facades\Cache::pull('pma_sso_' . $token);
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connecting to phpMyAdmin...</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background-color: #09090b;
            color: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card {
            background: #111114;
            border: 1px solid #27272a;
            border-radius: 12px;
            padding: 32px 40px;
            text-align: center;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .spinner {
            width: 36px;
            height: 36px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: #06b6d4;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 18px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .title {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 6px;
        }
        .subtitle {
            font-size: 12px;
            color: #a1a1aa;
            font-family: monospace;
        }
        .btn-fallback {
            display: inline-block;
            margin-top: 16px;
            padding: 8px 16px;
            background: #06b6d4;
            color: #000;
            font-weight: 600;
            font-size: 12px;
            border-radius: 6px;
            text-decoration: none;
            cursor: pointer;
            border: none;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="spinner"></div>
        <div class="title">Authenticating Session</div>
        <div class="subtitle">Opening <?= htmlspecialchars($data['db'] ?? 'database', ENT_QUOTES, 'UTF-8') ?>...</div>

        <form id="pma_form" method="post" action="/pma/index.php">
            <input type="hidden" name="pma_username" value="<?= htmlspecialchars($data['user'], ENT_QUOTES, 'UTF-8') ?>">
            <input type="hidden" name="pma_password" value="<?= htmlspecialchars($data['password'], ENT_QUOTES, 'UTF-8') ?>">
            <input type="hidden" name="server" value="1">
            <?php if (!empty($data['db'])): ?>
            <input type="hidden" name="route" value="/database/structure">
            <input type="hidden" name="db" value="<?= htmlspecialchars($data['db'], ENT_QUOTES, 'UTF-8') ?>">
            <?php endif; ?>
            <noscript>
                <button type="submit" class="btn-fallback">Click here to continue</button>
            </noscript>
        </form>
    </div>

    <script>
        document.getElementById('pma_form').submit();
    </script>
</body>
</html>
    <?php
    exit;
}

// If token is missing, expired, or visited directly, redirect to phpMyAdmin login screen
header('Location: /pma/index.php');
exit;
