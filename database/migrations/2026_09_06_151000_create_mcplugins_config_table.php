<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('mcplugins_config')) {
            Schema::create('mcplugins_config', function (Blueprint $table) {
                $table->increments('id');
                $table->string('curseforge_api_key')->nullable();
                $table->integer('default_page_size')->default(10);
                $table->string('default_provider')->default('modrinth');
                $table->text('allowed_eggs')->nullable();
                $table->string('text_install_button')->nullable();
                $table->string('text_versions_button')->nullable();
                $table->string('text_download_button')->nullable();
                $table->string('text_search')->nullable();
                $table->string('text_search_box')->nullable();
                $table->string('text_version')->nullable();
                $table->string('text_loader')->nullable();
                $table->string('text_sort_by')->nullable();
                $table->string('text_provider')->nullable();
                $table->string('text_page_size')->nullable();
                $table->string('text_not_found')->nullable();
                $table->string('text_showing')->nullable();
                $table->string('text_version_list')->nullable();
                $table->string('text_versions_not_found')->nullable();
                $table->string('text_version_downloads')->nullable();
                $table->string('text_redirect_url')->nullable();
                $table->string('text_download_url')->nullable();
                $table->string('text_install_success')->nullable();
                $table->string('text_install_failed')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mcplugins_config');
    }
};
