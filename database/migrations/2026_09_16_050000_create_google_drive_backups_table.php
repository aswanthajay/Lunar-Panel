<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateGoogleDriveBackupsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('google_drive_backups')) {
            Schema::create('google_drive_backups', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('backup_id')->index();
                $table->unsignedInteger('server_id')->index();
                $table->string('gdrive_file_id')->index();
                $table->string('gdrive_folder_id')->nullable();
                $table->string('file_name');
                $table->unsignedBigInteger('file_size')->default(0);
                $table->text('web_view_link')->nullable();
                $table->string('status', 32)->default('completed');
                $table->text('error_message')->nullable();
                $table->timestamp('synced_at')->nullable();
                $table->timestamps();

                $table->foreign('backup_id')->references('id')->on('backups')->onDelete('cascade');
                $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('google_drive_backups');
    }
}
