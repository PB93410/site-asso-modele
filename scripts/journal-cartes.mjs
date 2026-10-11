/**
 * Affiche le journal des envois de cartes (store « cartes-journal »), du plus ancien au plus récent.
 * Lecture seule. Destinataires masqués (ma***@exemple.fr, …78).
 *
 *   node scripts/journal-cartes.mjs
 *   node scripts/journal-cartes.mjs ASE-2627-014     un seul numéro
 *
 * Site : NETLIFY_SITE_ID, sinon .netlify/state.json (créé par `netlify link`).
 * Jeton : NETLIFY_AUTH_TOKEN, sinon la session du CLI (`netlify login`).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JOURNAL_STORE } from '../netlify/functions/_cartes-journal.mjs';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function siteId() {
  const id = process.env.NETLIFY_SITE_ID || readJson(path.join(process.cwd(), '.netlify', 'state.json'))?.siteId;
  if (!id) throw new Error('Site Netlify inconnu : lancez `netlify link` ou définissez NETLIFY_SITE_ID.');
  return id;
}

function cliToken() {
  if (process.env.NETLIFY_AUTH_TOKEN) return process.env.NETLIFY_AUTH_TOKEN;
  const home = os.homedir();
  const candidates = [
    path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'netlify', 'Config', 'config.json'),
    path.join(home, 'Library', 'Preferences', 'netlify', 'config.json'),
    path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'netlify', 'config.json'),
  ];
  for (const file of candidates) {
    const cfg = readJson(file);
    const token = cfg?.users?.[cfg?.userId]?.auth?.token;
    if (token) return token;
  }
  throw new Error('Jeton Netlify introuvable : lancez `netlify login` ou définissez NETLIFY_AUTH_TOKEN.');
}

function heureParis(iso) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

async function main() {
  const seul = String(process.argv[2] || '').trim();
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: JOURNAL_STORE, siteID: siteId(), token: cliToken(), consistency: 'strong' });
  const { blobs } = await store.list();
  const keys = (blobs || []).map((b) => b.key).sort();
  let n = 0;
  for (const key of keys) {
    const e = await store.get(key, { type: 'json' });
    if (!e || (seul && e.numero !== seul)) continue;
    n += 1;
    console.log(
      `${heureParis(e.at)} · ${e.numero} · ligne ${e.row} · ${e.canal} · ${e.dest || '—'}${e.renvoi ? ' · renvoi' : ''}`,
    );
  }
  console.log(`${n} envoi(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
