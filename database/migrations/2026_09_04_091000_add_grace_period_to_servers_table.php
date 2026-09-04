<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddGracePeriodToServersTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('servers', function (Blueprint $table) {
            if (!Schema::hasColumn('servers', 'grace_period_expires_at')) {
                $table->dateTime('grace_period_expires_at')->nullable()->after('expires_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('servers', function (Blueprint $table) {
            if (Schema::hasColumn('servers', 'grace_period_expires_at')) {
                $table->dropColumn('grace_period_expires_at');
            }
        });
    }
}
