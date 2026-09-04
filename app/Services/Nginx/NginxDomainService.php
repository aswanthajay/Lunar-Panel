<?php

namespace Pterodactyl\Services\Nginx;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\ServerCustomDomain;
use Symfony\Component\Process\Process;

class NginxDomainService
{
    /**
     * Get the target directory where Nginx configuration files should be placed.
     */
    public function getDomainsDirectory(): string
    {
        $configuredPath = config('nginx.domains_path', '/etc/nginx/conf.d/lunar-domains');

        // Check if the configured Linux path exists and is writable
        if (File::isDirectory($configuredPath) && is_writable($configuredPath)) {
            return rtrim($configuredPath, '/\\');
        }

        // Try creating the configured directory if running as root / with permission
        try {
            if (!File::isDirectory($configuredPath)) {
                @File::makeDirectory($configuredPath, 0755, true);
                if (File::isDirectory($configuredPath) && is_writable($configuredPath)) {
                    return rtrim($configuredPath, '/\\');
                }
            }
        } catch (\Throwable) {
            // Silently fall back to storage directory
        }

        // Fallback directory in storage for local dev / non-root / Windows environments
        $fallback = storage_path('app/nginx/domains');
        File::ensureDirectoryExists($fallback, 0755, true);

        return $fallback;
    }

    /**
     * Get sanitized configuration filename for a domain.
     */
    public function getConfigFilename(ServerCustomDomain $domain): string
    {
        $clean = preg_replace('/[^a-zA-Z0-9._-]/', '', strtolower($domain->domain));
        return "lunar_{$domain->id}_{$clean}.conf";
    }

    /**
     * Generate the Nginx reverse proxy configuration for a domain.
     */
    public function generateConfig(ServerCustomDomain $domain): string
    {
        $domain->loadMissing(['server.node', 'allocation']);

        $allocation = $domain->allocation;
        $server = $domain->server;
        $node = $server->node;

        // Determine the actual IP or hostname to forward to
        $targetIp = ($allocation->ip === '0.0.0.0')
            ? ($node->fqdn ?: '127.0.0.1')
            : $allocation->ip;

        $targetPort = $allocation->port;
        $domainName = strtolower(trim($domain->domain));
        $sslActive = $domain->ssl_enabled && !empty($domain->ssl_cert_path) && !empty($domain->ssl_key_path);

        $now = now()->toIso8601String();

        $config = "# ==========================================================================\n";
        $config .= "# Lunar Panel Automated Nginx Reverse Proxy\n";
        $config .= "# Domain: {$domainName}\n";
        $config .= "# Server: {$server->name} ({$server->uuid})\n";
        $config .= "# Target: http://{$targetIp}:{$targetPort}\n";
        $config .= "# Generated: {$now}\n";
        $config .= "# ==========================================================================\n\n";

        if ($domain->protocol === 'game_srv') {
            // For game ports, Nginx provides an informative landing page and web forwarding
            $config .= "server {\n";
            $config .= "    listen 80;\n";
            $config .= "    listen [::]:80;\n";
            $config .= "    server_name {$domainName};\n\n";
            $config .= "    location /.well-known/acme-challenge/ {\n";
            $config .= "        root /var/www/html;\n";
            $config .= "        try_files \$uri =404;\n";
            $config .= "    }\n\n";
            $config .= "    location / {\n";
            $config .= "        default_type text/html;\n";
            $config .= "        return 200 '<!DOCTYPE html><html><head><title>{$domainName} - Game Server</title><style>body{background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center;padding:30px;border:1px solid #242424;border-radius:10px;background:#111}h1{margin:0 0 10px;font-size:24px}p{color:#888;margin:0 0 16px}code{background:#202020;color:#10b981;padding:4px 8px;border-radius:4px;font-family:monospace}</style></head><body><div><h1>{$server->name}</h1><p>Game Service Domain Active</p><p>Connect in-game using: <code>{$domainName}</code></p><p style=\"font-size:12px;color:#555\">Port: {$targetPort} | Node: {$node->name}</p></div></body></html>';\n";
            $config .= "    }\n";
            $config .= "}\n";

            return $config;
        }

        // Web HTTP / HTTPS Reverse Proxy
        if ($sslActive) {
            // Port 80: ACME challenge and HTTP-to-HTTPS redirect
            $config .= "server {\n";
            $config .= "    listen 80;\n";
            $config .= "    listen [::]:80;\n";
            $config .= "    server_name {$domainName};\n\n";
            $config .= "    location /.well-known/acme-challenge/ {\n";
            $config .= "        root /var/www/html;\n";
            $config .= "        try_files \$uri =404;\n";
            $config .= "    }\n\n";
            $config .= "    location / {\n";
            $config .= "        return 301 https://\$host\$request_uri;\n";
            $config .= "    }\n";
            $config .= "}\n\n";

            // Port 443: SSL Reverse Proxy
            $config .= "server {\n";
            $config .= "    listen 443 ssl http2;\n";
            $config .= "    listen [::]:443 ssl http2;\n";
            $config .= "    server_name {$domainName};\n\n";
            $config .= "    ssl_certificate {$domain->ssl_cert_path};\n";
            $config .= "    ssl_certificate_key {$domain->ssl_key_path};\n";
            $config .= "    ssl_protocols TLSv1.2 TLSv1.3;\n";
            $config .= "    ssl_ciphers HIGH:!aNULL:!MD5;\n";
            $config .= "    ssl_prefer_server_ciphers on;\n";
            $config .= "    ssl_session_cache shared:SSL:10m;\n";
            $config .= "    ssl_session_timeout 1d;\n\n";
        } else {
            // Port 80 only (Plain HTTP Reverse Proxy)
            $config .= "server {\n";
            $config .= "    listen 80;\n";
            $config .= "    listen [::]:80;\n";
            $config .= "    server_name {$domainName};\n\n";
            $config .= "    location /.well-known/acme-challenge/ {\n";
            $config .= "        root /var/www/html;\n";
            $config .= "        try_files \$uri =404;\n";
            $config .= "    }\n\n";
        }

        // Shared Reverse Proxy Block
        $config .= "    client_max_body_size 100M;\n\n";
        $config .= "    location / {\n";
        $config .= "        proxy_pass http://{$targetIp}:{$targetPort};\n";
        $config .= "        proxy_http_version 1.1;\n\n";
        $config .= "        # WebSocket Support\n";
        $config .= "        proxy_set_header Upgrade \$http_upgrade;\n";
        $config .= "        proxy_set_header Connection \"upgrade\";\n\n";
        $config .= "        # Standard Client Forwarding Headers\n";
        $config .= "        proxy_set_header Host \$host;\n";
        $config .= "        proxy_set_header X-Real-IP \$remote_addr;\n";
        $config .= "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n";
        $config .= "        proxy_set_header X-Forwarded-Proto \$scheme;\n";
        $config .= "        proxy_set_header X-Forwarded-Host \$host;\n";
        $config .= "        proxy_set_header X-Forwarded-Port \$server_port;\n\n";
        $config .= "        # Timeouts & Buffering for Realtime Services\n";
        $config .= "        proxy_connect_timeout 60s;\n";
        $config .= "        proxy_send_timeout 86400s;\n";
        $config .= "        proxy_read_timeout 86400s;\n";
        $config .= "        proxy_buffering off;\n";
        $config .= "    }\n";
        $config .= "}\n";

        return $config;
    }

    /**
     * Atomically write configuration and reload Nginx.
     */
    public function writeAndReload(ServerCustomDomain $domain): array
    {
        $dir = $this->getDomainsDirectory();
        $filename = $this->getConfigFilename($domain);
        $finalPath = $dir . DIRECTORY_SEPARATOR . $filename;
        $tmpPath = $finalPath . '.tmp';

        $configContent = $this->generateConfig($domain);

        // Step 1: Write to temporary file
        File::put($tmpPath, $configContent);

        // Step 2: Test syntax with nginx -t if available
        $testCommand = config('nginx.test_command', 'nginx -t');
        $hasNginx = false;
        $syntaxOk = true;
        $syntaxOutput = '';

        try {
            $testProcess = Process::fromShellCommandline($testCommand);
            $testProcess->run();

            if ($testProcess->isSuccessful()) {
                $hasNginx = true;
                $syntaxOk = true;
            } else {
                $err = trim($testProcess->getErrorOutput() . ' ' . $testProcess->getOutput());
                if (stripos($err, 'not recognized') !== false || stripos($err, 'not found') !== false) {
                    $hasNginx = false;
                } else {
                    $hasNginx = true;
                    $syntaxOk = false;
                    $syntaxOutput = $err;
                }
            }
        } catch (\Throwable $e) {
            $hasNginx = false;
        }

        // If Nginx is installed and syntax check failed, abort and rollback
        if ($hasNginx && !$syntaxOk) {
            @File::delete($tmpPath);
            Log::error("Nginx syntax validation failed for domain [{$domain->domain}]: {$syntaxOutput}");

            $domain->nginx_status = 'error';
            $domain->save();

            return [
                'success' => false,
                'error' => "Nginx syntax validation failed: {$syntaxOutput}",
            ];
        }

        // Step 3: Move temporary file to permanent location
        if (File::exists($finalPath)) {
            File::delete($finalPath);
        }
        rename($tmpPath, $finalPath);

        // Step 4: Graceful reload if Nginx daemon is available
        $reloadOutput = '';
        if ($hasNginx) {
            $reloadCommand = config('nginx.reload_command', 'nginx -s reload');
            try {
                $reloadProcess = Process::fromShellCommandline($reloadCommand);
                $reloadProcess->run();
                if (!$reloadProcess->isSuccessful()) {
                    $reloadOutput = trim($reloadProcess->getErrorOutput() . ' ' . $reloadProcess->getOutput());
                    Log::warning("Nginx reload returned notice for domain [{$domain->domain}]: {$reloadOutput}");
                }
            } catch (\Throwable $e) {
                Log::warning("Could not execute Nginx reload: " . $e->getMessage());
            }
        }

        $domain->nginx_status = 'configured';
        $domain->nginx_config_path = $finalPath;
        $domain->save();

        return [
            'success' => true,
            'path' => $finalPath,
            'nginx_reloaded' => $hasNginx,
            'message' => $hasNginx
                ? 'Nginx configuration tested and activated successfully.'
                : "Configuration saved to {$finalPath}. Ready for webserver synchronization.",
        ];
    }

    /**
     * Remove Nginx configuration and reload webserver.
     */
    public function removeAndReload(ServerCustomDomain $domain): void
    {
        $dir = $this->getDomainsDirectory();
        $filename = $this->getConfigFilename($domain);
        $finalPath = $dir . DIRECTORY_SEPARATOR . $filename;

        if (File::exists($finalPath)) {
            @File::delete($finalPath);
        }

        if (!empty($domain->nginx_config_path) && File::exists($domain->nginx_config_path)) {
            @File::delete($domain->nginx_config_path);
        }

        // Reload Nginx gracefully if available
        $reloadCommand = config('nginx.reload_command', 'nginx -s reload');
        try {
            $reloadProcess = Process::fromShellCommandline($reloadCommand);
            $reloadProcess->run();
        } catch (\Throwable) {
            // Ignore on non-Nginx systems
        }
    }

    /**
     * Test and verify public DNS records for the domain.
     */
    public function verifyDns(ServerCustomDomain $domain): array
    {
        $domain->loadMissing(['server.node', 'allocation']);

        $domainName = strtolower(trim($domain->domain));
        $node = $domain->server->node;
        $expectedPort = $domain->allocation->port;

        $resolvedIps = [];
        $cnameTarget = null;
        $srvRecords = [];

        // Check A and AAAA records
        if (function_exists('dns_get_record')) {
            $aRecords = @dns_get_record($domainName, DNS_A);
            if (is_array($aRecords)) {
                foreach ($aRecords as $record) {
                    if (!empty($record['ip'])) {
                        $resolvedIps[] = $record['ip'];
                    }
                }
            }

            // Check CNAME records
            $cnameRecords = @dns_get_record($domainName, DNS_CNAME);
            if (is_array($cnameRecords) && !empty($cnameRecords[0]['target'])) {
                $cnameTarget = $cnameRecords[0]['target'];
            }

            // Check SRV records for game ports (e.g. _minecraft._tcp.domain)
            $srvLookup = "_minecraft._tcp.{$domainName}";
            $srvRaw = @dns_get_record($srvLookup, DNS_SRV);
            if (is_array($srvRaw)) {
                foreach ($srvRaw as $s) {
                    $srvRecords[] = [
                        'target' => $s['target'] ?? null,
                        'port' => $s['port'] ?? null,
                        'priority' => $s['pri'] ?? 0,
                        'weight' => $s['weight'] ?? 0,
                    ];
                }
            }
        } else {
            $ip = @gethostbyname($domainName);
            if ($ip && $ip !== $domainName) {
                $resolvedIps[] = $ip;
            }
        }

        // Match against node FQDN / IP
        $expectedIp = null;
        if (!empty($node->fqdn)) {
            $expectedIp = @gethostbyname($node->fqdn);
        }

        $isVerified = false;
        if (!empty($resolvedIps)) {
            if ($expectedIp && in_array($expectedIp, $resolvedIps, true)) {
                $isVerified = true;
            } elseif (in_array($domain->allocation->ip, $resolvedIps, true)) {
                $isVerified = true;
            }
        }

        if (!$isVerified && $cnameTarget && !empty($node->fqdn)) {
            if (rtrim(strtolower($cnameTarget), '.') === rtrim(strtolower($node->fqdn), '.')) {
                $isVerified = true;
            }
        }

        // For game SRV records
        $srvVerified = false;
        if (!empty($srvRecords)) {
            foreach ($srvRecords as $srv) {
                if ((int)$srv['port'] === (int)$expectedPort) {
                    $srvVerified = true;
                    break;
                }
            }
        }

        $domain->dns_status = ($isVerified || $srvVerified) ? 'verified' : 'pending';
        $domain->dns_last_checked_at = now();
        $domain->save();

        return [
            'domain' => $domainName,
            'verified' => $isVerified || $srvVerified,
            'status' => $domain->dns_status,
            'resolved_ips' => $resolvedIps,
            'expected_node_fqdn' => $node->fqdn,
            'expected_node_ip' => $expectedIp ?: $domain->allocation->ip,
            'cname_target' => $cnameTarget,
            'srv_records' => $srvRecords,
            'expected_srv_format' => "_minecraft._tcp.{$domainName} IN SRV 0 5 {$expectedPort} " . ($node->fqdn ?: $domain->allocation->ip),
            'checked_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Automatically provision or renew Let's Encrypt SSL certificate via Certbot.
     */
    public function provisionSsl(ServerCustomDomain $domain): array
    {
        $domainName = strtolower(trim($domain->domain));
        $certbotPath = config('nginx.certbot_path', 'certbot');
        $email = config('nginx.certbot_email', 'admin@votion.local');
        $webroot = config('nginx.webroot_path', '/var/www/html');

        $certPath = "/etc/letsencrypt/live/{$domainName}/fullchain.pem";
        $keyPath = "/etc/letsencrypt/live/{$domainName}/privkey.pem";

        // Check if certificate already exists
        if (File::exists($certPath) && File::exists($keyPath)) {
            $domain->ssl_cert_path = $certPath;
            $domain->ssl_key_path = $keyPath;
            $domain->ssl_enabled = true;
            $domain->ssl_status = 'active';
            $domain->save();

            $this->writeAndReload($domain);

            return [
                'success' => true,
                'status' => 'active',
                'message' => 'Active SSL certificate detected and attached.',
            ];
        }

        // Run Certbot non-interactively
        $cmd = "{$certbotPath} certonly --webroot -w {$webroot} -d {$domainName} --non-interactive --agree-tos --email {$email}";
        try {
            $process = Process::fromShellCommandline($cmd);
            $process->setTimeout(120);
            $process->run();

            if ($process->isSuccessful() && File::exists($certPath) && File::exists($keyPath)) {
                $domain->ssl_cert_path = $certPath;
                $domain->ssl_key_path = $keyPath;
                $domain->ssl_enabled = true;
                $domain->ssl_status = 'active';
                $domain->save();

                $this->writeAndReload($domain);

                return [
                    'success' => true,
                    'status' => 'active',
                    'message' => 'Let\'s Encrypt SSL certificate successfully provisioned.',
                ];
            }

            $output = trim($process->getErrorOutput() . ' ' . $process->getOutput());
            Log::warning("Certbot execution failed for [{$domainName}]: {$output}");

            $domain->ssl_status = 'failed';
            $domain->save();

            return [
                'success' => false,
                'status' => 'failed',
                'error' => 'Certbot automated SSL issuance could not be completed. Ensure your domain points to this server IP: ' . $output,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'status' => 'failed',
                'error' => 'SSL automation process error: ' . $e->getMessage(),
            ];
        }
    }
}
