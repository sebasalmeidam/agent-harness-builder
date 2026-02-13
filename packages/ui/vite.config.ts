import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiPort = process.env['PORT'] ?? 3001;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
