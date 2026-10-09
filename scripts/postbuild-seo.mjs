/**
 * Post-build SEO
 * 1. Génère sitemap.xml depuis ROUTES (src/lib/seoRoutes.ts)
 * 2. Pré-génère des HTML statiques pour les routes clés
 *    (meilleur premier HTML pour les crawlers, sans SSR complet)
 * 3. Écrit robots.txt, humans.txt, .well-known/security.txt et 404.html depuis asso.config.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { ASSO, SITE_URL } from '../asso.derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const SITE = SITE_URL;

/** Bundle src/lib/schema-export.ts → scripts/.generated/schema-api.mjs */
async function loadSchemaApi() {
  const outDir = path.join(__dirname, '.generated');
  const outfile = path.join(outDir, 'schema-api.mjs');
  fs.mkdirSync(outDir, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(root, 'src/lib/schema-export.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}

/** Routes indexables : src/lib/seoRoutes.ts (chargées dans main). */
let ROUTES = [];

/** URL canonique = forme 200 Netlify (slash final). Sans slash → 301 Pretty URLs. */
function pageUrl(routePath) {
  if (routePath === '/') return `${SITE}/`;
  const p = routePath.endsWith('/') ? routePath : `${routePath}/`;
  return `${SITE}${p}`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Génère le sitemap XML à partir de ROUTES (source unique). */
function generateSitemapFromRoutes() {
  const urls = ROUTES.map((route) => {
    const loc = pageUrl(route.path);
    const priority = route.priority || (route.path === '/' ? '1.0' : '0.8');
    const changefreq = route.changefreq || 'monthly';
    let block = `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>`;
    if (Array.isArray(route.images)) {
      for (const img of route.images) {
        block += `
    <image:image>
      <image:loc>${escapeXml(img.loc)}</image:loc>
      <image:title>${escapeXml(img.title)}</image:title>
      <image:caption>${escapeXml(img.caption)}</image:caption>
    </image:image>`;
      }
    }
    block += `
  </url>`;
    return block;
  }).join('\n\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

${urls}
</urlset>
`;

  const targets = [path.join(dist, 'sitemap.xml')];
  for (const file of targets) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      // dist peut ne pas encore avoir été créé si appelé trop tôt — on ignore
      if (file.includes(`${path.sep}dist${path.sep}`) || file.endsWith(`${path.sep}dist${path.sep}sitemap.xml`.replace(/\\/g, path.sep))) {
        if (!fs.existsSync(dist)) {
          console.warn('[seo] dist/ absent — sitemap public uniquement');
          continue;
        }
      }
    }
    try {
      fs.writeFileSync(file, xml, 'utf8');
      console.log(`[seo] sitemap → ${path.relative(root, file)} (${ROUTES.length} URLs, lastmod ${today})`);
    } catch (e) {
      console.warn(`[seo] sitemap write ${file}:`, e.message || e);
    }
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripJsonLd(html) {
  return html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');
}

function injectJsonLd(html, schemas) {
  const list = (Array.isArray(schemas) ? schemas : [schemas]).filter(Boolean);
  if (list.length === 0) return html;
  const tags = list
    .map((data) => `<script type="application/ld+json">\n${JSON.stringify(data)}\n</script>`)
    .join('\n    ');
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `    ${tags}\n  </head>`);
  }
  return `${html}\n${tags}`;
}

/**
 * Une intention par page (source : src/lib/schema.ts).
 * Filtre + injection : plus de mélange FAQ / Event / HowTo / Org sur chaque HTML.
 */
function rewriteJsonLd(html, routePath, api) {
  html = stripJsonLd(html);
  const schemas = schemasForRoute(routePath, api);
  return injectJsonLd(html, schemas);
}

/**
 * Événements pour le JSON-LD de l’accueil : dist/data/evenements.csv (Sheet publié ou
 * public/data), complété par src/data/siteData.ts (EVENTS) — même fusion que le site.
 */
function loadEvents(api) {
  const file = path.join(dist, 'data', 'evenements.csv');
  const fromCsv = fs.existsSync(file) ? api.parseEventCSV(fs.readFileSync(file, 'utf8')) : [];
  const titles = new Set(fromCsv.map((e) => api.eventKey(e.title)));
  const local = api.EVENTS.filter((e) => !titles.has(api.eventKey(e.title)));
  return [...local, ...fromCsv];
}

function schemasForRoute(routePath, api) {
  const p = routePath.replace(/\/$/, '') || '/';
  if (p === '/') return [api.buildHomeSchema(), api.buildEventsSchema(loadEvents(api))].filter(Boolean);
  if (p === '/faq') return [api.buildSiteFaqSchema()];
  if (p === '/essai' || p === '/inscription') return [api.buildHowToJoinSchema()];

  const activity = api.ACTIVITY_PAGES.find((a) => `/${a.slug}` === p);
  if (activity) {
    return [
      api.buildActivitySchema(activity),
      api.buildBreadcrumbSchema([
        { name: 'Accueil', item: `${SITE}/` },
        { name: activity.name, item: `${SITE}/${activity.slug}/` },
      ]),
    ];
  }

  const blogMatch = p.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const post = api.BLOG_ARTICLES.find((a) => a.slug === blogMatch[1]);
    if (post) {
      return [
        api.buildArticleSchema(post),
        api.buildBreadcrumbSchema([
          { name: 'Accueil', item: `${SITE}/` },
          { name: 'Blog', item: `${SITE}/blog/` },
          { name: post.title, item: `${SITE}/blog/${post.slug}/` },
        ]),
      ];
    }
  }

  return [];
}

function setMetaByAttr(html, attr, name, content) {
  const re = new RegExp(
    `<meta\\s+${attr}="${name}"\\s+content="[^"]*"\\s*/?>`,
    'i',
  );
  const tag = `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

function applyHead(html, route, canonical, api) {
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(route.title)}</title>`);
  html = setMetaByAttr(html, 'name', 'description', route.description);
  if (/rel="canonical"/i.test(html)) {
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${canonical}" />`,
    );
  }
  html = html.replace(
    /hreflang="fr-fr"\s+href="[^"]*"/i,
    `hreflang="fr-fr" href="${canonical}"`,
  );
  html = html.replace(
    /hreflang="x-default"\s+href="[^"]*"/i,
    `hreflang="x-default" href="${canonical}"`,
  );
  html = setMetaByAttr(html, 'property', 'og:title', route.title);
  html = setMetaByAttr(html, 'property', 'og:description', route.description);
  html = setMetaByAttr(html, 'property', 'og:url', canonical);
  html = setMetaByAttr(html, 'name', 'twitter:title', route.title);
  html = setMetaByAttr(html, 'name', 'twitter:description', route.description);
  html = rewriteJsonLd(html, route.path, api);
  return html;
}

function prerenderRoutes(api) {
  const indexPath = path.join(dist, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn('[seo] dist/index.html introuvable — lancez vite build avant');
    return;
  }
  const baseHtml = fs.readFileSync(indexPath, 'utf8');

  for (const route of ROUTES) {
    const canonical = pageUrl(route.path);
    let html = applyHead(baseHtml, route, canonical, api);

    // Noscript unique par route (contenu indexable même sans JS / si Puppeteer échoue)
    // Pas de <h1> noscript : H1 unique = React prérendu
    const noscript = `<noscript><p>${escapeHtml(route.description)} <a href="${canonical}">Version complète</a></p></noscript>`;
    if (/<noscript>[\s\S]*?<\/noscript>/i.test(html)) {
      html = html.replace(/<noscript>[\s\S]*?<\/noscript>/i, noscript);
    } else {
      html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`);
    }

    if (route.path === '/') {
      fs.writeFileSync(indexPath, html);
      console.log('[seo] prerender /');
      continue;
    }

    const dir = path.join(dist, route.path.replace(/^\//, ''));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    console.log(`[seo] prerender ${route.path}/`);
  }
}

function writeBenevolesNoindex() {
  const indexPath = path.join(dist, 'index.html');
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');
  html = stripJsonLd(html);
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>Espace bénévoles — ${escapeHtml(ASSO.nom)}</title>`);
  if (/name="robots"/i.test(html)) {
    html = html.replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
      '<meta name="robots" content="noindex, nofollow" />'
    );
  } else {
    html = html.replace('</head>', '  <meta name="robots" content="noindex, nofollow" />\n  </head>');
  }
  if (/rel="canonical"/i.test(html)) {
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${SITE}/" />`
    );
  }
  const dir = path.join(dist, 'benevoles');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log('[seo] /benevoles/ noindex (hors sitemap)');
}

async function main() {
  console.log(`[seo] build date ${today}`);
  const api = await loadSchemaApi();
  ROUTES = api.ROUTES;
  generateSitemapFromRoutes();
  prerenderRoutes(api);
  writeBenevolesNoindex();
  console.log('[seo] done');
  const cartesDir = path.join(dist, 'cartes');
  if (fs.existsSync(cartesDir)) {
    const pngs = fs.readdirSync(cartesDir).filter((name) => name.toLowerCase().endsWith('.png'));
    if (pngs.length > 0) {
      throw new Error(`dist/cartes contient ${pngs.length} PNG — ne pas publier les cartes adhérents`);
    }
  }

  writeStaticFiles();
}

/** Fichiers statiques propres à l'association (pas dans public/ : ils dépendent de asso.config.js). */
function writeStaticFiles() {
  const put = (rel, content) => {
    const file = path.join(dist, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
    console.log(`[seo] ${rel}`);
  };
  put(
    'robots.txt',
    `User-agent: *
Allow: /
Disallow: /bureau
Disallow: /benevoles
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`,
  );
  const expires = new Date(Date.now() + 300 * 864e5).toISOString();
  put(
    '.well-known/security.txt',
    `Contact: mailto:${ASSO.email}
Expires: ${expires}
Preferred-Languages: fr, en
Canonical: ${SITE}/.well-known/security.txt
Policy: ${SITE}/confidentialite
`,
  );
  put(
    'humans.txt',
    `/* ASSOCIATION */

Nom: ${ASSO.nom}
Statut: ${ASSO.statut}
Ville: ${ASSO.ville} (${ASSO.codePostal})
Contact: ${ASSO.email}
URL: ${SITE}/

/* TECHNOLOGIE */

Framework: React, Vite, Tailwind CSS
Hébergement: Netlify
`,
  );
  const c = ASSO.couleurs.primaire;
  put(
    '404.html',
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, follow" />
  <title>Page introuvable — ${escapeHtml(ASSO.nom)}</title>
  <link rel="canonical" href="${SITE}/" />
  <style>
    body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#F8F7F4;color:#111110;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
    .box{max-width:28rem;text-align:center}
    .label{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${c};margin-bottom:1rem}
    h1{font-size:1.75rem;margin:0 0 1rem;line-height:1.2}
    p{color:#4A4843;line-height:1.6;margin:0 0 1.75rem}
    a{display:inline-block;background:${c};color:#fff;text-decoration:none;font-weight:600;padding:0.75rem 1.5rem;border-radius:999px;min-height:44px;line-height:1.4}
  </style>
</head>
<body>
  <div class="box">
    <p class="label">Erreur 404</p>
    <h1>Page introuvable</h1>
    <p>Cette adresse n'existe pas sur le site de ${escapeHtml(ASSO.nom)}. Vérifiez le lien ou revenez à l'accueil.</p>
    <a href="/">Retour à l'accueil</a>
  </div>
</body>
</html>
`,
  );
}

main().catch((err) => {
  console.error('[seo] échec', err);
  process.exit(1);
});
