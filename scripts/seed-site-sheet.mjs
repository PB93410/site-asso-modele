/**
 * Crée (ou remplit) le Google Sheet « contenu site » : PLANNING + EVENEMENTS.
 * Compte de service = propriétaire. Pas de données adhérents.
 *
 * Usage : node scripts/seed-site-sheet.mjs
 * Puis : npx netlify-cli env:set GOOGLE_SITE_SHEET_ID <id>
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSO } from '../asso.derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** Lecture CSV minimale (guillemets doubles, virgules). */
function readCsvRows(name) {
  const file = path.join(ROOT, 'public', 'data', `${name}.csv`);
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').replace(/\r/g, '').split('\n')) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        cols.push(cur);
        cur = '';
      } else cur += ch;
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

/** Contenu initial = public/data/planning.csv et evenements.csv (en-têtes inclus). */
const PLANNING = readCsvRows('planning');
const EVENEMENTS = readCsvRows('evenements');

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function netlifyEnv(name) {
  const r = spawnSync('npx', ['--yes', 'netlify-cli', 'env:get', name], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    timeout: 120_000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.status !== 0 && !out) return '';
  if (name.endsWith('_JSON')) {
    const i = out.indexOf('{');
    const j = out.lastIndexOf('}');
    if (i >= 0 && j > i) return out.slice(i, j + 1);
  }
  const lines = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('npm ') && !l.toLowerCase().includes('warn'));
  return lines[lines.length - 1] || '';
}

function loadEnv() {
  parseDotEnv(path.join(ROOT, '.env'));
  parseDotEnv(path.join(ROOT, '.env.local'));
  for (const key of [
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_SITE_SHEET_ID',
    'GOOGLE_SHEET_ESSAIS_ID',
    'GOOGLE_SUIVI_SHEET_ID',
  ]) {
    if (process.env[key] && !/no value set/i.test(process.env[key])) continue;
    const val = netlifyEnv(key);
    if (!val || /no value set/i.test(val)) continue;
    process.env[key] = val;
  }
}

async function ensureTabs(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title))',
  });
  const titles = new Set((meta.data.sheets || []).map((s) => s.properties.title));
  const add = [];
  if (!titles.has('PLANNING')) add.push({ addSheet: { properties: { title: 'PLANNING' } } });
  if (!titles.has('EVENEMENTS')) add.push({ addSheet: { properties: { title: 'EVENEMENTS' } } });
  if (add.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: add },
    });
  }
}

async function main() {
  loadEnv();
  const { getSheets, replaceSheetValues } = await import(
    '../netlify/functions/_bureau-lib.mjs'
  );
  const sheets = await getSheets();

  let id = process.env.GOOGLE_SITE_SHEET_ID;
  if (id && /no value set/i.test(id)) id = '';

  if (!id) {
    try {
      const created = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: `${ASSO.nom} — Contenu site (bureau)` },
          sheets: [
            { properties: { title: 'PLANNING' } },
            { properties: { title: 'EVENEMENTS' } },
          ],
        },
      });
      id = created.data.spreadsheetId;
      console.log('Classeur dédié créé.');
    } catch (err) {
      const msg = String(err?.message || err);
      if (!/permission/i.test(msg)) throw err;
      id =
        process.env.GOOGLE_SHEET_ESSAIS_ID || process.env.GOOGLE_SUIVI_SHEET_ID || '';
      if (!id) throw err;
      console.log(
        'Création Drive refusée — onglets PLANNING / EVENEMENTS sur le classeur Essais (pas Adhérents).',
      );
    }
  }

  if (!id) throw new Error('Aucun identifiant de classeur');
  await ensureTabs(sheets, id);

  await replaceSheetValues(id, 'PLANNING', PLANNING);
  await replaceSheetValues(id, 'EVENEMENTS', EVENEMENTS);

  const envSet = spawnSync(
    'npx',
    ['--yes', 'netlify-cli', 'env:set', 'GOOGLE_SITE_SHEET_ID', id],
    { cwd: ROOT, encoding: 'utf8', shell: true, timeout: 120_000 },
  );
  if (envSet.status !== 0) {
    console.log(`Env Netlify non mise à jour automatiquement. Définir à la main : GOOGLE_SITE_SHEET_ID=${id}`);
    console.log(envSet.stderr || envSet.stdout || '');
  } else {
    console.log('GOOGLE_SITE_SHEET_ID enregistrée sur Netlify.');
  }
  console.log('OK — planning et événements prêts.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
