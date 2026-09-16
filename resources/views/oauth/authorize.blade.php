<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Authorize {{ $client->name }} &bull; {{ config('app.name', 'Lunar Panel') }}</title>

    <link rel="icon" type="image/svg+xml" href="/favicons/favicon.svg?v=2">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png?v=2">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/votion.css?v={{ file_exists(public_path('assets/votion.css')) ? filemtime(public_path('assets/votion.css')) : time() }}">

    <style>
        :root {
            color-scheme: dark;
        }
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            background-color: #08090c;
            color: #ededed;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 28px 16px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        ::selection {
            background-color: #10b981;
            color: #ffffff;
        }
        .votion-container {
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .votion-brand-icon {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.35);
            margin-bottom: 12px;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .votion-card {
            width: 100%;
            background: #101216;
            border: 1px solid #1e2229;
            border-radius: 24px;
            padding: 28px 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
            position: relative;
        }
        @media (min-width: 640px) {
            .votion-card {
                padding: 32px 28px;
            }
        }
        .handshake-box {
            background: #0a0b0e;
            border: 1px solid #1a1d24;
            border-radius: 16px;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 22px;
        }
        .entity-card {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            flex: 1;
        }
        .entity-avatar-app {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: #16181f;
            border: 1px solid #282d38;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #10b981;
            flex-shrink: 0;
            font-weight: 700;
            font-size: 15px;
        }
        .entity-avatar-user {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            flex-shrink: 0;
            font-weight: 700;
            font-size: 13px;
        }
        .entity-info {
            min-width: 0;
            overflow: hidden;
        }
        .entity-name {
            font-size: 13px;
            font-weight: 600;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .entity-sub {
            font-size: 11px;
            color: #8b949e;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .handshake-divider {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: #14161b;
            border: 1px solid #232731;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: #8b949e;
        }
        .scope-card {
            background: #0a0b0e;
            border: 1px solid #1a1d24;
            border-radius: 12px;
            padding: 12px 14px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            transition: border-color 0.15s ease;
        }
        .scope-card:hover {
            border-color: #262b35;
        }
        .scope-icon-box {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.2);
            color: #10b981;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-top: 1px;
        }
        .scope-icon-box.admin {
            background: rgba(245, 158, 11, 0.1);
            border-color: rgba(245, 158, 11, 0.2);
            color: #f59e0b;
        }
        .action-btn-approve {
            background-color: #10b981;
            color: #ffffff;
            font-weight: 600;
            font-size: 13px;
            padding: 12px 18px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            flex: 1;
        }
        .action-btn-approve:hover {
            background-color: #059669;
            box-shadow: 0 6px 18px rgba(16, 185, 129, 0.4);
            transform: translateY(-1px);
        }
        .action-btn-approve:active {
            transform: translateY(0);
        }
        .action-btn-deny {
            background-color: #181a20;
            color: #9ca3af;
            font-weight: 600;
            font-size: 13px;
            padding: 12px 18px;
            border-radius: 12px;
            border: 1px solid #262b35;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            flex: 1;
        }
        .action-btn-deny:hover {
            background-color: #20242c;
            color: #ffffff;
            border-color: #363c48;
        }
    </style>
</head>
<body>
    @php
        $clientHost = parse_url($redirectUri, PHP_URL_HOST) ?: $redirectUri;
    @endphp

    <div class="votion-container">
        {{-- Brand Mark & Heading --}}
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 24px;">
            <div class="votion-brand-icon">
                <svg style="width: 28px; height: 28px; color: #ffffff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            </div>
            <h1 style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff;">{{ config('app.name', 'Lunar Panel') }}</h1>
            <p style="font-size: 12px; color: #8b949e; margin-top: 4px;">Single Sign-On &bull; Authorize Application</p>
        </div>

        {{-- Main Authorization Card --}}
        <div class="votion-card">
            {{-- Handshake Connection Block --}}
            <div class="handshake-box">
                {{-- Left: External Client App --}}
                <div class="entity-card">
                    <div class="entity-avatar-app">
                        <svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                    </div>
                    <div class="entity-info">
                        <div class="entity-name" title="{{ $client->name }}">{{ $client->name }}</div>
                        <div class="entity-sub" title="{{ $clientHost }}">
                            <svg style="width: 10px; height: 10px; color: #10b981; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <span>{{ $clientHost }}</span>
                        </div>
                    </div>
                </div>

                {{-- Middle: Connecting Bridge --}}
                <div class="handshake-divider" title="Connecting accounts">
                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                </div>

                {{-- Right: Current User Account --}}
                <div class="entity-card" style="justify-content: flex-end; text-align: right;">
                    <div class="entity-info">
                        <div class="entity-name">{{ $user->name_first }} {{ $user->name_last }}</div>
                        <div class="entity-sub" style="justify-content: flex-end;">
                            <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px;">{{ '@' . $user->username }}</span>
                        </div>
                    </div>
                    <div class="entity-avatar-user">
                        {{ strtoupper(substr($user->username ?? 'U', 0, 2)) }}
                    </div>
                </div>
            </div>

            {{-- Title & Prompt --}}
            <div style="margin-bottom: 20px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">
                    Authorize access for {{ $client->name }}
                </h2>
                <p style="font-size: 12px; color: #8b949e; margin-top: 4px; line-height: 1.5;">
                    This application will be granted permission to access your <strong>{{ config('app.name', 'Lunar Panel') }}</strong> account according to the scopes requested below.
                </p>
            </div>

            {{-- Permissions / Scopes Block --}}
            <div style="margin-bottom: 22px;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 10px;">
                    Requested Permissions
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    @foreach($scopes as $scope)
                        @php
                            $isAdmin = ($scope === 'admin');
                        @endphp
                        <div class="scope-card">
                            <div class="scope-icon-box {{ $isAdmin ? 'admin' : '' }}">
                                @if($scope === 'openid')
                                    {{-- OIDC Identity Key SVG --}}
                                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.743 5.743L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.586a1 1 0 0 1 .293-.707l5.964-5.964A6 6 0 1 1 21 9z"/>
                                    </svg>
                                @elseif($scope === 'profile')
                                    {{-- User Profile SVG --}}
                                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                        <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                @elseif($scope === 'email')
                                    {{-- Mail Envelope SVG --}}
                                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                                    </svg>
                                @elseif($scope === 'servers')
                                    {{-- Game Server SVG --}}
                                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                                        <line x1="6" y1="6" x2="6.01" y2="6"/>
                                        <line x1="6" y1="18" x2="6.01" y2="18"/>
                                    </svg>
                                @elseif($scope === 'admin')
                                    {{-- Admin Shield Warning SVG --}}
                                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                        <path d="M12 8v4"/>
                                        <path d="M12 16h.01"/>
                                    </svg>
                                @else
                                    {{-- Default Check Shield SVG --}}
                                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                        <polyline points="9 12 11 14 15 10"/>
                                    </svg>
                                @endif
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 12px; font-weight: 600; color: #ffffff; font-family: 'JetBrains Mono', monospace;">{{ $scope }}</span>
                                    @if($isAdmin)
                                        <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 4px; padding: 1px 5px;">Admin Privileges</span>
                                    @endif
                                </div>
                                <div style="font-size: 11px; color: #8b949e; margin-top: 2px; line-height: 1.4;">
                                    {{ $scopeDefinitions[$scope] ?? 'Access requested permission.' }}
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>

            {{-- Trust & Safety Guarantee --}}
            <div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; background: #0c0d11; border: 1px solid #1a1d24; margin-bottom: 24px;">
                <svg style="width: 14px; height: 14px; color: #10b981; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span style="font-size: 11px; color: #6b7280; line-height: 1.4;">
                    Your account password and two-factor authentication secrets are strictly confidential and will never be shared.
                </span>
            </div>

            {{-- Approval Form --}}
            <form method="POST" action="{{ route('oauth.authorize.post') }}">
                {!! csrf_field() !!}
                <input type="hidden" name="client_id" value="{{ $client->id }}">
                <input type="hidden" name="redirect_uri" value="{{ $redirectUri }}">
                <input type="hidden" name="state" value="{{ $state }}">
                <input type="hidden" name="nonce" value="{{ $nonce ?? '' }}">
                <input type="hidden" name="scopes" value="{{ implode(' ', $scopes) }}">
                <input type="hidden" name="code_challenge" value="{{ $codeChallenge }}">
                <input type="hidden" name="code_challenge_method" value="{{ $codeChallengeMethod }}">

                <div style="display: flex; gap: 10px;">
                    <button type="submit" name="action" value="deny" class="action-btn-deny">
                        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        <span>Cancel</span>
                    </button>
                    <button type="submit" name="action" value="approve" class="action-btn-approve">
                        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <polyline points="9 12 11 14 15 10"/>
                        </svg>
                        <span>Authorize Access</span>
                    </button>
                </div>
            </form>

            {{-- Destination Notice --}}
            <div style="margin-top: 18px; text-align: center;">
                <p style="font-size: 11px; color: #6b7280; line-height: 1.5;">
                    After authorizing, you will be redirected to:
                </p>
                <div style="margin-top: 4px; display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 6px; background: #0a0b0e; border: 1px solid #1a1d24; max-width: 100%;">
                    <svg style="width: 10px; height: 10px; color: #10b981; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <code style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;" title="{{ $redirectUri }}">
                        {{ $redirectUri }}
                    </code>
                </div>
            </div>
        </div>

        {{-- Footer Copyright --}}
        <p style="text-align: center; color: #4b5563; font-size: 11px; margin-top: 20px;">
            &copy; {{ date('Y') }} {{ config('app.name', 'Lunar Panel') }}. All rights reserved.
        </p>
    </div>
</body>
</html>
