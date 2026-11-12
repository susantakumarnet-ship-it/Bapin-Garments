import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Proxy to the API on the PORT set in server/.env (default 4000), so the two always match.
const serverEnv = loadEnv('', fileURLToPath(new URL('../server', import.meta.url)), '');
const API = process.env.VITE_API_PROXY || `http://localhost:${serverEnv.PORT || 4000}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
