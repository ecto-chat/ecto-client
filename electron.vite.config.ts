import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: {
        entry: 'src/electron/main.ts',
      },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: {
        entry: 'src/electron/preload.ts',
        formats: ['cjs'],
      },
      rollupOptions: {
        output: {
          entryFileNames: 'preload.js',
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: 'index.html',
      },
    },
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
    plugins: [react(), tailwindcss()],
  },
});
