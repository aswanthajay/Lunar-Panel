<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateOauthServerTables extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('oauth_clients')) {
            Schema::create('oauth_clients', function (Blueprint $table) {
                $table->string('id', 80)->primary();
                $table->unsignedInteger('user_id')->nullable()->index();
                $table->string('name', 191);
                $table->string('secret', 191)->nullable();
                $table->text('redirect_uris');
                $table->boolean('personal_access_client')->default(false);
                $table->boolean('password_client')->default(false);
                $table->boolean('revoked')->default(false);
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            });
        }

        if (!Schema::hasTable('oauth_auth_codes')) {
            Schema::create('oauth_auth_codes', function (Blueprint $table) {
                $table->string('id', 100)->primary();
                $table->unsignedInteger('user_id')->index();
                $table->string('client_id', 80)->index();
                $table->text('scopes')->nullable();
                $table->boolean('revoked')->default(false);
                $table->dateTime('expires_at')->nullable();
                $table->string('code_challenge', 191)->nullable();
                $table->string('code_challenge_method', 20)->nullable();
                $table->string('nonce', 191)->nullable();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('client_id')->references('id')->on('oauth_clients')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('oauth_access_tokens')) {
            Schema::create('oauth_access_tokens', function (Blueprint $table) {
                $table->string('id', 100)->primary();
                $table->unsignedInteger('user_id')->nullable()->index();
                $table->string('client_id', 80)->index();
                $table->string('name', 191)->nullable();
                $table->text('scopes')->nullable();
                $table->boolean('revoked')->default(false);
                $table->dateTime('expires_at')->nullable();
                $table->dateTime('last_used_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('client_id')->references('id')->on('oauth_clients')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('oauth_refresh_tokens')) {
            Schema::create('oauth_refresh_tokens', function (Blueprint $table) {
                $table->string('id', 100)->primary();
                $table->string('access_token_id', 100)->index();
                $table->boolean('revoked')->default(false);
                $table->dateTime('expires_at')->nullable();

                $table->foreign('access_token_id')->references('id')->on('oauth_access_tokens')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('oauth_refresh_tokens');
        Schema::dropIfExists('oauth_access_tokens');
        Schema::dropIfExists('oauth_auth_codes');
        Schema::dropIfExists('oauth_clients');
    }
}
