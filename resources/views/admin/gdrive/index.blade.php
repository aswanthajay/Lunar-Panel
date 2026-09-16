@extends('layouts.admin')

@section('title')
    Google Drive Cloud Backups
@endsection

@section('content-header')
    <h1>Google Drive Cloud Backups<small>Automated offsite disaster recovery and cloud snapshot mirroring.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Google Drive</li>
    </ol>
@endsection

@section('content')
@if($migrationMissing ?? false)
    <div class="row">
        <div class="col-xs-12">
            <div class="callout callout-warning" style="background: #18150a !important; border-left: 4px solid #F59E0B; color: #FDE68A; border-radius: 8px; margin-bottom: 20px; padding: 18px 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h4 style="color: #FBBF24; font-weight: 700; margin: 0 0 6px 0; font-size: 15px;">
                            <i class="fa fa-database" style="margin-right: 6px;"></i> Google Drive Database Table Pending Initialization
                        </h4>
                        <p style="margin-bottom: 8px; color: #D1D5DB; font-size: 13px;">
                            The <code>google_drive_backups</code> database table has not been initialized yet. Click the button to initialize it automatically, or execute the migration via your VPS terminal:
                        </p>
                        <code style="background: #000000; border: 1px solid #2D2D2D; color: #34D399; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; display: inline-block;">php artisan migrate --force</code>
                    </div>
                    <div>
                        <form action="{{ route('admin.gdrive.migrate') }}" method="POST" style="margin: 0;">
                            {!! csrf_field() !!}
                            <button type="submit" class="btn btn-warning" style="font-weight: 600; padding: 8px 16px;">
                                <i class="fa fa-play-circle" style="margin-right: 4px;"></i> Initialize Table Now
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endif
<div class="row">
    <!-- Top Telemetry Row -->
    <div class="col-xs-12">
        <div class="row">
            <!-- Connection Status Card -->
            <div class="col-md-4 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">API Connection</span>
                            <span id="gdriveStatusBadge" class="label {{ ($connectionInfo && ($connectionInfo['success'] ?? false)) ? 'label-success' : ($configured ? 'label-warning' : 'label-default') }}">
                                {{ ($connectionInfo && ($connectionInfo['success'] ?? false)) ? 'CONNECTED' : ($configured ? 'READY TO TEST' : 'NOT CONFIGURED') }}
                            </span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 8px;">
                            <span id="gdriveAccountName" style="font-size: 15px; font-weight: 600; color: #FFFFFF; font-family: monospace;" class="text-truncate">
                                {{ $connectionInfo['email'] ?? ($configured ? 'Credentials Stored' : 'No Account Connected') }}
                            </span>
                        </div>
                        <div style="margin-top: 12px; display: flex; gap: 8px;">
                            <button type="button" id="btnTestConnection" class="btn btn-xs btn-default" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                                <i class="fa fa-refresh" id="testSpinner"></i> Test Connection
                            </button>
                            <span id="testFeedback" style="font-size: 11px; color: #A3A3A3; display: none; align-self: center;"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Storage Quota Card -->
            <div class="col-md-4 col-sm-6 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Drive Storage Quota</span>
                            <span style="font-size: 11px; font-family: monospace; color: #A3A3A3;">
                                @if($connectionInfo && isset($connectionInfo['storage_limit']) && $connectionInfo['storage_limit'] > 0)
                                    {{ number_format(($connectionInfo['storage_usage'] / $connectionInfo['storage_limit']) * 100, 1) }}% Used
                                @else
                                    Unlimited / Enterprise
                                @endif
                            </span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 4px;">
                            <span id="quotaUsageText" style="font-size: 18px; font-weight: 700; color: #FFFFFF; font-family: monospace;">
                                @if($connectionInfo && isset($connectionInfo['storage_usage']))
                                    {{ round($connectionInfo['storage_usage'] / (1024 * 1024 * 1024), 2) }} GB
                                @else
                                    -- GB
                                @endif
                            </span>
                            <span style="font-size: 12px; color: #737373;">
                                @if($connectionInfo && isset($connectionInfo['storage_limit']) && $connectionInfo['storage_limit'] > 0)
                                    / {{ round($connectionInfo['storage_limit'] / (1024 * 1024 * 1024), 1) }} GB
                                @else
                                    / Allocated
                                @endif
                            </span>
                        </div>
                        <div class="progress progress-xs" style="margin-top: 10px; margin-bottom: 0; background: #1F1F1F;">
                            @php
                                $percent = ($connectionInfo && isset($connectionInfo['storage_limit']) && $connectionInfo['storage_limit'] > 0)
                                    ? min(100, ($connectionInfo['storage_usage'] / $connectionInfo['storage_limit']) * 100)
                                    : 0;
                            @endphp
                            <div class="progress-bar progress-bar-info" style="width: {{ $percent }}%;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Vault Automation Card -->
            <div class="col-md-4 col-sm-12 col-xs-12">
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                    <div class="box-body" style="padding: 16px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; font-weight: 600;">Automation & Policy</span>
                            <span class="label {{ $enabled ? ($autoSync ? 'label-success' : 'label-info') : 'label-danger' }}">
                                {{ $enabled ? ($autoSync ? 'AUTO-SYNC ACTIVE' : 'MANUAL ONLY') : 'DISABLED' }}
                            </span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 8px;">
                            <span style="font-size: 14px; color: #E5E5E5;">
                                Retention: <strong style="color: #FFFFFF;">{{ $retentionDays > 0 ? "$retentionDays Days" : "Never Prune" }}</strong>
                            </span>
                        </div>
                        <div style="margin-top: 12px; display: flex; gap: 8px;">
                            <form action="{{ route('admin.gdrive.prune') }}" method="POST" style="display: inline;">
                                {!! csrf_field() !!}
                                <button type="submit" class="btn btn-xs btn-default" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;" onclick="return confirm('Prune expired backups from Google Drive?');">
                                    <i class="fa fa-trash-o"></i> Run Retention Prune Now
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="row">
    <!-- Left: Settings & Credentials Form -->
    <div class="col-md-6 col-xs-12">
        <form action="{{ route('admin.gdrive.update') }}" method="POST" enctype="multipart/form-data">
            {!! csrf_field() !!}
            <div class="box box-primary" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
                <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F;">
                    <h3 class="box-title" style="color: #FFFFFF; font-size: 15px; font-weight: 600;">
                        <i class="fa fa-google" style="margin-right: 6px; color: #4285F4;"></i> Google Drive Configuration
                    </h3>
                </div>
                <div class="box-body" style="padding: 20px;">
                    <!-- Master Enable -->
                    <div class="form-group">
                        <label class="control-label" style="color: #E5E5E5;">Google Drive System Status</label>
                        <div>
                            <label class="radio-inline" style="color: #A3A3A3;">
                                <input type="checkbox" name="gdrive:enabled" value="1" {{ $enabled ? 'checked' : '' }}> Enable Google Drive Integration
                            </label>
                        </div>
                        <p class="text-muted small">Enable or disable Google Drive backup transfers across this entire panel.</p>
                    </div>

                    <!-- Auto Sync -->
                    <div class="form-group">
                        <label class="control-label" style="color: #E5E5E5;">Automated Background Sync</label>
                        <div>
                            <label class="radio-inline" style="color: #A3A3A3;">
                                <input type="checkbox" name="gdrive:auto_sync" value="1" {{ $autoSync ? 'checked' : '' }}> Auto-upload to Google Drive whenever any server backup completes
                            </label>
                        </div>
                        <p class="text-muted small">When checked, completed backups on all nodes will be automatically streamed to Google Drive in the background.</p>
                    </div>

                    <hr style="border-top: 1px solid #1F1F1F;">

                    <!-- Service Account Key (Recommended) -->
                    <div class="form-group">
                        <label class="control-label" style="color: #E5E5E5;">Google Service Account JSON Key <span class="label label-primary" style="font-size: 9px; margin-left: 4px;">RECOMMENDED</span></label>
                        <div style="margin-bottom: 8px;">
                            <input type="file" name="service_account_file" class="form-control" accept=".json" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                        </div>
                        <p class="text-muted small">Upload your Google Cloud Service Account <code>.json</code> key file (recommended), or paste JSON directly below.</p>
                        <textarea name="gdrive:service_account_json" rows="4" class="form-control" style="background: #141414; border-color: #2D2D2D; color: #A3A3A3; font-family: monospace; font-size: 11px;" placeholder='{ "type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..." }'>{{ $hasServiceAccount ? '*** PREVIOUSLY CONFIGURED SERVICE ACCOUNT KEY PRESERVED (Leave empty to keep, or paste new JSON to update) ***' : '' }}</textarea>
                    </div>

                    <!-- Target Folder ID -->
                    <div class="form-group">
                        <label class="control-label" style="color: #E5E5E5;">Target Google Drive Folder ID <span class="text-muted">(Optional)</span></label>
                        <input type="text" name="gdrive:folder_id" class="form-control" value="{{ old('gdrive:folder_id', $folderId) }}" placeholder="1aBcDeFgHiJkLmNoPqRsTuVwXyZ" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                        <p class="text-muted small">The ID of the shared folder in Google Drive (found in your browser URL <code>drive.google.com/drive/folders/<b>[FOLDER_ID]</b></code>). If left empty, Lunar Panel will automatically create a root folder named <code>Lunar Panel Backups</code>.</p>
                    </div>

                    <!-- Retention Policy -->
                    <div class="form-group">
                        <label class="control-label" style="color: #E5E5E5;">Retention Policy (Days)</label>
                        <input type="number" name="gdrive:retention_days" class="form-control" min="0" max="3650" value="{{ old('gdrive:retention_days', $retentionDays) }}" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                        <p class="text-muted small">Number of days to keep backups in Google Drive before automated pruning. Enter <code>0</code> to retain forever.</p>
                    </div>

                    <!-- Optional OAuth2 Accordion -->
                    <div class="box box-solid collapsed-box" style="background: #141414; border: 1px solid #1F1F1F; border-radius: 6px; margin-top: 15px;">
                        <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F;">
                            <h3 class="box-title" style="font-size: 12px; color: #A3A3A3;">Alternative: OAuth2 User Credentials</h3>
                            <div class="box-tools pull-right">
                                <button type="button" class="btn btn-box-tool" data-widget="collapse"><i class="fa fa-plus"></i></button>
                            </div>
                        </div>
                        <div class="box-body" style="display: none; padding: 12px;">
                            <div class="form-group">
                                <label class="control-label small" style="color: #A3A3A3;">Client ID</label>
                                <input type="text" name="gdrive:client_id" class="form-control input-sm" value="{{ $clientId }}" style="background: #0A0A0A; border-color: #2D2D2D; color: #E5E5E5;">
                            </div>
                            <div class="form-group">
                                <label class="control-label small" style="color: #A3A3A3;">Client Secret</label>
                                <input type="password" name="gdrive:client_secret" class="form-control input-sm" value="{{ $clientSecret }}" style="background: #0A0A0A; border-color: #2D2D2D; color: #E5E5E5;">
                            </div>
                            <div class="form-group">
                                <label class="control-label small" style="color: #A3A3A3;">Refresh Token</label>
                                <input type="text" name="gdrive:refresh_token" class="form-control input-sm" placeholder="{{ $hasRefreshToken ? '*** PRESERVED ***' : '' }}" style="background: #0A0A0A; border-color: #2D2D2D; color: #E5E5E5;">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="box-footer" style="background: #0F0F0F; border-top: 1px solid #1F1F1F; padding: 15px 20px;">
                    <button type="submit" class="btn btn-primary" style="font-weight: 600;">Save Configuration</button>
                </div>
            </div>
        </form>
    </div>

    <!-- Right: Quick Setup Guide -->
    <div class="col-md-6 col-xs-12">
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
            <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F;">
                <h3 class="box-title" style="color: #FFFFFF; font-size: 15px; font-weight: 600;">
                    <i class="fa fa-book" style="margin-right: 6px; color: #A3A3A3;"></i> Quick Setup Guide (3 Minutes)
                </h3>
            </div>
            <div class="box-body" style="padding: 20px; color: #CCCCCC; font-size: 13px; line-height: 1.6;">
                <ol style="padding-left: 18px; margin-bottom: 15px;">
                    <li style="margin-bottom: 8px;">
                        <strong>Create a Google Cloud Project</strong>: Go to <a href="https://console.cloud.google.com" target="_blank" style="color: #60A5FA;">Google Cloud Console</a>, create or select a project.
                    </li>
                    <li style="margin-bottom: 8px;">
                        <strong>Enable Google Drive API</strong>: Navigate to <em>APIs & Services &rarr; Library</em>, search for <code>Google Drive API</code>, and click <strong>Enable</strong>.
                    </li>
                    <li style="margin-bottom: 8px;">
                        <strong>Create a Service Account</strong>: Navigate to <em>APIs & Services &rarr; Credentials &rarr; Create Credentials &rarr; Service Account</em>. Name it <code>lunar-backups</code>.
                    </li>
                    <li style="margin-bottom: 8px;">
                        <strong>Download JSON Key</strong>: Click on the newly created Service Account &rarr; <em>Keys tab &rarr; Add Key &rarr; Create new key &rarr; JSON</em>. A <code>.json</code> file will download.
                    </li>
                    <li style="margin-bottom: 8px;">
                        <strong>Share your Drive Folder</strong>: In Google Drive, create a folder (e.g. <code>Game Server Backups</code>), right-click &rarr; <em>Share</em>, and paste the <strong>Service Account Email</strong> (e.g. <code>lunar-backups@project.iam.gserviceaccount.com</code>) with role <strong>Editor</strong>.
                    </li>
                    <li>
                        <strong>Upload & Save</strong>: Upload the downloaded <code>.json</code> file in the form on the left, check <em>Enable</em>, and click <strong>Save Configuration</strong>. Click <em>Test Connection</em> to confirm!
                    </li>
                </ol>

                <div class="callout callout-info" style="background: #141414 !important; border-left-color: #3B82F6; color: #D1D5DB; margin-bottom: 0;">
                    <h5 style="color: #60A5FA; font-weight: 600; margin-top: 0;">Zero-RAM Streaming Resumable Uploads</h5>
                    <p class="small" style="margin-bottom: 0;">Backups of any size (from 100 MB to 100+ GB) are streamed directly from server node endpoints using Google's resumable chunk protocol, guaranteeing high transfer speeds without saturating your panel's memory.</p>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Synced Fleet Backups Table -->
<div class="row">
    <div class="col-xs-12">
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px;">
            <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F; display: flex; align-items: center; justify-content: space-between;">
                <h3 class="box-title" style="color: #FFFFFF; font-size: 15px; font-weight: 600;">
                    <i class="fa fa-cloud" style="margin-right: 6px; color: #3B82F6;"></i> Google Drive Synced Fleet Backups
                </h3>
                <span class="label label-default" style="font-family: monospace;">{{ $backups->total() }} Synced Backups</span>
            </div>
            <div class="box-body table-responsive no-padding">
                <table class="table table-hover" style="color: #D1D5DB;">
                    <thead>
                        <tr style="border-bottom: 1px solid #1F1F1F; color: #737373; font-size: 11px; text-transform: uppercase;">
                            <th>Server</th>
                            <th>Archive Name</th>
                            <th>Size</th>
                            <th>Status</th>
                            <th>Synced At</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($backups as $gbackup)
                            <tr style="border-bottom: 1px solid #141414;">
                                <td>
                                    @if($gbackup->server)
                                        <a href="{{ route('admin.servers.view', $gbackup->server->id) }}" style="color: #60A5FA; font-weight: 600;">
                                            {{ $gbackup->server->name }}
                                        </a>
                                        <div class="text-muted small" style="font-family: monospace;">{{ $gbackup->server->uuidShort }}</div>
                                    @else
                                        <span class="text-muted">Deleted Server</span>
                                    @endif
                                </td>
                                <td>
                                    <span style="font-family: monospace; color: #FFFFFF;">{{ $gbackup->file_name }}</span>
                                    @if($gbackup->backup)
                                        <div class="text-muted small">{{ $gbackup->backup->name }}</div>
                                    @endif
                                </td>
                                <td style="font-family: monospace;">
                                    {{ round($gbackup->file_size / (1024 * 1024), 2) }} MB
                                </td>
                                <td>
                                    @if($gbackup->status === 'completed')
                                        <span class="label label-success" style="font-size: 10px;">SYNCED</span>
                                    @elseif($gbackup->status === 'syncing')
                                        <span class="label label-info" style="font-size: 10px;"><i class="fa fa-refresh fa-spin"></i> SYNCING</span>
                                    @else
                                        <span class="label label-danger" style="font-size: 10px;" title="{{ $gbackup->error_message }}">FAILED</span>
                                    @endif
                                </td>
                                <td class="text-muted small">
                                    {{ $gbackup->synced_at ? $gbackup->synced_at->toDayDateTimeString() : $gbackup->created_at->toDayDateTimeString() }}
                                </td>
                                <td class="text-right">
                                    @if($gbackup->web_view_link)
                                        <a href="{{ $gbackup->web_view_link }}" target="_blank" class="btn btn-xs btn-default" style="background: #141414; border-color: #2D2D2D; color: #60A5FA;" title="Open in Google Drive">
                                            <i class="fa fa-external-link"></i> View in Drive
                                        </a>
                                    @endif
                                    <form action="{{ route('admin.gdrive.delete', $gbackup->id) }}" method="POST" style="display: inline;" onsubmit="return confirm('Delete this backup from Google Drive?');">
                                        {!! csrf_field() !!}
                                        {!! method_field('DELETE') !!}
                                        <button type="submit" class="btn btn-xs btn-danger" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #F87171;" title="Delete from Google Drive">
                                            <i class="fa fa-trash"></i>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="text-center text-muted" style="padding: 40px 0;">
                                    <i class="fa fa-cloud-upload fa-3x" style="color: #262626; margin-bottom: 12px; display: block;"></i>
                                    No backups synced to Google Drive yet.<br>
                                    <span class="small">Configure your credentials above and turn on Auto-Sync to mirror snapshots automatically.</span>
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            @if($backups->hasPages())
                <div class="box-footer" style="background: #0A0A0A; border-top: 1px solid #1F1F1F;">
                    <div class="col-md-12 text-center">{!! $backups->render() !!}</div>
                </div>
            @endif
        </div>
    </div>
</div>
@endsection

@section('footer-scripts')
    @parent
    <script>
        $(document).ready(function () {
            $('#btnTestConnection').on('click', function () {
                var $btn = $(this);
                var $spinner = $('#testSpinner');
                var $feedback = $('#testFeedback');
                var $badge = $('#gdriveStatusBadge');
                var $accountName = $('#gdriveAccountName');
                var $quotaText = $('#quotaUsageText');

                $btn.prop('disabled', true);
                $spinner.addClass('fa-spin');
                $feedback.show().text('Testing Google Drive API...').css('color', '#A3A3A3');

                $.ajax({
                    url: '{{ route('admin.gdrive.test') }}',
                    type: 'POST',
                    headers: { 'X-CSRF-TOKEN': '{{ csrf_token() }}' },
                    dataType: 'json',
                    success: function (data) {
                        $btn.prop('disabled', false);
                        $spinner.removeClass('fa-spin');
                        $badge.removeClass('label-default label-warning label-danger').addClass('label-success').text('CONNECTED');
                        $accountName.text(data.email || 'Service Account Connected');
                        if (data.storage_usage !== undefined) {
                            var usedGB = (data.storage_usage / (1024 * 1024 * 1024)).toFixed(2);
                            $quotaText.text(usedGB + ' GB');
                        }
                        $feedback.text('Connection verified successfully!').css('color', '#34D399');
                    },
                    error: function (xhr) {
                        $btn.prop('disabled', false);
                        $spinner.removeClass('fa-spin');
                        $badge.removeClass('label-default label-success label-warning').addClass('label-danger').text('ERROR');
                        var errorMsg = (xhr.responseJSON && xhr.responseJSON.error) ? xhr.responseJSON.error : 'Connection failed';
                        $feedback.text(errorMsg).css('color', '#F87171');
                    }
                });
            });
        });
    </script>
@endsection
