/**
 * Génère les visuels de base à partir de asso.config.js :
 *   logo.svg, logo-512.png, favicons, og-image.png, verso de carte adhérent,
 *   et des images de remplacement (hero, activités, coachs, logo fédération).
 *
 *   npm run identite            → n'écrase pas une image déjà présente
 *   npm run identite -- --force → régénère tout
 *
 * Remplacez ensuite les images de remplacement par vos vraies photos
 * (même nom de fichier, ou changez le chemin dans asso.config.js / src/data/siteData.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSO, SAISON_COURTE, SITE_URL } from '../asso.derive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const ASSETS = path.join(PUB, 'assets');
const FORCE = process.argv.includes('--force');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const P = ASSO.couleurs.primaire;
const S = ASSO.couleurs.secondaire;
const INITIALES = (ASSO.sigle || ASSO.nomCourt).slice(0, 3).toUpperCase();

/** Logo fourni par l'association (asso.config.js → logo) : il remplace le monogramme partout. */
const LOGO_FICHIER = ASSO.logo && ASSO.logo !== '/assets/logo.svg' ? path.join(PUB, ASSO.logo.replace(/^\/+/, '')) : '';
const LOGO_PERSO = Boolean(LOGO_FICHIER && fs.existsSync(LOGO_FICHIER));
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function write(rel, content) {
  const file = path.join(PUB, rel);
  if (!FORCE && fs.existsSync(file)) {
    console.log(`[identite] garde ${rel}`);
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`[identite] écrit ${rel}`);
  return true;
}

// ---------- SVG ----------

function logoSvg() {
  const size = INITIALES.length > 2 ? 190 : 230;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${P}"/>
  <text x="256" y="256" dy=".35em" text-anchor="middle" font-family="system-ui, Segoe UI, Arial, sans-serif" font-weight="800" font-size="${size}" fill="#fff">${esc(INITIALES)}</text>
</svg>
`;
}

/** Visuel abstrait : dégradé + formes douces. `tint` décale la teinte entre images. */
function sceneSvg(w, h, tint, label = '') {
  const id = `g${tint}`;
  const text = label
    ? `<text x="${w / 2}" y="${h - 48}" text-anchor="middle" font-family="system-ui, Segoe UI, Arial, sans-serif" font-size="${Math.round(h / 16)}" font-weight="700" fill="rgba(255,255,255,.85)">${esc(label)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tint % 2 ? S : P}"/>
      <stop offset="1" stop-color="#1A1916"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>
  <circle cx="${w * (0.2 + 0.1 * (tint % 3))}" cy="${h * 0.35}" r="${h * 0.45}" fill="#fff" opacity=".07"/>
  <circle cx="${w * 0.85}" cy="${h * (0.7 - 0.05 * (tint % 4))}" r="${h * 0.32}" fill="#fff" opacity=".06"/>
  <circle cx="${w * 0.55}" cy="${h * 1.05}" r="${h * 0.4}" fill="#000" opacity=".12"/>
  ${text}
</svg>
`;
}

function coachSvg(tint) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
  <rect width="400" height="500" fill="${tint % 2 ? S : P}" opacity=".18"/>
  <rect width="400" height="500" fill="#F4F1EA" opacity=".55"/>
  <circle cx="200" cy="190" r="78" fill="${tint % 2 ? S : P}" opacity=".55"/>
  <path d="M60 500c0-90 63-160 140-160s140 70 140 160z" fill="${tint % 2 ? S : P}" opacity=".55"/>
</svg>
`;
}

function federationSvg() {
  const label = ASSO.federation.sigle || 'FÉDÉRATION';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 96">
  <rect x="2" y="2" width="236" height="92" rx="14" fill="#fff" stroke="${S}" stroke-width="3"/>
  <text x="120" y="48" dy=".35em" text-anchor="middle" font-family="system-ui, Segoe UI, Arial, sans-serif" font-weight="800" font-size="34" fill="${S}">${esc(label)}</text>
</svg>
`;
}

// ---------- PNG (via Puppeteer) ----------

function ogHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box;
    background:linear-gradient(135deg,${P},#1A1916);color:#fff;font-family:system-ui,Segoe UI,Arial,sans-serif}
  h1{font-size:72px;line-height:1.02;margin:0 0 24px;font-weight:800}
  p{font-size:34px;margin:0;opacity:.9}
  small{position:absolute;bottom:48px;left:90px;font-size:26px;opacity:.75}
  </style></head><body>
  <h1>${esc(ASSO.nom)}</h1>
  <p>${esc(ASSO.accroche)} à ${esc(ASSO.ville)}</p>
  <small>${esc(SITE_URL.replace(/^https?:\/\//, ''))}</small>
  </body></html>`;
}

function versoHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1011px;height:638px;box-sizing:border-box;padding:56px 64px;border-radius:36px;
    background:#111110;color:#fff;font-family:system-ui,Segoe UI,Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between}
  .t{font-size:56px;font-weight:800;color:${P}}
  .l{font-size:30px;line-height:1.5;color:#E8E6E1}
  .s{font-size:24px;color:#B2AEA7}
  </style></head><body>
  <div class="t">${esc(ASSO.nomCourt.toUpperCase())}</div>
  <div class="l">${esc(ASSO.nom)}<br>${esc(ASSO.telephone)} · ${esc(ASSO.email)}<br>${esc(SITE_URL.replace(/^https?:\/\//, ''))}</div>
  <div class="s">Saison ${esc(ASSO.saison.label)} — carte personnelle, à présenter en cours.</div>
  </body></html>`;
}

/** ICO contenant un PNG (format accepté par tous les navigateurs récents). */
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

async function renderPngs() {
  const targets = [
    'assets/logo-512.png',
    'favicon-32x32.png',
    'favicon-192.png',
    'apple-touch-icon.png',
    'favicon.ico',
    'assets/og-image.png',
    `assets/carte-verso-${SAISON_COURTE}.png`,
  ];
  if (!FORCE && targets.every((t) => fs.existsSync(path.join(PUB, t)))) {
    console.log('[identite] PNG déjà présents (--force pour régénérer)');
    return;
  }
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const shot = async (html, w, h, transparent = false) => {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'load' });
      return Buffer.from(
        await page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } }),
      );
    };
    const logoUrl = LOGO_PERSO
      ? `data:${MIME[path.extname(LOGO_FICHIER).toLowerCase()] || 'image/png'};base64,${fs.readFileSync(LOGO_FICHIER).toString('base64')}`
      : '';
    const logoPage = (size) =>
      LOGO_PERSO
        ? `<!doctype html><html><body style="margin:0;background:transparent"><img src="${logoUrl}" style="display:block;width:${size}px;height:${size}px;object-fit:contain"></body></html>`
        : `<!doctype html><html><body style="margin:0;background:transparent">${logoSvg().replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;

    write('assets/logo-512.png', await shot(logoPage(512), 512, 512, true));
    const fav32 = await shot(logoPage(32), 32, 32, true);
    write('favicon-32x32.png', fav32);
    write('favicon.ico', pngToIco(fav32));
    write('favicon-192.png', await shot(logoPage(192), 192, 192, true));
    write('apple-touch-icon.png', await shot(logoPage(180), 180, 180, true));
    write('assets/og-image.png', await shot(ogHtml(), 1200, 630));
    write(`assets/carte-verso-${SAISON_COURTE}.png`, await shot(versoHtml(), 1011, 638, true));
  } finally {
    await browser.close();
  }
}

// ---------- Main ----------

fs.mkdirSync(ASSETS, { recursive: true });
if (LOGO_PERSO) console.log(`[identite] logo de l'association : ${ASSO.logo}`);
else write('assets/logo.svg', logoSvg());
if (ASSO.heroImage === '/assets/hero.svg') write('assets/hero.svg', sceneSvg(1344, 768, 0));
write('assets/act-pilates.svg', sceneSvg(900, 675, 1, 'Pilates'));
write('assets/act-zumba.svg', sceneSvg(900, 675, 2, 'Zumba'));
write('assets/act-renfo.svg', sceneSvg(900, 675, 3, 'Renforcement'));
write('assets/act-stretch.svg', sceneSvg(900, 675, 4, 'Stretching'));
write('assets/act-cardio.svg', sceneSvg(900, 675, 5, 'Cardio'));
write('assets/coach-1.svg', coachSvg(0));
write('assets/coach-2.svg', coachSvg(1));
write('assets/coach-3.svg', coachSvg(2));
if (ASSO.federation.nom) write('assets/logo-federation.svg', federationSvg());
await renderPngs();
