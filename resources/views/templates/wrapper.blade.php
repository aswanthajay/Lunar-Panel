<!DOCTYPE html>
<html lang="en">
    <head>
        <title>{{ config('app.name', 'Pterodactyl') }}</title>

        <script>
            (function() {
                try {
                    var mode = localStorage.getItem('votion_theme');
                    var isDark = mode === 'dark' || (!mode && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
                    if (isDark) {
                        document.documentElement.setAttribute('data-theme', 'dark');
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.removeAttribute('data-theme');
                        document.documentElement.classList.remove('dark');
                    }
                } catch(e) {}
            })();
        </script>

        @section('meta')
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
            <meta name="csrf-token" content="{{ csrf_token() }}">
            <meta name="robots" content="noindex">
            <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png?v=2">
            <link rel="icon" type="image/svg+xml" href="/favicons/favicon.svg?v=2">
            <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png?v=2" sizes="32x32">
            <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png?v=2" sizes="16x16">
            <link rel="manifest" href="/favicons/manifest.json">
            <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg?v=2" color="#000000">
            <link rel="shortcut icon" href="/favicons/favicon.ico?v=2">
            <meta name="msapplication-config" content="/favicons/browserconfig.xml">
            <meta name="theme-color" content="#000000">
        @show

        @section('user-data')
            @if(!is_null(Auth::user()))
                <script>
                    window.PterodactylUser = {!! json_encode(Auth::user()->toVueObject()) !!};
                </script>
            @endif
            @if(!empty($siteConfiguration))
                <script>
                    window.SiteConfiguration = {!! json_encode($siteConfiguration) !!};
                </script>
            @endif
        @show
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/assets/votion.css?v={{ file_exists(public_path('assets/votion.css')) ? filemtime(public_path('assets/votion.css')) : time() }}">

        <style>
            /* Global Preloader — White background in Light Mode, Black in Dark Mode */
            .votion-preloader {
                position: fixed;
                top: 0; left: 0;
                z-index: 99999;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                width: 100vw;
                background-color: #ffffff;
                transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .votion-preloader.dark,
            html[data-theme="dark"] .votion-preloader,
            html.dark .votion-preloader {
                background-color: #000000;
            }
            .votion-preloader-logo {
                width: 120px;
                height: auto;
                animation: votion-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.12));
            }
            .votion-preloader.dark .votion-preloader-logo,
            html[data-theme="dark"] .votion-preloader-logo,
            html.dark .votion-preloader-logo {
                filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.2));
            }
            @keyframes votion-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.6; transform: scale(0.95); }
            }
        </style>

        @yield('assets')

        @include('layouts.scripts')
    </head>
    <body class="{{ $css['body'] ?? 'bg-[#fbfaf9] dark:bg-[#000000]' }}">
        <div id="votion-global-preloader" class="votion-preloader">
            <img class="votion-preloader-logo" src="/votion-logo-metallic.png" alt="Loading Votion One..." />
        </div>
        @section('content')
            @yield('above-container')
            @yield('container')
            @yield('below-container')
        @show
        @section('scripts')
            {!! $asset->js('main.js') !!}
            <script>
                // Fallback safety dismissal in case of script load failure or slow network
                window.addEventListener('load', function() {
                    setTimeout(function() {
                        var p = document.getElementById('votion-global-preloader');
                        if (p) {
                            p.style.opacity = '0';
                            p.style.pointerEvents = 'none';
                            setTimeout(function() { if (p && p.parentNode) p.parentNode.removeChild(p); }, 600);
                        }
                    }, 3500);
                });
            </script>
        @show
    </body>
</html>
