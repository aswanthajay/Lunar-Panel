<?php

namespace Pterodactyl\Services\Billing;

use Illuminate\Http\UploadedFile;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerRenewalPayment;

class AntiFraudPaymentService
{
    /**
     * Evaluate a renewal payment attempt for fraudulent or dummy patterns.
     *
     * @return array{is_valid: bool, reason: string|null}
     */
    public function evaluate(Server $server, int $claimedAmount, string $utrNumber, ?string $payerName, ?UploadedFile $screenshot): array
    {
        // 1. Amount Verification
        $expectedAmount = (int) ($server->billing_amount ?? 0);
        if ($expectedAmount <= 0) {
            $expectedAmount = 499; // fallback default
        }

        if ($claimedAmount !== $expectedAmount) {
            return [
                'is_valid' => false,
                'reason' => "Claimed amount (₹{$claimedAmount}) does not match required renewal amount (₹{$expectedAmount}).",
            ];
        }

        // 2. UTR Format Check (Must be exactly 12 numeric digits in Indian Banking/UPI standard)
        $cleanUtr = trim($utrNumber);
        if (!preg_match('/^\d{12}$/', $cleanUtr)) {
            return [
                'is_valid' => false,
                'reason' => 'Invalid UTR format. A valid UPI transaction reference must be exactly 12 digits.',
            ];
        }

        // 2b. Repetitive or Obvious Sequential UTR Numbers (Fake entries)
        if (preg_match('/^(\d)\1{11}$/', $cleanUtr)) {
            return [
                'is_valid' => false,
                'reason' => 'Suspicious UTR pattern: all repeated digits detected.',
            ];
        }

        $obviousDummyUtrs = [
            '123456789012',
            '012345678901',
            '987654321098',
            '112233445566',
            '121212121212',
            '102030405060',
        ];
        if (in_array($cleanUtr, $obviousDummyUtrs, true)) {
            return [
                'is_valid' => false,
                'reason' => 'Suspicious UTR pattern: known dummy sequence detected.',
            ];
        }

        // 2c. Duplicate UTR check (Cannot reuse an existing approved or pending UTR)
        $duplicateExists = ServerRenewalPayment::query()
            ->where('utr_number', $cleanUtr)
            ->whereIn('status', [ServerRenewalPayment::STATUS_PENDING, ServerRenewalPayment::STATUS_APPROVED])
            ->exists();

        if ($duplicateExists) {
            return [
                'is_valid' => false,
                'reason' => 'Duplicate UTR number. This transaction reference has already been submitted.',
            ];
        }

        // 3. Payer Name Verification
        $cleanName = trim($payerName ?? '');
        if (mb_strlen($cleanName) < 2) {
            return [
                'is_valid' => false,
                'reason' => 'Payer name is missing or too short.',
            ];
        }

        $dummyNames = ['test', 'asdf', 'fake', 'random', 'admin', 'user', 'none', 'na', 'n/a', 'qwerty', 'abc'];
        if (in_array(mb_strtolower($cleanName), $dummyNames, true)) {
            return [
                'is_valid' => false,
                'reason' => 'Suspicious payer name detected.',
            ];
        }

        // 4. Screenshot / Proof Verification
        if (!$screenshot || !$screenshot->isValid()) {
            return [
                'is_valid' => false,
                'reason' => 'Missing or corrupted payment screenshot proof.',
            ];
        }

        // Check file size (real receipt screenshots on UPI are almost always > 12 KB)
        $fileSizeBytes = $screenshot->getSize();
        if ($fileSizeBytes < 10240) { // < 10 KB
            return [
                'is_valid' => false,
                'reason' => 'Screenshot file size is suspiciously small (< 10 KB). Please upload a genuine receipt.',
            ];
        }

        // Check image MIME type and readable dimensions
        $mime = $screenshot->getMimeType();
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!in_array($mime, $allowedMimes, true)) {
            return [
                'is_valid' => false,
                'reason' => 'Unsupported screenshot format. Must be a valid JPEG, PNG, or WebP image.',
            ];
        }

        $imageDimensions = @getimagesize($screenshot->getRealPath());
        if (!$imageDimensions || $imageDimensions[0] < 150 || $imageDimensions[1] < 150) {
            return [
                'is_valid' => false,
                'reason' => 'Image dimensions are too small or invalid for a payment receipt.',
            ];
        }

        return [
            'is_valid' => true,
            'reason' => null,
        ];
    }
}
