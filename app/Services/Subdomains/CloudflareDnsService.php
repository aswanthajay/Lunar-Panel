<?php

namespace Pterodactyl\Services\Subdomains;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\ServerSubdomain;
use Pterodactyl\Models\SubdomainCloudflareAccount;
use Pterodactyl\Models\SubdomainDomain;

class CloudflareDnsService
{
    private Client $client;

    public function __construct()
    {
        $this->client = new Client([
            'base_uri' => 'https://api.cloudflare.com/client/v4/',
            'timeout' => 15,
            'http_errors' => true,
        ]);
    }

    /**
     * Test credentials and retrieve zone list for a Cloudflare account.
     *
     * @return array{success: bool, zones: array, message?: string}
     */
    public function verifyAccount(SubdomainCloudflareAccount $account): array
    {
        try {
            $response = $this->client->get('zones?per_page=50', [
                'headers' => $account->getAuthHeaders(),
            ]);

            $body = json_decode($response->getBody()->getContents(), true);

            if (!($body['success'] ?? false)) {
                return [
                    'success' => false,
                    'zones' => [],
                    'message' => $body['errors'][0]['message'] ?? 'Failed to authenticate with Cloudflare API.',
                ];
            }

            $zones = array_map(function ($zone) {
                return [
                    'id' => $zone['id'],
                    'name' => $zone['name'],
                    'status' => $zone['status'] ?? 'unknown',
                ];
            }, $body['result'] ?? []);

            return [
                'success' => true,
                'zones' => $zones,
            ];
        } catch (RequestException $e) {
            $error = $this->extractErrorMessage($e);
            return [
                'success' => false,
                'zones' => [],
                'message' => $error,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'zones' => [],
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Create required DNS records (A and/or SRV) on Cloudflare for a server subdomain.
     *
     * @throws \Exception
     */
    public function createSubdomain(ServerSubdomain $subdomainRecord): array
    {
        $domain = $subdomainRecord->domain;
        if (!$domain) {
            throw new \Exception('Root domain configuration not found.');
        }

        $account = $domain->account;
        if (!$account) {
            throw new \Exception('Cloudflare account configuration not found for domain.');
        }

        $zoneId = $domain->zone_id;
        $headers = $account->getAuthHeaders();
        $prefix = strtolower(trim($subdomainRecord->subdomain));
        $rootDomain = strtolower(trim($domain->domain));
        $fullDomain = "{$prefix}.{$rootDomain}";
        $protocol = $domain->protocol ?: 'both';

        // Purge any stale records from Cloudflare for this exact subdomain to prevent conflicts
        $this->purgeStaleRecords($zoneId, $headers, $fullDomain);
        $this->purgeStaleRecords($zoneId, $headers, "_minecraft._tcp.{$fullDomain}");
        $this->purgeStaleRecords($zoneId, $headers, "_minecraft._tcp.{$prefix}");

        $dnsId = null;
        $srvId = null;

        try {
            // 1. Create Address Record (A, AAAA, or CNAME)
            // Even if the domain protocol is configured as 'srv_only', Cloudflare and RFC 2782 DNS
            // specifications require that the target of an SRV record MUST resolve to an IP address
            // via an Address (A/AAAA) record. Without this A record for $fullDomain, Minecraft clients
            // will fail to resolve the host ("Cannot resolve hostname").
            $target = trim($subdomainRecord->target_ip);
            $isIpv4 = filter_var($target, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4);
            $isIpv6 = filter_var($target, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6);
            $recordType = $isIpv4 ? 'A' : ($isIpv6 ? 'AAAA' : 'CNAME');

            $aPayload = [
                'type' => $recordType,
                'name' => $fullDomain,
                'content' => $target,
                'ttl' => 120, // 2 minutes for fast propagation
                'proxied' => false, // Game traffic must bypass Cloudflare HTTP reverse proxy
                'comment' => "Stellar Panel: Server #{$subdomainRecord->server_id} Subdomain",
            ];

            $response = $this->client->post("zones/{$zoneId}/dns_records", [
                'headers' => $headers,
                'json' => $aPayload,
            ]);

            $body = json_decode($response->getBody()->getContents(), true);
            $dnsId = $body['result']['id'] ?? null;

            // 2. Create SRV Record (for 'both' or 'srv_only')
            if (in_array($protocol, ['both', 'srv_only', 'srv'])) {
                // Cloudflare SRV format:
                // name: _service._proto.subdomain.domain.com
                // data: { service, proto, name, priority, weight, port, target }
                $srvPayload = [
                    'type' => 'SRV',
                    'name' => "_minecraft._tcp.{$fullDomain}",
                    'ttl' => 120,
                    'proxied' => false,
                    'comment' => "Stellar Panel: Server #{$subdomainRecord->server_id} SRV",
                    'data' => [
                        'service' => '_minecraft',
                        'proto' => '_tcp',
                        'name' => $fullDomain,
                        'priority' => 0,
                        'weight' => 5,
                        'port' => (int) $subdomainRecord->target_port,
                        'target' => $fullDomain,
                    ],
                ];

                $srvResponse = $this->client->post("zones/{$zoneId}/dns_records", [
                    'headers' => $headers,
                    'json' => $srvPayload,
                ]);

                $srvBody = json_decode($srvResponse->getBody()->getContents(), true);
                $srvId = $srvBody['result']['id'] ?? null;
            }

            // Update model record quietly
            $subdomainRecord->cloudflare_dns_id = $dnsId;
            $subdomainRecord->cloudflare_srv_id = $srvId;
            $subdomainRecord->saveQuietly();

            return [
                'success' => true,
                'dns_id' => $dnsId,
                'srv_id' => $srvId,
                'full_domain' => $fullDomain,
            ];
        } catch (RequestException $e) {
            // Clean up any partially created record if one failed
            if ($dnsId) {
                try {
                    $this->client->delete("zones/{$zoneId}/dns_records/{$dnsId}", ['headers' => $headers]);
                } catch (\Throwable) {}
            }
            if ($srvId) {
                try {
                    $this->client->delete("zones/{$zoneId}/dns_records/{$srvId}", ['headers' => $headers]);
                } catch (\Throwable) {}
            }

            $msg = $this->extractErrorMessage($e);
            Log::error("Cloudflare DNS creation error for [{$fullDomain}]: {$msg}");
            throw new \Exception("Cloudflare DNS API Error: {$msg}");
        } catch (\Throwable $e) {
            if ($dnsId) {
                try {
                    $this->client->delete("zones/{$zoneId}/dns_records/{$dnsId}", ['headers' => $headers]);
                } catch (\Throwable) {}
            }
            if ($srvId) {
                try {
                    $this->client->delete("zones/{$zoneId}/dns_records/{$srvId}", ['headers' => $headers]);
                } catch (\Throwable) {}
            }
            Log::error("Subdomain creation error for [{$fullDomain}]: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Cleanly remove DNS records from Cloudflare when a subdomain is deleted.
     */
    public function deleteSubdomain(ServerSubdomain $subdomainRecord): void
    {
        $domain = $subdomainRecord->domain;
        if (!$domain) {
            return;
        }

        $account = $domain->account;
        if (!$account) {
            return;
        }

        $zoneId = $domain->zone_id;
        $headers = $account->getAuthHeaders();

        // 1. Delete A record if present
        if (!empty($subdomainRecord->cloudflare_dns_id)) {
            try {
                $this->client->delete("zones/{$zoneId}/dns_records/{$subdomainRecord->cloudflare_dns_id}", [
                    'headers' => $headers,
                ]);
            } catch (RequestException $e) {
                // Ignore 404 if record was already deleted in Cloudflare dashboard
                if ($e->getResponse()?->getStatusCode() !== 404) {
                    Log::warning("Failed to delete Cloudflare A record [{$subdomainRecord->cloudflare_dns_id}]: " . $this->extractErrorMessage($e));
                }
            } catch (\Throwable $e) {
                Log::warning("Error deleting Cloudflare A record: " . $e->getMessage());
            }
        }

        // 2. Delete SRV record if present
        if (!empty($subdomainRecord->cloudflare_srv_id)) {
            try {
                $this->client->delete("zones/{$zoneId}/dns_records/{$subdomainRecord->cloudflare_srv_id}", [
                    'headers' => $headers,
                ]);
            } catch (RequestException $e) {
                if ($e->getResponse()?->getStatusCode() !== 404) {
                    Log::warning("Failed to delete Cloudflare SRV record [{$subdomainRecord->cloudflare_srv_id}]: " . $this->extractErrorMessage($e));
                }
            } catch (\Throwable $e) {
                Log::warning("Error deleting Cloudflare SRV record: " . $e->getMessage());
            }
        }

        // 3. Purge any remaining matching records to guarantee no orphaned records remain
        $prefix = strtolower(trim($subdomainRecord->subdomain));
        $rootDomain = strtolower(trim($domain->domain));
        $fullDomain = "{$prefix}.{$rootDomain}";
        $this->purgeStaleRecords($zoneId, $headers, $fullDomain);
        $this->purgeStaleRecords($zoneId, $headers, "_minecraft._tcp.{$fullDomain}");
    }

    /**
     * Purge any stale DNS records on Cloudflare matching a given name.
     */
    private function purgeStaleRecords(string $zoneId, array $headers, string $name): void
    {
        try {
            $res = $this->client->get("zones/{$zoneId}/dns_records", [
                'headers' => $headers,
                'query' => [
                    'name' => $name,
                    'per_page' => 100,
                ],
            ]);
            $body = json_decode($res->getBody()->getContents(), true);
            $records = $body['result'] ?? [];
            foreach ($records as $record) {
                if (!empty($record['id'])) {
                    $this->client->delete("zones/{$zoneId}/dns_records/{$record['id']}", [
                        'headers' => $headers,
                    ]);
                }
            }
        } catch (\Throwable) {}
    }

    /**
     * Extract human-readable error from Cloudflare API response.
     */
    private function extractErrorMessage(RequestException $e): string
    {
        if ($e->hasResponse()) {
            $contents = $e->getResponse()->getBody()->getContents();
            $data = json_decode($contents, true);
            if (!empty($data['errors']) && is_array($data['errors'])) {
                $messages = [];
                foreach ($data['errors'] as $err) {
                    $code = $err['code'] ?? '';
                    $message = $err['message'] ?? '';
                    $messages[] = $code ? "[{$code}] {$message}" : $message;
                }
                return implode('; ', $messages);
            }
            if (!empty($data['messages'][0])) {
                return (string) $data['messages'][0];
            }
        }

        return $e->getMessage();
    }
}
