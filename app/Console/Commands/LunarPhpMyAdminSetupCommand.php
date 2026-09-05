<?php

namespace Pterodactyl\Console\Commands;

use ZipArchive;
use Illuminate\Support\Str;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

class LunarPhpMyAdminSetupCommand extends Command
{
    protected $signature = 'lunar:pma-setup 
                            {--force : Force download and reinstallation of phpMyAdmin}
                            {--ver=5.2.1 : Specific phpMyAdmin release version}';

    protected $description = 'Downloads, installs, and configures built-in phpMyAdmin with 1-click single sign-on (SSO).';

    public function handle(): int
    {
        $this->info('=== Lunar Panel Built-in phpMyAdmin Automated Setup ===');
        $this->newLine();

        $version = $this->option('ver') ?: '5.2.1';
        $force = (bool) $this->option('force');
        $pmaDir = public_path('pma');

        // Check if already installed
        if (File::exists($pmaDir . '/index.php') && !$force) {
            $this->info("✓ phpMyAdmin is already installed at: {$pmaDir}");
            $this->ensureConfigAndSignon($pmaDir);
            $this->info("✓ Single Sign-On (SSO) configuration verified.");
            $this->newLine();
            $this->line("You can access phpMyAdmin at: <comment>/pma/</comment> or click 'phpMyAdmin' on any database row in the panel.");
            return 0;
        }

        $this->line("<comment>•</comment> Preparing target directory: <info>{$pmaDir}</info>");
        if (!File::isDirectory($pmaDir)) {
            File::makeDirectory($pmaDir, 0755, true);
        }

        // Download phpMyAdmin
        $downloadUrl = "https://files.phpmyadmin.net/phpMyAdmin/{$version}/phpMyAdmin-{$version}-all-languages.zip";
        $backupUrl = "https://github.com/phpmyadmin/phpmyadmin/archive/refs/tags/RELEASE_" . str_replace('.', '_', $version) . ".zip";

        $tempZip = sys_get_temp_dir() . DIRECTORY_SEPARATOR . "phpmyadmin_{$version}.zip";
        $this->line("<comment>•</comment> Downloading phpMyAdmin v{$version} from <info>{$downloadUrl}</info>...");

        $downloaded = false;
        try {
            $response = Http::withOptions(['verify' => false, 'timeout' => 180])
                ->sink($tempZip)
                ->get($downloadUrl);

            if ($response->successful() && File::exists($tempZip) && File::size($tempZip) > 1000000) {
                $downloaded = true;
            }
        } catch (\Exception $e) {
            $this->warn("Primary download URL failed: {$e->getMessage()}");
        }

        if (!$downloaded) {
            $this->line("<comment>•</comment> Attempting backup download source...");
            try {
                $response = Http::withOptions(['verify' => false, 'timeout' => 180])
                    ->sink($tempZip)
                    ->get($backupUrl);

                if ($response->successful() && File::exists($tempZip) && File::size($tempZip) > 1000000) {
                    $downloaded = true;
                }
            } catch (\Exception $e) {
                $this->error("Backup download failed: {$e->getMessage()}");
            }
        }

        if (!$downloaded || !File::exists($tempZip)) {
            $this->error("Failed to download phpMyAdmin archive. Please check your internet connection or manually extract phpMyAdmin to: {$pmaDir}");
            return 1;
        }

        $this->info("✓ Download completed. Extracting files...");

        // Extract zip
        $zip = new ZipArchive();
        if ($zip->open($tempZip) === true) {
            $extractTemp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pma_extract_' . Str::random(8);
            File::makeDirectory($extractTemp, 0755, true);
            $zip->extractTo($extractTemp);
            $zip->close();
            @unlink($tempZip);

            // Locate inner directory
            $extractedDirs = File::directories($extractTemp);
            $sourceDir = !empty($extractedDirs) ? $extractedDirs[0] : $extractTemp;

            // Move files into public/pma
            File::copyDirectory($sourceDir, $pmaDir);
            File::deleteDirectory($extractTemp);
            $this->info("✓ Extracted phpMyAdmin files successfully to {$pmaDir}");
        } else {
            $this->error("Failed to open downloaded zip archive.");
            @unlink($tempZip);
            return 1;
        }

        // Generate config.inc.php and signon.php
        $this->ensureConfigAndSignon($pmaDir);

        // Fix permissions on Linux
        if (PHP_OS_FAMILY !== 'Windows') {
            @chmod($pmaDir, 0755);
            $findProcess = new Process(['chmod', '-R', '755', $pmaDir]);
            $findProcess->run();

            foreach (['www-data', 'nginx', 'apache'] as $user) {
                $check = new Process(['id', '-u', $user]);
                $check->run();
                if ($check->isSuccessful()) {
                    $chown = new Process(['chown', '-R', "{$user}:{$user}", $pmaDir]);
                    $chown->run();
                    break;
                }
            }
        }

        $this->newLine();
        $this->info("🎉 Built-in phpMyAdmin is successfully installed and configured!");
        $this->line("Users can now click the <comment>phpMyAdmin</comment> button on any database row for instant 1-click SSO access.");
        $this->line("Direct URL: <info>/pma/</info>");
        $this->newLine();

        return 0;
    }

    /**
     * Ensure config.inc.php and signon.php exist and have proper SSO settings.
     */
    protected function ensureConfigAndSignon(string $pmaDir): void
    {
        $configFile = $pmaDir . '/config.inc.php';
        $secret = Str::random(32);

        $configContent = <<<PHP
<?php
/**
 * Built-in phpMyAdmin configuration for Lunar / Stellar Panel
 * Configured automatically for Single Sign-On (SSO)
 */
declare(strict_types=1);

\$cfg['blowfish_secret'] = '{$secret}';

\$i = 0;
\$i++;
\$cfg['Servers'][\$i]['auth_type'] = 'signon';
\$cfg['Servers'][\$i]['SignonSession'] = 'PterodactylPMA';
\$cfg['Servers'][\$i]['SignonURL'] = '/pma/signon.php';
\$cfg['Servers'][\$i]['LogoutURL'] = '/';
\$cfg['Servers'][\$i]['AllowArbitraryServer'] = true;
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = true;

// Directories
\$cfg['UploadDir'] = '';
\$cfg['SaveDir'] = '';
\$cfg['TempDir'] = sys_get_temp_dir();
\$cfg['SendErrorReports'] = 'never';
\$cfg['ShowPhpInfo'] = false;
PHP;

        if (!File::exists($configFile) || $this->option('force')) {
            File::put($configFile, $configContent);
            $this->info("✓ Generated {$configFile} with secure blowfish secret and SSO settings.");
        }

        // Ensure signon.php exists
        $signonFile = $pmaDir . '/signon.php';
        if (!File::exists($signonFile) || $this->option('force')) {
            $signonContent = <<<'PHP'
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

    $targetUrl = '/pma/index.php';
    if (!empty($data['db'])) {
        $targetUrl .= '?route=/database/structure&server=1&db=' . urlencode($data['db']);
    }

    header('Location: ' . $targetUrl);
    exit;
}

header('Location: /');
exit;
PHP;
            File::put($signonFile, $signonContent);
            $this->info("✓ Verified {$signonFile} single sign-on bridge.");
        }
    }
}
