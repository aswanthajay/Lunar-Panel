<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerSubdomain;
use Pterodactyl\Models\SubdomainDomain;
use Pterodactyl\Services\Subdomains\CloudflareDnsService;
use Pterodactyl\Services\Subdomains\SubdomainSchemaHelper;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains\GetSubdomainsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains\StoreSubdomainRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains\DeleteSubdomainRequest;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SubdomainController extends ClientApiController
{
    public function __construct(
        private CloudflareDnsService $dnsService
    ) {
        parent::__construct();
    }

    /**
     * Lists all subdomains configured for this server, along with available root domains.
     */
    public function index(GetSubdomainsRequest $request, Server $server): JsonResponse
    {
        SubdomainSchemaHelper::ensureTablesExist();

        $subdomains = $server->subdomains()
            ->with(['domain'])
            ->orderBy('created_at', 'desc')
            ->get();

        // Retrieve all enabled domains
        $allDomains = SubdomainDomain::enabled()
            ->select(['id', 'domain', 'protocol', 'egg_ids'])
            ->get();

        // Filter domains by egg restriction if applicable
        $availableDomains = $allDomains->filter(function (SubdomainDomain $d) use ($server) {
            if (empty($d->egg_ids) || !is_array($d->egg_ids)) {
                return true;
            }
            return in_array($server->egg_id, $d->egg_ids);
        })->values();

        $allocations = $server->allocations()
            ->get(['id', 'ip', 'port', 'ip_alias']);

        return response()->json([
            'success' => true,
            'data' => [
                'subdomains' => $subdomains,
                'available_domains' => $availableDomains,
                'allocations' => $allocations,
            ],
        ]);
    }

    /**
     * Provision a new subdomain on Cloudflare for the server.
     */
    public function store(StoreSubdomainRequest $request, Server $server): JsonResponse
    {
        // 1. Verify allocation
        $allocation = $server->allocations()
            ->where('id', $request->input('allocation_id'))
            ->first();

        if (!$allocation) {
            return response()->json([
                'success' => false,
                'message' => 'The selected allocation does not belong to this server.',
            ], 422);
        }

        // 2. Verify domain is valid and enabled
        $domain = SubdomainDomain::enabled()
            ->find($request->input('subdomain_domain_id'));

        if (!$domain) {
            return response()->json([
                'success' => false,
                'message' => 'The selected root domain is unavailable or disabled.',
            ], 422);
        }

        // Check egg restriction
        if (!empty($domain->egg_ids) && is_array($domain->egg_ids) && !in_array($server->egg_id, $domain->egg_ids)) {
            return response()->json([
                'success' => false,
                'message' => 'This root domain is not available for this server type.',
            ], 422);
        }

        // 3. Subdomain prefix validation & formatting
        $prefix = strtolower(trim($request->input('subdomain')));

        // Check if already taken on this domain
        $alreadyTaken = ServerSubdomain::where('subdomain_domain_id', $domain->id)
            ->where('subdomain', $prefix)
            ->exists();

        if ($alreadyTaken) {
            return response()->json([
                'success' => false,
                'message' => "The subdomain \"{$prefix}.{$domain->domain}\" is already registered. Please choose another prefix.",
            ], 422);
        }

        // 4. Resolve target IP
        $targetIp = $allocation->ip;
        if ($targetIp === '0.0.0.0' || $targetIp === '127.0.0.1' || empty($targetIp)) {
            if (!empty($server->node?->fqdn)) {
                $dnsIp = gethostbyname($server->node->fqdn);
                if (filter_var($dnsIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                    $targetIp = $dnsIp;
                } else {
                    $targetIp = $server->node->fqdn;
                }
            } elseif (!empty($server->node?->ip) && filter_var($server->node->ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                $targetIp = $server->node->ip;
            } else {
                $targetIp = request()->getHost();
            }
        }

        $targetPort = (int) $allocation->port;

        // 5. Create database record first
        $subdomainRecord = new ServerSubdomain([
            'server_id' => $server->id,
            'subdomain_domain_id' => $domain->id,
            'subdomain' => $prefix,
            'record_type' => $domain->protocol ?: 'both',
            'target_ip' => $targetIp,
            'target_port' => $targetPort,
        ]);

        $subdomainRecord->save();

        // 6. Execute Cloudflare DNS provisioning
        try {
            $subdomainRecord->load('domain.account');
            $cfResult = $this->dnsService->createSubdomain($subdomainRecord);

            return response()->json([
                'success' => true,
                'data' => $subdomainRecord->fresh('domain'),
                'cloudflare' => $cfResult,
                'message' => "Subdomain {$subdomainRecord->full_subdomain} provisioned on Cloudflare edge successfully!",
            ], 201);
        } catch (\Throwable $e) {
            // Rollback local record if Cloudflare fails
            $subdomainRecord->deleteQuietly();

            return response()->json([
                'success' => false,
                'message' => 'Failed to provision DNS on Cloudflare: ' . $e->getMessage(),
            ], 502);
        }
    }

    /**
     * Delete a subdomain and cleanly remove its Cloudflare DNS records.
     */
    public function delete(DeleteSubdomainRequest $request, Server $server, ServerSubdomain $subdomain): JsonResponse
    {
        $this->ensureBelongsToServer($server, $subdomain);

        $fullDomain = $subdomain->full_subdomain;

        // The deleting model hook will invoke CloudflareDnsService::deleteSubdomain automatically
        $subdomain->delete();

        return response()->json([
            'success' => true,
            'message' => "Subdomain {$fullDomain} and its Cloudflare DNS records were deleted.",
        ]);
    }

    /**
     * Ensure the subdomain belongs to the route server.
     */
    protected function ensureBelongsToServer(Server $server, ServerSubdomain $subdomain): void
    {
        if ($subdomain->server_id !== $server->id) {
            throw new NotFoundHttpException();
        }
    }
}
