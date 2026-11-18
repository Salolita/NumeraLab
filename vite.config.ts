import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { pdfAssets } from './erae-tori/pdf-assets';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), pdfAssets()],
    build: { rollupOptions: { input: { main: 'index.html', register: 'register.html', continue: 'continue.html', presentation: 'presentation.html', eraeTori: 'erae-tori.html' } } },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
