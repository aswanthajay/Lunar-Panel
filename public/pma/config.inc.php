<?php
/**
 * Built-in phpMyAdmin configuration for Lunar / Stellar Panel
 * Configured automatically for Single Sign-On (SSO) and Dark Theme
 */
declare(strict_types=1);

$cfg['blowfish_secret'] = 'J9IBXOtrabxw4oGh8VIVtR8QxqaYtDXd';

// Check if an active Single Sign-On session exists
$ssoSessionName = 'SignonSession';
$isSso = false;

if (!empty($_COOKIE[$ssoSessionName])) {
    $currName = session_name();
    $currId = session_id();
    session_name($ssoSessionName);
    session_id($_COOKIE[$ssoSessionName]);
    @session_start();
    if (!empty($_SESSION['PMA_single_signon_user'])) {
        $isSso = true;
    }
    session_write_close();
    session_name($currName);
    if (!empty($currId)) {
        session_id($currId);
    }
}

$i = 0;
$i++;

if ($isSso) {
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