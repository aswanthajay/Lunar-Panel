<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            if (!Schema::hasColumn('servers', 'discord_webhook_url')) {
                $table->text('discord_webhook_url')->nullable()->after('description');
            }
            if (!Schema::hasColumn('servers', 'discord_webhook_events')) {
                $table->json('discord_webhook_events')->nullable()->after('discord_webhook_url');
            }
        });
    }

    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            if (Schema::hasColumn('servers', 'discord_webhook_events')) {
                $table->dropColumn('discord_webhook_events');
            }
            if (Schema::hasColumn('servers', 'discord_webhook_url')) {
                $table->dropColumn('discord_webhook_url');
            }
        });
    }
};
