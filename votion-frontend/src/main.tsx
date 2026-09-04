import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initTheme } from './theme';
import '../styles.css';
import './index.css';

// Guard against third-party / browser DevTools Soft Navigation bug (reading 'startTime')
window.addEventListener('error', (event) => {
  const msg = event?.message || (event?.error && event?.error?.message) || '';
  const stack = event?.error?.stack || '';
  if (
    msg.includes("Cannot read properties of undefined (reading 'startTime')") ||
    msg.includes("reading 'startTime'") ||
    stack.includes('reportAllChanges')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Gracefully fade out the global preloader once React has mounted
const preloader = document.getElementById('votion-global-preloader');
if (preloader) {
  setTimeout(() => {
    preloader.style.opacity = '0';
    preloader.style.pointerEvents = 'none';
    setTimeout(() => preloader.remove(), 600);
  }, 100);
}
