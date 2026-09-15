<!DOCTYPE html>
<html lang="en" class="dark">
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
        <title>License Required &bull; Lunar Panel</title>
        <link rel="icon" type="image/svg+xml" href="/favicons/favicon.svg?v=2">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/assets/votion.css?v={{ time() }}">
        <style>
            body {
                background-color: #000000;
                color: #FFFFFF;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                margin: 0;
                padding: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
        </style>
    </head>
    <body>
        <div class="w-full max-w-lg mx-4 p-6 sm:p-8 bg-[#050505] border border-[#1F1F1F] rounded-xl shadow-2xl text-center relative overflow-hidden backdrop-blur-md select-none">
            {{-- Ambient radial background glow --}}
            <div class="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

            {{-- Icon Badge --}}
            <div class="relative w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-6 shadow-inner">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.743 5.743L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.586a1 1 0 0 1 .293-.707l5.964-5.964A6 6 0 1 1 21 9z" />
                </svg>
            </div>

            {{-- Title --}}
            <h1 class="font-serif text-2xl sm:text-3xl font-medium text-[#FFFFFF] tracking-tight m-0">
                Lunar License Required
            </h1>

            {{-- Description --}}
            <p class="text-xs text-[#A0A0A0] mt-3 max-w-md mx-auto leading-relaxed">
                {{ $licenseResult['message'] ?? 'This instance requires a valid cryptographically signed Lunar Panel license key to operate.' }}
            </p>

            {{-- Telemetry Chips --}}
            <div class="mt-6 p-3 rounded-lg bg-[#000000] border border-[#1A1A1A] flex items-center justify-between text-left text-xs font-mono">
                <div>
                    <span class="text-[#737373] text-[10px] uppercase block tracking-wider">Host Node</span>
                    <span class="text-[#D4D4D4] font-medium">{{ $host }}</span>
                </div>
                <div class="text-right">
                    <span class="text-[#737373] text-[10px] uppercase block tracking-wider">Status</span>
                    <span class="text-rose-400 font-semibold uppercase">{{ $licenseResult['status'] ?? 'UNLICENSED' }}</span>
                </div>
            </div>

            {{-- Activation Link / Actions --}}
            <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                    href="{{ route('admin.license') }}"
                    class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-[#FFFFFF] hover:bg-[#EAEAEA] active:scale-[0.98] text-[#0A0A0A] text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer"
                >
                    <svg class="w-3.5 h-3.5 text-[#0A0A0A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Sign in as Admin to Activate</span>
                </a>

                <button
                    type="button"
                    onclick="window.location.reload()"
                    class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-[#141414] hover:bg-[#1E1E1E] text-[#D4D4D4] hover:text-[#FFFFFF] border border-[#262626] text-xs font-medium transition-colors cursor-pointer"
                >
                    <span>Refresh Status</span>
                </button>
            </div>

            {{-- Footer Note --}}
            <div class="mt-8 pt-4 border-t border-[#141414] text-[11px] text-[#525252] font-mono">
                Lunar Control Plane &bull; Cryptographic RSA-2048 Enforced
            </div>
        </div>
    </body>
</html>
