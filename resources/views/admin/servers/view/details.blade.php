@extends('layouts.admin')

@section('title')
    Server — {{ $server->name }}: Details
@endsection

@section('content-header')
    <h1>{{ $server->name }}<small>Edit details for this server including owner and container.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.servers') }}">Servers</a></li>
        <li><a href="{{ route('admin.servers.view', $server->id) }}">{{ $server->name }}</a></li>
        <li class="active">Details</li>
    </ol>
@endsection

@section('content')
@include('admin.servers.partials.navigation')
<div class="row">
    <div class="col-xs-12">
        <div class="box box-primary">
            <div class="box-header with-border">
                <h3 class="box-title">Base Information</h3>
            </div>
            <form action="{{ route('admin.servers.view.details', $server->id) }}" method="POST">
                <div class="box-body">
                    <div class="form-group">
                        <label for="name" class="control-label">Server Name <span class="field-required"></span></label>
                        <input type="text" name="name" value="{{ old('name', $server->name) }}" class="form-control" />
                        <p class="text-muted small">Character limits: <code>a-zA-Z0-9_-</code> and <code>[Space]</code>.</p>
                    </div>
                    <div class="form-group">
                        <label for="external_id" class="control-label">External Identifier</label>
                        <input type="text" name="external_id" value="{{ old('external_id', $server->external_id) }}" class="form-control" />
                        <p class="text-muted small">Leave empty to not assign an external identifier for this server. The external ID should be unique to this server and not be in use by any other servers.</p>
                    </div>
                    <div class="form-group">
                        <label for="pUserId" class="control-label">Server Owner <span class="field-required"></span></label>
                        <select name="owner_id" class="form-control" id="pUserId">
                            <option value="{{ $server->owner_id }}" selected>{{ $server->user->email }}</option>
                        </select>
                        <p class="text-muted small">You can change the owner of this server by changing this field to an email matching another use on this system. If you do this a new daemon security token will be generated automatically.</p>
                    </div>
                    <div class="form-group">
                        <label for="description" class="control-label">Server Description</label>
                        <textarea name="description" rows="3" class="form-control">{{ old('description', $server->description) }}</textarea>
                        <p class="text-muted small">A brief description of this server.</p>
                    </div>
                    <div class="form-group">
                        <label for="pGameType" class="control-label"><i class="fa fa-gamepad"></i> Game Server Type</label>
                        <select id="pGameType" name="game_type" class="form-control">
                            <option value="auto" {{ old('game_type', $server->game_type ?? 'auto') === 'auto' ? 'selected' : '' }}>Automatic (Auto-detect from Nest / Egg)</option>
                            <option value="mc" {{ old('game_type', $server->game_type) === 'mc' ? 'selected' : '' }}>Minecraft (Java & Bedrock)</option>
                            <option value="fivem" {{ old('game_type', $server->game_type) === 'fivem' ? 'selected' : '' }}>FiveM (Grand Theft Auto V)</option>
                            <option value="samp" {{ old('game_type', $server->game_type) === 'samp' ? 'selected' : '' }}>SA-MP (San Andreas Multiplayer)</option>
                            <option value="other" {{ old('game_type', $server->game_type) === 'other' ? 'selected' : '' }}>Other / Generic Game Server</option>
                        </select>
                        <p class="text-muted small">Choose the game server type. Selecting <strong>Minecraft</strong> unlocks Minecraft-specific client panel tools: Plugins & Mod Manager, Bedrock Addons, Player Manager, and World Manager. (Currently active: <code>{{ $server->isMinecraft() ? 'Minecraft' : ($server->game_type ?? 'Generic') }}</code>)</p>
                    </div>
                    <div class="form-group">
                        <label for="pExpiresAt" class="control-label">
                            <i class="fa fa-clock-o text-yellow"></i> Server Expiry Date
                        </label>
                        <div class="row">
                            <div class="col-sm-6">
                                <div class="input-group">
                                    <span class="input-group-addon"><i class="fa fa-calendar"></i></span>
                                    <input type="date" class="form-control" id="pExpiresAt" name="expires_at" value="{{ old('expires_at', optional($server->expires_at)->format('Y-m-d')) }}">
                                </div>
                                <div style="margin-top: 6px;">
                                    <label for="pExpiresAtManual" class="small text-muted" style="font-weight: normal;">
                                        <i class="fa fa-mobile"></i> Phone / Manual Date Input (<code>YYYY-MM-DD</code>):
                                    </label>
                                    <input type="text" class="form-control input-sm" id="pExpiresAtManual" placeholder="YYYY-MM-DD" pattern="\d{4}-\d{2}-\d{2}" value="{{ old('expires_at', optional($server->expires_at)->format('Y-m-d')) }}">
                                </div>
                            </div>
                            <div class="col-sm-6">
                                <label class="small text-muted">Quick Presets / Extension:</label>
                                <div class="btn-group btn-group-justified" role="group" style="display: flex; gap: 4px; margin-top: 4px;">
                                    <a href="javascript:void(0)" class="btn btn-default btn-xs set-expiry-btn" data-days="7" style="flex: 1 1 auto; border-radius: 4px;">+7d</a>
                                    <a href="javascript:void(0)" class="btn btn-default btn-xs set-expiry-btn" data-days="30" style="flex: 1 1 auto; border-radius: 4px;">+30d</a>
                                    <a href="javascript:void(0)" class="btn btn-default btn-xs set-expiry-btn" data-days="90" style="flex: 1 1 auto; border-radius: 4px;">+90d</a>
                                    <a href="javascript:void(0)" class="btn btn-default btn-xs set-expiry-btn" data-days="365" style="flex: 1 1 auto; border-radius: 4px;">+1y</a>
                                    <a href="javascript:void(0)" class="btn btn-success btn-xs set-expiry-btn" data-days="0" style="flex: 1.4 1 auto; border-radius: 4px;"><i class="fa fa-infinity"></i> Never (No Expiry)</a>
                                </div>
                                <div id="expiryNoticeBadge" class="alert alert-info" style="display:none; padding:6px 10px; margin-top:6px; margin-bottom:0; font-size:11px;">
                                    <i class="fa fa-shield"></i> <span id="expiryNoticeText"></span>
                                </div>
                            </div>
                        </div>
                        <p class="text-muted small" style="margin-top: 6px;">
                            When this date passes, the server is automatically marked and suspended. Click <strong>Never</strong> or clear this field to make the server permanent (never expires).
                        </p>
                    </div>

                    <div class="form-group">
                        <label for="pBillingAmount" class="control-label">Renewal Amount (INR ₹)</label>
                        <div class="input-group">
                            <span class="input-group-addon" style="font-weight:bold;">₹</span>
                            <input type="number" class="form-control" id="pBillingAmount" name="billing_amount" value="{{ old('billing_amount', $server->billing_amount) }}" placeholder="e.g. 899" min="0" step="1">
                            <span class="input-group-addon">INR</span>
                        </div>
                        <p class="text-muted small">The recurring renewal price in INR that the client will see in their billing section.</p>
                    </div>
                </div>
                <div class="box-footer">
                    {!! csrf_field() !!}
                    {!! method_field('PATCH') !!}
                    <input type="submit" class="btn btn-sm btn-primary" value="Update Details" />
                </div>
            </form>
        </div>
    </div>
</div>
@endsection

@section('footer-scripts')
    @parent
    <script>
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    $('#pUserId').select2({
        ajax: {
            url: '/admin/users/accounts.json',
            dataType: 'json',
            delay: 250,
            data: function (params) {
                return {
                    filter: { email: params.term },
                    page: params.page,
                };
            },
            processResults: function (data, params) {
                return { results: data };
            },
            cache: true,
        },
        escapeMarkup: function (markup) { return markup; },
        minimumInputLength: 2,
        templateResult: function (data) {
            if (data.loading) return escapeHtml(data.text);

            return '<div class="user-block"> \
                <img class="img-circle img-bordered-xs" src="https://www.gravatar.com/avatar/' + escapeHtml(data.md5) + '?s=120" alt="User Image"> \
                <span class="username"> \
                    <a href="#">' + escapeHtml(data.name_first) + ' ' + escapeHtml(data.name_last) +'</a> \
                </span> \
                <span class="description"><strong>' + escapeHtml(data.email) + '</strong> - ' + escapeHtml(data.username) + '</span> \
            </div>';
        },
        templateSelection: function (data) {
            if (typeof data.name_first === 'undefined') {
                data = {
                    md5: '{{ md5(strtolower($server->user->email)) }}',
                    name_first: '{{ $server->user->name_first }}',
                    name_last: '{{ $server->user->name_last }}',
                    email: '{{ $server->user->email }}',
                    id: {{ $server->owner_id }}
                };
            }

            return '<div> \
                <span> \
                    <img class="img-rounded img-bordered-xs" src="https://www.gravatar.com/avatar/' + escapeHtml(data.md5) + '?s=120" style="height:28px;margin-top:-4px;" alt="User Image"> \
                </span> \
                <span style="padding-left:5px;"> \
                    ' + escapeHtml(data.name_first) + ' ' + escapeHtml(data.name_last) + ' (<strong>' + escapeHtml(data.email) + '</strong>) \
                </span> \
            </div>';
        }
    });

    // Expiry Date Synchronizer (Calendar on PC, Manual format on Phone)
    function updateExpiryNotice(val) {
        if (!val) {
            $('#expiryNoticeText').html('<strong>Never Expires:</strong> Server is permanent and will not be automatically suspended.');
            $('#expiryNoticeBadge').removeClass('alert-danger alert-info').addClass('alert-success').show();
            return;
        }
        var target = new Date(val + 'T00:00:00');
        var today = new Date();
        today.setHours(0,0,0,0);
        var diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
        var dateStr = target.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        if (diffDays > 0) {
            $('#expiryNoticeText').text('Server will automatically suspend on ' + dateStr + ' (in ' + diffDays + ' days).');
            $('#expiryNoticeBadge').removeClass('alert-danger alert-success').addClass('alert-info').show();
        } else if (diffDays === 0) {
            $('#expiryNoticeText').text('Server expires today on ' + dateStr + '!');
            $('#expiryNoticeBadge').removeClass('alert-info alert-success').addClass('alert-danger').show();
        } else {
            $('#expiryNoticeText').text('Server expired ' + Math.abs(diffDays) + ' days ago (' + dateStr + ').');
            $('#expiryNoticeBadge').removeClass('alert-info alert-success').addClass('alert-danger').show();
        }
    }

    $('#pExpiresAt').on('change input', function() {
        var val = $(this).val();
        $('#pExpiresAtManual').val(val);
        updateExpiryNotice(val);
    });

    $('#pExpiresAtManual').on('input change', function() {
        var val = $(this).val().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            $('#pExpiresAt').val(val);
            updateExpiryNotice(val);
        } else if (!val) {
            $('#pExpiresAt').val('');
            updateExpiryNotice('');
        }
    });

    $('.set-expiry-btn').on('click', function() {
        var days = parseInt($(this).data('days'), 10);
        if (days === 0) {
            $('#pExpiresAt').val('');
            $('#pExpiresAtManual').val('');
            updateExpiryNotice('');
        } else {
            var currentVal = $('#pExpiresAt').val();
            var baseDate = (currentVal && /^\d{4}-\d{2}-\d{2}$/.test(currentVal)) ? new Date(currentVal + 'T00:00:00') : new Date();
            // If current date is in past, base from today
            if (baseDate < new Date()) {
                baseDate = new Date();
            }
            baseDate.setDate(baseDate.getDate() + days);
            var yyyy = baseDate.getFullYear();
            var mm = String(baseDate.getMonth() + 1).padStart(2, '0');
            var dd = String(baseDate.getDate()).padStart(2, '0');
            var dateStr = yyyy + '-' + mm + '-' + dd;
            $('#pExpiresAt').val(dateStr);
            $('#pExpiresAtManual').val(dateStr);
            updateExpiryNotice(dateStr);
        }
    });

    updateExpiryNotice($('#pExpiresAt').val());
    </script>
@endsection
