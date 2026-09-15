<?php

namespace Pterodactyl\Console\Commands\License;

use Illuminate\Console\Command;
use Pterodactyl\Services\Licensing\LicenseManager;

class GenerateLicenseCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'lunar:license:generate
        {--domain= : The domain or pattern the license is bound to (e.g. panel.example.com or *.example.com or *)}
        {--customer= : The customer or organization name}
        {--tier=enterprise : The license tier (starter, pro, enterprise, lifetime)}
        {--days= : The number of days the license is valid for (omit for lifetime)}
        {--key-file= : Path to the private key file (defaults to storage/lunar_master.key)}';

    /**
     * The console command description.
     */
    protected $description = 'Generate an RSA-2048 cryptographically signed license key for a Lunar Panel client';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $domain = $this->option('domain');
        if (empty($domain)) {
            $domain = $this->ask('Enter the client domain (e.g. panel.example.com or * for all)');
        }

        $customer = $this->option('customer') ?: $this->ask('Enter the customer/organization name', 'Commercial Licensee');
        $tier = strtolower($this->option('tier') ?: 'enterprise');
        $days = $this->option('days') !== null ? (int) $this->option('days') : null;

        // Locate private key
        $keyPath = $this->option('key-file') ?: base_path('storage/lunar_master.key');
        $privateKeyPem = '';

        if (file_exists($keyPath)) {
            $privateKeyPem = file_get_contents($keyPath);
        } elseif (env('LUNAR_PRIVATE_KEY')) {
            $privateKeyPem = env('LUNAR_PRIVATE_KEY');
        }

        if (empty($privateKeyPem)) {
            $this->error("Private key not found at: {$keyPath}");
            $this->line("Ensure your master private key is placed at 'storage/lunar_master.key' or set in 'LUNAR_PRIVATE_KEY'.");
            return 1;
        }

        $expiresAt = $days !== null && $days > 0 ? time() + ($days * 86400) : null;

        try {
            $licenseKey = LicenseManager::createLicenseKey(
                $privateKeyPem,
                $domain,
                $customer,
                $tier,
                $expiresAt
            );
        } catch (\Throwable $e) {
            $this->error("Failed to generate license: " . $e->getMessage());
            return 1;
        }

        $this->info('');
        $this->info('===========================================================');
        $this->info('           LUNAR PANEL SIGNED LICENSE KEY ISSUED           ');
        $this->info('===========================================================');
        $this->line("<comment>Domain:</comment>       {$domain}");
        $this->line("<comment>Customer:</comment>     {$customer}");
        $this->line("<comment>Tier:</comment>         " . strtoupper($tier));
        $this->line("<comment>Expires:</comment>      " . ($expiresAt ? date('Y-m-d H:i:s T', $expiresAt) . " ({$days} days)" : 'Lifetime (Never Expires)'));
        $this->info('-----------------------------------------------------------');
        $this->line("<info>{$licenseKey}</info>");
        $this->info('-----------------------------------------------------------');
        $this->line("Provide this key to the customer to put in their <comment>.env</comment> as:");
        $this->line("<comment>LUNAR_LICENSE_KEY={$licenseKey}</comment>");
        $this->line("Or enter it in their Admin CP at <comment>/admin/license</comment>.");
        $this->info('===========================================================');
        $this->info('');

        return 0;
    }
}
