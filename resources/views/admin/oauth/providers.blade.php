@extends('layouts.admin')

@section('title')
    Inbound OAuth 2.0 & Social Login
@endsection

@section('content-header')
    <h1>OAuth 2.0 & Social Sign-On<small>Enable 1-click authentication via Discord, Google, GitHub, Authentik, and Custom OIDC.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">OAuth Providers</li>
    </ol>
@endsection

@section('content')
<div class="row">
    @foreach($providers as $key => $p)
        <div class="col-md-6 col-xs-12">
            <form action="{{ route('admin.oauth.providers.update', $key) }}" method="POST">
                {!! csrf_field() !!}
                <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px; margin-bottom: 24px;">
                    <div class="box-header with-border" style="border-bottom: 1px solid #1F1F1F; display: flex; align-items: center; justify-content: space-between; padding: 16px 20px;">
                        <h3 class="box-title" style="color: #FFFFFF; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                            <i class="fa {{ $p['icon'] }}" style="color: {{ $p['color'] }};"></i>
                            {{ $p['name'] }}
                        </h3>
                        <span class="label {{ $p['enabled'] ? 'label-success' : 'label-default' }}" style="font-size: 10px;">
                            {{ $p['enabled'] ? 'ENABLED' : 'DISABLED' }}
                        </span>
                    </div>

                    <div class="box-body" style="padding: 20px;">
                        <!-- Master Enable -->
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="radio-inline" style="color: #E5E5E5; font-weight: 600;">
                                <input type="checkbox" name="enabled" value="1" {{ $p['enabled'] ? 'checked' : '' }}> Enable {{ $p['name'] }} Login
                            </label>
                            <p class="text-muted small" style="margin-top: 4px;">Displays a sleek 1-click sign-in button on the client login screen.</p>
                        </div>

                        <!-- Callback URL (Pre-calculated with copy button) -->
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="control-label small" style="color: #A3A3A3;">Authorized Redirect URI (Copy to {{ $p['name'] }} Console)</label>
                            <div class="input-group">
                                <input type="text" readonly value="{{ $p['redirect_uri'] }}" class="form-control input-sm" style="background: #141414; border-color: #2D2D2D; color: #34D399; font-family: monospace; font-size: 11px;">
                                <span class="input-group-btn">
                                    <button type="button" class="btn btn-sm btn-default" onclick="navigator.clipboard.writeText('{{ $p['redirect_uri'] }}'); alert('Redirect URI copied!');" style="background: #1F1F1F; border-color: #2D2D2D; color: #E5E5E5;">
                                        <i class="fa fa-copy"></i>
                                    </button>
                                </span>
                            </div>
                        </div>

                        <!-- Client ID -->
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="control-label small" style="color: #A3A3A3;">Client ID / App ID</label>
                            <input type="text" name="client_id" value="{{ $p['client_id'] }}" class="form-control input-sm" placeholder="Enter Client ID" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                        </div>

                        <!-- Client Secret -->
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="control-label small" style="color: #A3A3A3;">Client Secret</label>
                            <input type="password" name="client_secret" placeholder="{{ $p['has_secret'] ? '*** PREVIOUSLY CONFIGURED (Leave empty to keep) ***' : 'Enter Client Secret' }}" class="form-control input-sm" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                        </div>

                        <!-- Scopes -->
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="control-label small" style="color: #A3A3A3;">OAuth Scopes</label>
                            <input type="text" name="scope" value="{{ $p['scope'] }}" class="form-control input-sm" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                        </div>

                        @if($key === 'generic')
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label class="control-label small" style="color: #A3A3A3;">Authorization Endpoint URL</label>
                                <input type="text" name="auth_url" value="{{ $p['extra']['auth_url'] ?? '' }}" placeholder="https://sso.example.com/oauth/authorize" class="form-control input-sm" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                            </div>
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label class="control-label small" style="color: #A3A3A3;">Token Endpoint URL</label>
                                <input type="text" name="token_url" value="{{ $p['extra']['token_url'] ?? '' }}" placeholder="https://sso.example.com/oauth/token" class="form-control input-sm" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                            </div>
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label class="control-label small" style="color: #A3A3A3;">UserInfo Endpoint URL</label>
                                <input type="text" name="user_url" value="{{ $p['extra']['user_url'] ?? '' }}" placeholder="https://sso.example.com/oauth/userinfo" class="form-control input-sm" style="background: #141414; border-color: #2D2D2D; color: #E5E5E5;">
                            </div>
                        @endif

                        <!-- Auto Provision Toggle -->
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="radio-inline small" style="color: #A3A3A3;">
                                <input type="checkbox" name="auto_provision" value="1" {{ $p['auto_provision'] ? 'checked' : '' }}> Automatically create new accounts (JIT Provisioning)
                            </label>
                        </div>
                    </div>

                    <div class="box-footer" style="background: #0F0F0F; border-top: 1px solid #1F1F1F; padding: 12px 20px;">
                        <button type="submit" class="btn btn-sm btn-primary" style="font-weight: 600;">
                            Save {{ $p['name'] }} Settings
                        </button>
                    </div>
                </div>
            </form>
        </div>
    @endforeach
</div>
@endsection