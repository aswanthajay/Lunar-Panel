<?php

namespace Pterodactyl\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Pterodactyl\Services\Licensing\LicenseManager;

class VerifyLunarLicense
{
    protected LicenseManager $licenseManager;

    public function __construct(LicenseManager $licenseManager)
    {
        $this->licenseManager = $licenseManager;
    }

    /**
     * Handle an incoming request and enforce active license verification.
     */
    public function handle(Request $request, Closure $next)
    {
        // 1. Whitelist static assets, webhooks, and activation endpoints
        if ($this->isWhitelisted($request)) {
            return $next($request);
        }

        // 2. Perform cryptographic verification
        $result = $this->licenseManager->verify();

        // If license is valid, proceed smoothly
        if ($result['valid']) {
            return $next($request);
        }

        // 3. If API request, return structured 402 Payment/License Required JSON
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'success' => false,
                'error' => 'License Required',
                'status' => $result['status'],
                'message' => $result['message'],
                'domain' => $result['host'],
                'activate_url' => url('/admin/license'),
            ], 402);
        }

        // 4. If Admin is logged in, redirect them to the Admin CP License page with notification
        if ($request->user() && $request->user()->root_admin) {
            if (!$request->is('admin/license*')) {
                return redirect()->route('admin.license')->with('error', $result['message']);
            }
            return $next($request);
        }

        // 5. If Client or Guest, render the dedicated obsidian lockout view
        return response()->view('errors.license', [
            'licenseResult' => $result,
            'host' => $result['host'],
        ], 402);
    }

    /**
     * Determine if the current route is exempt from license blocking.
     */
    protected function isWhitelisted(Request $request): bool
    {
        $exemptPaths = [
            'admin/license*',
            'auth/login*',
            'auth/logout*',
            'assets/*',
            'favicons/*',
            'locales/*',
            'daemon/*',
            'api/remote/*',
        ];

        foreach ($exemptPaths as $path) {
            if ($request->is($path)) {
                return true;
            }
        }

        return false;
    }
}
