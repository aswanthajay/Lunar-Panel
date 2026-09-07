<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\KSM\KsmService;
use Prologue\Alerts\AlertsMessageBag;

class KsmController extends Controller
{
    public function __construct(
        private ViewFactory $view,
        private KsmService $ksmService,
        private AlertsMessageBag $alert
    ) {
    }

    /**
     * Render the KSM Management & Visualization Dashboard.
     */
    public function index(): View
    {
        $metrics = $this->ksmService->getMetrics();

        return $this->view->make('admin.ksm.index', [
            'metrics' => $metrics,
        ]);
    }

    /**
     * Return live KSM telemetry metrics as JSON for real-time polling.
     */
    public function metrics(): JsonResponse
    {
        return response()->json($this->ksmService->getMetrics());
    }

    /**
     * Update KSM engine status and individual tuning parameters.
     */
    public function update(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'run' => 'nullable|integer|in:0,1,2',
            'pages_to_scan' => 'nullable|integer|min:10|max:10000',
            'sleep_millisecs' => 'nullable|integer|min:0|max:2000',
            'merge_across_nodes' => 'nullable|boolean',
            'smart_scan' => 'nullable|boolean',
        ]);

        $this->ksmService->updateParameters($validated);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'KSM parameters successfully updated.',
                'metrics' => $this->ksmService->getMetrics(),
            ]);
        }

        $this->alert->success('KSM kernel parameters updated successfully.')->flash();
        return redirect()->route('admin.ksm');
    }

    /**
     * Apply a 1-click optimization profile.
     */
    public function setProfile(Request $request): RedirectResponse|JsonResponse
    {
        $profile = strtolower((string) $request->input('profile', KsmService::PROFILE_BALANCED));

        if (!in_array($profile, [KsmService::PROFILE_AGGRESSIVE, KsmService::PROFILE_BALANCED, KsmService::PROFILE_ECO])) {
            $profile = KsmService::PROFILE_BALANCED;
        }

        $res = $this->ksmService->applyProfile($profile);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Applied {$res['label']} profile successfully.",
                'result' => $res,
                'metrics' => $this->ksmService->getMetrics(),
            ]);
        }

        $this->alert->success("Applied {$res['label']} profile successfully.")->flash();
        return redirect()->route('admin.ksm');
    }

    /**
     * Run a live memory deduplication benchmark test.
     */
    public function runTest(Request $request): JsonResponse
    {
        $mb = (int) $request->input('buffer_mb', 32);
        $result = $this->ksmService->runDeduplicationTest($mb);

        return response()->json($result);
    }
}
