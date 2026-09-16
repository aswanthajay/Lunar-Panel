<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property string $color
 * @property array $permissions
 * @property bool $is_system
 * @property \Carbon\CarbonImmutable $created_at
 * @property \Carbon\CarbonImmutable $updated_at
 * @property \Illuminate\Database\Eloquent\Collection|\Pterodactyl\Models\AdminStaff[] $staff
 */
class AdminRole extends Model
{
    public const RESOURCE_NAME = 'admin_role';

    protected $table = 'admin_roles';

    protected bool $immutableDates = true;

    protected bool $skipValidation = true;

    protected $casts = [
        'is_system' => 'bool',
        'permissions' => 'array',
    ];

    protected $fillable = [
        'name',
        'slug',
        'description',
        'color',
        'permissions',
        'is_system',
    ];

    public function staff(): HasMany
    {
        return $this->hasMany(AdminStaff::class, 'role_id');
    }

    /**
     * Check if this role grants a given permission (supports wildcards like '*' or 'servers.*').
     */
    public function hasPermission(string $permission): bool
    {
        $perms = $this->permissions ?? [];

        if (in_array('*', $perms, true)) {
            return true;
        }

        if (in_array($permission, $perms, true)) {
            return true;
        }

        // Check category wildcards (e.g., 'servers.*')
        $parts = explode('.', $permission);
        if (count($parts) > 1) {
            $categoryWildcard = $parts[0] . '.*';
            if (in_array($categoryWildcard, $perms, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Complete dictionary of available administrative permissions grouped by category.
     */
    public static function getAvailablePermissions(): array
    {
        return [
            'Administration & Control' => [
                'admin.overview' => [
                    'label' => 'View Overview',
                    'description' => 'Access the main Admin CP overview dashboard and system health telemetry.',
                ],
                'admin.settings' => [
                    'label' => 'System Settings',
                    'description' => 'Modify panel configuration, mail settings, and advanced variables.',
                ],
                'admin.api' => [
                    'label' => 'Application API Keys',
                    'description' => 'Create, view, and revoke Application API keys.',
                ],
                'admin.license' => [
                    'label' => 'License Management',
                    'description' => 'View and modify system activation and core license keys.',
                ],
            ],
            'Servers & Compute' => [
                'servers.view' => [
                    'label' => 'View Server List',
                    'description' => 'Browse and search servers within authorized scope.',
                ],
                'servers.view_details' => [
                    'label' => 'View Server Details',
                    'description' => 'Inspect server details, environment variables, startup, and build specs.',
                ],
                'servers.manage' => [
                    'label' => 'Manage & Power Control',
                    'description' => 'Send power commands (start/stop/restart), reinstall, and toggle server status.',
                ],
                'servers.files' => [
                    'label' => 'File Manager Access',
                    'description' => 'View and manage files on authorized servers.',
                ],
                'servers.database' => [
                    'label' => 'Database Operations',
                    'description' => 'Create, view, and reset databases on servers.',
                ],
                'servers.edit_build' => [
                    'label' => 'Edit Build & Limits',
                    'description' => 'Modify memory, CPU, disk, swap, and allocation assignments.',
                ],
                'servers.edit_startup' => [
                    'label' => 'Edit Startup Command',
                    'description' => 'Modify server startup command, Docker images, and egg variables.',
                ],
                'servers.create' => [
                    'label' => 'Create New Servers',
                    'description' => 'Deploy new game servers on authorized nodes.',
                ],
                'servers.delete' => [
                    'label' => 'Delete Servers',
                    'description' => 'Permanently delete servers from the system.',
                ],
            ],
            'Nodes & Fleet Infrastructure' => [
                'nodes.view' => [
                    'label' => 'View Nodes',
                    'description' => 'View node status, daemon versions, and resource utilization.',
                ],
                'nodes.create' => [
                    'label' => 'Create Nodes',
                    'description' => 'Deploy new daemon nodes to the fleet.',
                ],
                'nodes.edit' => [
                    'label' => 'Edit Node Configuration',
                    'description' => 'Modify node memory, disk limits, FQDN, and connection ports.',
                ],
                'nodes.delete' => [
                    'label' => 'Delete Nodes',
                    'description' => 'Remove nodes from the fleet.',
                ],
                'allocations.manage' => [
                    'label' => 'Manage IP Allocations',
                    'description' => 'Create, assign, alias, and delete IP allocations on nodes.',
                ],
            ],
            'Locations, Mounts & Databases' => [
                'locations.view' => [
                    'label' => 'View Locations',
                    'description' => 'View regional clusters and datacenter locations.',
                ],
                'locations.manage' => [
                    'label' => 'Manage Locations',
                    'description' => 'Create, edit, and delete geographical locations.',
                ],
                'databases.view' => [
                    'label' => 'View Database Hosts',
                    'description' => 'View MySQL database host servers.',
                ],
                'databases.manage' => [
                    'label' => 'Manage Database Hosts',
                    'description' => 'Add, edit, and delete database hosts.',
                ],
                'mounts.view' => [
                    'label' => 'View Mounts',
                    'description' => 'Inspect filesystem mounts.',
                ],
                'mounts.manage' => [
                    'label' => 'Manage Mounts',
                    'description' => 'Create, modify, and assign host filesystem mounts to nodes and eggs.',
                ],
                'nests.view' => [
                    'label' => 'View Nests & Eggs',
                    'description' => 'View service configurations, eggs, and install scripts.',
                ],
                'nests.manage' => [
                    'label' => 'Manage Nests & Eggs',
                    'description' => 'Import, export, modify, and delete nests and egg definitions.',
                ],
            ],
            'Users & Staff Administration' => [
                'users.view' => [
                    'label' => 'View Users',
                    'description' => 'Search and view registered user profiles and their server holdings.',
                ],
                'users.create' => [
                    'label' => 'Create Users',
                    'description' => 'Manually register new user accounts.',
                ],
                'users.edit' => [
                    'label' => 'Edit Users',
                    'description' => 'Update user email, password, username, and identity details.',
                ],
                'users.delete' => [
                    'label' => 'Delete Users',
                    'description' => 'Delete user accounts that have no active servers.',
                ],
                'roles.manage' => [
                    'label' => 'Manage Staff & Roles',
                    'description' => 'Create custom roles, edit permissions, and assign staff access.',
                ],
            ],
            'Advanced Services & Integrations' => [
                'gdrive.manage' => [
                    'label' => 'Google Drive Backup Vault',
                    'description' => 'Trigger cloud backups, manage retention policies, and view backup logs.',
                ],
                'oauth.manage' => [
                    'label' => 'OAuth Server & Applications',
                    'description' => 'Register, edit, and configure OAuth 2.0 / OIDC identity client apps.',
                ],
                'authentik.manage' => [
                    'label' => 'Authentik Single Sign-On',
                    'description' => 'Configure enterprise Authentik SSO authentication.',
                ],
                'ksm.manage' => [
                    'label' => 'Kernel Samepage Merging',
                    'description' => 'Monitor and tune host memory deduplication profiles.',
                ],
                'subdomains.manage' => [
                    'label' => 'Subdomains & Cloudflare',
                    'description' => 'Manage automated Cloudflare DNS subdomain bindings.',
                ],
            ],
        ];
    }

    /**
     * Get default system role presets with standardized descriptions and colors.
     */
    public static function getDefaultPresets(): array
    {
        return [
            'super-admin' => [
                'name' => 'Super Administrator',
                'slug' => 'super-admin',
                'description' => 'Unrestricted access to all panel controls, system configuration, infrastructure, and user management.',
                'color' => '#EF4444',
                'permissions' => ['*'],
                'is_system' => true,
            ],
            'junior-admin' => [
                'name' => 'Junior Administrator',
                'slug' => 'junior-admin',
                'description' => 'Day-to-day operations administrator. Manages servers, nodes, allocations, and users. Excludes system settings, API keys, and license.',
                'color' => '#8B5CF6',
                'permissions' => [
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
                ],
                'is_system' => true,
            ],
            'support-agent' => [
                'name' => 'Support Agent',
                'slug' => 'support-agent',
                'description' => 'Customer assistance specialist. Can execute server power actions, use console, inspect server files, and view node health.',
                'color' => '#10B981',
                'permissions' => [
                    'admin.overview',
                    'servers.view',
                    'servers.manage',
                    'servers.files',
                    'servers.database',
                    'users.view',
                    'nodes.view',
                ],
                'is_system' => true,
            ],
            'server-moderator' => [
                'name' => 'Server Moderator',
                'slug' => 'server-moderator',
                'description' => 'Server supervisor. Can start, stop, restart, use console, and view activity logs. Cannot alter build resource limits or delete servers.',
                'color' => '#3B82F6',
                'permissions' => [
                    'admin.overview',
                    'servers.view',
                    'servers.manage',
                ],
                'is_system' => true,
            ],
            'infrastructure-manager' => [
                'name' => 'Infrastructure Manager',
                'slug' => 'infrastructure-manager',
                'description' => 'Hardware & network engineer. Full management over Nodes, Locations, IP Allocations, Mounts, KSM, and Database Hosts.',
                'color' => '#F59E0B',
                'permissions' => [
                    'admin.overview',
                    'nodes.*',
                    'locations.*',
                    'databases.*',
                    'mounts.*',
                    'nests.*',
                    'ksm.*',
                    'gdrive.*',
                ],
                'is_system' => true,
            ],
            'billing-specialist' => [
                'name' => 'Billing & Account Specialist',
                'slug' => 'billing-specialist',
                'description' => 'Client management specialist. Can view and edit user profiles and view server assignments without accessing server contents.',
                'color' => '#06B6D4',
                'permissions' => [
                    'admin.overview',
                    'users.view',
                    'users.edit',
                    'servers.view',
                ],
                'is_system' => true,
            ],
        ];
    }
}
