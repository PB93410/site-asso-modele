/**
 * Recto de la carte adhérent, fabriqué au moment de l’envoi à partir de la fiche.
 * Pas de coffre d’images : nom, prénom et numéro viennent de la même ligne du Sheet,
 * lue à l’instant de l’envoi. Une carte ne peut donc pas partir chez quelqu’un d’autre.
 *
 * SVG → PNG avec resvg (WebAssembly, sans binaire natif). Polices .ttf dans
 * netlify/cartes/fonts (OFL), logo public/assets/logo-512.png (npm run identite).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { ASSO } from '../../asso.derive.js';

export const CARD_W = 1011;
export const CARD_H = 638;
const NAME_MAX = 690;
const NAME_BASE = 78;
const NAME_MIN = 42;
const NAME_TWO = 58;

const FONT_FILES = [
  'netlify/cartes/fonts/barlow-condensed-latin-700-normal.ttf',
  'netlify/cartes/fonts/inter-latin-400-normal.ttf',
  'netlify/cartes/fonts/inter-latin-500-normal.ttf',
];
const LOGO_FILE = 'public/assets/logo-512.png';
const WASM_FILE = 'node_modules/@resvg/resvg-wasm/index_bg.wasm';

/** Fichier du projet, en local comme dans la fonction Netlify (included_files). */
function readAsset(rel) {
  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT].filter(Boolean);
  for (const root of roots) {
    try {
      return readFileSync(path.join(root, rel));
    } catch {
      // absent à cet emplacement
    }
  }
  throw new Error(`Fichier de carte introuvable : ${rel}`);
}

let ready = null;
let fonts = null;
let logoUrl = '';

function prepare() {
  if (!ready) {
    ready = initWasm(readAsset(WASM_FILE)).then(() => {
      fonts = FONT_FILES.map((f) => new Uint8Array(readAsset(f)));
      try {
        logoUrl = `data:image/png;base64,${readAsset(LOGO_FILE).toString('base64')}`;
      } catch {
        logoUrl = '';
      }
    });
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

function render(svg) {
  return new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  });
}

export function escapeXml(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** « 2026-2027 » → « 2026 – 2027 ». */
export function seasonDash(label) {
  const m = String(label || '').match(/(\d{4})\s*[-–—]\s*(\d{4})/);
  if (!m) return String(label || '').trim();
  return `${m[1]} – ${m[2]}`;
}

/**
 * Une ligne, police réduite jusqu’au minimum lisible ; en dessous, prénom et nom
 * sur deux lignes. `width78` = largeur du nom complet à 78 px (la largeur est
 * proportionnelle à la taille).
 */
export function nameLayout(prenom, nom, width78) {
  const p = String(prenom || '').trim().toUpperCase();
  const n = String(nom || '').trim().toUpperCase();
  const line = `${p} ${n}`.trim();
  if (width78 <= NAME_MAX) return { mode: 'one', size: NAME_BASE, lines: [line] };
  const size = Math.floor((NAME_BASE * NAME_MAX) / width78);
  if (size >= NAME_MIN) return { mode: 'one', size, lines: [line] };
  return { mode: 'two', size: NAME_TWO, lines: [p, n] };
}

const NAME_STYLE = 'font-family="Barlow Condensed" font-weight="700" fill="#fff" letter-spacing="0.005em"';

function nameSvg(lines, size) {
  if (lines.length === 1) {
    const y = 318 + (size * 0.86 - size * 1.2) / 2 + size;
    return `<text x="64" y="${y.toFixed(1)}" font-size="${size}" ${NAME_STYLE}>${escapeXml(lines[0])}</text>`;
  }
  const lh = NAME_TWO * 0.88;
  const y1 = 318 + (lh - NAME_TWO * 1.2) / 2 + NAME_TWO;
  return lines
    .map(
      (l, i) =>
        `<text x="64" y="${(y1 + i * lh).toFixed(1)}" font-size="${NAME_TWO}" ${NAME_STYLE}>${escapeXml(l)}</text>`,
    )
    .join('');
}

/** Largeur du nom à 78 px, mesurée avec les vraies polices. */
function measureName(line) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200"><text x="0" y="120" font-size="${NAME_BASE}" ${NAME_STYLE}>${escapeXml(line)}</text></svg>`;
  const box = render(svg).getBBox();
  return box ? box.width : 0;
}

/** SVG complet du recto. `layout` vient de nameLayout. */
export function rectoSvg({ numero, saison, layout, logo = '' }) {
  const c = escapeXml(ASSO.couleurs.primaire);
  const sous = `${ASSO.ville} · ${ASSO.codePostal} · DEPUIS ${ASSO.anneeCreation}`.toUpperCase();
  // Le fichier Inter 500 se déclare sous la famille « Inter Medium ».
  const inter = (size, spacing, fill) =>
    `font-family="Inter Medium, Inter" font-weight="500" font-size="${size}" letter-spacing="${spacing}em" fill="${fill}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
<defs>
  <clipPath id="card"><rect width="${CARD_W}" height="${CARD_H}" rx="48"/></clipPath>
  <clipPath id="logo"><circle cx="886" cy="133" r="105"/></clipPath>
</defs>
<g clip-path="url(#card)">
  <rect width="${CARD_W}" height="${CARD_H}" fill="#111110"/>
  <rect width="29" height="500" fill="${c}"/>
  <rect y="500" width="${CARD_W}" height="7" fill="${c}"/>
  <rect y="507" width="${CARD_W}" height="${CARD_H - 507}" fill="#1A1916"/>
  ${logo ? `<image x="781" y="28" width="210" height="210" preserveAspectRatio="xMidYMid slice" clip-path="url(#logo)" xlink:href="${logo}"/>` : ''}
  <text x="64" y="100" font-family="Barlow Condensed" font-weight="700" font-size="64" letter-spacing="0.01em" fill="${c}">${escapeXml(ASSO.nomCourt.toUpperCase())}</text>
  <text x="62" y="130" ${inter(15, 0.24, '#B2AEA7')}>${escapeXml(sous)}</text>
  <text x="63" y="280" ${inter(18, 0.22, c)}>ADHÉRENT</text>
  ${nameSvg(layout.lines, layout.size)}
  <text x="63" y="580" ${inter(13, 0.18, '#B2AEA7')}>SAISON</text>
  <text x="63" y="618" font-family="Barlow Condensed" font-weight="700" font-size="28" letter-spacing="0.04em" fill="#fff">${escapeXml(saison)}</text>
  <text x="962" y="565" text-anchor="end" ${inter(13, 0.18, '#B2AEA7')}>N° ADHÉRENT</text>
  <text x="962" y="619" text-anchor="end" font-family="Barlow Condensed" font-weight="700" font-size="44" letter-spacing="0.02em" fill="${c}">${escapeXml(numero)}</text>
</g>
</svg>`;
}

/** PNG du recto pour cette personne. */
export async function renderRecto({ prenom, nom, numero, saison = seasonDash(ASSO.saison.label) }) {
  await prepare();
  const line = `${String(prenom || '').trim()} ${String(nom || '').trim()}`.trim().toUpperCase();
  const layout = nameLayout(prenom, nom, measureName(line));
  const png = render(rectoSvg({ numero, saison, layout, logo: logoUrl })).render().asPng();
  return Buffer.from(png);
}
