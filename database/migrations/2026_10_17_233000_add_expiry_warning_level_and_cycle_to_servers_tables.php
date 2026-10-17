<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddExpiryWarningLevelAndCycleToServersTables extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            if (!Schema::hasColumn('servers', 'expiry_warning_level')) {
                $table->tinyInteger('expiry_warning_level')->default(0)->after('grace_period_expires_at');
                $table->index('expiry_warning_level');
            }
        });

        Schema::table('server_renewal_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('server_renewal_payments', 'billing_cycle_months')) {
                $table->unsignedTinyInteger('billing_cycle_months')->default(1)->after('amount');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            if (Schema::hasColumn('servers', 'expiry_warning_level')) {
                $table->dropIndex(['expiry_warning_level']);
                $table->dropColumn('expiry_warning_level');
            }
        });

        Schema::table('server_renewal_payments', function (Blueprint $table) {
            if (Schema::hasColumn('server_renewal_payments', 'billing_cycle_months')) {
                $table->dropColumn('billing_cycle_months');
            }
        });
    }
}
