<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;

class MCPluginsConfig extends Model
{
    protected $table = 'mcplugins_config';

    protected $casts = [
        'allowed_eggs' => 'array',
    ];

    protected $fillable = [
        'curseforge_api_key',
        'default_page_size',
        'default_provider',
        'allowed_eggs',
        'text_install_button',
        'text_versions_button',
        'text_download_button',
        'text_search',
        'text_search_box',
        'text_version',
        'text_loader',
        'text_sort_by',
        'text_provider',
        'text_page_size',
        'text_not_found',
        'text_showing',
        'text_version_list',
        'text_versions_not_found',
        'text_version_downloads',
        'text_redirect_url',
        'text_download_url',
        'text_install_success',
        'text_install_failed',
    ];
}
