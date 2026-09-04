<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddAttachmentColumnsToTicketMessages extends Migration
{
    public function up()
    {
        Schema::table('ticket_messages', function (Blueprint $table) {
            $table->string('attachment_path')->nullable()->after('message');
            $table->string('attachment_name')->nullable()->after('attachment_path');
            $table->string('attachment_type')->nullable()->after('attachment_name'); // 'image' | 'text' | 'file'
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_type');
        });
    }

    public function down()
    {
        Schema::table('ticket_messages', function (Blueprint $table) {
            $table->dropColumn(['attachment_path', 'attachment_name', 'attachment_type', 'attachment_size']);
        });
    }
}
