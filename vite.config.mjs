import { defineConfig } from 'vite';

// En desarrollo, la pantalla usa el servidor que esté abierto en 4400 (o MYB_API).
export default defineConfig({
  server: { proxy: { '/api': { target: process.env.MYB_API || 'http://localhost:4400', changeOrigin: true } } },
  build: { chunkSizeWarningLimit: 900 },
});
