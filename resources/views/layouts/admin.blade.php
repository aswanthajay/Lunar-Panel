<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>{{ config('app.name', 'Lunar') }} Admin - @yield('title')</title>
        <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
        <meta name="_token" content="{{ csrf_token() }}">

        <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png?v=2">
        <link rel="icon" type="image/svg+xml" href="/favicons/favicon.svg?v=2">
        <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png?v=2" sizes="32x32">
        <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png?v=2" sizes="16x16">
        <link rel="manifest" href="/favicons/manifest.json">
        <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg?v=2" color="#000000">
        <link rel="shortcut icon" href="/favicons/favicon.ico?v=2">
        <meta name="msapplication-config" content="/favicons/browserconfig.xml">
        <meta name="theme-color" content="#09090b">

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">

        @include('layouts.scripts')

        @section('scripts')
            {!! Theme::css('vendor/select2/select2.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/bootstrap/bootstrap.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/adminlte/admin.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/adminlte/colors/skin-blue.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/sweetalert/sweetalert.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/animate/animate.min.css?t={cache-version}') !!}
            {!! Theme::css('css/pterodactyl.css?t={cache-version}') !!}
            {!! Theme::css('css/lunar-admin.css?v=2.5.0') !!}
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/ionicons/2.0.1/css/ionicons.min.css">

            <!--[if lt IE 9]>
            <script src="https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js"></script>
            <script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>
            <![endif]-->
        @show
    </head>
    <body class="hold-transition skin-blue fixed sidebar-mini">
        <div class="wrapper">
            <header class="main-header">
                <div class="lunar-topbar-left">
                    <a href="#" class="votion-toggle-btn sidebar-toggle" data-toggle="push-menu" role="button" title="Toggle Sidebar">
                        <span class="sr-only">Toggle navigation</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </a>

                    <a href="{{ route('admin.index') }}" class="votion-brand-link" title="Lunar Control Panel">
                        <span class="votion-brand-badge">votion</span>
                        <span class="votion-brand-slash">/</span>
                        <span class="votion-brand-product">Lunar Panel</span>
                    </a>

                    <span class="votion-brand-scope">Admin CP</span>
                </div>

                <div class="lunar-topbar-right">
                    <div class="votion-telemetry-chip hidden-xs hidden-sm" data-toggle="tooltip" data-placement="bottom" title="Cluster Fleet Telemetry Clock">
                        <span class="votion-pulse-dot"></span>
                        <span id="votionLiveClock" class="votion-clock-text">--:--:-- UTC</span>
                    </div>

                    <a href="{{ route('index') }}" class="votion-topbar-action" data-toggle="tooltip" data-placement="bottom" title="Switch to Client Area">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3l4 4-4 4"></path>
                            <path d="M3 7h18"></path>
                            <path d="M7 21l-4-4 4-4"></path>
                            <path d="M21 17H3"></path>
                        </svg>
                        <span class="hidden-xs">Client Area</span>
                    </a>

                    <a href="{{ route('account') }}" class="votion-user-capsule" data-toggle="tooltip" data-placement="bottom" title="Account Settings">
                        <div class="votion-avatar-ring">
                            {{ strtoupper(substr(Auth::user()->username ?? 'AD', 0, 2)) }}
                        </div>
                        <span class="votion-username-text hidden-xs">{{ Auth::user()?->name_first ?? 'Admin' }} {{ Auth::user()?->name_last ?? 'User' }}</span>
                    </a>

                    <a href="{{ route('auth.logout') }}" id="logoutButton" class="votion-icon-btn votion-logout-trigger" data-toggle="tooltip" data-placement="bottom" title="Sign Out">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </a>
                </div>
            </header>
            <aside class="main-sidebar">
                <section class="sidebar">
                    <div class="sidebar-search-wrap">
                        <div class="sidebar-search-inner">
                            <svg class="sidebar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input type="text" id="adminSidebarSearch" placeholder="Navigate to..." autocomplete="off">
                            <button type="button" id="adminSidebarSearchClear" class="sidebar-search-clear" style="display: none;" title="Clear search (Esc)">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                            <span class="sidebar-search-badge hidden-xs">Ctrl+K</span>
                        </div>
                    </div>
                    <ul class="sidebar-menu">
                        <li class="header">Administration</li>
                        <li class="{{ (Route::currentRouteName() === 'admin.index') ? 'active' : '' }}">
                            <a href="{{ route('admin.index') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 22 22" fill="currentColor">
                                    <path clip-rule="evenodd" d="M1 9.387h8V1.387H1v8ZM13 1.387h8v8h-8v-8ZM21 12.613h-8v8h8v-8ZM9 20.613H1v-8h8v8Z" fill-rule="evenodd"></path>
                                </svg>
                                <span>Overview</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.settings') ? 'active' : '' }}">
                            <a href="{{ route('admin.settings') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="4" y1="21" x2="4" y2="14"></line>
                                    <line x1="4" y1="10" x2="4" y2="3"></line>
                                    <line x1="12" y1="21" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12" y2="3"></line>
                                    <line x1="20" y1="21" x2="20" y2="16"></line>
                                    <line x1="20" y1="12" x2="20" y2="3"></line>
                                    <line x1="1" y1="14" x2="7" y2="14"></line>
                                    <line x1="9" y1="8" x2="15" y2="8"></line>
                                    <line x1="17" y1="16" x2="23" y2="16"></line>
                                </svg>
                                <span>Settings</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.api') ? 'active' : '' }}">
                            <a href="{{ route('admin.api.index') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 22 22" fill="currentColor">
                                    <path d="M12.65 3.35A5.5 5.5 0 0 0 4.5 10.7L1.35 13.85v3.65h3.65l1.05-1.05h2.1v-2.1l2.45-2.45a5.5 5.5 0 0 0 6.6-4.9c0-.44-.06-.88-.17-1.3l-2.43 2.43-2.1-2.1 2.43-2.43a5.5 5.5 0 0 0-1.3-.17ZM10.5 8.85l-4.1 4.1L3.85 15.5H2.85v-1l2.55-2.55 4.1-4.1a4 4 0 1 1 1 1Z" />
                                    <circle cx="15.5" cy="6.5" r="1.5" />
                                </svg>
                                <span>Application API</span>
                            </a>
                        </li>

                        <li class="header">Infrastructure</li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.servers') ? 'active' : '' }}">
                            <a href="{{ route('admin.servers') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="2" y="3" width="20" height="7" rx="2"></rect>
                                    <rect x="2" y="14" width="20" height="7" rx="2"></rect>
                                    <line x1="6" y1="6.5" x2="6.01" y2="6.5" stroke-width="2.5"></line>
                                    <line x1="6" y1="17.5" x2="6.01" y2="17.5" stroke-width="2.5"></line>
                                    <line x1="10" y1="6.5" x2="14" y2="6.5"></line>
                                    <line x1="10" y1="17.5" x2="14" y2="17.5"></line>
                                </svg>
                                <span>Servers</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.nodes') ? 'active' : '' }}">
                            <a href="{{ route('admin.nodes') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="3" width="6" height="5" rx="1"></rect>
                                    <rect x="3" y="16" width="6" height="5" rx="1"></rect>
                                    <rect x="15" y="16" width="6" height="5" rx="1"></rect>
                                    <path d="M12 8v4m-6 4v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                <span>Nodes</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.locations') ? 'active' : '' }}">
                            <a href="{{ route('admin.locations') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="9"></circle>
                                    <line x1="3" y1="12" x2="21" y2="12"></line>
                                    <path d="M12 3a14.5 14.5 0 0 1 4.5 9 14.5 14.5 0 0 1-4.5 9 14.5 14.5 0 0 1-4.5-9 14.5 14.5 0 0 1 4.5-9z"></path>
                                </svg>
                                <span>Locations</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.databases') ? 'active' : '' }}">
                            <a href="{{ route('admin.databases') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                                </svg>
                                <span>Databases</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.ksm') ? 'active' : '' }}">
                            <a href="{{ route('admin.ksm') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="5" y="5" width="14" height="14" rx="2"></rect>
                                    <rect x="9" y="9" width="6" height="6"></rect>
                                    <path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"></path>
                                </svg>
                                <span>Kernel Memory (KSM)</span>
                            </a>
                        </li>

                        <li class="header">Access & Services</li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.users') ? 'active' : '' }}">
                            <a href="{{ route('admin.users') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                <span>Users</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.nests') ? 'active' : '' }}">
                            <a href="{{ route('admin.nests') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                </svg>
                                <span>Nests & Eggs</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.mounts') ? 'active' : '' }}">
                            <a href="{{ route('admin.mounts') }}">
                                <svg class="v-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                                    <line x1="3" y1="14" x2="21" y2="14"></line>
                                    <circle cx="17" cy="17" r="1" fill="currentColor"></circle>
                                    <line x1="7" y1="9" x2="13" y2="9"></line>
                                </svg>
                                <span>Mounts</span>
                            </a>
                        </li>
                        <li id="adminSidebarEmpty" class="sidebar-empty-state" style="display: none;">
                            <span>No matching navigation</span>
                        </li>
                    </ul>
                </section>
                <div class="sidebar-footer-widget">
                    <a href="{{ route('index') }}" class="sidebar-client-btn" title="Exit Administration & Return to Client Panel">
                        <div class="sidebar-client-btn-left">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                            <span>Client Panel</span>
                        </div>
                        <span class="sidebar-client-tag">Exit</span>
                    </a>
                    <div class="sidebar-status-meta">
                        <span class="sidebar-status-pulse"></span>
                        <span>Votion Core · Operational</span>
                    </div>
                </div>
            </aside>
            <div class="content-wrapper">
                <section class="content-header">
                    @yield('content-header')
                </section>
                <section class="content">
                    <div class="row">
                        <div class="col-xs-12">
                            @if (isset($errors) && count($errors) > 0)
                                <div class="alert alert-danger">
                                    <i class="fa fa-exclamation-triangle"></i>
                                    <div>
                                        <strong>There was an error validating the data provided:</strong>
                                        <ul style="margin-top: 4px; padding-left: 18px;">
                                            @foreach ($errors->all() as $error)
                                                <li>{{ $error }}</li>
                                            @endforeach
                                        </ul>
                                    </div>
                                </div>
                            @endif
                            @foreach (Alert::getMessages() as $type => $messages)
                                @foreach ($messages as $message)
                                    <div class="alert alert-{{ $type }} alert-dismissable" role="alert">
                                        <button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>
                                        <i class="fa fa-info-circle"></i>
                                        <div>{!! $message !!}</div>
                                    </div>
                                @endforeach
                            @endforeach
                        </div>
                    </div>
                    @yield('content')
                </section>
            </div>
            <footer class="main-footer">
                <div class="pull-right small text-muted">
                    <span><i class="fa fa-fw fa-clock-o"></i> {{ round(microtime(true) - (defined('LARAVEL_START') ? LARAVEL_START : microtime(true)), 3) }}s</span>
                    <span style="margin: 0 8px; opacity: 0.4;">&bull;</span>
                    <span><i class="fa fa-fw fa-code"></i> PHP {{ phpversion() }}</span>
                    <span style="margin: 0 8px; opacity: 0.4;">&bull;</span>
                    <span><i class="fa fa-fw {{ $appIsGit ? 'fa-git' : 'fa-code-fork' }}"></i> {{ $appVersion }}</span>
                </div>
                <div>
                    <strong>Lunar Panel</strong> &bull; Administrative Control Center
                </div>
            </footer>
        </div>
        @section('footer-scripts')
            <script src="/js/keyboard.polyfill.js" type="application/javascript"></script>
            <script>keyboardeventKeyPolyfill.polyfill();</script>

            {!! Theme::js('vendor/jquery/jquery.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/sweetalert/sweetalert.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/bootstrap/bootstrap.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/slimscroll/jquery.slimscroll.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/adminlte/app.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/bootstrap-notify/bootstrap-notify.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/select2/select2.full.min.js?t={cache-version}') !!}
            {!! Theme::js('js/admin/functions.js?t={cache-version}') !!}
            <script src="/js/autocomplete.js" type="application/javascript"></script>

            @if(Auth::user()?->root_admin)
                <script>
                    $('#logoutButton').on('click', function (event) {
                        event.preventDefault();

                        var that = this;
                        swal({
                            title: 'Do you want to log out?',
                            type: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#d9534f',
                            cancelButtonColor: '#d33',
                            confirmButtonText: 'Log out'
                        }, function () {
                             $.ajax({
                                type: 'POST',
                                url: '{{ route('auth.logout') }}',
                                data: {
                                    _token: '{{ csrf_token() }}'
                                },complete: function () {
                                    window.location.href = '{{route('auth.login')}}';
                                }
                        });
                    });
                });
                </script>
            @endif

            <script>
                $(function () {
                    $('[data-toggle="tooltip"]').tooltip();

                    // Votion UTC Live Digital Clock
                    function updateVotionClock() {
                        var el = document.getElementById('votionLiveClock');
                        if (!el) return;
                        var now = new Date();
                        var h = String(now.getUTCHours()).padStart(2, '0');
                        var m = String(now.getUTCMinutes()).padStart(2, '0');
                        var s = String(now.getUTCSeconds()).padStart(2, '0');
                        el.textContent = h + ':' + m + ':' + s + ' UTC';
                    }
                    setInterval(updateVotionClock, 1000);
                    updateVotionClock();

                    // Votion Instant Sidebar Search Filter
                    function filterAdminSidebar(query) {
                        query = (query || '').toLowerCase().trim();
                        var $items = $('.sidebar-menu > li:not(.header):not(#adminSidebarEmpty)');
                        var $headers = $('.sidebar-menu > li.header');
                        var $empty = $('#adminSidebarEmpty');
                        var $clearBtn = $('#adminSidebarSearchClear');
                        var $badge = $('.sidebar-search-badge');

                        if (query.length > 0) {
                            $clearBtn.show();
                            $badge.hide();
                        } else {
                            $clearBtn.hide();
                            $badge.show();
                        }

                        if (!query) {
                            $items.show();
                            $headers.show();
                            $empty.hide();
                            return;
                        }

                        var visibleCount = 0;
                        $items.each(function () {
                            var text = $(this).find('span').text().toLowerCase();
                            var match = text.indexOf(query) !== -1;
                            $(this).toggle(match);
                            if (match) visibleCount++;
                        });

                        $headers.each(function () {
                            var $nextItems = $(this).nextUntil('.header', 'li:not(.header):not(#adminSidebarEmpty)');
                            var hasVisible = $nextItems.filter(':visible').length > 0;
                            $(this).toggle(hasVisible);
                        });

                        if (visibleCount === 0) {
                            $empty.show();
                        } else {
                            $empty.hide();
                        }
                    }

                    $('#adminSidebarSearch').on('input', function () {
                        filterAdminSidebar($(this).val());
                    });

                    $('#adminSidebarSearchClear').on('click', function () {
                        $('#adminSidebarSearch').val('').focus();
                        filterAdminSidebar('');
                    });

                    // Shortcut / or Ctrl+K / Cmd+K to search, Esc to reset
                    $(document).on('keydown', function (e) {
                        if (e.key === 'Escape' && $('#adminSidebarSearch').is(':focus')) {
                            $('#adminSidebarSearch').val('');
                            filterAdminSidebar('');
                            $('#adminSidebarSearch').blur();
                            return;
                        }
                        if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !$(e.target).is('input, textarea, select')) {
                            e.preventDefault();
                            $('#adminSidebarSearch').focus().select();
                        }
                    });
                });
            </script>
        @show
    </body>
</html>
