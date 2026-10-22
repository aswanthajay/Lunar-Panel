<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Pterodactyl\Models\User;
use Illuminate\Auth\AuthManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Auth\Events\Failed;
use Illuminate\Container\Container;
use Illuminate\Support\Facades\Event;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Http\Controllers\Controller;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Auth\AuthenticatesUsers;

abstract class AbstractLoginController extends Controller
{
    use AuthenticatesUsers;

    protected AuthManager $auth;

    /**
     * Lockout time for failed login requests (in minutes).
     */
    protected int $lockoutTime;

    /**
     * After how many attempts should logins be throttled and locked.
     */
    protected int $maxLoginAttempts;

    /**
     * Where to redirect users after login / registration.
     */
    protected string $redirectTo = '/';

    /**
     * LoginController constructor.
     */
    public function __construct()
    {
        $this->lockoutTime = (int) config('auth.lockout.time', 2);
        $this->maxLoginAttempts = (int) config('auth.lockout.attempts', 3);
        $this->auth = Container::getInstance()->make(AuthManager::class);
    }

    /**
     * The input field used as the username for authentication.
     */
    public function username(): string
    {
        return 'user';
    }

    /**
     * Get the maximum number of attempts to allow before locking out.
     */
    public function maxAttempts(): int
    {
        return (int) config('auth.lockout.attempts', 3);
    }

    /**
     * Get the number of minutes to throttle failed attempts for.
     */
    public function decayMinutes(): int
    {
        return (int) config('auth.lockout.time', 2);
    }

    /**
     * Get the throttle key for the given request combining sanitized username and IP address.
     * Prevents distributed credential stuffing bypasses and avoids shared-IP collateral lockouts.
     */
    protected function throttleKey(Request $request): string
    {
        $user = is_string($request->input('user')) ? Str::lower(trim($request->input('user'))) : '';

        return Str::transliterate($user . '|' . $request->ip());
    }

    /**
     * Get the failed login response instance with incremented rate limiting counter.
     *
     * @throws \Pterodactyl\Exceptions\DisplayException
     */
    protected function sendFailedLoginResponse(Request $request, Authenticatable $user = null, string $message = null)
    {
        $this->incrementLoginAttempts($request);

        $userField = is_string($request->input('user')) ? trim($request->input('user')) : '';
        $this->fireFailedLoginEvent($user, [
            $this->getField($userField) => $userField,
        ]);

        if ($request->route()->named('auth.login-checkpoint')) {
            throw new DisplayException($message ?? trans('auth.two_factor.checkpoint_failed'));
        }

        throw new DisplayException(trans('auth.failed'));
    }

    /**
     * Send the response after the user was authenticated.
     * Hardened against Open Redirect vulnerabilities, Session Fixation, and CSRF token re-use.
     */
    protected function sendLoginResponse(User $user, Request $request): JsonResponse
    {
        $intendedUrl = $request->session()->pull('url.intended', $this->redirectPath());
        if (($intendedUrl === '/' || empty($intendedUrl)) && $request->session()->has('oauth_auth_request')) {
            $oauthParams = $request->session()->pull('oauth_auth_request');
            if (is_array($oauthParams) && !empty($oauthParams)) {
                $intendedUrl = route('oauth.authorize', $oauthParams);
            }
        }

        // Mitigate Open Redirect attacks: ensure redirect target is strictly local or matches current host
        if (!empty($intendedUrl)) {
            if (str_starts_with($intendedUrl, '/') && !str_starts_with($intendedUrl, '//')) {
                // Safe relative local path
            } elseif (filter_var($intendedUrl, FILTER_VALIDATE_URL)) {
                $appHost = parse_url((string) config('app.url', ''), PHP_URL_HOST);
                $intendedHost = parse_url($intendedUrl, PHP_URL_HOST);
                if (empty($appHost) || strcasecmp((string) $appHost, (string) $intendedHost) !== 0) {
                    $intendedUrl = $this->redirectPath();
                }
            } else {
                $intendedUrl = $this->redirectPath();
            }
        } else {
            $intendedUrl = $this->redirectPath();
        }

        // Fully invalidate prior session tokens and regenerate ID & CSRF token to prevent Session Fixation
        $request->session()->remove('auth_confirmation_token');
        $request->session()->regenerate();
        $request->session()->regenerateToken();

        $this->clearLoginAttempts($request);

        $this->auth->guard()->login($user, true);

        $hasPasskeys = false;
        try {
            $hasPasskeys = $user->passkeys()->exists();
        } catch (\Throwable) {
            $hasPasskeys = true;
        }

        return new JsonResponse([
            'data' => [
                'complete' => true,
                'intended' => $intendedUrl ?: $this->redirectPath(),
                'user' => $user->toVueObject(),
                'prompt_passkey' => !$hasPasskeys,
            ],
        ]);
    }

    /**
     * Determine if the user is logging in using an email or username safely without type errors.
     */
    protected function getField(?string $input = null): string
    {
        return (!empty($input) && is_string($input) && str_contains($input, '@')) ? 'email' : 'username';
    }

    /**
     * Fire a failed login event.
     */
    protected function fireFailedLoginEvent(Authenticatable $user = null, array $credentials = [])
    {
        Event::dispatch(new Failed('auth', $user, $credentials));
    }
}
