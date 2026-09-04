import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
      '/novnc': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/api2': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/pve2': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/proxmox-console': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: 'esnext'
  }
});
