<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddPaymentNoteToServerRenewalPaymentsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        if (Schema::hasTable('server_renewal_payments')) {
            Schema::table('server_renewal_payments', function (Blueprint $table) {
                if (!Schema::hasColumn('server_renewal_payments', 'payment_note')) {
                    $table->string('payment_note')->nullable()->after('payer_name');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        if (Schema::hasTable('server_renewal_payments')) {
            Schema::table('server_renewal_payments', function (Blueprint $table) {
                if (Schema::hasColumn('server_renewal_payments', 'payment_note')) {
                    $table->dropColumn('payment_note');
                }
            });
        }
    }
}
