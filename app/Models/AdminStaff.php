<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $role_id
 * @property array|null $scope_nodes
 * @property array|null $scope_locations
 * @property array|null $scope_servers
 * @property array|null $custom_permissions
 * @property bool $is_active
 * @property string|null $notes
 * @property \Carbon\CarbonImmutable $created_at
 * @property \Carbon\CarbonImmutable $updated_at
 * @property \Pterodactyl\Models\User $user
 * @property \Pterodactyl\Models\AdminRole $role
 */
class AdminStaff extends Model
{
    public const RESOURCE_NAME = 'admin_staff';

    protected $table = 'admin_staff';

    protected bool $immutableDates = true;

    protected bool $skipValidation = true;

    protected $casts = [
        'user_id' => 'int',
        'role_id' => 'int',
        'scope_nodes' => 'array',
        'scope_locations' => 'array',
        'scope_servers' => 'array',
        'custom_permissions' => 'array',
        'is_active' => 'bool',
    ];

    protected $fillable = [
        'user_id',
        'role_id',
        'scope_nodes',
        'scope_locations',
        'scope_servers',
        'custom_permissions',
        'is_active',
        'notes',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(AdminRole::class, 'role_id');
    }

    /**
     * Check if staff has a specific administrative permission.
     */
    public function hasPermission(string $permission): bool
    {
        if (!$this->is_active) {
            return false;
        }

        // Check custom permission overrides first
        $custom = $this->custom_permissions ?? [];
        if (in_array('*', $custom, true) || in_array($permission, $custom, true)) {
            return true;
        }

        if ($this->role) {
            return $this->role->hasPermission($permission);
        }

        return false;
    }

    /**
     * Determine if this staff member can access a given node ID.
     */
    public function canAccessNode(int|string $nodeId): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if (empty($this->scope_nodes)) {
            return true; // All nodes permitted
        }

        return in_array((string) $nodeId, array_map('strval', $this->scope_nodes), true);
    }

    /**
     * Determine if this staff member can access a given location ID.
     */
    public function canAccessLocation(int|string $locationId): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if (empty($this->scope_locations)) {
            return true; // All locations permitted
        }

        return in_array((string) $locationId, array_map('strval', $this->scope_locations), true);
    }

    /**
     * Determine if this staff member can access a given server.
     */
    public function canAccessServer(Server|int $server): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $serverId = $server instanceof Server ? $server->id : $server;

        // If specific server IDs are designated, check them
        if (!empty($this->scope_servers)) {
            if (!in_array((string) $serverId, array_map('strval', $this->scope_servers), true)) {
                return false;
            }
        }

        if ($server instanceof Server) {
            // Check node restriction
            if (!empty($this->scope_nodes) && !empty($server->node_id)) {
                if (!in_array((string) $server->node_id, array_map('strval', $this->scope_nodes), true)) {
                    return false;
                }
            }

            // Check location restriction
            if (!empty($this->scope_locations) && $server->node) {
                if (!in_array((string) $server->node->location_id, array_map('strval', $this->scope_locations), true)) {
                    return false;
                }
            }
        }

        return true;
    }
}
