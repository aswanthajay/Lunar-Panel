<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Prunes legacy/unwanted telemetry command entries (e.g. tps, spark probes) from activity_logs.
     */
    public function up(): void
    {
        try {
            $ids = DB::table('activity_logs')
                ->where('event', 'server:console.command')
                ->where(function ($query) {
                    $query->whereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.command')), '')))) IN ('tps', '/tps', 'spark', '/spark', 'paper tps', 'spigot:tps', 'minecraft:tps', 'forge tps', 'neoforge tps')")
                        ->orWhereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.command')), '')))) LIKE 'spark %'")
                        ->orWhereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.command')), '')))) LIKE '/spark %'")
                        ->orWhereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.command')), '')))) LIKE 'spark:%'")
                        ->orWhereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.command')), '')))) LIKE '/spark:%'");
                })
                ->pluck('id');

            if ($ids->isNotEmpty()) {
                DB::table('activity_log_subjects')->whereIn('activity_log_id', $ids)->delete();
                DB::table('activity_logs')->whereIn('id', $ids)->delete();
            }
        } catch (\Throwable) {
            // Fallback for MySQL/MariaDB environments with variations in JSON functions
            try {
                $ids = DB::table('activity_logs')
                    ->where('event', 'server:console.command')
                    ->where(function ($query) {
                        $query->where('properties', 'LIKE', '%"command":"tps"%')
                            ->orWhere('properties', 'LIKE', '%"command":" tps "%')
                            ->orWhere('properties', 'LIKE', '%"command":"/tps"%')
                            ->orWhere('properties', 'LIKE', '%"command":"spark %')
                            ->orWhere('properties', 'LIKE', '%"command":"/spark %');
                    })
                    ->pluck('id');

                if ($ids->isNotEmpty()) {
                    DB::table('activity_log_subjects')->whereIn('activity_log_id', $ids)->delete();
                    DB::table('activity_logs')->whereIn('id', $ids)->delete();
                }
            } catch (\Throwable) {}
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Deletions cannot be reversed
    }
};
