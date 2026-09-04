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

        @include('layouts.scripts')

        @section('scripts')
            {!! Theme::css('vendor/select2/select2.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/bootstrap/bootstrap.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/adminlte/admin.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/adminlte/colors/skin-blue.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/sweetalert/sweetalert.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/animate/animate.min.css?t={cache-version}') !!}
            {!! Theme::css('css/pterodactyl.css?t={cache-version}') !!}
            {!! Theme::css('css/lunar-admin.css?t={cache-version}') !!}
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
                <a href="{{ route('admin.index') }}" class="logo">
                    <div class="lunar-admin-logo-wrap">
                        <div class="lunar-admin-logo-mark">
                            <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="50" cy="50" r="38" stroke="#ffffff" stroke-width="8" stroke-dasharray="160 50" stroke-linecap="round" />
                                <circle cx="50" cy="50" r="18" fill="#818cf8" />
                            </svg>
                        </div>
                        <span class="lunar-admin-logo-text">Lunar</span>
                        <span class="lunar-admin-badge">Admin CP</span>
                    </div>
                </a>
                <nav class="navbar navbar-static-top">
                    <a href="#" class="sidebar-toggle" data-toggle="push-menu" role="button">
                        <span class="sr-only">Toggle navigation</span>
                    </a>
                    <div class="navbar-custom-menu">
                        <ul class="nav navbar-nav">
                            <li>
                                <a href="{{ route('index') }}" class="lunar-nav-pill-client" data-toggle="tooltip" data-placement="bottom" title="Return to Client Area">
                                    <i class="fa fa-desktop"></i>
                                    <span class="hidden-xs">Client Area</span>
                                </a>
                            </li>
                            <li class="user-menu">
                                <a href="{{ route('account') }}" data-toggle="tooltip" data-placement="bottom" title="Account Settings">
                                    <img src="https://www.gravatar.com/avatar/{{ md5(strtolower(Auth::user()->email)) }}?s=160" class="user-image" alt="User Image">
                                    <span class="hidden-xs">{{ Auth::user()->name_first }} {{ Auth::user()->name_last }}</span>
                                </a>
                            </li>
                            <li>
                                <a href="{{ route('auth.logout') }}" id="logoutButton" class="lunar-nav-pill-logout" data-toggle="tooltip" data-placement="bottom" title="Sign Out">
                                    <i class="fa fa-sign-out"></i>
                                </a>
                            </li>
                        </ul>
                    </div>
                </nav>
            </header>
            <aside class="main-sidebar">
                <section class="sidebar">
                    <ul class="sidebar-menu">
                        <li class="header">Administration</li>
                        <li class="{{ (Route::currentRouteName() === 'admin.index') ? 'active' : '' }}">
                            <a href="{{ route('admin.index') }}">
                                <i class="fa fa-th-large"></i> <span>Overview</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.settings') ? 'active' : '' }}">
                            <a href="{{ route('admin.settings') }}">
                                <i class="fa fa-sliders"></i> <span>Settings</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.api') ? 'active' : '' }}">
                            <a href="{{ route('admin.api.index') }}">
                                <i class="fa fa-key"></i> <span>Application API</span>
                            </a>
                        </li>

                        <li class="header">Infrastructure</li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.servers') ? 'active' : '' }}">
                            <a href="{{ route('admin.servers') }}">
                                <i class="fa fa-server"></i> <span>Servers</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.nodes') ? 'active' : '' }}">
                            <a href="{{ route('admin.nodes') }}">
                                <i class="fa fa-sitemap"></i> <span>Nodes</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.locations') ? 'active' : '' }}">
                            <a href="{{ route('admin.locations') }}">
                                <i class="fa fa-globe"></i> <span>Locations</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.databases') ? 'active' : '' }}">
                            <a href="{{ route('admin.databases') }}">
                                <i class="fa fa-database"></i> <span>Databases</span>
                            </a>
                        </li>

                        <li class="header">Access & Services</li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.users') ? 'active' : '' }}">
                            <a href="{{ route('admin.users') }}">
                                <i class="fa fa-users"></i> <span>Users</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.nests') ? 'active' : '' }}">
                            <a href="{{ route('admin.nests') }}">
                                <i class="fa fa-cube"></i> <span>Nests & Eggs</span>
                            </a>
                        </li>
                        <li class="{{ starts_with(Route::currentRouteName() ?? '', 'admin.mounts') ? 'active' : '' }}">
                            <a href="{{ route('admin.mounts') }}">
                                <i class="fa fa-hdd-o"></i> <span>Mounts</span>
                            </a>
                        </li>
                    </ul>
                </section>
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
                    <span><i class="fa fa-fw fa-clock-o"></i> {{ round(microtime(true) - LARAVEL_START, 3) }}s</span>
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

            @if(Auth::user()->root_admin)
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
                })
            </script>
        @show
    </body>
</html>
