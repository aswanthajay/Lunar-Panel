@extends('layouts.admin')

@section('title')
    License & Activation
@endsection

@section('content-header')
    <div class="votion-bar-left">
        <h1 class="votion-hero-title font-serif">License &amp; Activation</h1>
        <p class="votion-hero-desc">
            Cryptographic asymmetric RSA-2048 license enforcement &bull; Node &amp; domain binding telemetry
        </p>
    </div>

    <div class="votion-bar-right">
        <form action="{{ route('admin.license.refresh') }}" method="POST" style="display: inline;">
            @csrf
            <button type="submit" class="votion-btn-dark" title="Re-verify signature &amp; clear cache">
                <i class="fa fa-refresh" style="font-size: 11px; margin-right: 4px;"></i> Re-Verify License
            </button>
        </form>
    </div>
@endsection

@section('content')
<div class="votion-admin-dashboard">

    {{-- Bento Telemetry Grid --}}
    <div class="row" style="margin-bottom: 24px;">
        {{-- Card 1: License Status --}}
        <div class="col-md-3 col-sm-6" style="margin-bottom: 16px;">
            <div style="background: #050505; border: 1px solid #1F1F1F; border-radius: 8px; padding: 20px; height: 100%;">
                <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #6B7280; display: block;">
                    Activation State
                </span>
                <div style="font-size: 20px; font-family: monospace; font-weight: 600; margin-top: 8px; display: flex; items-center; gap: 8px; color: {{ $license['valid'] ? '#10B981' : '#F43F5E' }};">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: {{ $license['valid'] ? '#10B981' : '#F43F5E' }}; margin-top: 7px;"></span>
                    {{ strtoupper($license['status']) }}
                </div>
                <span style="font-size: 11px; font-family: monospace; color: #737373; margin-top: 6px; display: block;">
                    {{ $license['valid'] ? 'Verified via RSA-2048' : 'Action Required' }}
                </span>
            </div>
        </div>

        {{-- Card 2: License Tier --}}
        <div class="col-md-3 col-sm-6" style="margin-bottom: 16px;">
            <div style="background: #050505; border: 1px solid #1F1F1F; border-radius: 8px; padding: 20px; height: 100%;">
                <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #6B7280; display: block;">
                    Licensed Tier
                </span>
                <div style="font-size: 20px; font-family: monospace; font-weight: 600; margin-top: 8px; color: #FFFFFF;">
                    {{ strtoupper($license['tier'] ?? 'UNLICENSED') }}
                </div>
                <span style="font-size: 11px; font-family: monospace; color: #737373; margin-top: 6px; display: block;">
                    {{ $license['customer'] ?? 'No owner assigned' }}
                </span>
            </div>
        </div>

        {{-- Card 3: Bound Host / Domain --}}
        <div class="col-md-3 col-sm-6" style="margin-bottom: 16px;">
            <div style="background: #050505; border: 1px solid #1F1F1F; border-radius: 8px; padding: 20px; height: 100%;">
                <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #6B7280; display: block;">
                    Bound Host
                </span>
                <div style="font-size: 18px; font-family: monospace; font-weight: 500; margin-top: 8px; color: #FFFFFF; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {{ $currentHost }}
                </div>
                <span style="font-size: 11px; font-family: monospace; color: #737373; margin-top: 6px; display: block;">
                    Target: {{ $license['domain'] ?? 'None' }}
                </span>
            </div>
        </div>

        {{-- Card 4: Validity & Expiration --}}
        <div class="col-md-3 col-sm-6" style="margin-bottom: 16px;">
            <div style="background: #050505; border: 1px solid #1F1F1F; border-radius: 8px; padding: 20px; height: 100%;">
                <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #6B7280; display: block;">
                    Validity Term
                </span>
                <div style="font-size: 20px; font-family: monospace; font-weight: 600; margin-top: 8px; color: #FFFFFF;">
                    @if(isset($license['days_remaining']) && $license['days_remaining'] !== null)
                        {{ $license['days_remaining'] }} <span style="font-size: 12px; font-weight: 400; color: #737373;">Days left</span>
                    @elseif($license['valid'])
                        LIFETIME
                    @else
                        --
                    @endif
                </div>
                <span style="font-size: 11px; font-family: monospace; color: #737373; margin-top: 6px; display: block;">
                    @if(isset($license['expires_at']) && $license['expires_at'])
                        Expires: {{ date('M j, Y', $license['expires_at']) }}
                    @else
                        Permanent Activation
                    @endif
                </span>
            </div>
        </div>
    </div>

    {{-- Main Activation Form Box --}}
    <div class="row">
        <div class="col-md-8">
            <div style="background: #050505; border: 1px solid #1F1F1F; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h3 style="font-size: 16px; font-weight: 600; color: #FFFFFF; margin-top: 0; margin-bottom: 8px;">
                    Update License Key
                </h3>
                <p style="font-size: 12px; color: #A0A0A0; line-height: 1.6; margin-bottom: 20px;">
                    Paste your signed Lunar Panel license key below. The signature is mathematically verified using the embedded 2048-bit RSA master authority.
                </p>

                <form action="{{ route('admin.license.update') }}" method="POST">
                    @csrf
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #A0A0A0; margin-bottom: 8px; display: block;">
                            Signed License Key (LNR-V1...)
                        </label>
                        <textarea
                            name="license_key"
                            rows="4"
                            style="width: 100%; background: #000000; border: 1px solid #262626; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; color: #FFFFFF; outline: none; resize: vertical; line-height: 1.5;"
                            placeholder="LNR-V1.eyJkb21haW4iOiJleGFtcGxlLmNvbSIsLi4ufQ==.c2lnbmF0dXJl..."
                            required
                        >{{ old('license_key', $rawKey) }}</textarea>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <button type="submit" class="votion-btn-white" style="cursor: pointer; padding: 8px 20px; font-size: 12px; font-weight: 600;">
                            <i class="fa fa-key" style="margin-right: 6px;"></i> Save &amp; Activate License
                        </button>

                        @if(!empty($rawKey))
                            <span style="font-size: 11px; font-family: monospace; color: #737373;">
                                Current: <code style="background: #141414; color: #D4D4D4; border: 1px solid #262626; padding: 2px 6px; border-radius: 4px;">{{ $license['key_masked'] ?? 'LNR-V1-****' }}</code>
                            </span>
                        @endif
                    </div>
                </form>
            </div>
        </div>

        {{-- Side Technical Explainer Box & ionCube Loader Telemetry --}}
        <div class="col-md-4">
            <div style="background: #050505; border: 1px solid #1F1F1F; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h4 style="font-size: 14px; font-weight: 600; color: #FFFFFF; margin-top: 0; margin-bottom: 12px;">
                    Bytecode Engine
                </h4>
                @php
                    $hasIoncube = extension_loaded('ionCube Loader');
                    $ioncubeVer = function_exists('ioncube_loader_version') ? ioncube_loader_version() : null;
                @endphp
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <span style="font-size: 12px; color: #A0A0A0;">ionCube Loader:</span>
                    @if($hasIoncube)
                        <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-family: monospace; font-weight: 600; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);">
                            <span style="width: 6px; height: 6px; border-radius: 9999px; background: #4ade80; margin-right: 6px;"></span>
                            ACTIVE {{ $ioncubeVer ? 'v' . $ioncubeVer : '' }}
                        </span>
                    @else
                        <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-family: monospace; font-weight: 600; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">
                            <span style="width: 6px; height: 6px; border-radius: 9999px; background: #fbbf24; margin-right: 6px;"></span>
                            AUTO-INSTALL READY
                        </span>
                    @endif
                </div>
                <div style="margin-bottom: 16px;">
                    <span style="font-size: 11px; color: #737373; display: block; margin-bottom: 6px;">
                        1-Click Auto-Installer Command:
                    </span>
                    <code style="display: block; background: #000000; border: 1px solid #262626; color: #38bdf8; padding: 8px 10px; border-radius: 4px; font-size: 11px; font-family: monospace; word-break: break-all; user-select: all;">sudo bash scripts/install-ioncube.sh</code>
                </div>

                <hr style="border: 0; border-top: 1px solid #1F1F1F; margin: 16px 0;">

                <h4 style="font-size: 14px; font-weight: 600; color: #FFFFFF; margin-top: 0; margin-bottom: 12px;">
                    Cryptographic Integrity
                </h4>
                <ul style="padding-left: 18px; font-size: 12px; color: #737373; line-height: 1.8; margin-bottom: 0;">
                    <li><strong style="color: #D4D4D4;">Algorithm:</strong> RSA-2048 with SHA-256 digest</li>
                    <li><strong style="color: #D4D4D4;">Code Protection:</strong> AES-256 tamper-sealed bytecode</li>
                    <li><strong style="color: #D4D4D4;">Domain Lock:</strong> License bound to this server FQDN</li>
                    <li><strong style="color: #D4D4D4;">Tamper Detection:</strong> SHA-256 HMAC integrity verification</li>
                </ul>
            </div>
        </div>
    </div>

</div>
@endsection
