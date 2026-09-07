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
        if (!Schema::hasTable('subdomain_cloudflare_accounts')) {
            Schema::create('subdomain_cloudflare_accounts', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('auth_type')->default('token'); // 'token' or 'key'
                $table->text('api_token')->nullable();
                $table->text('api_key')->nullable();
                $table->string('api_email')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('subdomain_domains')) {
            Schema::create('subdomain_domains', function (Blueprint $table) {
                $table->id();
                $table->string('domain')->unique();
                $table->string('zone_id');
                $table->unsignedBigInteger('cloudflare_account_id');
                $table->boolean('is_enabled')->default(true);
                $table->string('protocol')->default('both'); // 'both', 'srv_only', 'a_only'
                $table->text('egg_ids')->nullable();
                $table->timestamps();

                $table->foreign('cloudflare_account_id')
                    ->references('id')
                    ->on('subdomain_cloudflare_accounts')
                    ->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('server_subdomains')) {
            Schema::create('server_subdomains', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('server_id');
                $table->unsignedBigInteger('subdomain_domain_id');
                $table->string('subdomain');
                $table->string('record_type')->default('srv'); // 'srv', 'a'
                $table->string('target_ip');
                $table->integer('target_port');
                $table->string('cloudflare_dns_id')->nullable();
                $table->string('cloudflare_srv_id')->nullable();
                $table->timestamps();

                $table->foreign('server_id')
                    ->references('id')
                    ->on('servers')
                    ->onDelete('cascade');

                $table->foreign('subdomain_domain_id')
                    ->references('id')
                    ->on('subdomain_domains')
                    ->onDelete('cascade');

                $table->unique(['subdomain', 'subdomain_domain_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('server_subdomains');
        Schema::dropIfExists('subdomain_domains');
        Schema::dropIfExists('subdomain_cloudflare_accounts');
    }
};
