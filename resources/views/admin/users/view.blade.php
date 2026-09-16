@extends('layouts.admin')

@section('title')
    Manager User: {{ $user->username }}
@endsection

@section('content-header')
    <h1>{{ $user->name_first }} {{ $user->name_last}}<small>{{ $user->username }}</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.users') }}">Users</a></li>
        <li class="active">{{ $user->username }}</li>
    </ol>
@endsection

@section('content')
<div class="row">
    <form action="{{ route('admin.users.view', $user->id) }}" method="post">
        <div class="col-md-6">
            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">Identity</h3>
                </div>
                <div class="box-body">
                    <div class="form-group">
                        <label for="email" class="control-label">Email</label>
                        <div>
                            <input type="email" name="email" value="{{ $user->email }}" class="form-control form-autocomplete-stop">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="registered" class="control-label">Username</label>
                        <div>
                            <input type="text" name="username" value="{{ $user->username }}" class="form-control form-autocomplete-stop">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="registered" class="control-label">Client First Name</label>
                        <div>
                            <input type="text" name="name_first" value="{{ $user->name_first }}" class="form-control form-autocomplete-stop">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="registered" class="control-label">Client Last Name</label>
                        <div>
                            <input type="text" name="name_last" value="{{ $user->name_last }}" class="form-control form-autocomplete-stop">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="control-label">Default Language</label>
                        <div>
                            <select name="language" class="form-control">
                                @foreach($languages as $key => $value)
                                    <option value="{{ $key }}" @if($user->language === $key) selected @endif>{{ $value }}</option>
                                @endforeach
                            </select>
                            <p class="text-muted"><small>The default language to use when rendering the Panel for this user.</small></p>
                        </div>
                    </div>
                </div>
                <div class="box-footer">
                    {!! csrf_field() !!}
                    {!! method_field('PATCH') !!}
                    <input type="submit" value="Update User" class="btn btn-primary btn-sm">
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Password</h3>
                </div>
                <div class="box-body">
                    <div class="alert alert-success" style="display:none;margin-bottom:10px;" id="gen_pass"></div>
                    <div class="form-group no-margin-bottom">
                        <label for="password" class="control-label">Password <span class="field-optional"></span></label>
                        <div>
                            <input type="password" id="password" name="password" class="form-control form-autocomplete-stop">
                            <p class="text-muted small">Leave blank to keep this user's password the same. User will not receive any notification if password is changed.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="box box-warning">
                <div class="box-header with-border">
                    <h3 class="box-title"><i class="fa fa-shield" style="margin-right: 6px;"></i> Administrative Privileges &amp; Roles</h3>
                </div>
                <div class="box-body">
                    <div class="form-group">
                        <label for="root_admin" class="control-label">Root Administrator</label>
                        <div>
                            <select name="root_admin" id="select_root_admin" class="form-control" onchange="toggleStaffScopeSection(this.value)">
                                <option value="0" {{ !$user->root_admin ? 'selected="selected"' : '' }}>No (Standard User / Delegated Staff)</option>
                                <option value="1" {{ $user->root_admin ? 'selected="selected"' : '' }}>Yes (Full Root Admin - Unrestricted Access)</option>
                            </select>
                            <p class="text-muted"><small>Setting this to 'Yes' gives the user unrestricted authority (*) across all nodes, servers, and settings.</small></p>
                        </div>
                    </div>

                    <div id="staff_role_section" style="{{ $user->root_admin ? 'display: none;' : '' }}">
                        <hr style="margin: 15px 0; border-color: #2e2e38;">
                        <div class="form-group">
                            <label for="staff_role_id" class="control-label">Staff Role Assignment</label>
                            <div>
                                <select name="staff_role_id" id="staff_role_id" class="form-control" onchange="toggleScopingBox(this.value)">
                                    <option value="">-- None (Regular Client Account) --</option>
                                    @foreach($roles as $role)
                                        <option value="{{ $role->id }}" {{ ($staff && $staff->role_id == $role->id) ? 'selected' : '' }}>
                                            {{ $role->name }} - {{ $role->description }}
                                        </option>
                                    @endforeach
                                </select>
                                <p class="text-muted"><small>Select a predefined or custom role template to delegate Admin CP access without full root privileges.</small></p>
                            </div>
                        </div>

                        <div id="staff_scoping_details" style="{{ ($staff && $staff->role_id) ? '' : 'display: none;' }}">
                            <div class="box box-solid" style="background: #121217; border: 1px solid #272732; border-radius: 6px; padding: 12px; margin-top: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <h4 style="font-size: 13px; font-weight: 700; color: #FFFFFF; margin: 0;">
                                        <i class="fa fa-crosshairs" style="color: #10B981; margin-right: 4px;"></i> Resource Scoping Restrictions
                                    </h4>
                                    <span class="label label-info" style="font-size: 10px;">Uncheck all to allow all</span>
                                </div>

                                <div class="form-group">
                                    <label class="control-label" style="font-size: 12px; color: #A3A3A3;">Permitted Nodes</label>
                                    <div style="background: #0A0A0E; border: 1px solid #20202A; border-radius: 4px; padding: 8px; max-height: 120px; overflow-y: auto;">
                                        @foreach($nodes as $node)
                                            <div class="checkbox" style="margin: 3px 0;">
                                                <label style="color: #D4D4D4; font-size: 11px;">
                                                    <input type="checkbox" name="staff_scope_nodes[]" value="{{ $node->id }}" {{ ($staff && is_array($staff->scope_nodes) && in_array($node->id, $staff->scope_nodes)) ? 'checked' : '' }}>
                                                    <strong>{{ $node->name }}</strong> ({{ $node->fqdn }})
                                                </label>
                                            </div>
                                        @endforeach
                                    </div>
                                    <p class="text-muted small" style="margin-top: 3px; font-size: 10px;">If no nodes are checked, user can access all permitted nodes.</p>
                                </div>

                                <div class="form-group">
                                    <label class="control-label" style="font-size: 12px; color: #A3A3A3;">Permitted Locations</label>
                                    <div style="background: #0A0A0E; border: 1px solid #20202A; border-radius: 4px; padding: 8px; max-height: 120px; overflow-y: auto;">
                                        @foreach($locations as $loc)
                                            <div class="checkbox" style="margin: 3px 0;">
                                                <label style="color: #D4D4D4; font-size: 11px;">
                                                    <input type="checkbox" name="staff_scope_locations[]" value="{{ $loc->id }}" {{ ($staff && is_array($staff->scope_locations) && in_array($loc->id, $staff->scope_locations)) ? 'checked' : '' }}>
                                                    <strong>{{ $loc->short }}</strong> - {{ $loc->long }}
                                                </label>
                                            </div>
                                        @endforeach
                                    </div>
                                    <p class="text-muted small" style="margin-top: 3px; font-size: 10px;">If no locations are checked, user can access all permitted locations.</p>
                                </div>

                                <div class="form-group">
                                    <label class="control-label" style="font-size: 12px; color: #A3A3A3;">Permitted Specific Server IDs (Optional)</label>
                                    <input type="text" name="staff_scope_servers" class="form-control input-sm" placeholder="e.g. 1, 5, 12 (leave blank to allow all servers on allowed nodes)" value="{{ ($staff && is_array($staff->scope_servers)) ? implode(', ', $staff->scope_servers) : '' }}" style="background: #0A0A0E; border-color: #20202A; color: #FFFFFF;">
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="control-label" style="font-size: 12px; color: #A3A3A3;">Staff Delegation Status</label>
                                    <select name="staff_is_active" class="form-control input-sm" style="background: #0A0A0E; border-color: #20202A; color: #FFFFFF;">
                                        <option value="1" {{ (!$staff || $staff->is_active) ? 'selected' : '' }}>Active - Staff permissions active</option>
                                        <option value="0" {{ ($staff && !$staff->is_active) ? 'selected' : '' }}>Suspended - Staff access suspended</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="box-footer">
                    <input type="submit" value="Save Permissions &amp; Scopes" class="btn btn-warning btn-sm">
                </div>
            </div>
        </div>
    </form>
    <div class="col-xs-12">
        <div class="box box-danger">
            <div class="box-header with-border">
                <h3 class="box-title">Delete User</h3>
            </div>
            <div class="box-body">
                <p class="no-margin">There must be no servers associated with this account in order for it to be deleted.</p>
            </div>
            <div class="box-footer">
                <form action="{{ route('admin.users.view', $user->id) }}" method="POST">
                    {!! csrf_field() !!}
                    {!! method_field('DELETE') !!}
                    <input id="delete" type="submit" class="btn btn-sm btn-danger pull-right" {{ $user->servers->count() < 1 ?: 'disabled' }} value="Delete User" />
                </form>
            </div>
        </div>
    </div>
</div>
@endsection

@section('footer-scripts')
@parent
<script>
function toggleStaffScopeSection(val) {
    if (val === '1') {
        $('#staff_role_section').slideUp(200);
    } else {
        $('#staff_role_section').slideDown(200);
    }
}

function toggleScopingBox(val) {
    if (val) {
        $('#staff_scoping_details').slideDown(200);
    } else {
        $('#staff_scoping_details').slideUp(200);
    }
}
</script>
@endsection
