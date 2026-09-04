<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerCustomDomain;
use Pterodactyl\Services\Nginx\NginxDomainService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Domains\GetDomainsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Domains\StoreDomainRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Domains\DeleteDomainRequest;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DomainController extends ClientApiController
{
    public function __construct(
        private NginxDomainService $nginxService
    ) {
        parent::__construct();
    }

    /**
     * Lists all custom domains configured for the server.
     */
    public function index(GetDomainsRequest $request, Server $server): JsonResponse
    {
        $domains = $server->customDomains()
            ->with(['allocation'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $domains,
        ]);
    }

    /**
     * Store and configure a new custom domain with automated Nginx setup.
     */
    public function store(StoreDomainRequest $request, Server $server): JsonResponse
    {
        $allocation = $server->allocations()
            ->where('id', $request->input('allocation_id'))
            ->first();

        if (!$allocation) {
            return response()->json([
                'success' => false,
                'message' => 'The selected allocation does not belong to this server.',
            ], 422);
        }

        $domainName = strtolower(trim($request->input('domain')));
        $sslEnabled = (bool) $request->input('ssl_enabled', false);

        $domain = new ServerCustomDomain([
            'server_id' => $server->id,
            'allocation_id' => $allocation->id,
            'domain' => $domainName,
            'protocol' => $request->input('protocol'),
            'target_type' => $request->input('target_type'),
            'ssl_enabled' => $sslEnabled,
            'ssl_status' => $sslEnabled ? 'pending' : 'none',
            'notes' => $request->input('notes'),
        ]);

        $domain->save();

        // Automatically generate and test Nginx configuration
        $nginxResult = $this->nginxService->writeAndReload($domain);

        // Run initial DNS test
        $dnsResult = $this->nginxService->verifyDns($domain);

        // If SSL requested and DNS matches, attempt certbot
        $sslResult = null;
        if ($sslEnabled && ($dnsResult['verified'] ?? false) && $domain->protocol === 'http') {
            $sslResult = $this->nginxService->provisionSsl($domain);
        }

        return response()->json([
            'success' => true,
            'data' => $domain->fresh(['allocation']),
            'nginx' => $nginxResult,
            'dns' => $dnsResult,
            'ssl' => $sslResult,
        ], 201);
    }

    /**
     * Re-verify DNS records for a domain.
     */
    public function verify(GetDomainsRequest $request, Server $server, ServerCustomDomain $domain): JsonResponse
    {
        $this->ensureBelongsToServer($server, $domain);

        $result = $this->nginxService->verifyDns($domain);

        return response()->json([
            'success' => true,
            'data' => $domain->fresh(['allocation']),
            'diagnostics' => $result,
        ]);
    }

    /**
     * Trigger SSL provisioning / renewal for a domain.
     */
    public function provisionSsl(GetDomainsRequest $request, Server $server, ServerCustomDomain $domain): JsonResponse
    {
        $this->ensureBelongsToServer($server, $domain);

        $result = $this->nginxService->provisionSsl($domain);

        return response()->json([
            'success' => $result['success'] ?? false,
            'data' => $domain->fresh(['allocation']),
            'result' => $result,
        ]);
    }

    /**
     * Delete a custom domain and cleanly remove its Nginx configuration.
     */
    public function delete(DeleteDomainRequest $request, Server $server, ServerCustomDomain $domain): JsonResponse
    {
        $this->ensureBelongsToServer($server, $domain);

        // Remove config and reload Nginx
        $this->nginxService->removeAndReload($domain);

        $domain->delete();

        return response()->json([
            'success' => true,
            'message' => 'Custom domain and Nginx reverse proxy configuration removed successfully.',
        ]);
    }

    /**
     * Ensure the custom domain record belongs to the route server.
     */
    protected function ensureBelongsToServer(Server $server, ServerCustomDomain $domain): void
    {
        if ($domain->server_id !== $server->id) {
            throw new NotFoundHttpException();
        }
    }
}