/**
 * Fabrique les rectos de carte adhérent. N’écrit jamais dans les Sheets.
 * Les PNG nominatifs restent dans tmp/ (jamais dans public/).
 *
 *   node scripts/make-cartes.mjs
 *   node scripts/make-cartes.mjs --generer
 *   node scripts/make-cartes.mjs --numero ASE-2627-068 --generer
 *   node scripts/make-cartes.mjs --sortie tmp/cartes-test --numero ASE-2627-067 --generer
 *   node scripts/make-cartes.mjs --generer --envoyer-coffre
 *
 * --refaire écrase un PNG déjà présent dans le dossier de sortie, pas le coffre.
 * --coffre ignore les numéros déjà dans le coffre.
 * Ne pas lancer --envoyer-coffre sans avoir lu l’aperçu.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { foldStatut, isTestPrenom } from '../netlify/functions/_bureau-lib.mjs';
import { SEASON_PREFIX, carteNumeroPattern, isCarteImageNumero } from '../netlify/functions/_cartes-store.mjs';
import { loadEnv } from './_env.mjs';
import { ASSO } from '../asso.derive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARD_W = 1011;
const CARD_H = 638;
const MIN_BYTES = 20_000;

export function escapeHtml(raw) {
  return String(raw || '')
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
 * Une ligne, police réduite jusqu’au minimum lisible.
 * En dessous : prénom et nom sur deux lignes.
 */
export function nameLayout(prenom, nom, options = {}) {
  const base = options.base ?? 78;
  const min = options.min ?? 42;
  const maxWidth = options.maxWidth ?? 690;
  const widthOf = options.widthOf ?? ((text, size) => text.length * size * 0.46);
  const line = `${String(prenom || '').trim()} ${String(nom || '').trim()}`.trim().toUpperCase();
  let size = base;
  while (size > min && widthOf(line, size) > maxWidth) size -= 1;
  if (widthOf(line, size) > maxWidth) {
    return {
      mode: 'two',
      size: Math.max(min, 58),
      lines: [String(prenom || '').trim().toUpperCase(), String(nom || '').trim().toUpperCase()],
    };
  }
  return { mode: 'one', size, lines: [line] };
}

export function selectCartes(rows, { prefix = SEASON_PREFIX, havePng = new Set(), coffre = null, onlyNumero = '' } = {}) {
  const re = carteNumeroPattern(prefix);
  const only = String(onlyNumero || '').trim();
  const selected = [];
  for (const row of rows || []) {
    if (foldStatut(row.statut) !== 'a jour') continue;
    const numero = String(row.numero || '').trim();
    if (!re.test(numero)) continue;
    if (only && numero !== only) continue;
    if (isTestPrenom(row.prenom, row.nom)) continue;
    if (havePng.has(numero)) continue;
    if (coffre && coffre.has(numero)) continue;
    selected.push({
      prenom: String(row.prenom || '').trim(),
      nom: String(row.nom || '').trim(),
      numero,
    });
  }
  return selected;
}

export function sampleLine(row) {
  const first = row.prenom || '—';
  const initial = String(row.nom || '').trim().charAt(0);
  const who = initial ? `${first} ${initial.toUpperCase()}.` : first;
  return `${who} · ${row.numero}`;
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return '';
  return String(process.argv[index + 1] || '').trim();
}

function seasonLabel() {
  const fromName = String(process.env.GOOGLE_SHEET_NAME || '').replace(/^saison\s+/i, '');
  if (/\d{4}/.test(fromName)) return fromName.trim();
  const prefix = process.env.ADHERENT_PREFIX || SEASON_PREFIX;
  const m = String(prefix).match(/(\d{2})(\d{2})/);
  if (!m) return '2026-2027';
  return `20${m[1]}-20${m[2]}`;
}

function sortieDir(raw) {
  const dir = path.resolve(ROOT, raw || path.join('tmp', 'cartes'));
  const tmp = path.resolve(ROOT, 'tmp');
  const rel = path.relative(tmp, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('La sortie doit rester dans tmp/.');
  }
  return dir;
}

function pngFiles(dir) {
  if (!fs.existsSync(dir)) return new Set();
  const set = new Set();
  for (const name of fs.readdirSync(dir)) {
    const numero = name.replace(/\.png$/i, '');
    if (isCarteImageNumero(numero)) set.add(numero);
  }
  return set;
}

function pngOk(buf) {
  if (!buf || buf.length < MIN_BYTES) return false;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return false;
  return buf.readUInt32BE(16) === CARD_W && buf.readUInt32BE(20) === CARD_H;
}

function dataUrl(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function fillTemplate(row, saison) {
  const prenom = String(row.prenom || '').trim().toUpperCase();
  const nom = String(row.nom || '').trim().toUpperCase();
  const ligne = `${prenom} ${nom}`.trim();
  const font = (name) => dataUrl(path.join(ROOT, 'scripts', 'cartes', 'fonts', name), 'font/woff2');
  const logo = dataUrl(path.join(ROOT, 'public', 'assets', 'logo-512.png'), 'image/png');
  const sousTitre = `${ASSO.ville} · ${ASSO.codePostal} · DEPUIS ${ASSO.anneeCreation}`.toUpperCase();
  return fs
    .readFileSync(path.join(ROOT, 'scripts', 'cartes', 'recto.html'), 'utf8')
    .replaceAll('__FONT_BARLOW__', font('barlow-condensed-latin-700-normal.woff2'))
    .replaceAll('__FONT_INTER_MED__', font('inter-latin-500-normal.woff2'))
    .replaceAll('__FONT_INTER__', font('inter-latin-400-normal.woff2'))
    .replaceAll('__LOGO__', logo)
    .replaceAll('__COULEUR__', ASSO.couleurs.primaire)
    .replaceAll('__NOM_COURT__', escapeHtml(ASSO.nomCourt.toUpperCase()))
    .replaceAll('__SOUS_TITRE__', escapeHtml(sousTitre))
    .replaceAll('__PRENOM__', escapeHtml(prenom))
    .replaceAll('__NOM__', escapeHtml(nom))
    .replaceAll('__LIGNE__', escapeHtml(ligne))
    .replaceAll('__SAISON__', escapeHtml(saison))
    .replaceAll('__NUMERO__', escapeHtml(row.numero));
}

async function launchBrowser() {
  const puppeteer = (await import('puppeteer')).default;
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  const tries = [];
  if (process.platform === 'win32') tries.push({ headless: true, channel: 'chrome', args });
  tries.push({ headless: true, args });
  let lastErr;
  for (const opts of tries) {
    try {
      return await puppeteer.launch(opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function renderPng(browser, row, saison) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: 1 });
    await page.setContent(fillTemplate(row, saison), { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.fitName();
    });
    const buf = await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width: CARD_W, height: CARD_H },
    });
    return Buffer.from(buf);
  } finally {
    await page.close();
  }
}

async function coffreKeys() {
  const { getStore } = await import('@netlify/blobs');
  const store = await openStore(getStore);
  const listed = await store.list();
  const keys = new Set();
  for (const blob of listed.blobs || []) {
    if (isCarteImageNumero(blob.key)) keys.add(blob.key);
  }
  return { store, keys };
}

async function openStore(getStore) {
  const fsOs = await import('node:os');
  const cfgPath = path.join(fsOs.homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const token = cfg?.users?.[cfg.userId]?.auth?.token;
  if (!token) throw new Error('Jeton Netlify introuvable dans la session CLI.');
  return getStore({
    name: 'cartes-adherents',
    siteID: '8f894d3d-556c-4cbb-9d03-22e782ec2c96',
    token,
    consistency: 'strong',
  });
}

async function sendNewToCoffre(dir, numeros) {
  const { getStore } = await import('@netlify/blobs');
  const store = await openStore(getStore);
  let sent = 0;
  for (const numero of numeros) {
    const existing = await store.get(numero, { type: 'arrayBuffer' });
    if (existing && existing.byteLength) {
      console.log(`${numero} déjà au coffre, non remplacé.`);
      continue;
    }
    const buf = fs.readFileSync(path.join(dir, `${numero}.png`));
    await store.set(numero, new Blob([buf], { type: 'image/png' }), {
      metadata: { contentType: 'image/png' },
    });
    sent += 1;
  }
  console.log(`Coffre : ${sent} nouvelle(s) carte(s).`);
}

async function readAdherents() {
  const { getAdherentsSheetId, getAdherentsTab, readSheetAsObjects, pickRow } = await import(
    '../netlify/functions/_bureau-lib.mjs'
  );
  const tab = getAdherentsTab();
  const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${String(tab).replace(/'/g, "''")}'!A:Z`);
  return rows.map((row) => ({
    prenom: pickRow(row, 'PRENOM', 'Prénom'),
    nom: pickRow(row, 'NOM', 'Nom'),
    statut: pickRow(row, 'STATUT', 'Statut'),
    numero: pickRow(row, 'NUMERO'),
  }));
}

async function main() {
  const generer = process.argv.includes('--generer');
  const refaire = process.argv.includes('--refaire');
  const wantCoffre = process.argv.includes('--envoyer-coffre');
  const skipInCoffre = process.argv.includes('--coffre');
  const onlyNumero = argValue('--numero');
  const dir = sortieDir(argValue('--sortie'));

  loadEnv();
  const rows = await readAdherents();
  let coffre = null;
  if (skipInCoffre || wantCoffre) {
    coffre = (await coffreKeys()).keys;
  }
  const selected = selectCartes(rows, {
    prefix: process.env.ADHERENT_PREFIX || SEASON_PREFIX,
    havePng: refaire ? new Set() : pngFiles(dir),
    coffre: skipInCoffre ? coffre : null,
    onlyNumero,
  });

  console.log(generer ? `Cartes — écriture dans ${path.relative(ROOT, dir)}.` : 'Cartes — aperçu, rien n’est créé.');
  console.log(`À faire : ${selected.length}`);
  for (const row of selected) console.log(`  ${sampleLine(row)}`);
  if (!generer || !selected.length) return;

  fs.mkdirSync(dir, { recursive: true });
  const saison = seasonDash(seasonLabel());
  const browser = await launchBrowser();
  const written = [];
  try {
    for (const row of selected) {
      const buf = await renderPng(browser, row, saison);
      if (!pngOk(buf)) throw new Error(`${row.numero} : PNG invalide (taille ou dimensions).`);
      fs.writeFileSync(path.join(dir, `${row.numero}.png`), buf);
      written.push(row.numero);
      console.log(`${row.numero} ok`);
    }
  } finally {
    await browser.close();
  }
  if (wantCoffre) await sendNewToCoffre(dir, written);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
