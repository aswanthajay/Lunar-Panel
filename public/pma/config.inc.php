<?php
/**
 * Built-in phpMyAdmin configuration for Lunar / Stellar Panel
 * Configured automatically for Single Sign-On (SSO) and Dark Theme
 */
declare(strict_types=1);

// Prevent any PHP deprecations, notices or warnings from corrupting AJAX JSON responses
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT & ~E_NOTICE & ~E_WARNING);

$cfg['blowfish_secret'] = 'J9IBXOtrabxw4oGh8VIVtR8QxqaYtDXd';

$ssoSessionName = 'SignonSession';

$i = 0;
$i++;

// If a SignonSession cookie exists, authenticate via signon; otherwise fall back to standard cookie
if (!empty($_COOKIE[$ssoSessionName])) {
    $cfg['Servers'][$i]['auth_type'] = 'signon';
    $cfg['Servers'][$i]['SignonSession'] = $ssoSessionName;
    $cfg['Servers'][$i]['SignonURL'] = '/pma/signon.php';
} else {
    $cfg['Servers'][$i]['auth_type'] = 'cookie';
}

$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = 3306;
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = false;
$cfg['Servers'][$i]['verbose'] = 'MySQL Database';

// Allow manual login to arbitrary hosts if accessed directly
$cfg['AllowArbitraryServer'] = true;

// Dark Theme Defaults
if (is_dir(__DIR__ . '/themes/boodark')) {
    $cfg['ThemeDefault'] = 'boodark';
}
$cfg['ThemePerServer'] = false;

// Directories
$cfg['UploadDir'] = '';
$cfg['SaveDir'] = '';
$cfg['TempDir'] = sys_get_temp_dir();
$cfg['SendErrorReports'] = 'never';
$cfg['ShowPhpInfo'] = false;