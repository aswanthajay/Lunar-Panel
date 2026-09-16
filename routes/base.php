<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Base;
use Pterodactyl\Http\Controllers\OAuth;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;
use Pterodactyl\Http\Middleware\VerifyCsrfToken;

Route::get('/', [Base\IndexController::class, 'index'])->name('index')->fallback();
Route::get('/account', [Base\IndexController::class, 'index'])
    ->withoutMiddleware(RequireTwoFactorAuthentication::class)
    ->name('account');

Route::get('/locales/locale.json', Base\LocaleController::class)
    ->withoutMiddleware(['auth', RequireTwoFactorAuthentication::class])
    ->where('namespace', '.*');

// OAuth 2.0 Identity Server Endpoints (RFC 6749, RFC 7009, OIDC UserInfo)
Route::prefix('/oauth')->group(function () {
    Route::get('/authorize', [OAuth\OAuthServerController::class, 'authorizeRequest'])
        ->withoutMiddleware(RequireTwoFactorAuthentication::class)
        ->name('oauth.authorize');

    Route::post('/authorize', [OAuth\OAuthServerController::class, 'approve'])
        ->withoutMiddleware(RequireTwoFactorAuthentication::class)
        ->name('oauth.authorize.post');

    Route::post('/token', [OAuth\OAuthServerController::class, 'token'])
        ->withoutMiddleware([RequireTwoFactorAuthentication::class, VerifyCsrfToken::class, 'auth.session'])
        ->name('oauth.token');

    Route::match(['GET', 'POST'], '/userinfo', [OAuth\OAuthServerController::class, 'userinfo'])
        ->withoutMiddleware([RequireTwoFactorAuthentication::class, VerifyCsrfToken::class, 'auth.session'])
        ->name('oauth.userinfo');

    Route::post('/revoke', [OAuth\OAuthServerController::class, 'revoke'])
        ->withoutMiddleware([RequireTwoFactorAuthentication::class, VerifyCsrfToken::class, 'auth.session'])
        ->name('oauth.revoke');
});

Route::get('/{react}', [Base\IndexController::class, 'index'])
    ->where('react', '^(?!(\/)?(api|auth|admin|daemon|oauth)).+');
