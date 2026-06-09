import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://localhost:8081'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});