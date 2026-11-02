import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
});
