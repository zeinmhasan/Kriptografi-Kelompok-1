import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // API diakses lewat origin yang sama, sehingga cookie sesi SameSite=Strict ikut terkirim.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
