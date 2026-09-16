<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>Authorize {{ $client->name }} &bull; {{ config('app.name', 'Lunar Panel') }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #08090C;
            color: #EDEDED;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            -webkit-font-smoothing: antialiased;
        }
        .oauth-card {
            background: #101216;
            border: 1px solid #1E2229;
            border-radius: 20px;
            width: 100%;
            max-width: 480px;
            padding: 36px 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            position: relative;
            overflow: hidden;
        }
        .oauth-glow {
            position: absolute;
            top: -60px;
            right: -60px;
            width: 180px;
            height: 180px;
            background: rgba(16, 185, 129, 0.12);
            border-radius: 50%;
            filter: blur(40px);
            pointer-events: none;
        }
        .brand-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
        }
        .brand-logo-box {
            background: #1A1A1A;
            border: 1px solid #2D2D2D;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #FFFFFF;
        }
        .brand-title {
            font-size: 22px;
            font-weight: 700;
            color: #FFFFFF;
            letter-spacing: -0.02em;
            margin-bottom: 8px;
        }
        .brand-subtitle {
            font-size: 13px;
            color: #8A8F98;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .user-capsule {
            background: #0A0B0E;
            border: 1px solid #1A1D24;
            border-radius: 12px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
        }
        .user-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #059669, #10B981);
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
            flex-shrink: 0;
        }
        .user-info-text {
            overflow: hidden;
        }
        .user-name {
            font-size: 13px;
            font-weight: 600;
            color: #FFFFFF;
        }
        .user-email {
            font-size: 11px;
            color: #6B7280;
            font-family: 'JetBrains Mono', monospace;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
        }
        .scopes-header {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6B7280;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .scopes-list {
            list-style: none;
            margin-bottom: 28px;
            display: flex;
            flex-col;
            gap: 10px;
        }
        .scope-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            background: #0A0B0E;
            border: 1px solid #1A1D24;
            border-radius: 10px;
            padding: 10px 14px;
        }
        .scope-icon {
            color: #10B981;
            font-size: 14px;
            margin-top: 2px;
            flex-shrink: 0;
        }
        .scope-text-title {
            font-size: 12px;
            font-weight: 600;
            color: #E5E7EB;
        }
        .scope-text-desc {
            font-size: 11px;
            color: #8A8F98;
            margin-top: 2px;
        }
        .button-group {
            display: flex;
            gap: 12px;
        }
        .btn {
            flex: 1;
            padding: 12px 18px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            text-align: center;
            border: none;
            outline: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .btn-approve {
            background: #10B981;
            color: #FFFFFF;
        }
        .btn-approve:hover {
            background: #059669;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
        }
        .btn-deny {
            background: #14161B;
            color: #9CA3AF;
            border: 1px solid #242933;
        }
        .btn-deny:hover {
            background: #1C2028;
            color: #FFFFFF;
        }
        .client-redirect-note {
            margin-top: 20px;
            font-size: 11px;
            color: #6B7280;
            text-align: center;
            line-height: 1.4;
        }
        .client-redirect-note code {
            color: #9CA3AF;
            font-family: 'JetBrains Mono', monospace;
            background: #0A0B0E;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="oauth-card">
        <div class="oauth-glow"></div>

        <div class="brand-badge">
            <span class="brand-logo-box">votion</span>
            <span style="color: #4B5563; font-size: 14px;">/</span>
            <span style="color: #9CA3AF; font-size: 13px; font-weight: 500;">OAuth 2.0 Provider</span>
        </div>

        <h1 class="brand-title">Authorize {{ $client->name }}</h1>
        <p class="brand-subtitle">
            An external application is requesting permission to access your <strong>{{ config('app.name', 'Lunar Panel') }}</strong> account.
        </p>

        <!-- User Capsule -->
        <div class="user-capsule">
            <div class="user-avatar">
                {{ strtoupper(substr($user->username ?? 'U', 0, 2)) }}
            </div>
            <div class="user-info-text">
                <div class="user-name">{{ $user->name_first }} {{ $user->name_last }} (@<span>{{ $user->username }}</span>)</div>
                <div class="user-email">{{ $user->email }}</div>
            </div>
        </div>

        <!-- Scopes Requested -->
        <div class="scopes-header">Permissions Requested</div>
        <div class="scopes-list">
            @foreach($scopes as $scope)
                <div class="scope-item">
                    <i class="fa fa-check-circle scope-icon"></i>
                    <div>
                        <div class="scope-text-title">{{ $scope }}</div>
                        <div class="scope-text-desc">{{ $scopeDefinitions[$scope] ?? 'Access requested permission.' }}</div>
                    </div>
                </div>
            @endforeach
        </div>

        <!-- Approval Form -->
        <form method="POST" action="{{ route('oauth.authorize.post') }}">
            {!! csrf_field() !!}
            <input type="hidden" name="client_id" value="{{ $client->id }}">
            <input type="hidden" name="redirect_uri" value="{{ $redirectUri }}">
            <input type="hidden" name="state" value="{{ $state }}">
            <input type="hidden" name="scopes" value="{{ implode(' ', $scopes) }}">
            <input type="hidden" name="code_challenge" value="{{ $codeChallenge }}">
            <input type="hidden" name="code_challenge_method" value="{{ $codeChallengeMethod }}">

            <div class="button-group">
                <button type="submit" name="action" value="deny" class="btn btn-deny">
                    <i class="fa fa-times"></i> Cancel
                </button>
                <button type="submit" name="action" value="approve" class="btn btn-approve">
                    <i class="fa fa-shield"></i> Authorize Access
                </button>
            </div>
        </form>

        <p class="client-redirect-note">
            Upon authorization, you will be redirected to:<br>
            <code>{{ $redirectUri }}</code>
        </p>
    </div>
</body>
</html>