import React from 'react';
import ReactDOM from 'react-dom';
import App from '@/components/App';
import { setConfig } from 'react-hot-loader';

// Enable language support.
import './i18n';

// Prevents page reloads while making component changes which
// also avoids triggering constant loading indicators all over
// the place in development.
//
// @see https://github.com/gaearon/react-hot-loader#hook-support
setConfig({ reloadHooks: false });

ReactDOM.render(<App />, document.getElementById('app'));

// Gracefully fade out the global preloader once React has mounted (matching votion-frontend)
const preloader = document.getElementById('votion-global-preloader');
if (preloader) {
    setTimeout(() => {
        preloader.style.opacity = '0';
        preloader.style.pointerEvents = 'none';
        setTimeout(() => preloader.remove(), 600);
    }, 150);
}

// Register Service Worker for Background Desktop Web Push Notifications
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/service-worker.js')
            .catch((err) => {
                console.warn('Lunar Panel Service Worker registration failed:', err);
            });
    });
}

