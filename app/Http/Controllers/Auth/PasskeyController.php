<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Pterodactyl\Models\User;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\UserPasskey;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Services\Auth\WebAuthnService;

class PasskeyController extends AbstractLoginController
{
    public function __construct(private WebAuthnService $webAuthn)
    {
        parent::__construct();
    }

    /**
     * Issue an authentication challenge for passkey login.
     */
    public function challenge(Request $request): JsonResponse
    {
        $challenge = $this->webAuthn->generateChallenge();
        $request->session()->put('passkey_auth_challenge', $challenge);

        $rpId = $request->getHost();
        $userInput = trim($request->input('user') ?? $request->input('email') ?? '');

        $allowCredentials = [];
        if (!empty($userInput)) {
            $field = str_contains($userInput, '@') ? 'email' : 'username';
            $user = User::query()->where($field, $userInput)->first();
            if ($user) {
                $allowCredentials = $user->passkeys()->get(['credential_id', 'transports'])->map(function (UserPasskey $pk) {
                    return [
                        'id' => $pk->credential_id,
                        'type' => 'public-key',
                        'transports' => $pk->transports,
                    ];
                })->toArray();
            }
        }

        return new JsonResponse([
            'success' => true,
            'challenge' => $challenge,
            'rpId' => $rpId,
            'allowCredentials' => $allowCredentials,
        ]);
    }

    /**
     * Authenticate a user via their WebAuthn passkey assertion.
     */
    public function login(Request $request): JsonResponse
    {
        if ($this->hasTooManyLoginAttempts($request)) {
            $this->fireLockoutEvent($request);
            $this->sendLockoutResponse($request);
        }

        $expectedChallenge = $request->session()->pull('passkey_auth_challenge');
        if (empty($expectedChallenge)) {
            throw new DisplayException('Passkey authentication session expired. Please try again.');
        }

        $credentialId = $request->input('credentialId') ?? $request->input('credential_id');
        $clientDataB64 = $request->input('clientDataJSON');
        $authDataB64 = $request->input('authenticatorData');
        $signatureB64 = $request->input('signature');

        if (empty($credentialId) || empty($clientDataB64) || empty($authDataB64) || empty($signatureB64)) {
            throw new DisplayException('Missing required passkey assertion fields.');
        }

        /** @var \Pterodactyl\Models\UserPasskey|null $passkey */
        $passkey = UserPasskey::query()->where('credential_id', $credentialId)->first();
        if (!$passkey) {
            $this->sendFailedLoginResponse($request, null, 'Passkey credential not recognized on this server.');
        }

        $authDataRaw = $this->webAuthn->base64UrlDecode($authDataB64);
        $clientDataRaw = $this->webAuthn->base64UrlDecode($clientDataB64);
        $signatureRaw = $this->webAuthn->base64UrlDecode($signatureB64);

        $this->webAuthn->verifyAssertion(
            $passkey,
            $authDataRaw,
            $clientDataRaw,
            $signatureRaw,
            $expectedChallenge,
            $request->getHost()
        );

        Activity::event('auth:passkey')->withRequestMetadata()->subject($passkey->user)->log('Signed in with passkey: ' . $passkey->name);

        return $this->sendLoginResponse($passkey->user, $request);
    }
}