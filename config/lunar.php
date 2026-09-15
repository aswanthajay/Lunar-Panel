<?php

return [
    /*
     |--------------------------------------------------------------------------
     | Lunar Panel Licensing Configuration
     |--------------------------------------------------------------------------
     |
     | Master asymmetric RSA public key used to cryptographically verify
     | customer license signatures.
     |
     */
    'license' => [
        'key' => env('LUNAR_LICENSE_KEY', ''),

        'public_key' => <<<PEM
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxa1nMYvqK+e9UJxYb4Bz
ZaTmHL+SZi4/LfyPifHznUOosNA1hz3jiQ2fZbejcinFkkIlHJwfCdNQwcKA1VNY
wmgC4zgRus8S836AGmQI8S8EI73BIYR0UhvFtHPTviwHxF6IjH967McxEOsN47De
0xr9EyomDYEN062OUdHEF8xZK4DfEwIse5wybvl7wRjRmagqqm35OVHQzRUA/5kF
v5gXjKqtnZZncAvuaR0SQ9NM+LNTFPB3przK5BYmYfBM3c3zqTJbOER+aWpqQ4Zq
1F3husqeWar890s1/dBOxjjG/finSgcEi+0NV+I9AF1u7rGOpQGnV2NAZbHTe5oR
AwIDAQAB
-----END PUBLIC KEY-----
PEM,

        // Duration to cache license validation results in seconds (default 1 hour)
        'cache_ttl' => env('LUNAR_LICENSE_CACHE_TTL', 3600),

        // Allow localhost and private IPs for development if enabled
        'allow_local' => env('LUNAR_LICENSE_ALLOW_LOCAL', false),
    ],
];
