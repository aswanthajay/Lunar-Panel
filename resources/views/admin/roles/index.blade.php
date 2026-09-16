@extends('layouts.admin')

@section('title')
    Staff & Role-Based Access Control
@endsection

@section('content-header')
    <h1>Staff &amp; Roles<small>Advanced role presets, fine-grained permissions, and resource-scoped staff access.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Staff &amp; Roles</li>
    </ol>
@endsection

@section('content')
<!-- Telemetry / Stats Cards -->
<div class="row">
    <div class="col-xs-12">
        <div class="row">
            <div class="col-md-3 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Defined Roles</span>
                        <div style="font-size: 22px; font-weight: 700; color: #FFFFFF; font-family: monospace; margin-top: 4px;">
                            {{ $roles->count() }} <span style="font-size: 12px; color: #6366F1; font-weight: 500;">Templates</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Active Staff</span>
                        <div style="font-size: 22px; font-weight: 700; color: #FFFFFF; font-family: monospace; margin-top: 4px;">
                            {{ $staffMembers->where('is_active', true)->count() }} <span style="font-size: 12px; color: #10B981; font-weight: 500;">Delegated</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Root Administrators</span>
                        <div style="font-size: 22px; font-weight: 700; color: #FFFFFF; font-family: monospace; margin-top: 4px;">
                            {{ $rootAdmins->count() }} <span style="font-size: 12px; color: #EF4444; font-weight: 500;">Full Access</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Resource Scoping</span>
                        <div style="font-size: 22px; font-weight: 700; color: #FFFFFF; font-family: monospace; margin-top: 4px;">
                            {{ $nodes->count() }} <span style="font-size: 12px; color: #F59E0B; font-weight: 500;">Nodes &bull; {{ $locations->count() }} Locs</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Navigation Tabs & Action Controls -->
<div class="row" style="margin-bottom: 18px;">
    <div class="col-md-7 col-xs-12">
        <ul class="nav nav-pills" id="rbacTabs" style="display: flex; gap: 8px;">
            <li class="active">
                <a href="#tab-staff" data-toggle="pill" style="border-radius: 6px; padding: 8px 18px; font-weight: 600; font-size: 13px; background: #141414; border: 1px solid #262626; color: #E5E5E5;">
                    <i class="fa fa-users" style="margin-right: 6px; color: #6366F1;"></i> Staff Directory &amp; Scopes ({{ $staffMembers->count() }})
                </a>
            </li>
            <li>
                <a href="#tab-roles" data-toggle="pill" style="border-radius: 6px; padding: 8px 18px; font-weight: 600; font-size: 13px; background: #141414; border: 1px solid #262626; color: #E5E5E5;">
                    <i class="fa fa-shield" style="margin-right: 6px; color: #10B981;"></i> Role Presets &amp; Permissions ({{ $roles->count() }})
                </a>
            </li>
            <li>
                <a href="#tab-root" data-toggle="pill" style="border-radius: 6px; padding: 8px 18px; font-weight: 600; font-size: 13px; background: #141414; border: 1px solid #262626; color: #E5E5E5;">
                    <i class="fa fa-bolt" style="margin-right: 6px; color: #EF4444;"></i> Root Admins ({{ $rootAdmins->count() }})
                </a>
            </li>
        </ul>
    </div>
    <div class="col-md-5 col-xs-12 text-right" style="margin-top: 4px;">
        <button type="button" class="btn btn-sm" data-toggle="modal" data-target="#assignStaffModal" style="background: #4F46E5; color: #FFFFFF; font-weight: 600; border-radius: 6px; padding: 7px 14px; margin-right: 6px;">
            <i class="fa fa-user-plus" style="margin-right: 5px;"></i> Assign Staff Role
        </button>
        <button type="button" class="btn btn-sm" data-toggle="modal" data-target="#createRoleModal" style="background: #1F1F1F; border: 1px solid #333333; color: #FFFFFF; font-weight: 600; border-radius: 6px; padding: 7px 14px; margin-right: 6px;">
            <i class="fa fa-plus-circle" style="margin-right: 5px; color: #10B981;"></i> New Role
        </button>
        <form action="{{ route('admin.roles.reset') }}" method="POST" style="display: inline;" onsubmit="return confirm('Restore all built-in role presets to their standard permissions? Custom roles and staff assignments will remain intact.');">
            {!! csrf_field() !!}
            <button type="submit" class="btn btn-sm" style="background: transparent; border: 1px solid #333333; color: #9CA3AF; border-radius: 6px; padding: 7px 12px;" title="Reset system presets to default permissions">
                <i class="fa fa-refresh" style="margin-right: 4px;"></i> Reset Presets
            </button>
        </form>
    </div>
</div>

<div class="tab-content">
    <!-- TAB 1: STAFF DIRECTORY & RESOURCE SCOPING -->
    <div class="tab-pane active" id="tab-staff">
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
            <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F; padding: 14px 18px;">
                <h3 class="box-title" style="color: #FFFFFF; font-size: 14px; font-weight: 600;">
                    Delegated Staff Members &amp; Scope Assignments
                </h3>
                <div class="box-tools pull-right">
                    <span class="label" style="background: #1E1B4B; color: #A5B4FC; border: 1px solid #312E81; padding: 4px 8px; border-radius: 4px;">
                        Scoping active on Servers, Nodes &amp; Locations
                    </span>
                </div>
            </div>
            <div class="box-body table-responsive no-padding">
                <table class="table table-hover" style="margin: 0;">
                    <thead>
                        <tr style="border-bottom: 1px solid #1F1F1F; background: #111111; color: #737373; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">
                            <th style="padding: 12px 18px;">Staff User</th>
                            <th style="padding: 12px 14px;">Assigned Role</th>
                            <th style="padding: 12px 14px;">Node Scopes</th>
                            <th style="padding: 12px 14px;">Location Scopes</th>
                            <th style="padding: 12px 14px;">Server Restrictions</th>
                            <th style="padding: 12px 14px;">Status</th>
                            <th style="padding: 12px 18px;" class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody style="font-size: 13px; color: #D4D4D4;">
                        @forelse($staffMembers as $staff)
                            <tr style="border-bottom: 1px solid #171717;">
                                <td style="padding: 14px 18px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #1E1E2E; border: 1px solid #2E2E3E; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #A5B4FC; font-size: 12px;">
                                            {{ strtoupper(substr($staff->user->username ?? 'U', 0, 2)) }}
                                        </div>
                                        <div>
                                            <a href="{{ route('admin.users.view', $staff->user_id) }}" style="color: #FFFFFF; font-weight: 600; text-decoration: none;">
                                                {{ $staff->user->name_first }} {{ $staff->user->name_last }}
                                            </a>
                                            <div style="font-size: 11px; color: #737373;">
                                                <span>{{ $staff->user->username }}</span> &bull; <span>{{ $staff->user->email }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style="padding: 14px 14px; vertical-align: middle;">
                                    <span class="label" style="background: {{ $staff->role->color ?? '#6366F1' }}22; color: {{ $staff->role->color ?? '#6366F1' }}; border: 1px solid {{ $staff->role->color ?? '#6366F1' }}55; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 11px;">
                                        {{ $staff->role->name ?? 'Custom' }}
                                    </span>
                                </td>
                                <td style="padding: 14px 14px; vertical-align: middle;">
                                    @if(empty($staff->scope_nodes))
                                        <span class="label" style="background: #14281E; color: #34D399; border: 1px solid #065F46; padding: 3px 8px; border-radius: 4px; font-size: 11px;">
                                            <i class="fa fa-globe"></i> All Nodes
                                        </span>
                                    @else
                                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                            @foreach($staff->scope_nodes as $nodeId)
                                                @php $nodeModel = $nodes->firstWhere('id', $nodeId); @endphp
                                                <span class="label" style="background: #1F1F2E; color: #818CF8; border: 1px solid #3730A3; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                                                    {{ $nodeModel->name ?? ('#' . $nodeId) }}
                                                </span>
                                            @endforeach
                                        </div>
                                    @endif
                                </td>
                                <td style="padding: 14px 14px; vertical-align: middle;">
                                    @if(empty($staff->scope_locations))
                                        <span class="label" style="background: #14281E; color: #34D399; border: 1px solid #065F46; padding: 3px 8px; border-radius: 4px; font-size: 11px;">
                                            <i class="fa fa-globe"></i> All Locations
                                        </span>
                                    @else
                                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                            @foreach($staff->scope_locations as $locId)
                                                @php $locModel = $locations->firstWhere('id', $locId); @endphp
                                                <span class="label" style="background: #1F2E25; color: #6EE7B7; border: 1px solid #047857; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                                                    {{ $locModel->short ?? ('#' . $locId) }}
                                                </span>
                                            @endforeach
                                        </div>
                                    @endif
                                </td>
                                <td style="padding: 14px 14px; vertical-align: middle;">
                                    @if(empty($staff->scope_servers))
                                        <span class="text-muted" style="font-size: 12px;">All Permitted Nodes</span>
                                    @else
                                        <span class="label label-warning" style="font-size: 10px; border-radius: 3px;">
                                            {{ count($staff->scope_servers) }} Specific Server(s)
                                        </span>
                                    @endif
                                </td>
                                <td style="padding: 14px 14px; vertical-align: middle;">
                                    <form action="{{ route('admin.roles.staff.toggle', $staff->id) }}" method="POST" style="display: inline;">
                                        {!! csrf_field() !!}
                                        <button type="submit" class="btn btn-xs" style="background: {{ $staff->is_active ? '#064E3B' : '#3F1717' }}; color: {{ $staff->is_active ? '#6EE7B7' : '#FCA5A5' }}; border: 1px solid {{ $staff->is_active ? '#059669' : '#991B1B' }}; border-radius: 4px; padding: 3px 8px; font-weight: 600;" title="Click to toggle active status">
                                            <i class="fa fa-circle" style="font-size: 8px; margin-right: 4px;"></i> {{ $staff->is_active ? 'Active' : 'Suspended' }}
                                        </button>
                                    </form>
                                </td>
                                <td style="padding: 14px 18px; vertical-align: middle;" class="text-right">
                                    <button type="button" class="btn btn-xs btn-default" style="background: #171717; border-color: #333333; color: #E5E5E5; border-radius: 4px; margin-right: 4px;" onclick="openEditStaffModal({{ json_encode($staff) }})">
                                        <i class="fa fa-pencil"></i> Edit Scopes
                                    </button>
                                    <form action="{{ route('admin.roles.staff.remove', $staff->id) }}" method="POST" style="display: inline;" onsubmit="return confirm('Revoke staff privileges for {{ $staff->user->username }}? The user account will remain intact.');">
                                        {!! csrf_field() !!}
                                        {!! method_field('DELETE') !!}
                                        <button type="submit" class="btn btn-xs btn-danger" style="border-radius: 4px; background: #7F1D1D; border-color: #991B1B;">
                                            <i class="fa fa-trash"></i>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="text-center" style="padding: 30px; color: #737373;">
                                    <i class="fa fa-shield" style="font-size: 28px; margin-bottom: 8px; display: block; color: #404040;"></i>
                                    No delegated staff members assigned yet. Use <strong>Assign Staff Role</strong> above to assign permissions to users.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- TAB 2: ROLES & PRESETS MANAGEMENT -->
    <div class="tab-pane" id="tab-roles">
        <div class="row">
            @foreach($roles as $role)
                <div class="col-md-4 col-sm-6 col-xs-12" style="margin-bottom: 20px;">
                    <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-top: 3px solid {{ $role->color ?? '#6366F1' }}; border-radius: 8px; height: 100%; display: flex; flex-direction: column;">
                        <div class="box-header with-border" style="border-bottom: 1px solid #171717; padding: 14px 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 class="box-title" style="color: #FFFFFF; font-size: 15px; font-weight: 700;">
                                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: {{ $role->color ?? '#6366F1' }}; margin-right: 6px;"></span>
                                    {{ $role->name }}
                                </h3>
                                @if($role->is_system)
                                    <span class="label" style="background: #1E1B4B; color: #A5B4FC; border: 1px solid #312E81; font-size: 10px; border-radius: 4px;">
                                        SYSTEM PRESET
                                    </span>
                                @else
                                    <span class="label label-default" style="font-size: 10px; border-radius: 4px;">
                                        CUSTOM
                                    </span>
                                @endif
                            </div>
                        </div>
                        <div class="box-body" style="padding: 16px; flex-grow: 1;">
                            <p style="color: #A3A3A3; font-size: 12px; line-height: 1.5; min-height: 36px; margin-bottom: 12px;">
                                {{ $role->description ?? 'No description provided.' }}
                            </p>
                            <div style="background: #111111; border: 1px solid #1A1A1A; border-radius: 6px; padding: 10px; margin-bottom: 14px;">
                                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                                    <span style="color: #737373; text-transform: uppercase;">Permission Grants</span>
                                    <span style="color: #FFFFFF; font-weight: 700; font-family: monospace;">
                                        @if(in_array('*', $role->permissions ?? []))
                                            <span style="color: #EF4444;">ALL (*)</span>
                                        @else
                                            {{ count($role->permissions ?? []) }} grants
                                        @endif
                                    </span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px;">
                                    <span style="color: #737373; text-transform: uppercase;">Assigned Members</span>
                                    <span style="color: #10B981; font-weight: 700; font-family: monospace;">
                                        {{ $role->staff_count ?? $role->staff->count() }} staff
                                    </span>
                                </div>
                            </div>
                            <!-- Permission sample badges -->
                            <div style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 60px; overflow: hidden;">
                                @if(in_array('*', $role->permissions ?? []))
                                    <span class="label label-danger" style="font-size: 10px;">Full SuperAdmin Authority (*)</span>
                                @else
                                    @foreach(array_slice($role->permissions ?? [], 0, 5) as $perm)
                                        <span class="label label-default" style="background: #171717; border: 1px solid #262626; color: #D4D4D4; font-size: 10px;">
                                            {{ $perm }}
                                        </span>
                                    @endforeach
                                    @if(count($role->permissions ?? []) > 5)
                                        <span class="label" style="background: #262626; color: #9CA3AF; font-size: 10px;">
                                            +{{ count($role->permissions) - 5 }} more
                                        </span>
                                    @endif
                                @endif
                            </div>
                        </div>
                        <div class="box-footer" style="background: #0D0D0D; border-top: 1px solid #171717; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
                            <button type="button" class="btn btn-xs btn-default" onclick="openEditRoleModal({{ json_encode($role) }})" style="background: #1A1A1A; border-color: #333333; color: #FFFFFF; border-radius: 4px; padding: 4px 10px;">
                                <i class="fa fa-sliders" style="margin-right: 4px;"></i> Configure Permissions
                            </button>
                            @if(!$role->is_system)
                                <form action="{{ route('admin.roles.delete', $role->id) }}" method="POST" style="display: inline;" onsubmit="return confirm('Delete role {{ $role->name }}? Users assigned will lose this role.');">
                                    {!! csrf_field() !!}
                                    {!! method_field('DELETE') !!}
                                    <button type="submit" class="btn btn-xs btn-danger" style="background: #7F1D1D; border-color: #991B1B; border-radius: 4px;">
                                        <i class="fa fa-trash"></i>
                                    </button>
                                </form>
                            @endif
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    </div>

    <!-- TAB 3: ROOT ADMINISTRATORS -->
    <div class="tab-pane" id="tab-root">
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
            <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F; padding: 14px 18px;">
                <h3 class="box-title" style="color: #FFFFFF; font-size: 14px; font-weight: 600;">
                    Root Administrators (Full System Owners)
                </h3>
                <div class="box-tools pull-right">
                    <span class="label label-danger" style="font-size: 11px;">Bypasses all permission and scope filters</span>
                </div>
            </div>
            <div class="box-body table-responsive no-padding">
                <table class="table table-hover" style="margin: 0;">
                    <thead>
                        <tr style="border-bottom: 1px solid #1F1F1F; background: #111111; color: #737373; font-size: 11px; text-transform: uppercase;">
                            <th style="padding: 12px 18px;">Administrator</th>
                            <th style="padding: 12px 14px;">Authority Level</th>
                            <th style="padding: 12px 14px;">Servers Owned</th>
                            <th style="padding: 12px 14px;">Two-Factor Auth</th>
                            <th style="padding: 12px 18px;" class="text-right">Manage</th>
                        </tr>
                    </thead>
                    <tbody style="font-size: 13px; color: #D4D4D4;">
                        @foreach($rootAdmins as $admin)
                            <tr style="border-bottom: 1px solid #171717;">
                                <td style="padding: 14px 18px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #3B1212; border: 1px solid #7F1D1D; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #FCA5A5; font-size: 12px;">
                                            {{ strtoupper(substr($admin->username, 0, 2)) }}
                                        </div>
                                        <div>
                                            <a href="{{ route('admin.users.view', $admin->id) }}" style="color: #FFFFFF; font-weight: 600; text-decoration: none;">
                                                {{ $admin->name_first }} {{ $admin->name_last }}
                                            </a>
                                            <div style="font-size: 11px; color: #737373;">
                                                <span>{{ $admin->username }}</span> &bull; <span>{{ $admin->email }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style="padding: 14px 14px; vertical-align: middle;">
                                    <span class="label label-danger" style="font-weight: 700; font-size: 11px; border-radius: 4px;">ROOT_ADMIN</span>
                                </td>
                                <td style="padding: 14px 14px; vertical-align: middle;">
                                    {{ $admin->servers_count ?? $admin->servers->count() }}
                                </td>
                                <td style="padding: 14px 14px; vertical-align: middle;">
                                    @if($admin->use_totp)
                                        <span class="label label-success" style="font-size: 10px; border-radius: 4px;">2FA ACTIVE</span>
                                    @else
                                        <span class="label label-warning" style="font-size: 10px; border-radius: 4px;">DISABLED</span>
                                    @endif
                                </td>
                                <td style="padding: 14px 18px; vertical-align: middle;" class="text-right">
                                    <a href="{{ route('admin.users.view', $admin->id) }}" class="btn btn-xs btn-default" style="background: #1A1A1A; border-color: #333333; color: #FFFFFF; border-radius: 4px;">
                                        <i class="fa fa-user"></i> View Profile
                                    </a>
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- ================= MODALS ================= -->

<!-- MODAL: Assign Staff Member -->
<div class="modal fade" id="assignStaffModal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <form action="{{ route('admin.roles.staff.assign') }}" method="POST">
            {!! csrf_field() !!}
            <div class="modal-content" style="background: #0F0F0F; border: 1px solid #262626; color: #E5E5E5; border-radius: 8px;">
                <div class="modal-header" style="border-bottom: 1px solid #262626; padding: 16px 20px;">
                    <button type="button" class="close" data-dismiss="modal" style="color: #9CA3AF;">&times;</button>
                    <h4 class="modal-title" style="color: #FFFFFF; font-weight: 700;">
                        <i class="fa fa-user-plus" style="margin-right: 6px; color: #6366F1;"></i> Assign Staff Role &amp; Scopes
                    </h4>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="row">
                        <div class="col-md-6 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Select User Account</label>
                            <select name="user_id" id="assignUserId" class="form-control" required style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                                <option value="">-- Choose User --</option>
                                @foreach($nonStaffUsers as $candidate)
                                    <option value="{{ $candidate->id }}">{{ $candidate->username }} ({{ $candidate->email }})</option>
                                @endforeach
                            </select>
                            <p class="text-muted small" style="margin-top: 4px;">Only non-root users are listed.</p>
                        </div>
                        <div class="col-md-6 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Assign Role</label>
                            <select name="role_id" id="assignRoleId" class="form-control" required style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                                @foreach($roles as $role)
                                    <option value="{{ $role->id }}" data-color="{{ $role->color }}">{{ $role->name }} - {{ $role->description }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                    <hr style="border-color: #262626; margin: 15px 0;">

                    <h5 style="color: #FFFFFF; font-weight: 700; margin-bottom: 12px;">
                        <i class="fa fa-crosshairs" style="color: #10B981; margin-right: 6px;"></i> Resource Scoping Restrictions
                        <small style="color: #9CA3AF; display: block; font-size: 11px; margin-top: 2px;">Leave unselected/blank to grant access to ALL available resources for this role.</small>
                    </h5>

                    <div class="row">
                        <!-- Node Scoping -->
                        <div class="col-md-6 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Permitted Nodes</label>
                            <div style="background: #141414; border: 1px solid #262626; border-radius: 6px; padding: 10px; max-height: 140px; overflow-y: auto;">
                                <div style="margin-bottom: 6px;">
                                    <small style="color: #6EE7B7; font-weight: 600;">Uncheck all to allow all nodes</small>
                                </div>
                                @foreach($nodes as $node)
                                    <div class="checkbox" style="margin: 4px 0;">
                                        <label style="color: #D4D4D4; font-size: 12px;">
                                            <input type="checkbox" name="scope_nodes[]" value="{{ $node->id }}">
                                            <strong>{{ $node->name }}</strong> ({{ $node->fqdn }})
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                        </div>

                        <!-- Location Scoping -->
                        <div class="col-md-6 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Permitted Locations</label>
                            <div style="background: #141414; border: 1px solid #262626; border-radius: 6px; padding: 10px; max-height: 140px; overflow-y: auto;">
                                <div style="margin-bottom: 6px;">
                                    <small style="color: #6EE7B7; font-weight: 600;">Uncheck all to allow all locations</small>
                                </div>
                                @foreach($locations as $loc)
                                    <div class="checkbox" style="margin: 4px 0;">
                                        <label style="color: #D4D4D4; font-size: 12px;">
                                            <input type="checkbox" name="scope_locations[]" value="{{ $loc->id }}">
                                            <strong>{{ $loc->short }}</strong> - {{ $loc->long }}
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Specific Server IDs (Optional)</label>
                        <input type="text" name="scope_servers" class="form-control" placeholder="e.g. 1, 4, 12 (leave blank to allow all servers on permitted nodes)" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                        <p class="text-muted small" style="margin-top: 4px;">Comma-separated list of server IDs. If empty, the staff member can view all servers on allowed nodes.</p>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Administrative Notes</label>
                        <textarea name="notes" rows="2" class="form-control" placeholder="e.g. Assigned to North America regional shift" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;"></textarea>
                    </div>
                </div>
                <div class="modal-footer" style="border-top: 1px solid #262626; padding: 14px 20px;">
                    <button type="button" class="btn btn-default" data-dismiss="modal" style="background: #1F1F1F; border-color: #333333; color: #9CA3AF; border-radius: 6px;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background: #4F46E5; border-color: #4338CA; border-radius: 6px; font-weight: 600;">Assign Staff Access</button>
                </div>
            </div>
        </form>
    </div>
</div>

<!-- MODAL: Edit Staff Scopes -->
<div class="modal fade" id="editStaffModal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <form id="editStaffForm" action="{{ route('admin.roles.staff.assign') }}" method="POST">
            {!! csrf_field() !!}
            <input type="hidden" name="user_id" id="editStaffUserId">
            <div class="modal-content" style="background: #0F0F0F; border: 1px solid #262626; color: #E5E5E5; border-radius: 8px;">
                <div class="modal-header" style="border-bottom: 1px solid #262626; padding: 16px 20px;">
                    <button type="button" class="close" data-dismiss="modal" style="color: #9CA3AF;">&times;</button>
                    <h4 class="modal-title" style="color: #FFFFFF; font-weight: 700;">
                        <i class="fa fa-sliders" style="margin-right: 6px; color: #6366F1;"></i> Modify Staff Role &amp; Resource Scopes: <span id="editStaffUsername" style="color: #818CF8;"></span>
                    </h4>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="row">
                        <div class="col-md-6 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Assigned Role</label>
                            <select name="role_id" id="editStaffRoleId" class="form-control" required style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                                @foreach($roles as $role)
                                    <option value="{{ $role->id }}">{{ $role->name }} - {{ $role->description }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-md-6 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Account Status</label>
                            <select name="is_active" id="editStaffIsActive" class="form-control" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                                <option value="1">Active - Can access Admin CP</option>
                                <option value="0">Suspended - Staff access blocked</option>
                            </select>
                        </div>
                    </div>

                    <hr style="border-color: #262626; margin: 15px 0;">

                    <h5 style="color: #FFFFFF; font-weight: 700; margin-bottom: 12px;">
                        <i class="fa fa-crosshairs" style="color: #10B981; margin-right: 6px;"></i> Resource Scoping Restrictions
                    </h5>

                    <div class="row">
                        <!-- Node Scoping -->
                        <div class="col-md-6 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Permitted Nodes</label>
                            <div style="background: #141414; border: 1px solid #262626; border-radius: 6px; padding: 10px; max-height: 140px; overflow-y: auto;">
                                <div style="margin-bottom: 6px;">
                                    <small style="color: #6EE7B7; font-weight: 600;">Leave all unchecked to allow all nodes</small>
                                </div>
                                @foreach($nodes as $node)
                                    <div class="checkbox" style="margin: 4px 0;">
                                        <label style="color: #D4D4D4; font-size: 12px;">
                                            <input type="checkbox" name="scope_nodes[]" class="edit-scope-node-checkbox" value="{{ $node->id }}">
                                            <strong>{{ $node->name }}</strong> ({{ $node->fqdn }})
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                        </div>

                        <!-- Location Scoping -->
                        <div class="col-md-6 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Permitted Locations</label>
                            <div style="background: #141414; border: 1px solid #262626; border-radius: 6px; padding: 10px; max-height: 140px; overflow-y: auto;">
                                <div style="margin-bottom: 6px;">
                                    <small style="color: #6EE7B7; font-weight: 600;">Leave all unchecked to allow all locations</small>
                                </div>
                                @foreach($locations as $loc)
                                    <div class="checkbox" style="margin: 4px 0;">
                                        <label style="color: #D4D4D4; font-size: 12px;">
                                            <input type="checkbox" name="scope_locations[]" class="edit-scope-loc-checkbox" value="{{ $loc->id }}">
                                            <strong>{{ $loc->short }}</strong> - {{ $loc->long }}
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Specific Server IDs (Optional)</label>
                        <input type="text" name="scope_servers" id="editStaffServers" class="form-control" placeholder="e.g. 1, 4, 12 (leave blank to allow all servers on permitted nodes)" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Administrative Notes</label>
                        <textarea name="notes" id="editStaffNotes" rows="2" class="form-control" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;"></textarea>
                    </div>
                </div>
                <div class="modal-footer" style="border-top: 1px solid #262626; padding: 14px 20px;">
                    <button type="button" class="btn btn-default" data-dismiss="modal" style="background: #1F1F1F; border-color: #333333; color: #9CA3AF; border-radius: 6px;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background: #4F46E5; border-color: #4338CA; border-radius: 6px; font-weight: 600;">Save Scopes</button>
                </div>
            </div>
        </form>
    </div>
</div>

<!-- MODAL: Create New Role -->
<div class="modal fade" id="createRoleModal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document" style="width: 880px; max-width: 95%;">
        <form action="{{ route('admin.roles.store') }}" method="POST">
            {!! csrf_field() !!}
            <div class="modal-content" style="background: #0F0F0F; border: 1px solid #262626; color: #E5E5E5; border-radius: 8px;">
                <div class="modal-header" style="border-bottom: 1px solid #262626; padding: 16px 20px;">
                    <button type="button" class="close" data-dismiss="modal" style="color: #9CA3AF;">&times;</button>
                    <h4 class="modal-title" style="color: #FFFFFF; font-weight: 700;">
                        <i class="fa fa-shield" style="margin-right: 6px; color: #10B981;"></i> Create Administrative Role Template
                    </h4>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="row">
                        <div class="col-md-5 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Role Name</label>
                            <input type="text" name="name" class="form-control" required placeholder="e.g. Network Technician" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                        </div>
                        <div class="col-md-4 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Slug Identifier</label>
                            <input type="text" name="slug" class="form-control" placeholder="e.g. network-tech (auto-generated if empty)" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                        </div>
                        <div class="col-md-3 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Badge Color</label>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="color" name="color" value="#6366F1" style="border: none; width: 36px; height: 34px; background: transparent; cursor: pointer;">
                                <input type="text" name="color_hex" value="#6366F1" class="form-control" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px; font-family: monospace;">
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Description</label>
                        <textarea name="description" rows="2" class="form-control" placeholder="Describe the responsibilities and scope of this role..." style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;"></textarea>
                    </div>

                    <hr style="border-color: #262626; margin: 15px 0;">

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h5 style="color: #FFFFFF; font-weight: 700; margin: 0;">
                            <i class="fa fa-lock" style="color: #6366F1; margin-right: 6px;"></i> Permissions Checklist
                        </h5>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="btn btn-xs btn-default" onclick="toggleAllCheckboxes('#createRoleModal', true)" style="background: #1F1F1F; border-color: #333333; color: #E5E5E5; border-radius: 4px;">
                                Select All
                            </button>
                            <button type="button" class="btn btn-xs btn-default" onclick="toggleAllCheckboxes('#createRoleModal', false)" style="background: #1F1F1F; border-color: #333333; color: #9CA3AF; border-radius: 4px;">
                                Deselect All
                            </button>
                        </div>
                    </div>

                    <!-- Permission Categories Grid -->
                    <div style="max-height: 380px; overflow-y: auto; padding-right: 6px;">
                        <div class="row">
                            @foreach($availablePermissions as $category => $catData)
                                <div class="col-md-6 col-xs-12" style="margin-bottom: 16px;">
                                    <div style="background: #141414; border: 1px solid #262626; border-radius: 6px; padding: 12px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #202020; padding-bottom: 6px;">
                                            <strong style="color: #FFFFFF; font-size: 13px;">{{ $catData['label'] }}</strong>
                                            <button type="button" class="btn btn-xs" style="background: transparent; color: #818CF8; border: none; font-size: 11px;" onclick="toggleCategoryCheckboxes(this, true)">Toggle</button>
                                        </div>
                                        <div style="display: grid; grid-template-columns: 1fr; gap: 4px;">
                                            @foreach($catData['permissions'] as $permKey => $permLabel)
                                                <div class="checkbox" style="margin: 3px 0;">
                                                    <label style="color: #D4D4D4; font-size: 12px;">
                                                        <input type="checkbox" name="permissions[]" value="{{ $permKey }}">
                                                        <span>{{ $permLabel }}</span>
                                                        <code style="background: #0A0A0A; border: 1px solid #1F1F1F; color: #737373; font-size: 10px; margin-left: 4px;">{{ $permKey }}</code>
                                                    </label>
                                                </div>
                                            @endforeach
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="border-top: 1px solid #262626; padding: 14px 20px;">
                    <button type="button" class="btn btn-default" data-dismiss="modal" style="background: #1F1F1F; border-color: #333333; color: #9CA3AF; border-radius: 6px;">Cancel</button>
                    <button type="submit" class="btn btn-success" style="background: #059669; border-color: #047857; border-radius: 6px; font-weight: 600;">Create Role</button>
                </div>
            </div>
        </form>
    </div>
</div>

<!-- MODAL: Edit Role & Permissions -->
<div class="modal fade" id="editRoleModal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document" style="width: 880px; max-width: 95%;">
        <form id="editRoleForm" action="" method="POST">
            {!! csrf_field() !!}
            {!! method_field('PUT') !!}
            <div class="modal-content" style="background: #0F0F0F; border: 1px solid #262626; color: #E5E5E5; border-radius: 8px;">
                <div class="modal-header" style="border-bottom: 1px solid #262626; padding: 16px 20px;">
                    <button type="button" class="close" data-dismiss="modal" style="color: #9CA3AF;">&times;</button>
                    <h4 class="modal-title" style="color: #FFFFFF; font-weight: 700;">
                        <i class="fa fa-sliders" style="margin-right: 6px; color: #6366F1;"></i> Configure Role: <span id="editRoleTitle" style="color: #818CF8;"></span>
                    </h4>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="row">
                        <div class="col-md-5 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Role Name</label>
                            <input type="text" name="name" id="editRoleName" class="form-control" required style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                        </div>
                        <div class="col-md-4 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Slug Identifier</label>
                            <input type="text" name="slug" id="editRoleSlug" class="form-control" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;">
                        </div>
                        <div class="col-md-3 col-xs-12 form-group">
                            <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Badge Color</label>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="color" name="color" id="editRoleColor" style="border: none; width: 36px; height: 34px; background: transparent; cursor: pointer;">
                                <input type="text" name="color_hex" id="editRoleColorHex" class="form-control" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px; font-family: monospace;">
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="font-size: 12px; text-transform: uppercase; color: #A3A3A3; font-weight: 600;">Description</label>
                        <textarea name="description" id="editRoleDescription" rows="2" class="form-control" style="background: #171717; border: 1px solid #333333; color: #FFFFFF; border-radius: 6px;"></textarea>
                    </div>

                    <hr style="border-color: #262626; margin: 15px 0;">

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h5 style="color: #FFFFFF; font-weight: 700; margin: 0;">
                            <i class="fa fa-lock" style="color: #6366F1; margin-right: 6px;"></i> Permissions Checklist
                        </h5>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="btn btn-xs btn-default" onclick="toggleAllCheckboxes('#editRoleModal', true)" style="background: #1F1F1F; border-color: #333333; color: #E5E5E5; border-radius: 4px;">
                                Select All
                            </button>
                            <button type="button" class="btn btn-xs btn-default" onclick="toggleAllCheckboxes('#editRoleModal', false)" style="background: #1F1F1F; border-color: #333333; color: #9CA3AF; border-radius: 4px;">
                                Deselect All
                            </button>
                        </div>
                    </div>

                    <!-- Permission Categories Grid -->
                    <div style="max-height: 380px; overflow-y: auto; padding-right: 6px;">
                        <div class="row">
                            @foreach($availablePermissions as $category => $catData)
                                <div class="col-md-6 col-xs-12" style="margin-bottom: 16px;">
                                    <div style="background: #141414; border: 1px solid #262626; border-radius: 6px; padding: 12px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #202020; padding-bottom: 6px;">
                                            <strong style="color: #FFFFFF; font-size: 13px;">{{ $catData['label'] }}</strong>
                                            <button type="button" class="btn btn-xs" style="background: transparent; color: #818CF8; border: none; font-size: 11px;" onclick="toggleCategoryCheckboxes(this, true)">Toggle</button>
                                        </div>
                                        <div style="display: grid; grid-template-columns: 1fr; gap: 4px;">
                                            @foreach($catData['permissions'] as $permKey => $permLabel)
                                                <div class="checkbox" style="margin: 3px 0;">
                                                    <label style="color: #D4D4D4; font-size: 12px;">
                                                        <input type="checkbox" name="permissions[]" class="edit-role-perm-checkbox" value="{{ $permKey }}">
                                                        <span>{{ $permLabel }}</span>
                                                        <code style="background: #0A0A0A; border: 1px solid #1F1F1F; color: #737373; font-size: 10px; margin-left: 4px;">{{ $permKey }}</code>
                                                    </label>
                                                </div>
                                            @endforeach
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="border-top: 1px solid #262626; padding: 14px 20px;">
                    <button type="button" class="btn btn-default" data-dismiss="modal" style="background: #1F1F1F; border-color: #333333; color: #9CA3AF; border-radius: 6px;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background: #4F46E5; border-color: #4338CA; border-radius: 6px; font-weight: 600;">Save Changes</button>
                </div>
            </div>
        </form>
    </div>
</div>

@endsection

@section('footer-scripts')
@parent
<script>
function toggleAllCheckboxes(containerSelector, checked) {
    $(containerSelector).find('input[name="permissions[]"]').prop('checked', checked);
}

function toggleCategoryCheckboxes(btn, checked) {
    var $box = $(btn).closest('div').parent();
    var $boxes = $box.find('input[name="permissions[]"]');
    var allChecked = true;
    $boxes.each(function() {
        if (!$(this).prop('checked')) allChecked = false;
    });
    $boxes.prop('checked', !allChecked);
}

function openEditStaffModal(staff) {
    $('#editStaffUserId').val(staff.user_id);
    $('#editStaffUsername').text(staff.user ? staff.user.username : ('#' + staff.user_id));
    $('#editStaffRoleId').val(staff.role_id);
    $('#editStaffIsActive').val(staff.is_active ? 1 : 0);
    $('#editStaffNotes').val(staff.notes || '');

    // Server IDs
    if (staff.scope_servers && Array.isArray(staff.scope_servers)) {
        $('#editStaffServers').val(staff.scope_servers.join(', '));
    } else {
        $('#editStaffServers').val('');
    }

    // Nodes
    $('.edit-scope-node-checkbox').prop('checked', false);
    if (staff.scope_nodes && Array.isArray(staff.scope_nodes)) {
        staff.scope_nodes.forEach(function(nodeId) {
            $('.edit-scope-node-checkbox[value="' + nodeId + '"]').prop('checked', true);
        });
    }

    // Locations
    $('.edit-scope-loc-checkbox').prop('checked', false);
    if (staff.scope_locations && Array.isArray(staff.scope_locations)) {
        staff.scope_locations.forEach(function(locId) {
            $('.edit-scope-loc-checkbox[value="' + locId + '"]').prop('checked', true);
        });
    }

    $('#editStaffModal').modal('show');
}

function openEditRoleModal(role) {
    var updateUrl = "{{ url('/admin/roles') }}/" + role.id;
    $('#editRoleForm').attr('action', updateUrl);
    $('#editRoleTitle').text(role.name);
    $('#editRoleName').val(role.name);
    $('#editRoleSlug').val(role.slug);
    $('#editRoleDescription').val(role.description || '');
    $('#editRoleColor').val(role.color || '#6366F1');
    $('#editRoleColorHex').val(role.color || '#6366F1');

    // Reset permissions
    $('.edit-role-perm-checkbox').prop('checked', false);

    if (role.permissions && Array.isArray(role.permissions)) {
        if (role.permissions.indexOf('*') !== -1) {
            $('.edit-role-perm-checkbox').prop('checked', true);
        } else {
            role.permissions.forEach(function(perm) {
                $('.edit-role-perm-checkbox[value="' + perm + '"]').prop('checked', true);
            });
        }
    }

    $('#editRoleModal').modal('show');
}

// Color picker sync
$('input[name="color"]').on('input', function() {
    $(this).next('input[name="color_hex"]').val($(this).val());
});
$('input[name="color_hex"]').on('input', function() {
    $(this).prev('input[name="color"]').val($(this).val());
});
</script>
@endsection
