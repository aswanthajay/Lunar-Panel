<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\Licensing\LicenseManager;

class LicenseController extends Controller
{
    protected LicenseManager $licenseManager;
    protected AlertsMessageBag $alert;

    public function __construct(LicenseManager $licenseManager, AlertsMessageBag $alert)
    {
        $this->licenseManager = $licenseManager;
        $this->alert = $alert;
    }

    /**
     * Display the license management page in Admin CP.
     */
    public function index(): View
    {
        $status = $this->licenseManager->verify();
        $rawKey = $this->licenseManager->getLicenseKey();

        return view('admin.license.index', [
            'license' => $status,
            'rawKey' => $rawKey,
            'currentHost' => $this->licenseManager->getCurrentHost(),
        ]);
    }

    /**
     * Update and validate the license key.
     */
    public function update(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        $key = trim($request->input('license_key', ''));

        if (empty($key)) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'License key cannot be empty. Please enter your valid Lunar Panel license key.'], 422);
            }
            $this->alert->danger('License key cannot be empty. Please enter your valid Lunar Panel license key.')->flash();
            return redirect()->route('admin.license');
        }

        // Test the new key before saving
        $result = $this->licenseManager->verify($key);

        if (!$result['valid']) {
            if ($request->expectsJson()) {
                return response()->json(['error' => "Activation Failed: {$result['message']}"], 422);
            }
            $this->alert->danger("Activation Failed: {$result['message']}")->flash();
            return redirect()->route('admin.license')->withInput();
        }

        // Key is valid! Save it permanently to database
        $this->licenseManager->setLicenseKey($key);

        $tierName = ucfirst($result['tier']);
        if ($request->expectsJson()) {
            return response()->json(['success' => true, 'message' => "License activated successfully! Welcome to Lunar Panel ({$tierName} Edition)."]);
        }
        $this->alert->success("License activated successfully! Welcome to Lunar Panel ({$tierName} Edition).")->flash();

        return redirect()->route('admin.license');
    }

    /**
     * Refresh the cached license verification state.
     */
    public function refresh(): RedirectResponse
    {
        $this->licenseManager->clearCache();
        $result = $this->licenseManager->verify();

        if ($result['valid']) {
            $this->alert->success('License verification refreshed successfully. Status: Active.')->flash();
        } else {
            $this->alert->warning("License refresh returned non-active status: {$result['message']}")->flash();
        }

        return redirect()->route('admin.license');
    }
}
