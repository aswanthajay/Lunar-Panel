@extends('templates/wrapper', [
    'css' => ['body' => 'm-0 p-0 antialiased bg-white']
])

@section('title', 'Log In – ' . config('app.name', 'Lunar Cloud'))

@section('assets')
    <style>
        /* Full-Screen Edge-to-Edge Minimalist Split Screen */
        html,
        body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0a0a0a !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
            min-height: 100vh !important;
            height: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        #app,
        .App___StyledDiv-sc-2l91w7-0,
        .w-full.min-h-screen {
            background-color: #ffffff !important;
            background: #ffffff !important;
            min-height: 100vh !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        /* Immediately dismiss preloader for instantaneous display */
        #votion-global-preloader {
            display: none !important;
        }
    </style>
@endsection

@section('container')
    <div id="app"></div>
@endsection
