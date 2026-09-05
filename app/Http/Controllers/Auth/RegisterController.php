<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Exception;
use Ramsey\Uuid\Uuid;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Pterodactyl\Models\User;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Http\Controllers\Controller;

class RegisterController extends Controller
{
    /**
     * Handle initial registration request: validates details, generates 6-digit OTP,
     * stores payload in cache for 15 minutes, and delivers verification email via SMTP.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'email' => 'required|email|max:191',
            'password' => 'required|string|min:8',
        ]);

        $email = strtolower(trim($validated['email']));
        $name = trim($validated['name']);
        $password = $validated['password'];

        // Check if an account already exists with this email
        if (User::query()->where('email', $email)->exists()) {
            return new JsonResponse([
                'success' => false,
                'error' => 'An account with this email address already exists. Please log in instead.',
            ], 422);
        }

        // Determine if registration requires email OTP verification
        $otpEnabled = filter_var(config('pterodactyl.auth.registration_otp_enabled', true), FILTER_VALIDATE_BOOLEAN);

        if (!$otpEnabled) {
            $user = $this->createUserRecord($name, $email, Hash::make($password));

            // Authenticate the user directly into the panel session
            Auth::login($user, true);
            $request->session()->regenerate();

            return new JsonResponse([
                'success' => true,
                'verificationRequired' => false,
                'user' => [
                    'id' => $user->id,
                    'uuid' => $user->uuid,
                    'username' => $user->username,
                    'email' => $user->email,
                    'name' => $user->name,
                    'role' => 'client',
                ],
                'token' => $request->session()->token(),
                'redirect' => '/',
                'message' => 'Account created successfully! Logging into dashboard...',
            ]);
        }

        // Generate 6-digit numeric OTP
        $otp = str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        $verificationToken = Str::random(64);

        // Store registration state in cache for 15 minutes
        Cache::put('reg_otp_' . $verificationToken, [
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'otp' => $otp,
            'attempts' => 0,
            'created_at' => now()->timestamp,
        ], now()->addMinutes(15));

        // Dispatch verification code via configured SMTP Mail
        $mailSent = false;
        try {
            Mail::send('emails.auth.registration-otp', ['name' => $name, 'otp' => $otp], function ($message) use ($email) {
                $message->to($email)
                    ->subject('Your Votion Verification Code');
            });
            $mailSent = true;
        } catch (Exception $e) {
            Log::error('Failed to send registration OTP email to ' . $email . ': ' . $e->getMessage());
            // In local/testing environments without external SMTP relays, log the OTP for verification
            Log::info("Votion Registration OTP for [{$email}]: {$otp} (Token: {$verificationToken})");
        }

        return new JsonResponse([
            'success' => true,
            'verificationRequired' => true,
            'verificationToken' => $verificationToken,
            'message' => $mailSent
                ? "A verification code has been sent to {$email}."
                : "A verification code has been generated for {$email}."
        ]);
    }

    /**
     * Verify the 6-digit OTP code, create the user record, and authenticate the session.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email|max:191',
            'verificationToken' => 'required|string',
            'otp' => 'required|string',
        ]);

        $email = strtolower(trim($validated['email']));
        $token = $validated['verificationToken'];
        $submittedOtp = trim($validated['otp']);

        $cacheKey = 'reg_otp_' . $token;
        $cached = Cache::get($cacheKey);

        if (!$cached || !is_array($cached)) {
            return new JsonResponse([
                'success' => false,
                'error' => 'The verification code has expired or is invalid. Please register again.',
            ], 400);
        }

        if (strtolower($cached['email']) !== $email) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Email address mismatch. Please register again.',
            ], 400);
        }

        // Protect against brute-force guessing
        if (($cached['attempts'] ?? 0) >= 5) {
            Cache::forget($cacheKey);
            return new JsonResponse([
                'success' => false,
                'error' => 'Too many invalid verification attempts. Please start registration again.',
            ], 429);
        }

        if (!hash_equals((string) $cached['otp'], $submittedOtp)) {
            $cached['attempts'] = ($cached['attempts'] ?? 0) + 1;
            Cache::put($cacheKey, $cached, now()->addMinutes(15));

            return new JsonResponse([
                'success' => false,
                'error' => 'Invalid verification code. Please check your email and try again.',
            ], 400);
        }

        // Ensure user hasn't been created in the meantime
        if (User::query()->where('email', $email)->exists()) {
            Cache::forget($cacheKey);
            return new JsonResponse([
                'success' => false,
                'error' => 'An account with this email address already exists. Please log in.',
            ], 422);
        }

        // Create the user in the database
        $user = $this->createUserRecord($cached['name'], $email, $cached['password']);

        // Clear the cache OTP token
        Cache::forget($cacheKey);

        // Authenticate the user directly into the panel session
        Auth::login($user, true);
        $request->session()->regenerate();

        return new JsonResponse([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'uuid' => $user->uuid,
                'username' => $user->username,
                'email' => $user->email,
                'name' => $user->name,
                'role' => 'client',
            ],
            'token' => $request->session()->token(),
            'redirect' => '/',
        ]);
    }

    /**
     * Create a new user record in the database with a permanent RFC 4122 v4 UUID.
     */
    protected function createUserRecord(string $fullName, string $email, string $hashedPassword): User
    {
        $nameParts = explode(' ', $fullName, 2);
        $nameFirst = $nameParts[0];
        $nameLast = $nameParts[1] ?? 'User';

        $baseUsername = preg_replace('/[^a-zA-Z0-9_]/', '', strtolower(explode('@', $email)[0]));
        if (empty($baseUsername) || strlen($baseUsername) < 3) {
            $baseUsername = 'user_' . strtolower(Str::random(5));
        }

        $username = $baseUsername;
        $counter = 1;
        while (User::query()->where('username', $username)->exists()) {
            $username = $baseUsername . $counter;
            $counter++;
        }

        $user = new User();
        $user->uuid = Uuid::uuid4()->toString();
        $user->username = $username;
        $user->email = $email;
        $user->name_first = $nameFirst;
        $user->name_last = $nameLast;
        $user->password = $hashedPassword; // already bcrypt-hashed
        $user->language = 'en';
        $user->root_admin = false;
        $user->use_totp = false;
        $user->gravatar = true;
        $user->save();

        Activity::event('auth:register')->withRequestMetadata()->subject($user)->log();

        return $user;
    }

    /**
     * Resend verification OTP code to the user's email.
     */
    public function resendOtp(Request $request): JsonResponse
    {
        $otpEnabled = filter_var(config('pterodactyl.auth.registration_otp_enabled', true), FILTER_VALIDATE_BOOLEAN);
        if (!$otpEnabled) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Registration OTP verification is currently disabled.',
            ], 400);
        }

        $validated = $request->validate([
            'email' => 'required|email|max:191',
            'verificationToken' => 'required|string',
        ]);

        $email = strtolower(trim($validated['email']));
        $token = $validated['verificationToken'];

        $cacheKey = 'reg_otp_' . $token;
        $cached = Cache::get($cacheKey);

        if (!$cached || !is_array($cached)) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Verification session expired. Please register again.',
            ], 400);
        }

        // Generate fresh 6-digit OTP
        $otp = str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        $cached['otp'] = $otp;
        $cached['attempts'] = 0;
        Cache::put($cacheKey, $cached, now()->addMinutes(15));

        try {
            Mail::send('emails.auth.registration-otp', ['name' => $cached['name'], 'otp' => $otp], function ($message) use ($email) {
                $message->to($email)
                    ->subject('Your New Votion Verification Code');
            });
        } catch (Exception $e) {
            Log::error('Failed to resend registration OTP email: ' . $e->getMessage());
            Log::info("Resent Votion Registration OTP for [{$email}]: {$otp}");
        }

        return new JsonResponse([
            'success' => true,
            'verificationRequired' => true,
            'verificationToken' => $token,
            'message' => "A new verification code has been sent to {$email}.",
        ]);
    }
}
