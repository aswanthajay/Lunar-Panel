<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddBillingAmountToServersTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        if (!Schema::hasColumn('servers', 'billing_amount')) {
            Schema::table('servers', function (Blueprint $table) {
                $table->unsignedInteger('billing_amount')->nullable()->after('expires_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        if (Schema::hasColumn('servers', 'billing_amount')) {
            Schema::table('servers', function (Blueprint $table) {
                $table->dropColumn('billing_amount');
            });
        }
    }
}
