<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\UserPasskey;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Services\Auth\WebAuthnService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class AccountPasskeyController extends ClientApiController
{
    public function __construct(private WebAuthnService $webAuthn)
    {
        parent::__construct();
    }

    /**
     * List all registered passkeys for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $passkeys = $request->user()->passkeys()
            ->select(['id', 'name', 'credential_id', 'aaguid', 'last_used_at', 'created_at'])
            ->latest()
            ->get();

        return new JsonResponse([
            'success' => true,
            'data' => $passkeys,
        ]);
    }

    /**
     * Issue registration options and challenge for enrolling a new passkey.
     */
    public function registerOptions(Request $request): JsonResponse
    {
        $user = $request->user();
        $challenge = $this->webAuthn->generateChallenge();
        $request->session()->put('passkey_register_challenge', $challenge);

        $rpId = $request->getHost();

        return new JsonResponse([
            'success' => true,
            'challenge' => $challenge,
            'rp' => [
                'name' => config('app.name', 'Lunar Panel'),
                'id' => $rpId,
            ],
            'user' => [
                'id' => $this->webAuthn->base64UrlEncode($user->uuid),
                'name' => $user->email,
                'displayName' => $user->name ?: $user->username,
            ],
            'pubKeyCredParams' => [
                ['alg' => -7, 'type' => 'public-key'],   // ES256
                ['alg' => -257, 'type' => 'public-key'], // RS256
            ],
            'timeout' => 60000,
            'attestation' => 'none',
            'authenticatorSelection' => [
                'residentKey' => 'preferred',
                'userVerification' => 'preferred',
            ],
            'excludeCredentials' => $user->passkeys()->get(['credential_id'])->map(function (UserPasskey $pk) {
                return [
                    'id' => $pk->credential_id,
                    'type' => 'public-key',
                ];
            })->toArray(),
        ]);
    }

    /**
     * Store a newly created passkey after client enrollment.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $expectedChallenge = $request->session()->pull('passkey_register_challenge');

        $clientDataB64 = $request->input('clientDataJSON');
        $attestationB64 = $request->input('attestationObject');
        $spkiDerB64 = $request->input('publicKey');
        $name = trim($request->input('name') ?: 'Passkey ' . now()->toDateString());
        $transports = $request->input('transports');

        if (empty($clientDataB64) || empty($attestationB64)) {
            throw new DisplayException('Missing required WebAuthn attestation data.');
        }

        $clientDataRaw = $this->webAuthn->base64UrlDecode($clientDataB64);
        $clientData = json_decode($clientDataRaw, true);
        if (!is_array($clientData) || ($clientData['type'] ?? '') !== 'webauthn.create') {
            throw new DisplayException('Invalid WebAuthn registration response type.');
        }

        if (!empty($expectedChallenge) && ($clientData['challenge'] ?? '') !== $expectedChallenge) {
            throw new DisplayException('Registration challenge mismatch or expired.');
        }

        $attestationRaw = $this->webAuthn->base64UrlDecode($attestationB64);
        $spkiDerRaw = !empty($spkiDerB64) ? $this->webAuthn->base64UrlDecode($spkiDerB64) : null;

        $parsed = $this->webAuthn->extractAttestationData($attestationRaw, $spkiDerRaw);

        // Check if credential ID is already registered
        $existing = UserPasskey::query()->where('credential_id', $parsed['credential_id'])->first();
        if ($existing) {
            if ($existing->user_id === $user->id) {
                $existing->update([
                    'name' => $name,
                    'transports' => is_array($transports) ? $transports : null,
                ]);

                return new JsonResponse([
                    'success' => true,
                    'message' => 'Passkey updated.',
                    'data' => $existing,
                ]);
            }

            throw new DisplayException('This passkey is already enrolled with another account.');
        }

        $passkey = UserPasskey::create([
            'user_id' => $user->id,
            'name' => $name,
            'credential_id' => $parsed['credential_id'],
            'public_key' => $parsed['public_key'],
            'attestation_type' => $parsed['attestation_type'],
            'aaguid' => $parsed['aaguid'],
            'transports' => is_array($transports) ? $transports : null,
        ]);

        Activity::event('user:passkey.create')->withRequestMetadata()->subject($user)->log('Enrolled new passkey: ' . $name);

        return new JsonResponse([
            'success' => true,
            'message' => 'Passkey registered successfully.',
            'data' => $passkey,
        ], 201);
    }

    /**
     * Delete / revoke a passkey.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        /** @var \Pterodactyl\Models\UserPasskey $passkey */
        $passkey = $request->user()->passkeys()->findOrFail($id);

        $name = $passkey->name;
        $passkey->delete();

        Activity::event('user:passkey.delete')->withRequestMetadata()->subject($request->user())->log('Deleted passkey: ' . $name);

        return new JsonResponse([
            'success' => true,
            'message' => 'Passkey removed.',
        ]);
    }
}