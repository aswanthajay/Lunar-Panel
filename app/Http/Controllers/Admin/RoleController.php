<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Throwable;
use Illuminate\View\View;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\AdminRole;
use Pterodactyl\Models\AdminStaff;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Illuminate\Contracts\View\Factory as ViewFactory;

class RoleController extends Controller
{
    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view
    ) {
    }

    /**
     * Display the Roles & Staff Management Dashboard.
     */
    public function index(): View
    {
        $roles = AdminRole::withCount('staff')->orderBy('id')->get();
        $staffMembers = AdminStaff::with(['user', 'role'])->orderByDesc('created_at')->get();
        $nodes = Node::with('location')->orderBy('name')->get();
        $locations = Location::orderBy('short')->get();
        $permissionCategories = AdminRole::getAvailablePermissions();

        return $this->view->make('admin.roles.index', [
            'roles' => $roles,
            'staffMembers' => $staffMembers,
            'nodes' => $nodes,
            'locations' => $locations,
            'permissionCategories' => $permissionCategories,
        ]);
    }

    /**
     * Store a new custom role.
     */
    public function storeRole(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:191',
            'color' => 'required|string|max:50',
            'description' => 'nullable|string|max:500',
            'permissions' => 'required|array|min:1',
        ]);

        $slug = Str::slug($request->input('name'));
        if (AdminRole::where('slug', $slug)->exists()) {
            $slug .= '-' . Str::random(5);
        }

        try {
            $role = AdminRole::create([
                'name' => (string) $request->input('name'),
                'slug' => $slug,
                'description' => (string) $request->input('description'),
                'color' => (string) $request->input('color', '#10b981'),
                'permissions' => array_values($request->input('permissions', [])),
                'is_system' => false,
            ]);

            $this->alert->success("Role [{$role->name}] has been created successfully.")->flash();
        } catch (Throwable $e) {
            $this->alert->danger('Failed to create role: ' . $e->getMessage())->flash();
        }

        return redirect()->route('admin.roles');
    }

    /**
     * Update an existing role.
     */
    public function updateRole(Request $request, AdminRole $role): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:191',
            'color' => 'required|string|max:50',
            'description' => 'nullable|string|max:500',
            'permissions' => 'required|array|min:1',
        ]);

        try {
            $role->name = (string) $request->input('name');
            $role->description = (string) $request->input('description');
            $role->color = (string) $request->input('color');
            $role->permissions = array_values($request->input('permissions', []));
            $role->save();

            $this->alert->success("Role [{$role->name}] has been updated successfully.")->flash();
        } catch (Throwable $e) {
            $this->alert->danger('Failed to update role: ' . $e->getMessage())->flash();
        }

        return redirect()->route('admin.roles');
    }

    /**
     * Delete a non-system role.
     */
    public function destroyRole(AdminRole $role): RedirectResponse
    {
        if ($role->is_system && in_array($role->slug, ['super-admin', 'junior-admin', 'support-agent'], true)) {
            $this->alert->danger("Core system role [{$role->name}] cannot be deleted.")->flash();
            return redirect()->route('admin.roles');
        }

        if ($role->staff()->count() > 0) {
            $this->alert->danger("Role [{$role->name}] has active staff members assigned. Please reassign them before deleting this role.")->flash();
            return redirect()->route('admin.roles');
        }

        try {
            $name = $role->name;
            $role->delete();
            $this->alert->success("Role [{$name}] was successfully deleted.")->flash();
        } catch (Throwable $e) {
            $this->alert->danger('Failed to delete role: ' . $e->getMessage())->flash();
        }

        return redirect()->route('admin.roles');
    }

    /**
     * Reset or install missing built-in presets.
     */
    public function resetPresets(): RedirectResponse
    {
        $presets = AdminRole::getDefaultPresets();

        $restored = 0;
        foreach ($presets as $p) {
            AdminRole::updateOrCreate(
                ['slug' => $p['slug']],
                $p
            );
            $restored++;
        }

        $this->alert->success("Refreshed {$restored} standard role presets successfully.")->flash();

        return redirect()->route('admin.roles');
    }

    /**
     * Create or update a Staff member's role and scoping assignment.
     */
    public function assignStaff(Request $request): RedirectResponse
    {
        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role_id' => 'required|integer|exists:admin_roles,id',
            'scope_nodes' => 'nullable|array',
            'scope_locations' => 'nullable|array',
            'scope_servers' => 'nullable|string',
            'notes' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        $userId = (int) $request->input('user_id');
        $roleId = (int) $request->input('role_id');

        // Parse scope nodes (empty or 'all' means unrestricted)
        $scopeNodes = $request->input('scope_nodes', []);
        $scopeNodes = !empty($scopeNodes) && !in_array('all', $scopeNodes, true)
            ? array_values(array_filter(array_map('intval', $scopeNodes)))
            : null;

        // Parse scope locations
        $scopeLocations = $request->input('scope_locations', []);
        $scopeLocations = !empty($scopeLocations) && !in_array('all', $scopeLocations, true)
            ? array_values(array_filter(array_map('intval', $scopeLocations)))
            : null;

        // Parse scope servers (comma or newline separated IDs)
        $rawServers = (string) $request->input('scope_servers');
        $serverList = preg_split('/[\r\n,]+/', $rawServers);
        $serverList = array_values(array_filter(array_map('trim', $serverList)));
        $scopeServers = !empty($serverList) ? $serverList : null;

        try {
            $staff = AdminStaff::updateOrCreate(
                ['user_id' => $userId],
                [
                    'role_id' => $roleId,
                    'scope_nodes' => $scopeNodes,
                    'scope_locations' => $scopeLocations,
                    'scope_servers' => $scopeServers,
                    'is_active' => $request->has('is_active'),
                    'notes' => (string) $request->input('notes'),
                ]
            );

            $user = User::find($userId);
            $role = AdminRole::find($roleId);

            $this->alert->success("User [{$user->username}] has been assigned role [{$role->name}] with customized scoping.")->flash();
        } catch (Throwable $e) {
            $this->alert->danger('Failed to assign staff member: ' . $e->getMessage())->flash();
        }

        return redirect()->route('admin.roles');
    }

    /**
     * Remove staff privileges from a user.
     */
    public function removeStaff(AdminStaff $staff): RedirectResponse
    {
        try {
            $username = $staff->user->username ?? 'User';
            $staff->delete();
            $this->alert->success("Staff privileges for [{$username}] have been revoked.")->flash();
        } catch (Throwable $e) {
            $this->alert->danger('Failed to remove staff member: ' . $e->getMessage())->flash();
        }

        return redirect()->route('admin.roles');
    }

    /**
     * Toggle active status for a staff member.
     */
    public function toggleStaffStatus(AdminStaff $staff): RedirectResponse
    {
        $staff->is_active = !$staff->is_active;
        $staff->save();

        $status = $staff->is_active ? 'activated' : 'suspended';
        $username = $staff->user->username ?? 'User';
        $this->alert->info("Staff access for [{$username}] has been {$status}.")->flash();

        return redirect()->route('admin.roles');
    }
}
