@extends('layouts.admin')

@section('title')
    License & Activation
@endsection

@section('content-header')
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
        <div>
            <h1 style="font-size: 24px; font-weight: 700; color: #FFFFFF; margin: 0; letter-spacing: -0.02em; font-family: var(--font-sans, 'Inter', sans-serif);">
                License &amp; Activation
            </h1>
            <p style="font-size: 13px; color: #8C8C8C; margin: 4px 0 0 0;">
                Cryptographic asymmetric RSA-2048 license enforcement &bull; Node &amp; domain binding telemetry
            </p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <form action="{{ route('admin.license.refresh') }}" method="POST" style="display: inline; margin: 0;">
                @csrf
                <button type="submit" class="btn btn-default" style="background: #141414; border: 1px solid #2D2D2D; color: #E5E5E5; font-size: 12px; font-weight: 500; padding: 7px 16px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; transition: all 150ms ease;" title="Re-verify signature &amp; clear cache">
                    <i class="fa fa-refresh" style="font-size: 11px;"></i> Re-Verify License
                </button>
            </form>
        </div>
    </div>
    <ol class="breadcrumb" style="background: transparent; padding: 0; margin-bottom: 20px; font-size: 12px;">
        <li><a href="{{ route('admin.index') }}" style="color: #8C8C8C;"><i class="fa fa-dashboard"></i> Admin</a></li>
        <li class="active" style="color: #E5E5E5;">License &amp; Activation</li>
    </ol>
@endsection

@section('content')
<div class="row">
    <!-- Top Telemetry Bento Grid -->
    <div class="col-xs-12" style="margin-bottom: 24px;">
        <div class="row">
            <!-- Card 1: Activation State -->
            <div class="col-md-3 col-sm-6 col-xs-12" style="margin-bottom: 16px;">
                <div style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px; padding: 18px 20px; min-height: 112px; display: flex; flex-direction: column; justify-content: space-between;">
                    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #737373;">
                        Activation State
                    </span>
                    <div style="font-size: 20px; font-family: monospace; font-weight: 700; display: flex; align-items: center; gap: 8px; color: {{ $license['valid'] ? '#10B981' : '#EF4444' }};">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: {{ $license['valid'] ? '#10B981' : '#EF4444' }}; box-shadow: 0 0 8px {{ $license['valid'] ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)' }};"></span>
                        {{ strtoupper($license['status']) }}
                    </div>
                    <span style="font-size: 11px; font-family: monospace; color: #737373;">
                        {{ $license['valid'] ? 'Verified via RSA-2048' : 'Action Required' }}
                    </span>
                </div>
            </div>

            <!-- Card 2: License Tier -->
            <div class="col-md-3 col-sm-6 col-xs-12" style="margin-bottom: 16px;">
                <div style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px; padding: 18px 20px; min-height: 112px; display: flex; flex-direction: column; justify-content: space-between;">
                    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #737373;">
                        Licensed Tier
                    </span>
                    <div style="font-size: 20px; font-family: monospace; font-weight: 700; color: #FFFFFF;">
                        {{ strtoupper($license['tier'] ?? 'UNLICENSED') }}
                    </div>
                    <span style="font-size: 11px; font-family: monospace; color: #737373;">
                        {{ $license['customer'] ?? 'Votion Cloud' }}
                    </span>
                </div>
            </div>

            <!-- Card 3: Bound Host -->
            <div class="col-md-3 col-sm-6 col-xs-12" style="margin-bottom: 16px;">
                <div style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px; padding: 18px 20px; min-height: 112px; display: flex; flex-direction: column; justify-content: space-between;">
                    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #737373;">
                        Bound Host
                    </span>
                    <div style="font-size: 16px; font-family: monospace; font-weight: 600; color: #FFFFFF; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        {{ $currentHost }}
                    </div>
                    <span style="font-size: 11px; font-family: monospace; color: #737373;">
                        Target: {{ $license['domain'] ?? 'None' }}
                    </span>
                </div>
            </div>

            <!-- Card 4: Validity Term -->
            <div class="col-md-3 col-sm-6 col-xs-12" style="margin-bottom: 16px;">
                <div style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px; padding: 18px 20px; min-height: 112px; display: flex; flex-direction: column; justify-content: space-between;">
                    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #737373;">
                        Validity Term
                    </span>
                    <div style="font-size: 20px; font-family: monospace; font-weight: 700; color: #FFFFFF;">
                        @if(isset($license['days_remaining']) && $license['days_remaining'] !== null)
                            {{ $license['days_remaining'] }} <span style="font-size: 12px; font-weight: 400; color: #737373;">Days left</span>
                        @elseif($license['valid'])
                            LIFETIME
                        @else
                            --
                        @endif
                    </div>
                    <span style="font-size: 11px; font-family: monospace; color: #737373;">
                        @if(isset($license['expires_at']) && $license['expires_at'])
                            Expires: {{ date('M j, Y', $license['expires_at']) }}
                        @else
                            Permanent Activation
                        @endif
                    </span>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Content Area: Update License Form & Technical Details -->
    <div class="col-md-8 col-xs-12">
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px; margin-bottom: 24px;">
            <div class="box-header with-border" style="border-bottom-color: #1F1F1F; padding: 16px 20px;">
                <h3 class="box-title" style="color: #FFFFFF; font-weight: 600; font-size: 16px;">
                    <i class="fa fa-shield" style="color: #10B981; margin-right: 8px;"></i> License Key Management
                </h3>
            </div>
            <div class="box-body" style="padding: 20px;">
                {{-- Active Key Masked Display (Keeps key secure on screen) --}}
                <div style="background: #111113; border: 1px solid #242428; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #8C8C8C;">
                            Current Active License Key
                        </span>
                        @if(!empty($rawKey))
                            <span class="label" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); font-family: monospace; font-size: 10px; padding: 3px 8px;">
                                <i class="fa fa-lock" style="margin-right: 4px;"></i> PROTECTED
                            </span>
                        @else
                            <span class="label label-danger" style="font-family: monospace; font-size: 10px; padding: 3px 8px;">
                                NO KEY STORED
                            </span>
                        @endif
                    </div>

                    <div class="input-group" style="width: 100%;">
                        <input
                            type="password"
                            id="maskedKeyInput"
                            class="form-control"
                            value="{{ $rawKey }}"
                            readonly
                            style="background: #000000; border: 1px solid #2D2D2D; color: #10B981; font-family: monospace; font-size: 12px; height: 38px; cursor: default; letter-spacing: 0.15em;"
                            spellcheck="false"
                        >
                        <span class="input-group-btn">
                            <button
                                type="button"
                                id="btnToggleKeyVisibility"
                                class="btn btn-default"
                                style="background: #18181A; border: 1px solid #2D2D2D; color: #D4D4D4; height: 38px; padding: 0 16px; font-size: 12px;"
                                title="Toggle Key Visibility"
                            >
                                <i class="fa fa-eye" id="eyeIcon"></i> <span id="eyeText" style="margin-left: 4px;">Reveal</span>
                            </button>
                            <button
                                type="button"
                                id="btnCopyLicenseKey"
                                class="btn btn-default"
                                style="background: #18181A; border: 1px solid #2D2D2D; color: #D4D4D4; height: 38px; padding: 0 16px; font-size: 12px;"
                                title="Copy Key to Clipboard"
                            >
                                <i class="fa fa-copy"></i> Copy
                            </button>
                        </span>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #737373;">
                        <span>Key is masked by default to prevent exposure during screen shares and presentations.</span>
                        <span id="copySuccessFeedback" style="color: #10B981; display: none; font-weight: 500;">
                            <i class="fa fa-check"></i> Copied to clipboard!
                        </span>
                    </div>
                </div>

                {{-- Update License Key Form --}}
                <form action="{{ route('admin.license.update') }}" method="POST">
                    @csrf
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #A0A0A0; margin-bottom: 8px; display: block;">
                            Update License Key (LNR-V1...)
                        </label>
                        <p style="font-size: 12px; color: #737373; margin-top: 0; margin-bottom: 10px;">
                            Paste a new signed Lunar Panel license key below to change tier or renew your installation.
                        </p>
                        <textarea
                            name="license_key"
                            rows="4"
                            style="width: 100%; background: #000000; border: 1px solid #262626; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; color: #FFFFFF; outline: none; resize: vertical; line-height: 1.5;"
                            placeholder="LNR-V1.eyJkb21haW4iOiJleGFtcGxlLmNvbSIsLi4ufQ==.c2lnbmF0dXJl..."
                            required
                        >{{ old('license_key') }}</textarea>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <button type="submit" class="btn btn-primary" style="background: #10B981; border-color: #10B981; color: #FFFFFF; font-weight: 600; padding: 8px 22px; border-radius: 6px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa fa-key"></i> Save &amp; Activate License
                        </button>

                        @if(!empty($rawKey))
                            <span style="font-size: 11px; font-family: monospace; color: #737373;">
                                Masked ID: <code style="background: #141414; color: #A3A3A3; border: 1px solid #262626; padding: 2px 6px; border-radius: 4px;">{{ $license['key_masked'] ?? 'LNR-V1-****' }}</code>
                            </span>
                        @endif
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Side Box: Bytecode Engine & Cryptographic Integrity -->
    <div class="col-md-4 col-xs-12">
        <div class="box box-solid" style="background: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 8px; margin-bottom: 24px;">
            <div class="box-header with-border" style="border-bottom-color: #1F1F1F; padding: 16px 20px;">
                <h3 class="box-title" style="color: #FFFFFF; font-weight: 600; font-size: 15px;">
                    <i class="fa fa-microchip" style="color: #38bdf8; margin-right: 8px;"></i> Bytecode Engine
                </h3>
            </div>
            <div class="box-body" style="padding: 20px;">
                @php
                    $hasIoncube = extension_loaded('ionCube Loader');
                    $ioncubeVer = function_exists('ioncube_loader_version') ? ioncube_loader_version() : null;
                @endphp
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                    <span style="font-size: 12px; color: #A0A0A0; font-weight: 500;">ionCube Loader:</span>
                    @if($hasIoncube)
                        <span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 9999px; font-size: 10px; font-family: monospace; font-weight: 600; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);">
                            <span style="width: 6px; height: 6px; border-radius: 9999px; background: #4ade80; margin-right: 6px;"></span>
                            ACTIVE {{ $ioncubeVer ? 'v' . $ioncubeVer : '' }}
                        </span>
                    @else
                        <span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 9999px; font-size: 10px; font-family: monospace; font-weight: 600; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">
                            <span style="width: 6px; height: 6px; border-radius: 9999px; background: #fbbf24; margin-right: 6px;"></span>
                            AUTO-INSTALL READY
                        </span>
                    @endif
                </div>

                <div style="margin-bottom: 18px;">
                    <span style="font-size: 11px; color: #737373; display: block; margin-bottom: 6px;">
                        1-Click Auto-Installer Command:
                    </span>
                    <div class="input-group">
                        <input
                            type="text"
                            id="ioncubeInstallCmd"
                            class="form-control input-sm"
                            value="sudo bash scripts/install-ioncube.sh"
                            readonly
                            style="background: #000000; border: 1px solid #262626; color: #38bdf8; font-family: monospace; font-size: 11px;"
                        >
                        <span class="input-group-btn">
                            <button
                                type="button"
                                id="btnCopyInstallCmd"
                                class="btn btn-default btn-sm"
                                style="background: #18181A; border: 1px solid #262626; color: #D4D4D4;"
                                title="Copy Command"
                            >
                                <i class="fa fa-copy"></i>
                            </button>
                        </span>
                    </div>
                </div>

                <hr style="border: 0; border-top: 1px solid #1F1F1F; margin: 18px 0;">

                <h4 style="font-size: 13px; font-weight: 600; color: #FFFFFF; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">
                    Cryptographic Integrity
                </h4>
                <ul style="padding-left: 18px; font-size: 12px; color: #8C8C8C; line-height: 1.9; margin-bottom: 0;">
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

@section('footer-scripts')
    @parent
    <script>
        $(function () {
            // Toggle License Key Visibility
            var isRevealed = false;
            var $keyInput = $('#maskedKeyInput');
            var $eyeIcon = $('#eyeIcon');
            var $eyeText = $('#eyeText');

            $('#btnToggleKeyVisibility').on('click', function () {
                isRevealed = !isRevealed;
                if (isRevealed) {
                    $keyInput.attr('type', 'text').css('letter-spacing', 'normal');
                    $eyeIcon.removeClass('fa-eye').addClass('fa-eye-slash');
                    $eyeText.text('Hide');
                } else {
                    $keyInput.attr('type', 'password').css('letter-spacing', '0.15em');
                    $eyeIcon.removeClass('fa-eye-slash').addClass('fa-eye');
                    $eyeText.text('Reveal');
                }
            });

            // Copy License Key to Clipboard
            $('#btnCopyLicenseKey').on('click', function () {
                var rawValue = $keyInput.val();
                if (!rawValue) return;

                navigator.clipboard.writeText(rawValue).then(function () {
                    var $feedback = $('#copySuccessFeedback');
                    $feedback.fadeIn(150);
                    setTimeout(function () {
                        $feedback.fadeOut(300);
                    }, 2500);
                });
            });

            // Copy Ioncube Command
            $('#btnCopyInstallCmd').on('click', function () {
                var cmd = $('#ioncubeInstallCmd').val();
                navigator.clipboard.writeText(cmd).then(function () {
                    var $btn = $('#btnCopyInstallCmd');
                    var orig = $btn.html();
                    $btn.html('<i class="fa fa-check" style="color: #10B981;"></i>');
                    setTimeout(function () {
                        $btn.html(orig);
                    }, 2000);
                });
            });
        });
    </script>
@endsection
