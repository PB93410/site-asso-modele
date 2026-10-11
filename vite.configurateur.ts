import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/**
 * Questionnaire en ligne pour les associations (/configurer) : un site à part,
 * hébergé une seule fois, qui produit le dossier lu par `npm run installer`.
 *
 *   npm run configurateur         en local
 *   npm run build:configurateur   → configurateur/dist (Netlify : configurateur/netlify.toml)
 */
export default defineConfig({
  root: path.resolve(__dirname, 'configurateur'),
  publicDir: false,
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss({ config: path.resolve(__dirname, 'configurateur/tailwind.config.js') }), autoprefixer()],
    },
  },
  server: { port: 5180 },
  build: {
    outDir: path.resolve(__dirname, 'configurateur/dist'),
    emptyOutDir: true,
    target: 'es2022',
  },
});
