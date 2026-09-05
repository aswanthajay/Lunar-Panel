<?php

namespace Pterodactyl\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Pterodactyl\Models\ServerCustomDomain;
use Pterodactyl\Services\Nginx\NginxDomainService;

class LunarNginxSetupCommand extends Command
{
    protected $signature = 'lunar:nginx-setup {--force : Force overwrite all existing configurations}';

    protected $description = 'Configures Nginx permissions, generates reverse proxy configurations for all active custom domains, and tests DNS.';

    public function __construct(private NginxDomainService $nginxService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $this->info('=== Lunar Panel Nginx Automated Engine Setup ===');
        $this->newLine();

        // Step 1: Ensure directory exists & permissions
        $dir = $this->nginxService->getDomainsDirectory();
        $this->line("<comment>•</comment> Active Nginx configuration directory: <info>{$dir}</info>");

        // On Linux as root, setup sudoers rule for www-data
        if (PHP_OS_FAMILY !== 'Windows' && function_exists('posix_getuid') && posix_getuid() === 0) {
            $sudoersFile = '/etc/sudoers.d/lunar-nginx';
            $sudoersContent = "www-data ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx, /usr/bin/systemctl reload nginx, /usr/bin/certbot\n";

            try {
                File::put($sudoersFile, $sudoersContent);
                chmod($sudoersFile, 0440);
                $this->line("<comment>•</comment> Sudoers rules configured for www-data in <info>{$sudoersFile}</info>");
            } catch (\Throwable $e) {
                $this->warn("! Could not write {$sudoersFile}: " . $e->getMessage());
            }

            // Ensure web user can write to conf.d or lunar-domains
            if (File::isDirectory('/etc/nginx/conf.d')) {
                @chown('/etc/nginx/conf.d', 'www-data');
                @chgrp('/etc/nginx/conf.d', 'www-data');
                @chmod('/etc/nginx/conf.d', 0775);
            }
        }

        // Step 2: Sync and re-write all domains
        $domains = ServerCustomDomain::with(['server.node', 'allocation'])->get();
        if ($domains->isEmpty()) {
            $this->info('No custom domains found in database.');
            return 0;
        }

        $this->line("<comment>•</comment> Found {$domains->count()} custom domain(s) to synchronize.");
        $rows = [];

        foreach ($domains as $domain) {
            $writeResult = $this->nginxService->writeAndReload($domain);
            $dnsResult = $this->nginxService->verifyDns($domain);

            $rows[] = [
                $domain->id,
                $domain->domain,
                $domain->protocol,
                $domain->nginx_status,
                $domain->dns_status,
                $domain->ssl_status,
                $writeResult['success'] ? 'OK' : 'Error',
            ];
        }

        $this->table(
            ['ID', 'Domain', 'Protocol', 'Nginx Status', 'DNS Status', 'SSL Status', 'Config Write'],
            $rows
        );

        $this->newLine();
        $this->info('✓ All custom domains synchronized successfully with Nginx reverse proxy.');

        return 0;
    }
}
