/**
 * Prérendu statique post-build (Puppeteer)
 * - Sert dist/
 * - Visite chaque route
 * - Écrit le HTML complet (contenu #root inclus) sans toucher aux meta/JSON-LD
 *   déjà posés par postbuild-seo.mjs (on fusionne head existant + body rendu)
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

/** Routes à prérendre = celles du sitemap écrit par postbuild-seo.mjs (src/lib/seoRoutes.ts). */
function routesFromSitemap() {
  const xml = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  return locs.map((p) => (p.length > 1 ? p.replace(/\/$/, '') : p));
}
const ROUTES = routesFromSitemap();

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = path.join(dist, urlPath === '/' ? 'index.html' : urlPath);

        if (!filePath.startsWith(dist)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(dist, 'index.html');
        }

        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        res.end(data);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

function outPathForRoute(routePath) {
  if (routePath === '/') return path.join(dist, 'index.html');
  const clean = routePath.replace(/^\//, '').replace(/\/$/, '');
  const dir = path.join(dist, clean);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'index.html');
}

function mergeHtml(existingPath, renderedHtml) {
  const rendered = renderedHtml;
  const bodyMatch = rendered.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const htmlLang = rendered.match(/<html[^>]*>/i)?.[0] || '<html lang="fr">';

  if (!fs.existsSync(existingPath)) {
    return rendered;
  }
  const existing = fs.readFileSync(existingPath, 'utf8');
  const headMatch = existing.match(/<head[^>]*>[\s\S]*?<\/head>/i);
  if (!headMatch || !bodyMatch) return rendered;

  let body = bodyMatch[1];
  if (/id=["']root["'][\s\S]*?<h1[\s>]/i.test(body)) {
    body = body.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
  }
  return `<!DOCTYPE html>\n${htmlLang}\n${headMatch[0]}\n<body>\n${body}\n</body>\n</html>\n`;
}

async function main() {
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('[prerender] dist/index.html manquant');
    process.exit(1);
  }

  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    console.error('[prerender] puppeteer non installé ou import impossible — npm i -D puppeteer');
    console.error('[prerender] le prérendu est obligatoire pour le SEO');
    process.exit(1);
  }

  const { server, port } = await startStaticServer();
  const base = `http://127.0.0.1:${port}`;
  console.log(`[prerender] serveur local :${port}`);

  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  const launchTries = [];
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchTries.push({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: launchArgs,
    });
  }
  if (process.platform === 'win32') {
    launchTries.push({ headless: true, channel: 'chrome', args: launchArgs });
  }
  launchTries.push({ headless: true, args: launchArgs });

  let browser;
  try {
    let lastErr;
    for (const opts of launchTries) {
      try {
        browser = await puppeteer.launch(opts);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!browser) throw lastErr;
  } catch (err) {
    server.close();
    console.error('[prerender] puppeteer.launch() a échoué (Chromium absent ou bloqué)');
    console.error('[prerender]', err && err.message ? err.message : err);
    process.exit(1);
  }

  let ok = 0;
  let failed = 0;
  try {
    for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      const url = base + (route === '/' ? '/' : route);
      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForFunction(
          () => {
            const root = document.getElementById('root');
            return root && root.innerText && root.innerText.replace(/\s+/g, ' ').trim().length > 80;
          },
          { timeout: 30000 }
        );
        await new Promise((r) => setTimeout(r, 300));

        const html = await page.content();
        const out = outPathForRoute(route);
        const merged = mergeHtml(out, html);
        fs.writeFileSync(out, merged, 'utf8');

        const textLen = await page.evaluate(() =>
          (document.getElementById('root')?.innerText || '').replace(/\s+/g, ' ').trim().length
        );
        console.log(`[prerender] ${route} → ${path.relative(dist, out)} (${textLen} car. texte)`);
        ok += 1;
      } catch (e) {
        failed += 1;
        console.error(`[prerender] échec ${route}:`, e.message || e);
      } finally {
        await page.close();
      }
    }
  } finally {
    try {
      if (browser) await browser.close();
    } catch (closeErr) {
      console.warn('[prerender] fermeture Chrome (sans impact) :', closeErr.message || closeErr);
    }
    try {
      server.close();
    } catch {
      /* ignore */
    }
  }

  console.log(`[prerender] terminé — ${ok}/${ROUTES.length} routes OK`);
  if (ok === 0) {
    console.error('[prerender] aucune route prérendue');
    process.exit(1);
  }
  if (failed > 0) {
    console.error(`[prerender] ${failed} route(s) en échec`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[prerender]', e);
  process.exit(1);
});
