/**
 * Charge les variables des scripts Sheets.
 * Ordre : .env, puis .env.local (sans écraser), puis Netlify pour les clés encore vides.
 * Ne jamais afficher les valeurs, en particulier GOOGLE_SERVICE_ACCOUNT_JSON.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NEEDED = [
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SHEET_NAME',
  'GOOGLE_SHEET_ESSAIS_ID',
  'GOOGLE_SUIVI_SHEET_ID',
  'GOOGLE_SHEET_ESSAIS_NAME',
  'GOOGLE_SUIVI_SHEET_NAME',
];

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

export function loadEnv() {
  parseDotEnv(path.join(ROOT, '.env'));
  parseDotEnv(path.join(ROOT, '.env.local'));
  for (const key of NEEDED) {
    if (process.env[key] && !/no value set/i.test(process.env[key])) continue;
    const val = netlifyEnv(key);
    if (!val || /no value set|no project|not linked/i.test(val)) continue;
    process.env[key] = val;
  }
  for (const key of NEEDED) {
    if (process.env[key] && /no value set/i.test(process.env[key])) {
      delete process.env[key];
    }
  }
}
