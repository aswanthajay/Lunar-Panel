<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Setting;
use Pterodactyl\Models\ServerRenewalPayment;
use Pterodactyl\Services\Billing\AntiFraudPaymentService;
use Pterodactyl\Services\Servers\SuspensionService;

class BillingController extends ClientApiController
{
    public function __construct(
        private AntiFraudPaymentService $antiFraudService,
        private SuspensionService $suspensionService
    ) {
        parent::__construct();
    }

    /**
     * Returns the active UPI payment gateway settings and supported duration discounts.
     */
    public function config(): JsonResponse
    {
        $upiId = Setting::where('key', 'billing:upi_id')->value('value') ?: 'votion@upi';
        $payeeName = Setting::where('key', 'billing:payee_name')->value('value') ?: 'Votion Game Infrastructure';

        return response()->json([
            'success' => true,
            'data' => [
                'upi_id' => $upiId,
                'payee_name' => $payeeName,
                'cycles' => [
                    ['months' => 1, 'label' => '1 Month (Standard)', 'discount_percent' => 0],
                    ['months' => 3, 'label' => '3 Months (Quarterly)', 'discount_percent' => 5],
                    ['months' => 6, 'label' => '6 Months (Semi-Annual)', 'discount_percent' => 10],
                    ['months' => 12, 'label' => '12 Months (Annual Plan)', 'discount_percent' => 15],
                ],
            ],
        ]);
    }

    /**
     * Returns renewal payments for the logged-in client.
     */
    public function payments(Request $request): JsonResponse
    {
        $user = $request->user();

        $payments = ServerRenewalPayment::query()
            ->with(['server:id,uuid,uuidShort,name,expires_at,status,billing_amount'])
            ->where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $payments,
        ]);
    }

    /**
     * Submit a server renewal payment with UPI screenshot, UTR number, and flexible duration.
     */
    public function renew(Request $request, string $serverUuid): JsonResponse
    {
        $user = $request->user();

        // Resolve server by uuid or uuidShort
        $server = Server::query()
            ->where(function ($query) use ($serverUuid) {
                $query->where('uuid', $serverUuid)
                    ->orWhere('uuidShort', $serverUuid);
            })
            ->firstOrFail();

        // Authorization: must be owner or admin
        if ($server->owner_id !== $user->id && !$user->root_admin) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have permission to renew this server.',
            ], 403);
        }

        $request->validate([
            'amount' => 'required|numeric|min:1',
            'utr_number' => 'required|string|min:8|max:30',
            'payer_name' => 'required|string|min:2|max:100',
            'payment_note' => 'nullable|string|max:100',
            'billing_cycle_months' => 'nullable|integer|in:1,3,6,12',
            'screenshot' => 'required|file|image|mimes:jpeg,png,jpg,webp|max:10240', // max 10MB
        ]);

        $claimedAmount = (int) $request->input('amount');
        $utrNumber = trim($request->input('utr_number'));
        $payerName = trim($request->input('payer_name'));
        $paymentNote = trim((string) $request->input('payment_note')) ?: ('Renewal-' . ($user->username ?? 'user') . '-' . Str::slug($server->name));
        $screenshotFile = $request->file('screenshot');
        $months = (int) $request->input('billing_cycle_months', 1);

        // Calculate expected amount based on flexible renewal duration (with term discounts)
        $baseMonthly = (int) ($server->billing_amount ?: 499);
        $discountPercent = match ($months) {
            3 => 5,
            6 => 10,
            12 => 15,
            default => 0,
        };
        $expectedAmount = (int) round(($baseMonthly * $months) * (1 - $discountPercent / 100));

        // Evaluate anti-fraud with expected amount override
        $fraudCheck = $this->antiFraudService->evaluate($server, $claimedAmount, $utrNumber, $payerName, $screenshotFile, $expectedAmount);
        $isSuspicious = !$fraudCheck['is_valid'];
        $suspiciousReason = $fraudCheck['reason'];

        // Save screenshot to public/uploads/proofs
        $destinationPath = public_path('uploads/proofs');
        if (!is_dir($destinationPath)) {
            @mkdir($destinationPath, 0755, true);
        }

        $fileName = 'proof_' . $server->id . '_' . time() . '_' . Str::random(8) . '.' . $screenshotFile->getClientOriginalExtension();
        $screenshotFile->move($destinationPath, $fileName);
        $screenshotPath = '/uploads/proofs/' . $fileName;

        $merchantUpi = Setting::where('key', 'billing:upi_id')->value('value') ?: 'votion@upi';

        // Check if server is currently suspended and eligible for 12-hour grace period
        $isExistingServer = !is_null($server->created_at);
        $isSuspended = $server->isSuspended();
        $gracePeriodGranted = false;
        $graceExpiresAt = null;

        if ($isExistingServer && $isSuspended && !$isSuspicious) {
            // Grant 12-hour grace period!
            $gracePeriodGranted = true;
            $graceExpiresAt = Carbon::now()->addHours(12);

            $server->grace_period_expires_at = $graceExpiresAt;
            $server->status = null;
            $server->save();

            // Try to unsuspend through Wings daemon, catch offline exception gracefully
            try {
                $this->suspensionService->toggle($server, SuspensionService::ACTION_UNSUSPEND);
            } catch (\Throwable) {
                $server->update(['status' => null]);
            }
        }

        $payment = ServerRenewalPayment::create([
            'server_id' => $server->id,
            'user_id' => $user->id,
            'amount' => $claimedAmount,
            'billing_cycle_months' => $months,
            'upi_id' => $merchantUpi,
            'payer_name' => $payerName,
            'payment_note' => $paymentNote,
            'utr_number' => $utrNumber,
            'screenshot_path' => $screenshotPath,
            'status' => ServerRenewalPayment::STATUS_PENDING,
            'grace_period_granted' => $gracePeriodGranted,
            'grace_period_expires_at' => $graceExpiresAt,
            'is_suspicious' => $isSuspicious,
            'suspicious_reason' => $suspiciousReason,
        ]);

        $message = "Renewal payment for {$months} month(s) submitted successfully and queued for admin verification.";
        if ($gracePeriodGranted) {
            $message = "Payment for {$months} month(s) submitted! Your suspended server has been unsuspended with a 12-hour grace period while admin reviews your payment.";
        } elseif ($isSuspicious) {
            $message = 'Payment submitted, but flagged for manual verification: ' . $suspiciousReason . '. Grace period is withheld until admin confirms payment.';
        }

        return response()->json([
            'success' => true,
            'is_suspicious' => $isSuspicious,
            'grace_period_granted' => $gracePeriodGranted,
            'message' => $message,
            'data' => $payment->load('server:id,uuid,uuidShort,name,expires_at,status'),
        ]);
    }
}
