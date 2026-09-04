<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Nginx Custom Domains Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration options for automated Nginx reverse proxy management and
    | custom domain linking.
    |
    */

    'enabled' => env('NGINX_DOMAINS_ENABLED', true),

    // Target directory where Nginx vhost files are written on the webserver
    'domains_path' => env('NGINX_DOMAINS_PATH', '/etc/nginx/conf.d/lunar-domains'),

    // Command to test Nginx configuration before activation
    'test_command' => env('NGINX_TEST_COMMAND', 'nginx -t'),

    // Command to reload Nginx gracefully
    'reload_command' => env('NGINX_RELOAD_COMMAND', 'nginx -s reload'),

    // Certbot binary path and options for Let's Encrypt SSL automation
    'certbot_path' => env('CERTBOT_PATH', 'certbot'),
    'certbot_email' => env('CERTBOT_EMAIL', env('MAIL_FROM_ADDRESS', 'admin@votion.local')),
    'certbot_webroot' => env('CERTBOT_WEBROOT', '/var/www/html'),
];
