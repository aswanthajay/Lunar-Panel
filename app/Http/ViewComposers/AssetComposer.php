<?php

namespace Pterodactyl\Http\ViewComposers;

use Illuminate\View\View;
use Pterodactyl\Services\Helpers\AssetHashService;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class AssetComposer
{
    /**
     * AssetComposer constructor.
     */
    public function __construct(
        private AssetHashService $assetHashService,
        private SettingsRepositoryInterface $settings
    ) {
    }

    /**
     * Provide access to the asset service in the views.
     */
    public function compose(View $view): void
    {
        try {
            $authentikEnabled = filter_var($this->settings->get('authentik:enabled', false), FILTER_VALIDATE_BOOLEAN);
            $authentikEnforced = filter_var($this->settings->get('authentik:enforce', false), FILTER_VALIDATE_BOOLEAN);
            $authentikTitle = trim((string) $this->settings->get('authentik:title', 'Authentik'));
        } catch (\Throwable) {
            $authentikEnabled = false;
            $authentikEnforced = false;
            $authentikTitle = 'Authentik';
        }

        $oauthProviders = [];
        try {
            /** @var \Pterodactyl\Services\Auth\UniversalOAuthService $oauthService */
            $oauthService = app(\Pterodactyl\Services\Auth\UniversalOAuthService::class);
            $oauthProviders = $oauthService->getActiveProviders();
        } catch (\Throwable) {
            $oauthProviders = [];
        }

        $view->with('asset', $this->assetHashService);
        $view->with('siteConfiguration', [
            'name' => config('app.name') ?? 'Lunar Panel',
            'locale' => config('app.locale') ?? 'en',
            'recaptcha' => [
                'enabled' => config('recaptcha.enabled', false),
                'siteKey' => config('recaptcha.website_key') ?? '',
            ],
            'authentik' => [
                'enabled' => $authentikEnabled,
                'enforced' => $authentikEnforced,
                'title' => !empty($authentikTitle) ? $authentikTitle : 'Authentik',
                'url' => route('auth.sso.authentik'),
            ],
            'oauth_providers' => $oauthProviders,
        ]);
    }
}
