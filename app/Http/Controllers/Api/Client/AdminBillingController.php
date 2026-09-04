<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Setting;
use Pterodactyl\Models\ServerRenewalPayment;
use Pterodactyl\Services\Servers\SuspensionService;

class AdminBillingController extends ClientApiController
{
    public function __construct(private SuspensionService $suspensionService)
    {
        parent::__construct();
    }

    /**
     * Enforce admin privilege for all operations in this controller.
     */
    protected function ensureAdmin(Request $request): void
    {
        if (!$request->user() || !$request->user()->root_admin) {
            abort(403, 'Unauthorized. Root admin access required for billing operations.');
        }
    }

    /**
     * Get UPI gateway configuration.
     */
    public function getConfig(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $upiId = Setting::where('key', 'billing:upi_id')->value('value') ?: 'votion@upi';
        $payeeName = Setting::where('key', 'billing:payee_name')->value('value') ?: 'Votion Game Infrastructure';

        return response()->json([
            'success' => true,
            'data' => [
                'upi_id' => $upiId,
                'payee_name' => $payeeName,
            ],
        ]);
    }

    /**
     * Update UPI gateway configuration.
     */
    public function updateConfig(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $request->validate([
            'upi_id' => 'required|string|regex:/^[\w\.\-]+@[\w\-]+$/|max:100',
            'payee_name' => 'required|string|min:2|max:100',
        ]);

        Setting::updateOrCreate(['key' => 'billing:upi_id'], ['value' => trim($request->input('upi_id'))]);
        Setting::updateOrCreate(['key' => 'billing:payee_name'], ['value' => trim($request->input('payee_name'))]);

        return response()->json([
            'success' => true,
            'message' => 'UPI Gateway settings updated successfully.',
            'data' => [
                'upi_id' => trim($request->input('upi_id')),
                'payee_name' => trim($request->input('payee_name')),
            ],
        ]);
    }

    /**
     * List all renewal verification submissions.
     */
    public function payments(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $query = ServerRenewalPayment::query()
            ->with([
                'user:id,username,email',
                'server:id,uuid,uuidShort,name,expires_at,status,grace_period_expires_at,billing_amount',
                'reviewer:id,username,email',
            ])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        if ($request->input('suspicious') === 'true') {
            $query->where('is_suspicious', true);
        }

        $payments = $query->get();

        return response()->json([
            'success' => true,
            'data' => $payments,
        ]);
    }

    /**
     * Approve payment: extend server expiry by 30 days, clear grace period, ensure unsuspended.
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        $this->ensureAdmin($request);

        $payment = ServerRenewalPayment::with('server')->findOrFail($id);

        if ($payment->status === ServerRenewalPayment::STATUS_APPROVED) {
            return response()->json([
                'success' => false,
                'message' => 'This payment has already been approved.',
            ], 400);
        }

        $server = $payment->server;
        $now = Carbon::now();

        // Calculate new expiration date: extend by 30 days from current expiry if future, else from now
        $baseDate = ($server->expires_at && $server->expires_at->isFuture())
            ? $server->expires_at
            : $now;

        $newExpiry = (clone $baseDate)->addDays(30);

        // Update server
        $server->expires_at = $newExpiry;
        $server->grace_period_expires_at = null;
        $server->status = null;
        $server->save();

        // Try to unsuspend via Wings daemon if needed
        try {
            $this->suspensionService->toggle($server, SuspensionService::ACTION_UNSUSPEND);
        } catch (\Throwable) {
            $server->update(['status' => null]);
        }

        // Update payment record
        $payment->status = ServerRenewalPayment::STATUS_APPROVED;
        $payment->reviewed_by = $request->user()->id;
        $payment->reviewed_at = $now;
        if ($request->filled('admin_notes')) {
            $payment->admin_notes = $request->input('admin_notes');
        }
        $payment->save();

        return response()->json([
            'success' => true,
            'message' => "Payment approved! Server '{$server->name}' expiry extended to {$newExpiry->toDateString()}.",
            'data' => $payment->load(['server', 'reviewer']),
        ]);
    }

    /**
     * Reject payment: mark rejected, clear grace period, immediately suspend if server is expired.
     */
    public function reject(Request $request, int $id): JsonResponse
    {
        $this->ensureAdmin($request);

        $payment = ServerRenewalPayment::with('server')->findOrFail($id);

        $rejectionReason = $request->input('reason', 'Payment verification failed or receipt was invalid.');

        $payment->status = ServerRenewalPayment::STATUS_REJECTED;
        $payment->rejection_reason = $rejectionReason;
        $payment->reviewed_by = $request->user()->id;
        $payment->reviewed_at = Carbon::now();
        $payment->save();

        $server = $payment->server;
        if ($server) {
            $server->grace_period_expires_at = null;

            // If server is past its expiration, immediately suspend it
            if ($server->expires_at && $server->expires_at->isPast()) {
                $server->status = Server::STATUS_SUSPENDED;
                $server->save();

                try {
                    $this->suspensionService->toggle($server, SuspensionService::ACTION_SUSPEND);
                } catch (\Throwable) {
                    $server->update(['status' => Server::STATUS_SUSPENDED]);
                }
            } else {
                $server->save();
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Payment rejected. Server grace period revoked.",
            'data' => $payment->load(['server', 'reviewer']),
        ]);
    }
}
