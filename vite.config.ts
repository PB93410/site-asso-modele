import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import ASSO from './asso.config.js';
import { HOME_DESCRIPTION, HOME_TITLE } from './src/lib/seoText';

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Remplit les %ASSO_…% de index.html depuis asso.config.js. */
function assoHtml(): Plugin {
  const values: Record<string, string> = {
    ASSO_TITLE: HOME_TITLE,
    ASSO_DESCRIPTION: HOME_DESCRIPTION,
    ASSO_NOM: ASSO.nom,
    ASSO_URL: ASSO.siteUrl.replace(/\/+$/, ''),
    ASSO_COULEUR: ASSO.couleurs.primaire,
    ASSO_HERO: ASSO.heroImage,
  };
  return {
    name: 'asso-html',
    transformIndexHtml(html) {
      return html.replace(/%(ASSO_[A-Z]+)%/g, (m, key: string) =>
        key in values ? escAttr(values[key]) : m,
      );
    },
  };
}

/**
 * Configuration Vite — site d'association
 * Optimisée pour déploiement statique Netlify + prerender
 * Minify / transform : esbuild
 */
export default defineConfig({
  plugins: [react(), assoHtml()],

  base: '/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    open: false,
    fs: {
      allow: ['.'],
    },
  },

  preview: {
    port: 4173,
  },

  // Transform & minify JS/CSS via esbuild
  esbuild: {
    target: 'es2022',
    legalComments: 'none',
    // Retire console.* et debugger du bundle prod
    drop: ['console', 'debugger'],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    cssCodeSplit: true,
    cssMinify: 'esbuild',
    minify: 'esbuild',
    // Plus rapide en CI (Netlify gzippe déjà)
    reportCompressedSize: false,
    chunkSizeWarningLimit: 500,
    // Navigateurs modernes : pas besoin du polyfill modulepreload
    modulePreload: {
      polyfill: false,
    },
    assetsInlineLimit: 4096,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
            return 'react-vendor';
          }
          if (id.includes('lucide-react')) {
            return 'lucide';
          }
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
    esbuildOptions: {
      target: 'es2022',
    },
  },
});
