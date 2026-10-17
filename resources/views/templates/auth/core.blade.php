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

        /* Prevent ugly browser autofill background on underline inputs */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
            -webkit-text-fill-color: #ffffff !important;
            -webkit-box-shadow: 0 0 0px 1000px #0c0c0c inset !important;
            box-shadow: 0 0 0px 1000px #0c0c0c inset !important;
            transition: background-color 5000s ease-in-out 0s;
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

        /* Luxury Action Button Animations */
        @keyframes luxury-button-ripple {
            0% {
                transform: scale(0.94);
                opacity: 0.95;
            }
            40% {
                opacity: 0.6;
            }
            100% {
                transform: scale(1.85);
                opacity: 0;
            }
        }

        @keyframes luxury-button-glow {
            0%, 100% {
                box-shadow: 0 0 25px rgba(255, 255, 255, 0.25), 0 0 50px rgba(255, 255, 255, 0.1);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 55px rgba(255, 255, 255, 0.6), 0 0 95px rgba(255, 255, 255, 0.25);
                transform: scale(1.03);
            }
        }
    </style>
@endsection

@section('container')
    <div id="app"></div>
@endsection
