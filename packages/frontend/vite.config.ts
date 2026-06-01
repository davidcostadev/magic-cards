import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5000,
    host: true,
    allowedHosts: ['.davidcosta.dev', 'blue.davidcosta.dev'],
    // Proxy API calls so the browser only ever talks to this origin (no direct localhost:3001,
    // which trips mixed-content / private-network access over HTTPS/remote hosts).
    proxy: {
      '/v1': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  preview: {
    port: 5000,
    host: true,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
