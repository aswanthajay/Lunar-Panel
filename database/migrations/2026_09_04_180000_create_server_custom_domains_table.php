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
        Schema::create('server_custom_domains', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('server_id');
            $table->unsignedInteger('allocation_id');
            $table->string('domain')->unique();
            $table->string('protocol')->default('http'); // 'http', 'game_srv', 'tcp_stream'
            $table->string('target_type')->default('web'); // 'web', 'game'
            $table->boolean('ssl_enabled')->default(false);
            $table->string('ssl_status')->default('none'); // 'none', 'pending', 'active', 'failed'
            $table->string('ssl_cert_path')->nullable();
            $table->string('ssl_key_path')->nullable();
            $table->string('nginx_status')->default('pending'); // 'pending', 'configured', 'error', 'disabled'
            $table->string('nginx_config_path')->nullable();
            $table->string('dns_status')->default('pending'); // 'pending', 'verified', 'failed'
            $table->timestamp('dns_last_checked_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
            $table->foreign('allocation_id')->references('id')->on('allocations')->onDelete('cascade');
            $table->index(['server_id', 'allocation_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('server_custom_domains');
    }
};
