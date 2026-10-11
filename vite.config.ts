import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import ASSO from './asso.config.js';
import { HOME_DESCRIPTION, HOME_TITLE } from './src/lib/seoText';

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Mode démo : `npm run demo` (vite --mode demo) ou DEMO=1. Données fictives, sans Google. */
function isDemo(mode: string) {
  return mode === 'demo' || /^(1|true|oui)$/i.test(String(process.env.DEMO || '').trim());
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Redirections /api/… → nom de fonction, lues dans netlify.toml (une seule source). */
function functionRoutes() {
  const toml = fs.readFileSync(path.resolve(__dirname, 'netlify.toml'), 'utf8');
  const routes: { from: string; name: string }[] = [];
  for (const m of toml.matchAll(/from\s*=\s*"([^"]+)"\s*\r?\n\s*to\s*=\s*"\/\.netlify\/functions\/([\w-]+)/g)) {
    routes.push({ from: m[1], name: m[2] });
  }
  return routes;
}

function functionFor(pathname: string, routes: { from: string; name: string }[]) {
  const direct = pathname.match(/^\/\.netlify\/functions\/([\w-]+)/);
  if (direct) return direct[1];
  const exact = routes.find((r) => r.from === pathname);
  if (exact) return exact.name;
  const splat = routes.find((r) => r.from.endsWith('/*') && pathname.startsWith(r.from.slice(0, -1)));
  return splat?.name || '';
}

/**
 * En démo, sert les fonctions Netlify dans le serveur Vite (pas besoin de `netlify dev`).
 * Le code des fonctions est le vrai ; seuls les clients Google sont fictifs (_demo.mjs).
 */
function netlifyFunctionsDev(): Plugin {
  return {
    name: 'netlify-functions-dev',
    apply: 'serve',
    configureServer(server) {
      const routes = functionRoutes();
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const name = functionFor(url.pathname, routes);
        if (!name) return next();
        try {
          const mod = await server.ssrLoadModule(path.resolve(__dirname, 'netlify/functions', `${name}.mjs`));
          const body = await readBody(req);
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k.toLowerCase()] = v;
          const out = await mod.handler({
            httpMethod: req.method,
            path: url.pathname,
            rawUrl: url.href,
            queryStringParameters: Object.fromEntries(url.searchParams),
            headers,
            body: body.length ? body.toString('utf8') : null,
            isBase64Encoded: false,
          });
          res.statusCode = out?.statusCode || 200;
          for (const [k, v] of Object.entries(out?.headers || {})) if (v !== undefined) res.setHeader(k, String(v));
          const payload = out?.body ?? '';
          res.end(out?.isBase64Encoded ? Buffer.from(payload, 'base64') : payload);
        } catch (err) {
          console.error(`[fonction ${name}]`, err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Erreur dans la fonction ${name} (voir le terminal).` }));
        }
      });
    },
  };
}

/** Remplit les %ASSO_…% de index.html depuis asso.config.js. */
function assoHtml(demo = false): Plugin {
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
      const out = html.replace(/%(ASSO_[A-Z]+)%/g, (m, key: string) =>
        key in values ? escAttr(values[key]) : m,
      );
      // Un site de démo ne doit pas être indexé.
      return demo ? out.replace(/<meta name="robots" content="[^"]*"/, '<meta name="robots" content="noindex, nofollow"') : out;
    },
  };
}

/**
 * Configuration Vite — site d'association
 * Optimisée pour déploiement statique Netlify + prerender
 * Minify / transform : esbuild
 */
export default defineConfig(({ mode }) => {
  const demo = isDemo(mode);
  // Lu par les fonctions Netlify servies en démo (netlify/functions/_demo.mjs).
  if (demo) process.env.DEMO = '1';
  return {
    plugins: [react(), assoHtml(demo), ...(demo ? [netlifyFunctionsDev()] : [])],

    define: {
      'import.meta.env.VITE_DEMO': JSON.stringify(demo ? '1' : ''),
    },

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
  };
});
