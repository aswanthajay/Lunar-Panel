<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddNonceToOauthAuthCodesTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('oauth_auth_codes') && !Schema::hasColumn('oauth_auth_codes', 'nonce')) {
            Schema::table('oauth_auth_codes', function (Blueprint $table) {
                $table->string('nonce', 191)->nullable()->after('code_challenge_method');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('oauth_auth_codes') && Schema::hasColumn('oauth_auth_codes', 'nonce')) {
            Schema::table('oauth_auth_codes', function (Blueprint $table) {
                $table->dropColumn('nonce');
            });
        }
    }
}
