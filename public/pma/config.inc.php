<?php
/**
 * Built-in phpMyAdmin configuration for Lunar / Stellar Panel
 * Configured automatically for Single Sign-On (SSO) and Dark Theme
 */
declare(strict_types=1);

$cfg['blowfish_secret'] = 'J9IBXOtrabxw4oGh8VIVtR8QxqaYtDXd';

$i = 0;
$i++;
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['AllowArbitraryServer'] = true;
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = false;
$cfg['Servers'][$i]['verbose'] = 'MySQL Database';

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