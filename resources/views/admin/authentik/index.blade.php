@extends('layouts.admin')

@section('title')
    Authentik Single Sign-On (SSO)
@endsection

@section('content-header')
    <h1>Authentik SSO<small>Centralized OpenID Connect and OAuth2 identity management across your Votion fleet.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Authentik SSO</li>
    </ol>
@endsection

@section('content')
<div class="row">
    <!-- Telemetry Cards -->
    <div class="col-xs-12">
        <div class="row">
            <!-- Connection Status Card -->
            <div class="col-md-4 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">IdP Connection</span>
                            <span id="authentikStatusBadge" class="label {{ ($connectionInfo && ($connectionInfo['success'] ?? false)) ? 'label-success' : ($configured ? 'label-warning' : 'label-default') }}">
                                {{ ($connectionInfo && ($connectionInfo['success'] ?? false)) ? 'ONLINE' : ($configured ? 'READY TO TEST' : 'NOT CONFIGURED') }}
                            </span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 8px;">
                            <span id="authentikIssuerText" style="font-size: 14px; font-weight: 600; color: #FFFFFF; font-family: monospace;" class="text-truncate">
                                {{ $connectionInfo['issuer'] ?? ($url ? $url : 'No Instance URL Configured') }}
                            </span>
                        </div>
                        <div style="margin-top: 12px; display: flex; gap: 8px;">
                            <button type="button" id="btnTestConnection" class="btn btn-xs btn-default" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                                <i class="fa fa-refresh" id="testSpinner"></i> Test IdP Reachability
                            </button>
                            <span id="testFeedback" style="font-size: 11px; color: #A3A3A3; display: none; align-self: center;"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SSO Status Card -->
            <div class="col-md-4 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Login Policy</span>
                            <span class="label {{ $enabled ? 'label-success' : 'label-danger' }}">
                                {{ $enabled ? 'SSO ACTIVE' : 'SSO DISABLED' }}
                            </span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 4px;">
                            <span style="font-size: 16px; font-weight: 700; color: #FFFFFF;">
                                {{ $enforce ? 'Enforced' : 'Dual Login Active' }}
                            </span>
                        </div>
                        <p style="font-size: 11px; color: #737373; margin-top: 6px; margin-bottom: 0;">
                            {{ $enforce ? 'All standard users are directed to Authentik SSO.' : 'Users may log in with either Password / Passkeys or Authentik.' }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Provisioning Policy Card -->
            <div class="col-md-4 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">JIT Auto-Provisioning</span>
                            <span class="label {{ $autoProvision ? 'label-info' : 'label-default' }}">
                                {{ $autoProvision ? 'ENABLED' : 'MANUAL' }}
                            </span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 4px;">
                            <span style="font-size: 14px; font-weight: 600; color: #FFFFFF; font-family: monospace;">
                                Admin Group: {{ $adminGroup ?: 'None (Standard Users)' }}
                            </span>
                        </div>
                        <p style="font-size: 11px; color: #737373; margin-top: 6px; margin-bottom: 0;">
                            {{ $autoProvision ? 'Accounts are created automatically on their first successful SSO login.' : 'Only existing user accounts can sign in via SSO.' }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Configuration Form -->
    <div class="col-md-8 col-xs-12">
        <form action="{{ route('admin.authentik.update') }}" method="POST">
            {!! csrf_field() !!}
            <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                <div class="box-header with-border" style="border-bottom-color: #1F1F1F; padding: 16px 20px;">
                    <h3 class="box-title" style="color: #FFFFFF; font-weight: 600; font-size: 16px;">
                        <i class="fa fa-shield" style="color: #fd4b2d; margin-right: 8px;"></i> OpenID Connect / OAuth2 Settings
                    </h3>
                </div>
                <div class="box-body" style="padding: 20px;">
                    <!-- Master Toggles -->
                    <div class="form-group" style="margin-bottom: 24px; padding: 14px; background: #141414; border: 1px solid #262626; border-radius: 6px;">
                        <div class="checkbox" style="margin-top: 0; margin-bottom: 10px;">
                            <label style="color: #E5E5E5; font-weight: 600; font-size: 13px;">
                                <input type="checkbox" name="authentik:enabled" value="1" {{ $enabled ? 'checked' : '' }}> Enable Authentik Single Sign-On (SSO)
                            </label>
                            <p class="text-muted" style="font-size: 11px; margin-left: 20px; margin-bottom: 0; color: #8C8C8C;">
                                Displays the SSO button on the login screen and activates the OAuth2 callback endpoints.
                            </p>
                        </div>
                        <div class="checkbox" style="margin-top: 0; margin-bottom: 10px;">
                            <label style="color: #E5E5E5; font-weight: 600; font-size: 13px;">
                                <input type="checkbox" name="authentik:enforce" value="1" {{ $enforce ? 'checked' : '' }}> Enforce SSO Authentication
                            </label>
                            <p class="text-muted" style="font-size: 11px; margin-left: 20px; margin-bottom: 0; color: #8C8C8C;">
                                Recommends SSO by default. Password logins remain accessible for emergency administrative recovery.
                            </p>
                        </div>
                        <div class="checkbox" style="margin-top: 0; margin-bottom: 0;">
                            <label style="color: #E5E5E5; font-weight: 600; font-size: 13px;">
                                <input type="checkbox" name="authentik:auto_provision" value="1" {{ $autoProvision ? 'checked' : '' }}> Enable Just-In-Time (JIT) Account Auto-Provisioning
                            </label>
                            <p class="text-muted" style="font-size: 11px; margin-left: 20px; margin-bottom: 0; color: #8C8C8C;">
                                Automatically creates a panel user account when an authenticated Authentik user signs in for the first time.
                            </p>
                        </div>
                    </div>

                    <!-- Instance URL -->
                    <div class="form-group">
                        <label style="color: #E5E5E5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Authentik Instance URL</label>
                        <input type="url" name="authentik:url" class="form-control" value="{{ old('authentik:url', $url) }}" placeholder="https://auth.votioncloud.online" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;" required>
                        <p class="text-muted" style="font-size: 11px; margin-top: 4px; color: #8C8C8C;">
                            The base URL where your Authentik instance is hosted (e.g. <code>https://auth.votioncloud.online</code> or <code>https://authentik.yourdomain.com</code>).
                        </p>
                    </div>

                    <!-- Client ID & Client Secret -->
                    <div class="row">
                        <div class="col-md-6 col-xs-12">
                            <div class="form-group">
                                <label style="color: #E5E5E5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Client ID</label>
                                <input type="text" name="authentik:client_id" class="form-control" value="{{ old('authentik:client_id', $clientId) }}" placeholder="e.g. 4d7f8a9b0c1e2f3a" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5; font-family: monospace;" required>
                                <p class="text-muted" style="font-size: 11px; margin-top: 4px; color: #8C8C8C;">
                                    The OAuth2 Client ID generated in your Authentik Provider.
                                </p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xs-12">
                            <div class="form-group">
                                <label style="color: #E5E5E5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Client Secret</label>
                                <input type="password" name="authentik:client_secret" class="form-control" placeholder="{{ $hasClientSecret ? '*** CLIENT SECRET PRESERVED (Leave empty to keep) ***' : 'Paste OAuth2 Client Secret' }}" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5; font-family: monospace;">
                                <p class="text-muted" style="font-size: 11px; margin-top: 4px; color: #8C8C8C;">
                                    The confidential OAuth2 Client Secret. Stored encrypted in the panel database.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Redirect URI with Copy Button -->
                    <div class="form-group">
                        <label style="color: #E5E5E5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Redirect / Callback URI</label>
                        <div class="input-group">
                            <input type="text" id="redirectUriInput" class="form-control" value="{{ $redirectUri }}" readonly style="background: #111111; border-color: #2D2D2D; color: #00e699; font-family: monospace;">
                            <span class="input-group-btn">
                                <button class="btn btn-default" type="button" id="btnCopyRedirect" style="background: #222222; border-color: #2D2D2D; color: #E5E5E5;">
                                    <i class="fa fa-copy"></i> Copy
                                </button>
                            </span>
                        </div>
                        <p class="text-muted" style="font-size: 11px; margin-top: 4px; color: #8C8C8C;">
                            Copy this exact URL and paste it into your Authentik Provider's <strong>Redirect URIs/Origins</strong> list.
                        </p>
                    </div>

                    <hr style="border-top: 1px solid #1F1F1F; margin: 24px 0 20px 0;">

                    <!-- Branding & Role Mapping -->
                    <div class="row">
                        <div class="col-md-6 col-xs-12">
                            <div class="form-group">
                                <label style="color: #E5E5E5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Button Display Title</label>
                                <input type="text" name="authentik:title" class="form-control" value="{{ old('authentik:title', $title) }}" placeholder="Authentik" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                                <p class="text-muted" style="font-size: 11px; margin-top: 4px; color: #8C8C8C;">
                                    Label displayed on the login button (e.g. <code>Authentik</code> or <code>Votion ID</code>).
                                </p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xs-12">
                            <div class="form-group">
                                <label style="color: #E5E5E5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Admin Group Mapping</label>
                                <input type="text" name="authentik:admin_group" class="form-control" value="{{ old('authentik:admin_group', $adminGroup) }}" placeholder="e.g. authentik Admins or votion-admins" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                                <p class="text-muted" style="font-size: 11px; margin-top: 4px; color: #8C8C8C;">
                                    Users belonging to this Authentik group are automatically elevated to <strong>Root Administrator</strong>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="box-footer" style="background: #0A0A0A; border-top: 1px solid #1F1F1F; padding: 16px 20px; text-align: right;">
                    <button type="submit" class="btn btn-primary" style="background: #fd4b2d; border-color: #fd4b2d; font-weight: 600; padding: 8px 24px;">
                        <i class="fa fa-save" style="margin-right: 6px;"></i> Save Authentik Settings
                    </button>
                </div>
            </div>
        </form>
    </div>

    <!-- Instructions & Documentation Card -->
    <div class="col-md-4 col-xs-12">
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
            <div class="box-header with-border" style="border-bottom-color: #1F1F1F; padding: 16px 20px;">
                <h3 class="box-title" style="color: #FFFFFF; font-weight: 600; font-size: 15px;">
                    <i class="fa fa-book" style="color: #3b82f6; margin-right: 8px;"></i> Authentik Setup Guide
                </h3>
            </div>
            <div class="box-body" style="padding: 18px 20px; font-size: 12px; color: #A3A3A3; line-height: 1.6;">
                <div style="margin-bottom: 14px;">
                    <strong style="color: #FFFFFF; display: block; margin-bottom: 4px;">Step 1: Create OAuth2 Provider</strong>
                    In your Authentik Admin interface, navigate to <strong>Applications &rarr; Providers &rarr; Create</strong> and select <strong>OAuth2/OpenID Provider</strong>.
                </div>

                <div style="margin-bottom: 14px;">
                    <strong style="color: #FFFFFF; display: block; margin-bottom: 4px;">Step 2: Configure Provider</strong>
                    <ul style="padding-left: 18px; margin-bottom: 0;">
                        <li><strong>Client Type:</strong> Confidential</li>
                        <li><strong>Redirect URIs:</strong> Copy and paste the Redirect URI from this page.</li>
                        <li><strong>Signing Key:</strong> Choose an active RSA certificate/key.</li>
                        <li><strong>Scopes:</strong> Ensure <code>openid</code>, <code>profile</code>, and <code>email</code> are selected.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 14px;">
                    <strong style="color: #FFFFFF; display: block; margin-bottom: 4px;">Step 3: Create Application</strong>
                    Navigate to <strong>Applications &rarr; Applications &rarr; Create</strong>. Enter "Lunar Panel" or "Votion Panel", set the slug to <code>lunar-panel</code>, and assign the Provider created in Step 1.
                </div>

                <div style="margin-bottom: 0;">
                    <strong style="color: #FFFFFF; display: block; margin-bottom: 4px;">Step 4: Save & Test</strong>
                    Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from Authentik into the form on the left, save your settings, and use the <strong>Test IdP Reachability</strong> button to confirm everything is linked.
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

@section('footer-scripts')
    @parent
    <script>
        $(function () {
            // Copy Redirect URI Helper
            $('#btnCopyRedirect').on('click', function () {
                var input = document.getElementById('redirectUriInput');
                input.select();
                input.setSelectionRange(0, 99999);
                navigator.clipboard.writeText(input.value).then(function () {
                    var $btn = $('#btnCopyRedirect');
                    var origHtml = $btn.html();
                    $btn.html('<i class="fa fa-check" style="color: #10b981;"></i> Copied!');
                    setTimeout(function () {
                        $btn.html(origHtml);
                    }, 2000);
                });
            });

            // Test Connection AJAX
            $('#btnTestConnection').on('click', function () {
                var $btn = $(this);
                var $spinner = $('#testSpinner');
                var $badge = $('#authentikStatusBadge');
                var $feedback = $('#testFeedback');
                var $issuerText = $('#authentikIssuerText');

                $btn.prop('disabled', true);
                $spinner.addClass('fa-spin');
                $feedback.show().text('Connecting to Authentik...');

                $.ajax({
                    type: 'POST',
                    url: '{{ route('admin.authentik.test') }}',
                    data: {
                        _token: '{{ csrf_token() }}'
                    },
                    dataType: 'json',
                    success: function (data) {
                        $btn.prop('disabled', false);
                        $spinner.removeClass('fa-spin');

                        if (data.success) {
                            $badge.removeClass('label-warning label-danger label-default').addClass('label-success').text('ONLINE (' + data.latency_ms + 'ms)');
                            $issuerText.text(data.issuer || 'Connected');
                            $feedback.css('color', '#10b981').text('Connection verified successfully (' + data.latency_ms + 'ms).');
                        } else {
                            $badge.removeClass('label-success label-warning label-default').addClass('label-danger').text('ERROR');
                            $feedback.css('color', '#ef4444').text(data.error || 'Connection failed.');
                        }
                    },
                    error: function (xhr) {
                        $btn.prop('disabled', false);
                        $spinner.removeClass('fa-spin');
                        $badge.removeClass('label-success label-warning label-default').addClass('label-danger').text('ERROR');
                        var msg = xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Connection request failed.';
                        $feedback.css('color', '#ef4444').text(msg);
                    }
                });
            });
        });
    </script>
@endsection
