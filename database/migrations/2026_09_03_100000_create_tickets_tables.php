<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTicketsTables extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('tickets')) {
            Schema::create('tickets', function (Blueprint $table) {
                $table->id();
                $table->string('ticket_id')->unique();
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('server_id')->nullable();
                $table->string('title');
                $table->string('department')->default('Technical Support');
                $table->enum('priority', ['low', 'medium', 'high', 'critical'])->default('medium');
                $table->enum('status', ['open', 'in_progress', 'answered', 'closed'])->default('open');
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('server_id')->references('id')->on('servers')->onDelete('set null');
            });
        }

        if (!Schema::hasTable('ticket_messages')) {
            Schema::create('ticket_messages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('ticket_id');
                $table->unsignedInteger('user_id')->nullable();
                $table->boolean('is_staff')->default(false);
                $table->text('message');
                $table->timestamps();

                $table->foreign('ticket_id')->references('id')->on('tickets')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('ticket_messages');
        Schema::dropIfExists('tickets');
    }
}
