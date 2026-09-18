@extends('templates/wrapper', [
    'css' => ['body' => 'cds--dark-theme m-0 p-0']
])

@section('title', 'Log in to Votion Cloud – Votion Cloud')

@section('assets')
    <link rel="stylesheet" href="/assets/carbon.css?v={{ file_exists(public_path('assets/carbon.css')) ? filemtime(public_path('assets/carbon.css')) : time() }}">
    <style>
        /* 1:1 IBM Cloud Carbon Design System Overrides */
        html,
        body.cds--dark-theme {
            background-color: #161616 !important;
            font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            overflow-x: hidden !important;
            max-width: 100vw !important;
        }

        #app,
        .App___StyledDiv-sc-2l91w7-0,
        .w-full.min-h-screen {
            background-color: transparent !important;
            background: transparent !important;
            overflow-x: hidden !important;
        }

        /* The container with the 3D isometric network background */
        .ibm-cloud-app.ibm-cloud-react-container,
        body.cds--dark-theme .ibm-cloud-react-container {
            background-image: url(/assets/carbon-bg.png) !important;
            background-position: 0 0 !important;
            background-repeat: no-repeat !important;
            background-size: cover !important;
            min-height: 100vh !important;
            width: 100% !important;
            max-width: 100vw !important;
            position: relative !important;
            overflow-x: hidden !important;
        }

        /* Fixed Top Navigation Bar */
        .cds--header.navbar {
            background-color: #161616 !important;
            border-bottom: 1px solid #393939 !important;
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            height: 3rem !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100vw !important;
            padding-left: 1rem !important;
            padding-right: 1.5rem !important;
            z-index: 8000 !important;
            overflow: hidden !important;
        }

        .cds--header.navbar .cds--header__name {
            display: inline-flex !important;
            align-items: center !important;
            color: #f4f4f4 !important;
            font-size: 14px !important;
            text-decoration: none !important;
            letter-spacing: 0.16px !important;
            flex-shrink: 0 !important;
        }

        .cds--header.navbar .cds--header__nav {
            display: block !important;
            flex-shrink: 0 !important;
        }

        .cds--header.navbar .cds--header__menu-bar {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            list-style: none !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
        }

        .cds--header.navbar .cds--header__menu-item {
            display: inline-flex !important;
            align-items: center !important;
            height: 3rem !important;
            padding: 0 16px !important;
            color: #c6c6c6 !important;
            font-size: 14px !important;
            text-decoration: none !important;
            white-space: nowrap !important;
            transition: background-color 70ms cubic-bezier(0,0,.38,.9), color 70ms cubic-bezier(0,0,.38,.9) !important;
        }

        .cds--header.navbar .cds--header__menu-item:hover {
            background-color: #353535 !important;
            color: #ffffff !important;
        }

        .cds--header.navbar .navbar__icon {
            display: inline-flex !important;
            align-items: center !important;
            margin-right: 8px !important;
        }

        .cds--header.navbar .navbar__icon svg {
            fill: #c6c6c6 !important;
        }

        .cds--header.navbar .cds--header__menu-item:hover .navbar__icon svg {
            fill: #ffffff !important;
        }

        @media screen and (max-width: 820px) {
            .navbar .navbar__menu-text {
                display: none !important;
            }
            .cds--header.navbar .cds--header__menu-item {
                padding: 0 10px !important;
            }
            .cds--header.navbar .navbar__icon {
                margin-right: 0 !important;
            }
        }

        /* Unmask app-container so the 3D isometric graphic is fully visible */
        .ibm-cloud-app .app-container,
        [data-theme="dark"] .ibm-cloud-app .app-container,
        .app-container {
            background-color: transparent !important;
            background: transparent !important;
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            height: 100% !important;
            min-height: 100vh !important;
            padding: 0 !important;
            overflow-x: hidden !important;
            max-width: 100vw !important;
        }

        /* Left panel login wrapper */
        .app-container .login-wrapper {
            background-color: #161616 !important;
            box-sizing: content-box !important;
            display: flex !important;
            flex-direction: column !important;
            flex-grow: 1 !important;
            padding-left: 4rem !important;
            padding-right: 6rem !important;
            padding-top: 8.875rem !important;
            width: 31.25rem !important;
            min-height: calc(100vh - 8.875rem) !important;
        }

        @media screen and (max-width: 1162px) {
            .app-container .login-wrapper {
                box-sizing: border-box !important;
                width: 30rem !important;
                padding-left: 3rem !important;
                padding-right: 3rem !important;
            }
        }

        @media screen and (max-width: 640px) {
            .ibm-cloud-app.ibm-cloud-react-container {
                background-image: none !important;
            }
            .app-container .login-container {
                align-items: center !important;
                width: 100% !important;
            }
            .app-container .login-wrapper {
                box-sizing: border-box !important;
                padding-left: 1.25rem !important;
                padding-right: 1.25rem !important;
                padding-top: 5rem !important;
                width: 100% !important;
            }
        }

        /* Typography fix: prevent serif Newsreader from bleeding in */
        .ibm-cloud-app,
        .ibm-cloud-app * {
            font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        .ibm-cloud-app .login-form__title,
        .login-form__title {
            font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 2rem !important;
            font-weight: 300 !important;
            line-height: 1.25 !important;
            color: #f4f4f4 !important;
            margin-top: 24px !important;
            letter-spacing: 0 !important;
        }

        .ibm-cloud-app .login-form__title .login-form__title-2,
        .login-form__title .login-form__title-2 {
            font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-weight: 600 !important;
            color: #f4f4f4 !important;
            margin-left: 4px !important;
        }

        /* Primary Button (Continue / Log in / Submit) */
        .ibm-cloud-app .cds--btn--primary,
        .ibm-cloud-app .login-form__button.cds--btn--primary,
        .cds--btn--primary {
            background-color: #0f62fe !important;
            color: #ffffff !important;
            border: none !important;
            height: 48px !important;
            min-height: 48px !important;
            padding: 0 16px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 400 !important;
            transition: background-color 70ms cubic-bezier(0,0,.38,.9) !important;
        }

        .ibm-cloud-app .cds--btn--primary:hover,
        .ibm-cloud-app .login-form__button.cds--btn--primary:hover {
            background-color: #0353e9 !important;
        }

        .ibm-cloud-app .cds--btn--primary:active,
        .ibm-cloud-app .login-form__button.cds--btn--primary:active {
            background-color: #002d9c !important;
        }

        .ibm-cloud-app .cds--btn--primary:disabled,
        .ibm-cloud-app .login-form__button.cds--btn--primary:disabled {
            background-color: #393939 !important;
            color: #8d8d8d !important;
            cursor: not-allowed !important;
        }

        .ibm-cloud-app .cds--btn--primary .cds--btn__icon {
            fill: #ffffff !important;
            width: 16px !important;
            height: 16px !important;
        }

        /* Watsonx Promotion Box */
        .promotion-container {
            align-items: center !important;
            display: flex !important;
            flex-direction: column !important;
            flex-grow: 1 !important;
            justify-content: center !important;
        }

        @media screen and (max-width: 1162px) {
            .app-container .promotion-container,
            .promotion-container {
                display: none !important;
            }
        }

        .app-container .promotion-container .promotion-wrapper {
            height: 440px !important;
            width: 470px !important;
        }

        .promotion-box {
            background-image: linear-gradient(180deg, #e5f6ff, #bae6ff) !important;
            background-position: 50% !important;
            background-repeat: no-repeat !important;
            background-size: cover !important;
            height: 100% !important;
            width: 100% !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 48px 40px 40px 40px !important;
        }

        .promotion-title-wrapper {
            padding: 0 !important;
        }

        .promotion-box .promotion-title {
            color: #000000 !important;
            font-size: 2.25rem !important;
            font-weight: 300 !important;
            line-height: 1.2 !important;
            font-family: 'IBM Plex Sans', sans-serif !important;
            margin: 0 !important;
        }

        .promotion-description-wrapper {
            padding: 0 !important;
            margin-top: 16px !important;
        }

        .promotion-box .promotion-description {
            color: #000000 !important;
            font-size: 1.5rem !important;
            font-weight: 400 !important;
            line-height: 1.35 !important;
            font-family: 'IBM Plex Sans', sans-serif !important;
            margin: 0 !important;
        }

        .promotion-box .promotion-button-wrapper {
            padding: 0 !important;
            margin-top: auto !important;
            padding-top: 24px !important;
        }

        .promotion-box .promotion-button,
        .promotion-box button.promotion-button,
        .promotion-box a.promotion-button,
        .promotion-box a.promotion-button:link,
        .promotion-box a.promotion-button:visited {
            border: 1px solid #0f62fe !important;
            background-color: transparent !important;
            color: #0f62fe !important;
            height: 48px !important;
            min-height: 48px !important;
            padding: 0 16px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            text-align: left !important;
            text-decoration: none !important;
            outline: none !important;
            font-family: 'IBM Plex Sans', sans-serif !important;
            font-size: 14px !important;
            font-weight: 400 !important;
            letter-spacing: 0.16px !important;
            line-height: 1 !important;
            transition: background-color 70ms cubic-bezier(0,0,.38,.9), color 70ms cubic-bezier(0,0,.38,.9), border-color 70ms cubic-bezier(0,0,.38,.9) !important;
        }

        .promotion-box .promotion-button:hover,
        .promotion-box button.promotion-button:hover,
        .promotion-box a.promotion-button:hover {
            background-color: #0f62fe !important;
            color: #ffffff !important;
            border-color: #0f62fe !important;
        }

        .promotion-box .promotion-button:active,
        .promotion-box button.promotion-button:active,
        .promotion-box a.promotion-button:active {
            background-color: #002d9c !important;
            color: #ffffff !important;
            border-color: #002d9c !important;
        }

        .promotion-box .promotion-button-text,
        .promotion-box a.promotion-button .promotion-button-text {
            font-size: 14px !important;
            font-weight: 400 !important;
            color: inherit !important;
            font-family: 'IBM Plex Sans', sans-serif !important;
            letter-spacing: 0.16px !important;
            line-height: 1 !important;
        }

        /* SSO buttons (Red Hat, Google, Passkey) */
        .ibm-cloud-app .gsi-material-button {
            height: 48px !important;
            min-height: 48px !important;
            border: 1px solid #525252 !important;
            background-color: transparent !important;
            color: #f4f4f4 !important;
            width: 100% !important;
            display: flex !important;
            align-items: center !important;
            padding: 0 16px !important;
            text-decoration: none !important;
        }

        .ibm-cloud-app .gsi-material-button:hover {
            background-color: #353535 !important;
            border-color: #6f6f6f !important;
            color: #ffffff !important;
        }

        .ibm-cloud-app .gsi-material-button-content-wrapper {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
        }

        .ibm-cloud-app .gsi-material-button-contents {
            font-size: 14px !important;
            font-weight: 400 !important;
        }

        /* Remember me and copyright clause */
        .app-container .copyright-clause {
            font-size: 11px !important;
            color: #8d8d8d !important;
        }
        .app-container .copyright-clause a {
            color: #78a9ff !important;
            text-decoration: underline !important;
        }

        /* ==========================================================================
           Animated VOTION Brand Logos
           1. Smooth Comet Trace — Signature orbiting light beam rectangular badge
           2. Metallic Pulse — Breathing pulse with subtle glowing drop shadow
           ========================================================================== */
        .theme-brand-logo,
        .votion-brand-badge {
            position: relative !important;
            height: 34px !important;
            box-sizing: border-box !important;
            padding: 3px !important;
            border-radius: 0 !important;
            background-color: #3f3f46 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            user-select: none !important;
            line-height: 1 !important;
            flex-shrink: 0 !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
            transition: transform 150ms ease, box-shadow 150ms ease !important;
        }

        .comet-trace-beam,
        .votion-comet-beam {
            position: absolute !important;
            top: -150% !important;
            left: -150% !important;
            width: 400% !important;
            height: 400% !important;
            pointer-events: none !important;
            z-index: 1 !important;
            background: conic-gradient(
                from 0deg,
                transparent 0deg,
                transparent 285deg,
                rgba(255, 255, 255, 0.04) 292deg,
                rgba(255, 255, 255, 0.15) 315deg,
                rgba(255, 255, 255, 0.40) 338deg,
                rgba(255, 255, 255, 0.80) 352deg,
                rgba(255, 255, 255, 0.98) 358deg,
                #FFFFFF 359deg,
                #FFFFFF 360deg
            ) !important;
            animation: cometGlide 3.6s linear infinite !important;
        }

        @keyframes cometGlide {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @keyframes votionCometTrace {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .theme-brand-logo-inner,
        .votion-brand-label {
            position: relative !important;
            z-index: 2 !important;
            height: 100% !important;
            width: 100% !important;
            border-radius: 0 !important;
            background-color: #0a0a0a !important;
            color: #ededed !important;
            padding: 0 14px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif !important;
            font-size: 16px !important;
            font-weight: 800 !important;
            letter-spacing: -0.04em !important;
            text-transform: lowercase !important;
            line-height: 1 !important;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04) !important;
        }

        .theme-brand-logo:hover,
        .votion-brand-badge:hover {
            transform: scale(1.02) !important;
            box-shadow: 0 0 16px rgba(255, 255, 255, 0.2) !important;
        }

        .votion-animated-logo,
        .votion-preloader-logo {
            animation: votion-pulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
            filter: drop-shadow(0 0 16px rgba(255, 255, 255, 0.25)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6)) !important;
            will-change: transform, opacity !important;
        }

        @keyframes votion-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.72; transform: scale(0.95); }
        }
    </style>
@endsection

@section('container')
    <div id="app"></div>
@endsection

