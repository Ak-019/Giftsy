import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :5000. Proxying /api and /uploads makes the browser see one origin,
// so the httpOnly refresh cookie works without any CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split big libraries into their own cached files
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], charts: ['recharts'] },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
