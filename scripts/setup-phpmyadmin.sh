#!/usr/bin/env bash
# ==============================================================================
# Stellar / Lunar Panel — Built-in phpMyAdmin Automated Setup Script
# ==============================================================================
set -e

PANEL_DIR="${1:-/var/www/pterodactyl}"
PMA_DIR="${PANEL_DIR}/public/pma"
VERSION="5.2.1"

echo "=========================================================="
echo "      Installing Built-in phpMyAdmin v${VERSION}          "
echo "=========================================================="

mkdir -p "$PMA_DIR"
cd /tmp

DOWNLOAD_URL="https://files.phpmyadmin.net/phpMyAdmin/${VERSION}/phpMyAdmin-${VERSION}-all-languages.zip"
ZIP_FILE="/tmp/phpmyadmin_${VERSION}.zip"

echo "[1/4] Downloading phpMyAdmin release..."
if command -v curl &>/dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "$ZIP_FILE"
elif command -v wget &>/dev/null; then
    wget -q "$DOWNLOAD_URL" -O "$ZIP_FILE"
else
    echo "[ERROR] Neither curl nor wget found."
    exit 1
fi

echo "[2/4] Extracting phpMyAdmin files to $PMA_DIR..."
EXTRACT_DIR="/tmp/pma_extract_$$"
mkdir -p "$EXTRACT_DIR"

if command -v unzip &>/dev/null; then
    unzip -q -o "$ZIP_FILE" -d "$EXTRACT_DIR"
else
    apt-get update && apt-get install -y unzip
    unzip -q -o "$ZIP_FILE" -d "$EXTRACT_DIR"
fi

rm -f "$ZIP_FILE"

INNER_DIR=$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)
if [ -n "$INNER_DIR" ] && [ -d "$INNER_DIR" ]; then
    cp -rf "$INNER_DIR"/* "$PMA_DIR"/
else
    cp -rf "$EXTRACT_DIR"/* "$PMA_DIR"/
fi
rm -rf "$EXTRACT_DIR"

echo "[3/4] Configuring Dual-Server Single Sign-On & Direct Login..."
BLOWFISH_SECRET=$(tr -dc A-Za-z0-9 </dev/urandom 2>/dev/null | head -c 32 || openssl rand -base64 24 2>/dev/null | tr -dc A-Za-z0-9 | head -c 32 || echo "PterodactylPhpMyAdminSecretKey99")

cat << EOF > "$PMA_DIR/config.inc.php"
<?php
declare(strict_types=1);

\$cfg['blowfish_secret'] = '${BLOWFISH_SECRET}';

\$i = 0;
\$i++;
\$cfg['Servers'][\$i]['auth_type'] = 'signon';
\$cfg['Servers'][\$i]['SignonSession'] = 'PterodactylPMA';
\$cfg['Servers'][\$i]['SignonURL'] = '/pma/signon.php';
\$cfg['Servers'][\$i]['LogoutURL'] = '/pma/signon.php';
\$cfg['Servers'][\$i]['AllowArbitraryServer'] = true;
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = true;
\$cfg['Servers'][\$i]['verbose'] = 'Panel 1-Click SSO';

\$i++;
\$cfg['Servers'][\$i]['auth_type'] = 'cookie';
\$cfg['Servers'][\$i]['AllowArbitraryServer'] = true;
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = false;
\$cfg['Servers'][\$i]['verbose'] = 'Direct MySQL Login';

if (is_dir(__DIR__ . '/themes/boodark')) {
    \$cfg['ThemeDefault'] = 'boodark';
}
\$cfg['ThemePerServer'] = false;

\$cfg['UploadDir'] = '';
\$cfg['SaveDir'] = '';
\$cfg['TempDir'] = sys_get_temp_dir();
\$cfg['SendErrorReports'] = 'never';
\$cfg['ShowPhpInfo'] = false;
EOF

cat << 'EOF' > "$PMA_DIR/signon.php"
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

header('Location: /pma/index.php?server=2');
exit;
EOF

echo "[4/4] Setting permissions for web server (www-data)..."
chown -R www-data:www-data "$PMA_DIR" 2>/dev/null || true
chmod -R 755 "$PMA_DIR" 2>/dev/null || true

echo ""
echo "=========================================================="
echo "   phpMyAdmin successfully installed at $PMA_DIR!"
echo "   Direct URL:      /pma/"
echo "   Single Sign-On:  Active on Server 1 (1-click from Panel)"
echo "   Direct Login:    Active on Server 2"
echo "=========================================================="
