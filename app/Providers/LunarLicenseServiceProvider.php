<?php

namespace Pterodactyl\Providers;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use Pterodactyl\Services\Licensing\LicenseManager;
use Pterodactyl\Console\Commands\License\GenerateLicenseCommand;

class LunarLicenseServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register()
    {
        $this->app->singleton(LicenseManager::class, function () {
            return new LicenseManager();
        });

        if ($this->app->runningInConsole()) {
            $this->commands([
                GenerateLicenseCommand::class,
            ]);
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot()
    {
        // Custom blade directives for conditional UI display based on license
        Blade::if('licensed', function () {
            return app(LicenseManager::class)->verify()['valid'];
        });

        Blade::if('licenseTier', function (string $tier) {
            $res = app(LicenseManager::class)->verify();
            return $res['valid'] && strtolower($res['tier']) === strtolower($tier);
        });

        // Share license state with all views
        view()->composer('*', function ($view) {
            $view->with('lunarLicense', app(LicenseManager::class)->verify());
        });
    }
}
