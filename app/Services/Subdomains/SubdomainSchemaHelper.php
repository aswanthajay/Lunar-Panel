<?php

namespace Pterodactyl\Services\Subdomains;

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SubdomainSchemaHelper
{
    /**
     * Ensure all required subdomain tables exist in the database with the correct columns.
     * Automatically creates or updates them if migrations were skipped or tables have legacy schemas.
     */
    public static function ensureTablesExist(): void
    {
        try {
            Schema::disableForeignKeyConstraints();

            // 1. Check & upgrade server_subdomains if it exists with missing subdomain_domain_id
            if (Schema::hasTable('server_subdomains')) {
                if (!Schema::hasColumn('server_subdomains', 'subdomain_domain_id')) {
                    $count = DB::table('server_subdomains')->count();
                    if ($count === 0) {
                        Schema::dropIfExists('server_subdomains');
                    } else {
                        Schema::table('server_subdomains', function (Blueprint $table) {
                            if (!Schema::hasColumn('server_subdomains', 'subdomain_domain_id')) {
                                $table->unsignedBigInteger('subdomain_domain_id')->nullable()->after('server_id');
                            }
                            if (!Schema::hasColumn('server_subdomains', 'record_type')) {
                                $table->string('record_type', 32)->default('srv');
                            }
                            if (!Schema::hasColumn('server_subdomains', 'target_ip')) {
                                $table->string('target_ip', 191)->nullable();
                            }
                            if (!Schema::hasColumn('server_subdomains', 'target_port')) {
                                $table->integer('target_port')->nullable();
                            }
                            if (!Schema::hasColumn('server_subdomains', 'cloudflare_dns_id')) {
                                $table->string('cloudflare_dns_id', 64)->nullable();
                            }
                            if (!Schema::hasColumn('server_subdomains', 'cloudflare_srv_id')) {
                                $table->string('cloudflare_srv_id', 64)->nullable();
                            }
                        });
                    }
                }
            }

            // 2. Table: subdomain_cloudflare_accounts
            if (!Schema::hasTable('subdomain_cloudflare_accounts')) {
                Schema::create('subdomain_cloudflare_accounts', function (Blueprint $table) {
                    $table->id();
                    $table->string('name', 191);
                    $table->string('auth_type', 32)->default('token'); // 'token' or 'key'
                    $table->text('api_token')->nullable();
                    $table->text('api_key')->nullable();
                    $table->string('api_email', 191)->nullable();
                    $table->timestamps();
                });
            }

            // 3. Table: subdomain_domains
            if (!Schema::hasTable('subdomain_domains')) {
                Schema::create('subdomain_domains', function (Blueprint $table) {
                    $table->id();
                    $table->string('domain', 191)->unique();
                    $table->string('zone_id', 64);
                    $table->unsignedBigInteger('cloudflare_account_id');
                    $table->boolean('is_enabled')->default(true);
                    $table->string('protocol', 32)->default('both'); // 'both', 'srv_only', 'a_only'
                    $table->text('egg_ids')->nullable();
                    $table->timestamps();

                    $table->foreign('cloudflare_account_id')
                        ->references('id')
                        ->on('subdomain_cloudflare_accounts')
                        ->onDelete('cascade');
                });
            }

            // 4. Table: server_subdomains
            if (!Schema::hasTable('server_subdomains')) {
                Schema::create('server_subdomains', function (Blueprint $table) {
                    $table->id();
                    $table->unsignedInteger('server_id');
                    $table->unsignedBigInteger('subdomain_domain_id');
                    $table->string('subdomain', 64);
                    $table->string('record_type', 32)->default('srv'); // 'srv', 'a'
                    $table->string('target_ip', 191);
                    $table->integer('target_port');
                    $table->string('cloudflare_dns_id', 64)->nullable();
                    $table->string('cloudflare_srv_id', 64)->nullable();
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

            // 5. Mark in migrations table
            if (Schema::hasTable('migrations')) {
                $exists = DB::table('migrations')
                    ->where('migration', '2026_09_07_200000_create_subdomains_tables')
                    ->exists();

                if (!$exists) {
                    $maxBatch = (int) DB::table('migrations')->max('batch');
                    DB::table('migrations')->insert([
                        'migration' => '2026_09_07_200000_create_subdomains_tables',
                        'batch' => $maxBatch > 0 ? $maxBatch + 1 : 1,
                    ]);
                }
            }

            Schema::enableForeignKeyConstraints();
        } catch (\Throwable $e) {
            Schema::enableForeignKeyConstraints();
            Log::error('SubdomainSchemaHelper auto-provisioning error: ' . $e->getMessage());
            throw $e;
        }
    }
}
