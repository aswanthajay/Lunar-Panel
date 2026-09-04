<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateServerRenewalPaymentsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        if (!Schema::hasTable('server_renewal_payments')) {
            Schema::create('server_renewal_payments', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('server_id');
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('amount'); // in INR ₹
                $table->string('upi_id');
                $table->string('payer_name')->nullable();
                $table->string('utr_number')->index();
                $table->string('screenshot_path');
                $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->index();
                $table->boolean('grace_period_granted')->default(false);
                $table->dateTime('grace_period_expires_at')->nullable();
                $table->boolean('is_suspicious')->default(false);
                $table->string('suspicious_reason')->nullable();
                $table->text('admin_notes')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->unsignedInteger('reviewed_by')->nullable();
                $table->dateTime('reviewed_at')->nullable();
                $table->timestamps();

                $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('server_renewal_payments');
    }
}
