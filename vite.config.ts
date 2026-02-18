import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@/ui': path.resolve(__dirname, 'src/ui'),
      '@/features': path.resolve(__dirname, 'src/features'),
      '@/layout': path.resolve(__dirname, 'src/layout'),
      '@/stores': path.resolve(__dirname, 'src/stores'),
      '@/hooks': path.resolve(__dirname, 'src/hooks'),
      '@/services': path.resolve(__dirname, 'src/services'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
      '@/types': path.resolve(__dirname, 'src/types'),
    },
  },
  server: {
    port: 5173,
  },
});
