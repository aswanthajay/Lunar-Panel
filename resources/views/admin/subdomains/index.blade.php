@extends('layouts.admin')

@section('title')
    Subdomain Manager
@endsection

@section('content-header')
    <h1>Subdomain Manager<small>Manage Cloudflare API accounts and root domains for automated server subdomains.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Subdomains</li>
    </ol>
@endsection

@section('content')
<style>
.sd-metric-card {
    background: #0A0A0A;
    border: 1px solid #1F1F1F;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 20px;
    transition: border-color 0.2s;
}
.sd-metric-card:hover {
    border-color: #333333;
}
.sd-metric-num {
    font-size: 26px;
    font-weight: 700;
    color: #FFFFFF;
    font-family: var(--font-display, inherit);
    line-height: 1.1;
}
.sd-metric-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888888;
    margin-top: 4px;
}
.sd-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
}
.sd-badge-active {
    background: rgba(34, 197, 94, 0.12);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.25);
}
.sd-badge-inactive {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.25);
}
.sd-badge-neutral {
    background: rgba(255, 255, 255, 0.06);
    color: #D1D5DB;
    border: 1px solid rgba(255, 255, 255, 0.1);
}
.sd-toggle-form {
    display: inline-block;
    margin: 0;
}
</style>

{{-- Bento Metric Overview --}}
<div class="row">
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="sd-metric-card">
            <div class="sd-metric-num">{{ $totalSubdomains }}</div>
            <div class="sd-metric-label">Active Subdomains</div>
        </div>
    </div>
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="sd-metric-card">
            <div class="sd-metric-num">{{ $domains->count() }}</div>
            <div class="sd-metric-label">Configured Domains ({{ $enabledDomainsCount }} Active)</div>
        </div>
    </div>
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="sd-metric-card">
            <div class="sd-metric-num">{{ $accounts->count() }}</div>
            <div class="sd-metric-label">Cloudflare Accounts</div>
        </div>
    </div>
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="sd-metric-card">
            <div class="sd-metric-num" style="color: #4ade80;">Operational</div>
            <div class="sd-metric-label">Cloudflare Edge DNS</div>
        </div>
    </div>
</div>

<div class="row">
    {{-- Section 1: Domains --}}
    <div class="col-xs-12">
        <div class="box box-primary">
            <div class="box-header with-border" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="box-title">Available Root Domains</h3>
                <div class="box-tools">
                    @if ($accounts->isEmpty())
                        <button class="btn btn-sm btn-default" disabled title="Add a Cloudflare account first"><i class="fa fa-plus"></i> Add Domain</button>
                    @else
                        <button class="btn btn-sm btn-primary" data-toggle="modal" data-target="#newDomainModal"><i class="fa fa-plus"></i> Add Domain</button>
                    @endif
                </div>
            </div>
            <div class="box-body table-responsive no-padding">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Cloudflare Account</th>
                            <th>Zone ID</th>
                            <th>Protocol</th>
                            <th class="text-center">Status</th>
                            <th class="text-center">Subdomains</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($domains as $domain)
                            <tr>
                                <td>
                                    <strong style="color: #FFFFFF; font-size: 13px;">{{ $domain->domain }}</strong>
                                </td>
                                <td>
                                    @if ($domain->account)
                                        <span class="sd-badge sd-badge-neutral">{{ $domain->account->name }}</span>
                                    @else
                                        <span class="label label-danger">Missing Account</span>
                                    @endif
                                </td>
                                <td><code>{{ substr($domain->zone_id, 0, 8) }}...{{ substr($domain->zone_id, -6) }}</code></td>
                                <td>
                                    @if ($domain->protocol === 'both')
                                        <span class="sd-badge sd-badge-neutral">SRV + A Record</span>
                                    @elseif ($domain->protocol === 'srv_only')
                                        <span class="sd-badge sd-badge-neutral">SRV Record Only</span>
                                    @else
                                        <span class="sd-badge sd-badge-neutral">A Record Only</span>
                                    @endif
                                </td>
                                <td class="text-center">
                                    <form action="{{ route('admin.subdomains.domains.toggle', $domain->id) }}" method="POST" class="sd-toggle-form">
                                        @csrf
                                        <button type="submit" class="btn btn-xs {{ $domain->is_enabled ? 'btn-success' : 'btn-default' }}" title="Click to toggle Enabled / Disabled">
                                            @if ($domain->is_enabled)
                                                <i class="fa fa-check-circle"></i> Enabled
                                            @else
                                                <i class="fa fa-ban"></i> Disabled
                                            @endif
                                        </button>
                                    </form>
                                </td>
                                <td class="text-center">
                                    <span class="badge bg-gray">{{ $domain->subdomains_count }}</span>
                                </td>
                                <td class="text-right">
                                    <form action="{{ route('admin.subdomains.domains.delete', $domain->id) }}" method="POST" onsubmit="return confirm('Are you sure you want to delete {{ $domain->domain }}? All {{ $domain->subdomains_count }} subdomains attached to this domain will also be deleted from Cloudflare.');" style="display: inline-block;">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="btn btn-xs btn-danger"><i class="fa fa-trash"></i> Delete</button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="text-center text-muted" style="padding: 28px 10px;">
                                    No root domains configured yet. Add your first domain to let server owners create custom subdomains.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<div class="row">
    {{-- Section 2: Cloudflare Accounts --}}
    <div class="col-xs-12">
        <div class="box box-info">
            <div class="box-header with-border" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="box-title">Cloudflare API Accounts</h3>
                <div class="box-tools">
                    <button class="btn btn-sm btn-info" data-toggle="modal" data-target="#newAccountModal"><i class="fa fa-plus"></i> Add Cloudflare Account</button>
                </div>
            </div>
            <div class="box-body table-responsive no-padding">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Account Name</th>
                            <th>Auth Type</th>
                            <th>Email / Identity</th>
                            <th class="text-center">Managed Domains</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($accounts as $account)
                            <tr>
                                <td>
                                    <strong style="color: #FFFFFF;">{{ $account->name }}</strong>
                                </td>
                                <td>
                                    @if ($account->auth_type === 'token')
                                        <span class="sd-badge sd-badge-active"><i class="fa fa-key"></i> API Token</span>
                                    @else
                                        <span class="sd-badge sd-badge-neutral"><i class="fa fa-lock"></i> Global API Key</span>
                                    @endif
                                </td>
                                <td>
                                    @if ($account->auth_type === 'key')
                                        <code>{{ $account->api_email }}</code>
                                    @else
                                        <span class="text-muted">Scoped API Token (Cloudflare User)</span>
                                    @endif
                                </td>
                                <td class="text-center">
                                    <span class="badge bg-blue">{{ $account->domains_count }}</span>
                                </td>
                                <td class="text-right">
                                    <form action="{{ route('admin.subdomains.accounts.delete', $account->id) }}" method="POST" onsubmit="return confirm('Deleting this Cloudflare account will also remove all {{ $account->domains_count }} domains associated with it.');" style="display: inline-block;">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="btn btn-xs btn-danger"><i class="fa fa-trash"></i> Delete</button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="text-center text-muted" style="padding: 28px 10px;">
                                    No Cloudflare accounts linked yet. Add a Cloudflare API Token or Global API Key to get started.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

{{-- Modal: Create Cloudflare Account --}}
<div class="modal fade" id="newAccountModal" tabindex="-1" role="dialog">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <form action="{{ route('admin.subdomains.accounts.store') }}" method="POST">
                @csrf
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 class="modal-title">Add Cloudflare API Account</h4>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="accName" class="form-label">Friendly Account Name</label>
                        <input type="text" name="name" id="accName" class="form-control" placeholder="e.g. Stellar Production Cloudflare" required>
                    </div>

                    <div class="form-group">
                        <label for="accAuthType" class="form-label">Authentication Method</label>
                        <select name="auth_type" id="accAuthType" class="form-control" required onchange="toggleAuthFields(this.value)">
                            <option value="token" selected>API Token (Recommended · Scoped permissions)</option>
                            <option value="key">Global API Key (Email + Key)</option>
                        </select>
                        <p class="text-muted small" style="margin-top: 5px;">
                            For API Tokens, create a token on Cloudflare with <code>Zone.DNS:Edit</code> and <code>Zone.Zone:Read</code> permissions.
                        </p>
                    </div>

                    <div id="tokenAuthSection" class="form-group">
                        <label for="accToken" class="form-label">API Token</label>
                        <input type="password" name="api_token" id="accToken" class="form-control" placeholder="Paste your Cloudflare API Token">
                    </div>

                    <div id="keyAuthSection" style="display: none;">
                        <div class="form-group">
                            <label for="accEmail" class="form-label">Cloudflare Account Email</label>
                            <input type="email" name="api_email" id="accEmail" class="form-control" placeholder="admin@example.com">
                        </div>
                        <div class="form-group">
                            <label for="accKey" class="form-label">Global API Key</label>
                            <input type="password" name="api_key" id="accKey" class="form-control" placeholder="Cloudflare Global API Key">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-info">Verify & Add Account</button>
                </div>
            </form>
        </div>
    </div>
</div>

{{-- Modal: Create Root Domain --}}
<div class="modal fade" id="newDomainModal" tabindex="-1" role="dialog">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <form action="{{ route('admin.subdomains.domains.store') }}" method="POST">
                @csrf
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 class="modal-title">Register Root Domain</h4>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="dAccount" class="form-label">Cloudflare Account</label>
                        <select name="cloudflare_account_id" id="dAccount" class="form-control" required>
                            @foreach ($accounts as $account)
                                <option value="{{ $account->id }}">{{ $account->name }} ({{ $account->auth_type === 'token' ? 'API Token' : $account->api_email }})</option>
                            @endforeach
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="dDomain" class="form-label">Domain Name</label>
                        <input type="text" name="domain" id="dDomain" class="form-control" placeholder="stellarhost.gg" required>
                        <p class="text-muted small" style="margin-top: 4px;">The apex/root domain configured in Cloudflare (without subdomains or http://).</p>
                    </div>

                    <div class="form-group">
                        <label for="dZoneId" class="form-label">Cloudflare Zone ID</label>
                        <input type="text" name="zone_id" id="dZoneId" class="form-control" placeholder="e.g. 023e105f4ecef8ad9ca31a8372d0c353" required>
                        <p class="text-muted small" style="margin-top: 4px;">Found on the Overview page of your domain in the Cloudflare dashboard (under API section on the right).</p>
                    </div>

                    <div class="form-group">
                        <label for="dProtocol" class="form-label">Record Protocol Policy</label>
                        <select name="protocol" id="dProtocol" class="form-control" required>
                            <option value="both" selected>SRV + A Record (Recommended for Minecraft & Games)</option>
                            <option value="srv_only">SRV Record Only (Only for SRV-supporting game clients)</option>
                            <option value="a_only">A Record Only (Points directly to Allocation IP)</option>
                        </select>
                        <p class="text-muted small" style="margin-top: 4px;">
                            "SRV + A Record" creates an A record pointing to the server node and an SRV record containing the allocation port, allowing players to join without typing ports.
                        </p>
                    </div>

                    <div class="form-group">
                        <div class="checkbox">
                            <label>
                                <input type="checkbox" name="is_enabled" value="1" checked> Enable domain immediately for client subdomain creation
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Domain</button>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
function toggleAuthFields(type) {
    var tokenSection = document.getElementById('tokenAuthSection');
    var keySection = document.getElementById('keyAuthSection');
    if (type === 'key') {
        tokenSection.style.display = 'none';
        keySection.style.display = 'block';
    } else {
        tokenSection.style.display = 'block';
        keySection.style.display = 'none';
    }
}
</script>
@endsection
