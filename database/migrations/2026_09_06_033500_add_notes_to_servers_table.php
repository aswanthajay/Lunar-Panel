<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            if (!Schema::hasColumn('servers', 'notes')) {
                $table->longText('notes')->nullable()->after('description');
            }
            if (!Schema::hasColumn('servers', 'notes_updated_by')) {
                $table->unsignedInteger('notes_updated_by')->nullable()->after('notes');
            }
            if (!Schema::hasColumn('servers', 'notes_updated_at')) {
                $table->timestamp('notes_updated_at')->nullable()->after('notes_updated_by');
            }
            if (!Schema::hasColumn('servers', 'admin_notes')) {
                $table->longText('admin_notes')->nullable()->after('notes_updated_at');
            }
            if (!Schema::hasColumn('servers', 'admin_notes_updated_by')) {
                $table->unsignedInteger('admin_notes_updated_by')->nullable()->after('admin_notes');
            }
            if (!Schema::hasColumn('servers', 'admin_notes_updated_at')) {
                $table->timestamp('admin_notes_updated_at')->nullable()->after('admin_notes_updated_by');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $columns = [
                'admin_notes_updated_at',
                'admin_notes_updated_by',
                'admin_notes',
                'notes_updated_at',
                'notes_updated_by',
                'notes',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('servers', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
