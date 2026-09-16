@extends('layouts.admin')

@section('title')
    OAuth 2.0 Server Applications
@endsection

@section('content-header')
    <h1>OAuth 2.0 Identity Server<small>RFC 6749 Authorization Server & Token Management for Votion Apps.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">OAuth Applications</li>
    </ol>
@endsection

@section('content')
<!-- Telemetry Metrics -->
<div class="row">
    <div class="col-xs-12">
        <div class="row">
            <div class="col-md-4 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Registered Apps</span>
                        <div style="font-size: 20px; font-weight: 700; color: #FFFFFF; font-family: monospace; margin-top: 4px;">
                            {{ $clients->total() }} <span style="font-size: 12px; color: #10B981; font-weight: 500;">Active</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Active Bearer Tokens</span>
                        <div style="font-size: 20px; font-weight: 700; color: #FFFFFF; font-family: monospace; margin-top: 4px;">
                            {{ $activeTokensCount }} <span style="font-size: 12px; color: #3B82F6; font-weight: 500;">Live</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4 col-sm-12 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Supported Protocols</span>
                        <div style="font-size: 13px; font-weight: 600; color: #E5E5E5; margin-top: 4px;">
                            <span class="label label-success" style="font-size: 10px;">AUTH CODE + PKCE</span>
                            <span class="label label-info" style="font-size: 10px;">CLIENT CREDENTIALS</span>
                            <span class="label label-default" style="font-size: 10px;">REFRESH TOKEN</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Newly Generated Credentials Callout -->
@if(session('new_oauth_credentials'))
    @php $cred = session('new_oauth_credentials'); @endphp
    <div class="row">
        <div class="col-xs-12">
            <div class="callout callout-success" style="background: #064E3B !important; border-left: 4px solid #10B981; color: #D1FAE5; border-radius: 8px; margin-bottom: 20px; padding: 18px 22px;">
                <h4 style="color: #34D399; font-weight: 700; margin: 0 0 10px 0;">
                    <i class="fa fa-key" style="margin-right: 6px;"></i> OAuth 2.0 Client Credentials for "{{ $cred['name'] }}"
                </h4>
                <p style="font-size: 13px; margin-bottom: 12px; color: #A7F3D0;">
                    Please copy and securely store this <strong>Client Secret</strong> now. For security purposes, it will <strong>never be shown again</strong>.
                </p>
                <div style="background: #022C22; border: 1px solid #047857; border-radius: 6px; padding: 14px; margin-bottom: 8px;">
                    <div style="margin-bottom: 10px;">
                        <span style="font-size: 11px; text-transform: uppercase; color: #6EE7B7; font-weight: 600; display: block; margin-bottom: 4px;">Client ID</span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="copyClientId" readonly value="{{ $cred['client_id'] }}" style="background: #064E3B; border: 1px solid #059669; color: #FFFFFF; font-family: monospace; padding: 6px 10px; border-radius: 4px; font-size: 13px; width: 100%; max-width: 480px;">
                            <button type="button" class="btn btn-sm btn-default" onclick="navigator.clipboard.writeText('{{ $cred['client_id'] }}'); alert('Client ID copied!');" style="background: #059669; border-color: #047857; color: #FFFFFF;">
                                <i class="fa fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: #6EE7B7; font-weight: 600; display: block; margin-bottom: 4px;">Client Secret</span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="copyClientSecret" readonly value="{{ $cred['client_secret'] }}" style="background: #064E3B; border: 1px solid #059669; color: #FFFFFF; font-family: monospace; padding: 6px 10px; border-radius: 4px; font-size: 13px; width: 100%; max-width: 480px;">
                            <button type="button" class="btn btn-sm btn-default" onclick="navigator.clipboard.writeText('{{ $cred['client_secret'] }}'); alert('Client Secret copied!');" style="background: #059669; border-color: #047857; color: #FFFFFF;">
                                <i class="fa fa-copy"></i> Copy Secret
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endif

<div class="row">
    <!-- Left: Register New Client Application -->
    <div class="col-md-5 col-xs-12">
        <form action="{{ route('admin.oauth.apps.store') }}" method="POST">
            {!! csrf_field() !!}
            <div class="box box-primary" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F;">
                    <h3 class="box-title" style="color: #FFFFFF; font-size: 15px; font-weight: 600;">
                        <i class="fa fa-plus-circle" style="margin-right: 6px; color: #10B981;"></i> Register OAuth Application
                    </h3>
                </div>
                <div class="box-body" style="padding: 20px;">
                    <div class="form-group">
                        <label class="control-label" style="color: #E5E5E5;">Application Name</label>
                        <input type="text" name="name" class="form-control" placeholder="e.g. Votion Billing, Discord Bot, Mobile App" required style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                        <p class="text-muted small">Something your users will recognize and trust during the authorization prompt.</p>
                    </div>

                    <div class="form-group">
                        <label class="control-label" style="color: #E5E5E5;">Authorized Redirect URIs</label>
                        <textarea name="redirect_uris" rows="3" class="form-control" placeholder="https://billing.votioncloud.online/oauth/callback&#10;https://localhost:3000/callback" required style="background: #141414; border-color: #2D2D2D; color: #E5E5E5; font-family: monospace; font-size: 12px;"></textarea>
                        <p class="text-muted small">One URI per line. Your application must match one of these callback URLs exactly during authorization.</p>
                    </div>

                    <div class="form-group">
                        <label class="radio-inline" style="color: #A3A3A3;">
                            <input type="checkbox" name="personal_access_client" value="1"> Confidential / Server-Side Application
                        </label>
                        <p class="text-muted small" style="margin-top: 4px;">Enables client secret requirement. (Public clients like SPAs/Mobile can use PKCE without secrets).</p>
                    </div>
                </div>
                <div class="box-footer" style="background: #0F0F0F; border-top: 1px solid #1F1F1F; padding: 15px 20px;">
                    <button type="submit" class="btn btn-success" style="font-weight: 600; background: #10B981; border-color: #059669;">
                        <i class="fa fa-shield"></i> Create Application
                    </button>
                </div>
            </div>
        </form>

        <!-- OAuth Server Discovery Endpoints -->
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px; margin-top: 20px;">
            <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F;">
                <h3 class="box-title" style="color: #FFFFFF; font-size: 14px; font-weight: 600;">
                    <i class="fa fa-plug" style="margin-right: 6px; color: #3B82F6;"></i> Server Endpoints for Votion Apps
                </h3>
            </div>
            <div class="box-body" style="padding: 16px; font-size: 12px; color: #D1D5DB;">
                <div style="margin-bottom: 10px;">
                    <span style="color: #9CA3AF; display: block; font-weight: 600;">Authorize URL:</span>
                    <code style="background: #141414; color: #60A5FA; padding: 3px 6px; border-radius: 4px; display: block; margin-top: 2px;">{{ route('oauth.authorize') }}</code>
                </div>
                <div style="margin-bottom: 10px;">
                    <span style="color: #9CA3AF; display: block; font-weight: 600;">Token URL:</span>
                    <code style="background: #141414; color: #34D399; padding: 3px 6px; border-radius: 4px; display: block; margin-top: 2px;">{{ route('oauth.token') }}</code>
                </div>
                <div>
                    <span style="color: #9CA3AF; display: block; font-weight: 600;">User Info URL:</span>
                    <code style="background: #141414; color: #F59E0B; padding: 3px 6px; border-radius: 4px; display: block; margin-top: 2px;">{{ route('oauth.userinfo') }}</code>
                </div>
            </div>
        </div>
    </div>

    <!-- Right: Applications Table -->
    <div class="col-md-7 col-xs-12">
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
            <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F; display: flex; align-items: center; justify-content: space-between;">
                <h3 class="box-title" style="color: #FFFFFF; font-size: 15px; font-weight: 600;">
                    <i class="fa fa-cubes" style="margin-right: 6px; color: #A78BFA;"></i> Registered Applications
                </h3>
                <span class="label label-default" style="font-family: monospace;">{{ $clients->total() }} Total</span>
            </div>
            <div class="box-body table-responsive no-padding">
                <table class="table table-hover" style="color: #D1D5DB;">
                    <thead>
                        <tr style="border-bottom: 1px solid #1F1F1F; color: #737373; font-size: 11px; text-transform: uppercase;">
                            <th>Application</th>
                            <th>Client ID</th>
                            <th>Redirect URIs</th>
                            <th>Active Tokens</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($clients as $client)
                            <tr style="border-bottom: 1px solid #141414;">
                                <td>
                                    <a href="#" class="btn-edit-app"
                                       data-id="{{ $client->id }}"
                                       data-name="{{ $client->name }}"
                                       data-redirect-uris="{{ $client->redirect_uris }}"
                                       data-confidential="{{ $client->personal_access_client ? 1 : 0 }}"
                                       data-action="{{ route('admin.oauth.apps.update', $client->id) }}"
                                       style="color: #FFFFFF; font-weight: 700; text-decoration: none;"
                                       title="Click to edit application & URLs">
                                        {{ $client->name }}
                                        <i class="fa fa-pencil" style="font-size: 10px; color: #737373; margin-left: 4px;"></i>
                                    </a>
                                    <div class="text-muted small">{{ $client->created_at ? $client->created_at->diffForHumans() : 'Just now' }}</div>
                                </td>
                                <td>
                                    <code style="background: #141414; color: #A3A3A3; font-size: 11px; padding: 2px 6px; border-radius: 4px; user-select: all;">
                                        {{ $client->id }}
                                    </code>
                                </td>
                                <td>
                                    @php $uris = $client->getRedirectUrisArray(); @endphp
                                    <span class="text-truncate" style="max-width: 180px; display: inline-block; font-size: 11px; font-family: monospace; color: #8A8F98;" title="{{ implode("\n", $uris) }}">
                                        {{ $uris[0] ?? 'None' }}
                                        @if(count($uris) > 1)
                                            <span class="badge" style="background: #27272A; font-size: 9px;">+{{ count($uris) - 1 }}</span>
                                        @endif
                                    </span>
                                </td>
                                <td>
                                    <span class="label label-info" style="font-size: 10px;">{{ $client->access_tokens_count }} Tokens</span>
                                </td>
                                <td class="text-right">
                                    <button type="button" class="btn btn-xs btn-primary btn-edit-app"
                                        data-id="{{ $client->id }}"
                                        data-name="{{ $client->name }}"
                                        data-redirect-uris="{{ $client->redirect_uris }}"
                                        data-confidential="{{ $client->personal_access_client ? 1 : 0 }}"
                                        data-action="{{ route('admin.oauth.apps.update', $client->id) }}"
                                        title="Edit Application & Redirect URIs"
                                        style="background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.3); color: #60A5FA; margin-right: 2px;">
                                        <i class="fa fa-pencil"></i>
                                    </button>

                                    <form action="{{ route('admin.oauth.apps.regenerate', $client->id) }}" method="POST" style="display: inline;" onsubmit="return confirm('Regenerate secret for {{ $client->name }}? The old secret will stop working immediately.');">
                                        {!! csrf_field() !!}
                                        <button type="submit" class="btn btn-xs btn-warning" title="Regenerate Client Secret" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); color: #FBBF24; margin-right: 2px;">
                                            <i class="fa fa-refresh"></i>
                                        </button>
                                    </form>

                                    <form action="{{ route('admin.oauth.apps.delete', $client->id) }}" method="POST" style="display: inline;" onsubmit="return confirm('Revoke and delete {{ $client->name }}? All active user authorizations will be terminated.');">
                                        {!! csrf_field() !!}
                                        {!! method_field('DELETE') !!}
                                        <button type="submit" class="btn btn-xs btn-danger" title="Revoke & Delete" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #F87171;">
                                            <i class="fa fa-trash"></i>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="text-center text-muted" style="padding: 40px 0;">
                                    <i class="fa fa-id-card-o fa-3x" style="color: #262626; margin-bottom: 12px; display: block;"></i>
                                    No OAuth applications registered yet.<br>
                                    <span class="small">Register an application on the left to allow other Votion apps to authenticate users via Lunar Panel.</span>
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            @if($clients->hasPages())
                <div class="box-footer" style="background: #0A0A0A; border-top: 1px solid #1F1F1F;">
                    <div class="col-md-12 text-center">{!! $clients->render() !!}</div>
                </div>
            @endif
        </div>
    </div>
</div>

<!-- Edit OAuth Application Modal -->
<div class="modal fade" id="editAppModal" tabindex="-1" role="dialog" aria-labelledby="editAppModalLabel">
    <div class="modal-dialog" role="document">
        <div class="modal-content" style="background: #0A0A0A; border: 1px solid #262626; border-radius: 8px; color: #E5E5E5; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);">
            <form id="editAppForm" action="" method="POST">
                {!! csrf_field() !!}
                {!! method_field('PUT') !!}
                <div class="modal-header" style="border-bottom: 1px solid #1F1F1F; padding: 16px 20px;">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="color: #A3A3A3; opacity: 0.8;">
                        <span aria-hidden="true">&times;</span>
                    </button>
                    <h4 class="modal-title" id="editAppModalLabel" style="color: #FFFFFF; font-weight: 600; font-size: 16px;">
                        <i class="fa fa-pencil" style="margin-right: 8px; color: #3B82F6;"></i> Edit OAuth Application
                    </h4>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="control-label" style="color: #E5E5E5; font-size: 13px;">Application Name</label>
                        <input type="text" name="name" id="editAppName" class="form-control" required style="background: #141414; border-color: #2D2D2D; color: #FFFFFF; border-radius: 6px;">
                        <p class="text-muted small" style="margin-top: 4px;">User-facing display name shown during authorization.</p>
                    </div>

                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="control-label" style="color: #E5E5E5; font-size: 13px;">Authorized Redirect URIs (Callback URLs)</label>
                        <textarea name="redirect_uris" id="editAppRedirectUris" rows="4" class="form-control" required style="background: #141414; border-color: #2D2D2D; color: #34D399; font-family: monospace; font-size: 12px; border-radius: 6px;"></textarea>
                        <p class="text-muted small" style="margin-top: 4px;">One URI per line. The external application must match one of these callback URLs exactly during authorization (e.g. <code>https://pve.example.com:8006</code>).</p>
                    </div>

                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="control-label" style="color: #E5E5E5; font-size: 13px;">Client ID</label>
                        <div class="input-group">
                            <input type="text" id="editAppClientId" readonly class="form-control" style="background: #141414; border-color: #2D2D2D; color: #A3A3A3; font-family: monospace; font-size: 12px; border-radius: 6px 0 0 6px;">
                            <span class="input-group-btn">
                                <button type="button" class="btn btn-default" id="btnCopyEditClientId" style="background: #1F1F1F; border-color: #2D2D2D; color: #E5E5E5; border-radius: 0 6px 6px 0;" title="Copy Client ID">
                                    <i class="fa fa-copy"></i>
                                </button>
                            </span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="radio-inline" style="color: #D4D4D4; font-size: 13px;">
                            <input type="checkbox" name="personal_access_client" id="editAppPersonalAccessClient" value="1">
                            Confidential / Server-Side Application
                        </label>
                        <p class="text-muted small" style="margin-top: 4px; margin-left: 20px;">Requires client secret during token exchange. Public clients (SPAs, mobile apps) can authenticate with PKCE without a client secret.</p>
                    </div>
                </div>
                <div class="modal-footer" style="background: #0A0A0A; border-top: 1px solid #1F1F1F; padding: 14px 20px;">
                    <button type="button" class="btn btn-default btn-sm pull-left" data-dismiss="modal" style="background: #1F1F1F; border-color: #2D2D2D; color: #E5E5E5; border-radius: 6px;">
                        Cancel
                    </button>
                    <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 600; background: #3B82F6; border-color: #2563EB; border-radius: 6px; padding: 6px 14px;">
                        <i class="fa fa-save" style="margin-right: 4px;"></i> Save Changes
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
@endsection

@section('footer-scripts')
    @parent
    <script>
        $(document).ready(function () {
            $('.btn-edit-app').on('click', function (e) {
                e.preventDefault();
                var btn = $(this);
                var action = btn.data('action');
                var name = btn.data('name');
                var redirectUris = btn.data('redirect-uris');
                var id = btn.data('id');
                var confidential = btn.data('confidential');

                $('#editAppForm').attr('action', action);
                $('#editAppName').val(name);
                $('#editAppRedirectUris').val(redirectUris);
                $('#editAppClientId').val(id);
                $('#editAppPersonalAccessClient').prop('checked', confidential == 1);
                $('#editAppModalLabel').html('<i class="fa fa-pencil" style="margin-right: 8px; color: #3B82F6;"></i> Edit ' + $('<div>').text(name).html());
                $('#editAppModal').modal('show');
            });

            $('#btnCopyEditClientId').on('click', function () {
                var id = $('#editAppClientId').val();
                if (id) {
                    navigator.clipboard.writeText(id).then(function () {
                        alert('Client ID copied to clipboard!');
                    });
                }
            });
        });
    </script>
@endsection