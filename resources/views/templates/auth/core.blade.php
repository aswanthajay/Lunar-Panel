@extends('templates/wrapper', [
    'css' => ['body' => 'm-0 p-0 antialiased bg-black']
])

@section('title', 'Login – ' . config('app.name', 'Lunar Cloud'))

@section('assets')
    <style>
        /* Pure Matte Black Swiss Minimalist Canvas */
        html,
        body {
            background-color: #000000 !important;
            background: #000000 !important;
            color: #ffffff !important;
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
            background-color: #000000 !important;
            background: #000000 !important;
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

        /* Custom subtle scrollbar */
        ::-webkit-scrollbar {
            width: 6px;
        }
        ::-webkit-scrollbar-track {
            background: #000000;
        }
        ::-webkit-scrollbar-thumb {
            background: #262626;
            border-radius: 3px;
        }
    </style>
@endsection

@section('container')
    <div id="app"></div>
@endsection
