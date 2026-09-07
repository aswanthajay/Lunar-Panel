<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\SubdomainCloudflareAccount;
use Pterodactyl\Models\SubdomainDomain;
use Pterodactyl\Models\ServerSubdomain;
use Pterodactyl\Services\Subdomains\CloudflareDnsService;
use Pterodactyl\Services\Subdomains\SubdomainSchemaHelper;

class SubdomainsController extends Controller
{
    public function __construct(
        private AlertsMessageBag $alert,
        private ViewFactory $view,
        private CloudflareDnsService $dnsService
    ) {
    }

    /**
     * Display the subdomain manager dashboard in Admin CP.
     */
    public function index(): View
    {
        SubdomainSchemaHelper::ensureTablesExist();

        try {
            $accounts = SubdomainCloudflareAccount::withCount('domains')
                ->orderBy('created_at', 'desc')
                ->get();

            $domains = SubdomainDomain::with(['account'])
                ->withCount('subdomains')
                ->orderBy('created_at', 'desc')
                ->get();

            $totalSubdomains = ServerSubdomain::count();
            $enabledDomainsCount = SubdomainDomain::where('is_enabled', true)->count();
        } catch (\Throwable $e) {
            $accounts = collect();
            $domains = collect();
            $totalSubdomains = 0;
            $enabledDomainsCount = 0;
            $this->alert->danger('Subdomain database tables not found. Please run "php artisan migrate --force" in your server terminal to create them.')->flash();
        }

        return $this->view->make('admin.subdomains.index', [
            'accounts' => $accounts,
            'domains' => $domains,
            'totalSubdomains' => $totalSubdomains,
            'enabledDomainsCount' => $enabledDomainsCount,
        ]);
    }

    /**
     * Store a new Cloudflare API account credential.
     */
    public function storeAccount(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'auth_type' => 'required|string|in:token,key',
            'api_token' => 'required_if:auth_type,token|nullable|string',
            'api_key' => 'required_if:auth_type,key|nullable|string',
            'api_email' => 'required_if:auth_type,key|nullable|email',
        ]);

        $account = SubdomainCloudflareAccount::create([
            'name' => $validated['name'],
            'auth_type' => $validated['auth_type'],
            'api_token' => $validated['api_token'] ?? null,
            'api_key' => $validated['api_key'] ?? null,
            'api_email' => $validated['api_email'] ?? null,
        ]);

        // Attempt verification
        $result = $this->dnsService->verifyAccount($account);
        if ($result['success']) {
            $count = count($result['zones'] ?? []);
            $this->alert->success("Cloudflare account \"{$account->name}\" connected successfully! Found {$count} available DNS zones.")->flash();
        } else {
            $msg = $result['message'] ?? 'Could not verify credentials with Cloudflare.';
            $this->alert->warning("Cloudflare account added, but connection test returned: {$msg}")->flash();
        }

        return redirect()->route('admin.subdomains');
    }

    /**
     * Delete a Cloudflare API account.
     */
    public function deleteAccount(SubdomainCloudflareAccount $account): RedirectResponse
    {
        $name = $account->name;
        $account->delete();

        $this->alert->success("Cloudflare account \"{$name}\" and its associated domain links were deleted.")->flash();
        return redirect()->route('admin.subdomains');
    }

    /**
     * Store a new root domain linked to a Cloudflare account.
     */
    public function storeDomain(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:191|unique:subdomain_domains,domain',
            'zone_id' => 'required|string|max:191',
            'cloudflare_account_id' => 'required|integer|exists:subdomain_cloudflare_accounts,id',
            'protocol' => 'required|string|in:both,srv_only,a_only',
            'is_enabled' => 'nullable|boolean',
        ]);

        $cleanDomain = strtolower(trim($validated['domain']));
        $cleanDomain = preg_replace('#^https?://#', '', $cleanDomain);
        $cleanDomain = rtrim($cleanDomain, '/');

        SubdomainDomain::create([
            'domain' => $cleanDomain,
            'zone_id' => trim($validated['zone_id']),
            'cloudflare_account_id' => $validated['cloudflare_account_id'],
            'protocol' => $validated['protocol'],
            'is_enabled' => $request->boolean('is_enabled', true),
        ]);

        $this->alert->success("Domain \"{$cleanDomain}\" successfully registered and available for server subdomains.")->flash();
        return redirect()->route('admin.subdomains');
    }

    /**
     * Toggle a domain between enabled and disabled.
     */
    public function toggleDomain(Request $request, SubdomainDomain $subdomain_domain): JsonResponse|RedirectResponse
    {
        $subdomain_domain->is_enabled = !$subdomain_domain->is_enabled;
        $subdomain_domain->save();

        $status = $subdomain_domain->is_enabled ? 'enabled' : 'disabled';

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json([
                'success' => true,
                'is_enabled' => $subdomain_domain->is_enabled,
                'message' => "Domain {$subdomain_domain->domain} is now {$status}.",
            ]);
        }

        $this->alert->info("Domain {$subdomain_domain->domain} is now {$status}.")->flash();
        return redirect()->route('admin.subdomains');
    }

    /**
     * Delete a domain and clean up any active server subdomains.
     */
    public function deleteDomain(SubdomainDomain $subdomain_domain): RedirectResponse
    {
        $domainName = $subdomain_domain->domain;

        // Cleanly delete server subdomains so their Cloudflare DNS records are cleaned up
        foreach ($subdomain_domain->subdomains as $serverSubdomain) {
            try {
                $serverSubdomain->delete();
            } catch (\Throwable) {}
        }

        $subdomain_domain->delete();

        $this->alert->success("Domain \"{$domainName}\" and its active subdomains have been removed.")->flash();
        return redirect()->route('admin.subdomains');
    }
}
