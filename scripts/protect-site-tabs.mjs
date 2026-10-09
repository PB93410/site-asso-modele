/**
 * Protège les onglets PLANNING et EVENEMENTS :
 * seuls le compte asso et le compte de service peuvent les modifier.
 * Les autres éditeurs du classeur (bénévoles) voient mais ne touchent pas.
 *
 * Usage : node scripts/protect-site-tabs.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSO } from '../asso.derive.js';

const TAG = ASSO.sigle;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OWNER_EMAIL = process.env.ASSO_GMAIL || ASSO.email;
const TAB_TITLES = ['PLANNING', 'EVENEMENTS'];

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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
  if (name.endsWith('_JSON')) {
    const i = out.indexOf('{');
    const j = out.lastIndexOf('}');
    if (i >= 0 && j > i) return out.slice(i, j + 1);
  }
  return (
    out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('npm ') && !l.toLowerCase().includes('warn'))
      .at(-1) || ''
  );
}

function loadEnv() {
  parseDotEnv(path.join(ROOT, '.env'));
  parseDotEnv(path.join(ROOT, '.env.local'));
  for (const key of [
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_SHEET_ESSAIS_ID',
    'GOOGLE_SUIVI_SHEET_ID',
    'GOOGLE_SITE_SHEET_ID',
  ]) {
    if (process.env[key] && !/no value set/i.test(process.env[key])) continue;
    const val = netlifyEnv(key);
    if (val && !/no value set/i.test(val)) process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const { getSheets, getSiteSheetId } = await import('../netlify/functions/_bureau-lib.mjs');
  const sheets = await getSheets();
  const spreadsheetId = getSiteSheetId();

  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const saEmail = String(creds.client_email || '').trim();
  if (!saEmail) throw new Error('client_email manquant dans GOOGLE_SERVICE_ACCOUNT_JSON');

  const editors = [...new Set([OWNER_EMAIL, saEmail])];
  console.log('Éditeurs autorisés sur PLANNING / EVENEMENTS :');
  for (const e of editors) console.log(' ·', e);

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title),protectedRanges)',
  });

  const requests = [];

  for (const title of TAB_TITLES) {
    const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
    if (!sheet) {
      console.log(`Skip : onglet « ${title} » introuvable`);
      continue;
    }
    const sheetId = sheet.properties.sheetId;
    const existing = (sheet.protectedRanges || []).filter(
      (p) => p.range?.sheetId === sheetId && (p.description || '').includes(TAG),
    );
    for (const p of existing) {
      requests.push({ deleteProtectedRange: { protectedRangeId: p.protectedRangeId } });
    }
    // Aussi retirer d’anciennes protections « feuille entière » sans description de l’asso
    // si elles couvrent toute la feuille (pas de start/end row) — on les remplace.
    for (const p of sheet.protectedRanges || []) {
      if (p.range?.sheetId !== sheetId) continue;
      if ((p.description || '').includes(TAG)) continue;
      const r = p.range || {};
      const wholeSheet =
        r.startRowIndex == null &&
        r.endRowIndex == null &&
        r.startColumnIndex == null &&
        r.endColumnIndex == null;
      if (wholeSheet) {
        requests.push({ deleteProtectedRange: { protectedRangeId: p.protectedRangeId } });
      }
    }

    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId },
          description: `${TAG} — ${title} : édition via /bureau ou compte asso uniquement`,
          warningOnly: false,
          editors: {
            users: editors,
            domainUsersCanEdit: false,
          },
        },
      },
    });
    console.log(`Protection → « ${title} » (sheetId ${sheetId})`);
  }

  if (!requests.length) {
    console.log('Rien à faire.');
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  const after = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title),protectedRanges(description,editors,warningOnly))',
  });
  console.log('\nÉtat des protections :');
  for (const s of after.data.sheets || []) {
    const title = s.properties?.title;
    if (!TAB_TITLES.includes(title)) continue;
    const prs = s.protectedRanges || [];
    if (!prs.length) {
      console.log(` ${title} : aucune protection`);
      continue;
    }
    for (const p of prs) {
      console.log(
        ` ${title} : ${p.description || '(sans desc)'} · warning=${Boolean(p.warningOnly)} · editors=${(p.editors?.users || []).join(', ') || '—'}`,
      );
    }
  }
  console.log('\nOK. Les bénévoles peuvent encore éditer Essais / Forum / Compteurs.');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
