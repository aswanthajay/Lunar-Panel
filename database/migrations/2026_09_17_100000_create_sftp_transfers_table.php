<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateSftpTransfersTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('sftp_transfers')) {
            Schema::create('sftp_transfers', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedInteger('server_id')->index();
                $table->unsignedInteger('user_id')->index();
                $table->string('direction', 16)->default('import');
                $table->string('status', 32)->default('pending')->index();
                $table->string('host');
                $table->unsignedSmallInteger('port')->default(2022);
                $table->string('username');
                $table->text('password');
                $table->string('remote_path')->default('/');
                $table->boolean('wipe_existing')->default(false);
                $table->unsignedInteger('total_files')->default(0);
                $table->unsignedInteger('transferred_files')->default(0);
                $table->unsignedBigInteger('total_bytes')->default(0);
                $table->unsignedBigInteger('transferred_bytes')->default(0);
                $table->string('current_file')->nullable();
                $table->longText('log')->nullable();
                $table->text('error_message')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sftp_transfers');
    }
}
