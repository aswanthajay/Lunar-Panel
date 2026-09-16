<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CreateAdminRolesAndStaffTables extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('admin_roles')) {
            Schema::create('admin_roles', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('name', 191);
                $table->string('slug', 191)->unique();
                $table->text('description')->nullable();
                $table->string('color', 50)->default('#10b981');
                $table->longText('permissions');
                $table->boolean('is_system')->default(false);
                $table->timestamps();
            });

            // Seed built-in presets
            $now = Carbon::now();
            $presets = [
                [
                    'name' => 'Super Administrator',
                    'slug' => 'super-admin',
                    'description' => 'Unrestricted access to all panel controls, system configuration, infrastructure, and user management.',
                    'color' => '#EF4444',
                    'permissions' => json_encode(['*']),
                    'is_system' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'Junior Administrator',
                    'slug' => 'junior-admin',
                    'description' => 'Day-to-day operations administrator. Manages servers, nodes, allocations, and users. Excludes system settings, API keys, and license.',
                    'color' => '#8B5CF6',
                    'permissions' => json_encode([
                        'admin.overview',
                        'servers.*',
                        'nodes.*',
                        'locations.*',
                        'databases.*',
                        'subdomains.*',
                        'users.*',
                        'mounts.*',
                        'nests.*',
                        'gdrive.*',
                    ]),
                    'is_system' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'Support Agent',
                    'slug' => 'support-agent',
                    'description' => 'Customer assistance specialist. Can execute server power actions, use console, inspect server files, and view node health.',
                    'color' => '#10B981',
                    'permissions' => json_encode([
                        'admin.overview',
                        'servers.view',
                        'servers.view_details',
                        'servers.manage',
                        'servers.files',
                        'servers.database',
                        'users.view',
                        'nodes.view',
                    ]),
                    'is_system' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'Server Moderator',
                    'slug' => 'server-moderator',
                    'description' => 'Server supervisor. Can start, stop, restart, use console, and view activity logs. Cannot alter build resource limits or delete servers.',
                    'color' => '#3B82F6',
                    'permissions' => json_encode([
                        'admin.overview',
                        'servers.view',
                        'servers.view_details',
                        'servers.manage',
                    ]),
                    'is_system' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'Infrastructure Manager',
                    'slug' => 'infrastructure-manager',
                    'description' => 'Hardware & network engineer. Full management over Nodes, Locations, IP Allocations, Mounts, KSM, and Database Hosts.',
                    'color' => '#F59E0B',
                    'permissions' => json_encode([
                        'admin.overview',
                        'nodes.*',
                        'locations.*',
                        'databases.*',
                        'mounts.*',
                        'nests.*',
                        'ksm.*',
                        'gdrive.*',
                    ]),
                    'is_system' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'Billing & Account Specialist',
                    'slug' => 'billing-specialist',
                    'description' => 'Client management specialist. Can view and edit user profiles and view server assignments without accessing server contents.',
                    'color' => '#06B6D4',
                    'permissions' => json_encode([
                        'admin.overview',
                        'users.view',
                        'users.edit',
                        'servers.view',
                        'servers.view_details',
                    ]),
                    'is_system' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ];

            DB::table('admin_roles')->insert($presets);
        }

        if (!Schema::hasTable('admin_staff')) {
            Schema::create('admin_staff', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedInteger('user_id')->unique();
                $table->unsignedBigInteger('role_id');
                $table->text('scope_nodes')->nullable();
                $table->text('scope_locations')->nullable();
                $table->text('scope_servers')->nullable();
                $table->text('custom_permissions')->nullable();
                $table->boolean('is_active')->default(true);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('role_id')->references('id')->on('admin_roles')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_staff');
        Schema::dropIfExists('admin_roles');
    }
}
