<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Pterodactyl\Models\User;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Illuminate\Contracts\View\View;
use Illuminate\Contracts\View\Factory as ViewFactory;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Pterodactyl\Http\Requests\Auth\LoginRequest;

class LoginController extends AbstractLoginController
{
    /**
     * Standard precomputed dummy bcrypt hash to guarantee constant-time execution
     * when an account does not exist, fully mitigating timing-based user enumeration.
     */
    private const DUMMY_PASSWORD_HASH = '$2y$10$eO0V4zKzXJ2x.mR00vjUq.K8s0gRj2qN5X5K5e5e5e5e5e5e5e5e5';

    /**
     * LoginController constructor.
     */
    public function __construct(private ViewFactory $view)
    {
        parent::__construct();
    }

    /**
     * Handle all incoming requests for the authentication routes and render the
     * base authentication view component. React will take over at this point and
     * turn the login area into an SPA.
     */
    public function index(): View
    {
        return $this->view->make('templates/auth.core');
    }

    /**
     * Handle a login request to the application with strict validation, rate limiting,
     * constant-time hash execution to prevent user enumeration, and injection mitigation.
     *
     * @throws \Pterodactyl\Exceptions\DisplayException
     * @throws \Illuminate\Validation\ValidationException
     */
    public function login(LoginRequest $request): JsonResponse
    {
        if ($this->hasTooManyLoginAttempts($request)) {
            $this->fireLockoutEvent($request);
            $this->sendLockoutResponse($request);
        }

        $username = is_string($request->input('user')) ? trim($request->input('user')) : '';
        $password = is_string($request->input('password')) ? $request->input('password') : '';

        try {
            /** @var \Pterodactyl\Models\User $user */
            $user = User::query()->where($this->getField($username), $username)->firstOrFail();
        } catch (ModelNotFoundException) {
            // Perform constant-time dummy password verification so response times do not reveal user existence
            password_verify($password, self::DUMMY_PASSWORD_HASH);
            $this->sendFailedLoginResponse($request);
        }

        // Verify password against stored hash
        if (!password_verify($password, $user->password)) {
            $this->sendFailedLoginResponse($request, $user);
        }

        if (!$user->use_totp) {
            return $this->sendLoginResponse($user, $request);
        }

        Activity::event('auth:checkpoint')->withRequestMetadata()->subject($user)->log();

        $request->session()->put('auth_confirmation_token', [
            'user_id' => $user->id,
            'token_value' => $token = Str::random(64),
            'expires_at' => CarbonImmutable::now()->addMinutes(5),
        ]);

        return new JsonResponse([
            'data' => [
                'complete' => false,
                'confirmation_token' => $token,
            ],
        ]);
    }
}
