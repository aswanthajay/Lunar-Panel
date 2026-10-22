<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Pterodactyl\Models\User;
use Illuminate\Http\JsonResponse;
use PragmaRX\Google2FA\Google2FA;
use Illuminate\Support\Facades\Event;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Pterodactyl\Events\Auth\ProvidedAuthenticationToken;
use Pterodactyl\Http\Requests\Auth\LoginCheckpointRequest;
use Illuminate\Contracts\Validation\Factory as ValidationFactory;

class LoginCheckpointController extends AbstractLoginController
{
    private const TOKEN_EXPIRED_MESSAGE = 'The authentication token provided has expired, please refresh the page and try again.';

    /**
     * LoginCheckpointController constructor.
     */
    public function __construct(
        private Encrypter $encrypter,
        private Google2FA $google2FA,
        private ValidationFactory $validation
    ) {
        parent::__construct();
    }

    /**
     * Handle a login where the user is required to provide a TOTP authentication
     * token or recovery token.
     *
     * @throws \PragmaRX\Google2FA\Exceptions\IncompatibleWithGoogleAuthenticatorException
     * @throws \PragmaRX\Google2FA\Exceptions\InvalidCharactersException
     * @throws \PragmaRX\Google2FA\Exceptions\SecretKeyTooShortException
     * @throws \Exception
     * @throws \Illuminate\Validation\ValidationException
     */
    public function __invoke(LoginCheckpointRequest $request): JsonResponse
    {
        if ($this->hasTooManyLoginAttempts($request)) {
            $this->sendLockoutResponse($request);
        }

        $details = $request->session()->get('auth_confirmation_token');
        if (!is_array($details) || !$this->hasValidSessionData($details)) {
            $this->sendFailedLoginResponse($request, null, self::TOKEN_EXPIRED_MESSAGE);
        }

        $confirmationToken = is_string($request->input('confirmation_token')) ? $request->input('confirmation_token') : '';
        $storedToken = is_string($details['token_value'] ?? null) ? $details['token_value'] : '';

        if (!hash_equals($confirmationToken, $storedToken)) {
            $this->sendFailedLoginResponse($request);
        }

        try {
            /** @var \Pterodactyl\Models\User $user */
            $user = User::query()->findOrFail($details['user_id']);
        } catch (ModelNotFoundException) {
            $this->sendFailedLoginResponse($request, null, self::TOKEN_EXPIRED_MESSAGE);
        }

        // Recovery tokens go through a slightly different pathway for usage.
        $recoveryToken = $request->input('recovery_token');
        if (is_string($recoveryToken) && trim($recoveryToken) !== '') {
            if ($this->isValidRecoveryToken($user, trim($recoveryToken))) {
                Event::dispatch(new ProvidedAuthenticationToken($user, true));

                return $this->sendLoginResponse($user, $request);
            }
        } else {
            try {
                $decrypted = $this->encrypter->decrypt($user->totp_secret);
                $authCode = is_string($request->input('authentication_code')) ? trim($request->input('authentication_code')) : '';

                if ($this->google2FA->verifyKey($decrypted, $authCode, config('pterodactyl.auth.2fa.window', 4))) {
                    Event::dispatch(new ProvidedAuthenticationToken($user));

                    return $this->sendLoginResponse($user, $request);
                }
            } catch (\Throwable) {
                // Ignore decryption / crypto faults and treat as invalid authentication code
            }
        }

        $this->sendFailedLoginResponse($request, $user, !empty($recoveryToken) ? 'The recovery token provided is not valid.' : null);
    }

    /**
     * Determines if a given recovery token is valid for the user account. If we find a matching token
     * it will be deleted from the database.
     *
     * @throws \Exception
     */
    protected function isValidRecoveryToken(User $user, string $value): bool
    {
        foreach ($user->recoveryTokens as $token) {
            if (password_verify($value, $token->token)) {
                $token->delete();

                return true;
            }
        }

        return false;
    }

    /**
     * Determines if the data provided from the session is valid or not.
     */
    protected function hasValidSessionData(?array $data): bool
    {
        if (empty($data)) {
            return false;
        }

        $validator = $this->validation->make($data, [
            'user_id' => 'required|integer|min:1',
            'token_value' => 'required|string',
            'expires_at' => 'required',
        ]);

        if ($validator->fails()) {
            return false;
        }

        if (!isset($data['expires_at']) || !$data['expires_at'] instanceof CarbonInterface) {
            return false;
        }

        if ($data['expires_at']->isBefore(CarbonImmutable::now())) {
            return false;
        }

        return true;
    }
}
