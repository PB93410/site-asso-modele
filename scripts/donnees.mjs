/**
 * npm run donnees — les données du bureau sur Netlify (référent).
 *
 *   npm run donnees -- exporter [fichier.xlsx]      copie locale en Excel (par défaut dans tmp/)
 *   npm run donnees -- restaurer fichier.xlsx       remet une sauvegarde (mail du lundi, ou export)
 *   npm run donnees -- importer-google              reprend les Google Sheets actuels (passage à Netlify)
 *
 *   --force   remplace des données déjà présentes sur Netlify
 *   --essai   montre ce qui serait fait, sans rien écrire
 *
 * Variables (.env, jamais sur Netlify) : NETLIFY_SITE_ID (Site configuration → Site details → Site ID)
 * et NETLIFY_AUTH_TOKEN (User settings → Applications → Personal access tokens). Voir docs/DOC-DONNEES.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ASSO, MODULES } from '../asso.derive.js';
import { loadEnv } from './_env.mjs';
import { lireXlsx } from './_xlsx-lire.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Les onglets du stockage Netlify, avec leur nom dans le fichier Excel et dans Google Sheets.
 * @param {{ adherents: string, essais: string, planning: string, evenements: string }} noms onglets (getters du bureau)
 * @param {Record<string, string | undefined>} env
 */
export function cibles(noms, env = {}, modules = MODULES) {
  const site = env.GOOGLE_SITE_SHEET_ID || env.GOOGLE_SHEET_ESSAIS_ID;
  const out = [];
  if (modules.adhesion || modules.bureau) {
    out.push({ excel: noms.adherents, id: 'adherents', tab: noms.adherents, google: env.GOOGLE_SHEET_ID });
  }
  if (modules.essais || modules.bureau) {
    out.push({ excel: 'Essais', id: 'essais', tab: noms.essais, google: env.GOOGLE_SHEET_ESSAIS_ID });
  }
  if (modules.bureau) {
    out.push({ excel: 'Horaires', id: 'site', tab: noms.planning, google: site });
    out.push({ excel: 'Événements', id: 'site', tab: noms.evenements, google: site });
  }
  return out;
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Associe les onglets d'un fichier Excel aux onglets Netlify (par nom, ou « Saison … » pour les adhérents). */
export function associer(onglets, liste) {
  const trouves = [];
  const ignores = [];
  for (const o of onglets) {
    const c =
      liste.find((x) => norm(x.excel).slice(0, 31) === norm(o.nom).slice(0, 31)) ||
      (liste[0]?.id === 'adherents' && /^saison\b/.test(norm(o.nom)) ? liste[0] : null);
    if (c && !trouves.some((t) => t.cible === c)) trouves.push({ cible: c, lignes: o.lignes });
    else ignores.push(o.nom);
  }
  return { trouves, ignores };
}

const nbFiches = (rows) => Math.max(0, (rows || []).filter((r) => (r || []).some((c) => String(c ?? '').trim())).length - 1);

async function storeNetlify() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) {
    throw new Error('Il faut NETLIFY_SITE_ID et NETLIFY_AUTH_TOKEN dans .env : voir docs/DOC-DONNEES.md.');
  }
  const { getStore } = await import('@netlify/blobs');
  const { STORE_DONNEES } = await import('../netlify/functions/_stockage.mjs');
  return getStore({ name: STORE_DONNEES, siteID, token });
}

async function nomsOnglets() {
  const b = await import('../netlify/functions/_bureau-lib.mjs');
  return { adherents: b.getAdherentsTab(), essais: b.getEssaisTab(), planning: b.getPlanningTab(), evenements: b.getEventsTab() };
}

async function lireNetlify(store, c) {
  const { cleOnglet } = await import('../netlify/functions/_stockage.mjs');
  const data = await store.get(cleOnglet(c.id, c.tab), { type: 'json' });
  return Array.isArray(data?.rows) ? data.rows : null;
}

async function ecrireNetlify(store, liste, { force, essai }) {
  const { cleOnglet } = await import('../netlify/functions/_stockage.mjs');
  const occupes = [];
  for (const { cible } of liste) {
    const deja = await lireNetlify(store, cible);
    if (deja && nbFiches(deja) > 0) occupes.push(`${cible.excel} (${nbFiches(deja)} ligne(s))`);
  }
  for (const { cible, lignes } of liste) console.log(`  · ${cible.excel} : ${nbFiches(lignes)} ligne(s)`);
  if (occupes.length && !force) {
    console.log(`\nDéjà sur Netlify : ${occupes.join(', ')}. Rien n’est remplacé (--force pour remplacer).`);
    console.log('Conseil : npm run donnees -- exporter, avant de remplacer.');
    process.exitCode = 1;
    return;
  }
  if (essai) {
    console.log('\nAperçu seulement : rien n’est écrit.');
    return;
  }
  for (const { cible, lignes } of liste) {
    await store.setJSON(cleOnglet(cible.id, cible.tab), { rows: lignes.map((r) => (r || []).map((c) => String(c ?? ''))), maj: new Date().toISOString() });
  }
  console.log('\n✔ Données écrites sur Netlify. Le bureau les voit tout de suite.');
}

async function exporter(fichier) {
  const store = await storeNetlify();
  const { classeurXlsx } = await import('../netlify/functions/_xlsx.mjs');
  const { ongletVierge } = await import('../netlify/functions/_bureau-lib.mjs');
  const onglets = [];
  for (const c of cibles(await nomsOnglets())) {
    const rows = (await lireNetlify(store, c)) || ongletVierge(c.id, c.tab);
    onglets.push({ nom: c.excel, lignes: rows });
    console.log(`  · ${c.excel} : ${nbFiches(rows)} ligne(s)`);
  }
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const dest = path.resolve(fichier || path.join(ROOT, 'tmp', `${ASSO.sigle}-donnees-${jour}.xlsx`));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, classeurXlsx(onglets));
  console.log(`\n✔ ${path.relative(ROOT, dest) || dest}`);
  console.log('Données personnelles : ne pas commiter, ne pas transférer hors du bureau.');
}

async function restaurer(fichier, opts) {
  if (!fichier) throw new Error('Indiquez le fichier : npm run donnees -- restaurer chemin/vers/sauvegarde.xlsx');
  const onglets = lireXlsx(fs.readFileSync(path.resolve(fichier)));
  const { trouves, ignores } = associer(onglets, cibles(await nomsOnglets()));
  if (!trouves.length) throw new Error('Aucun onglet reconnu (Adhérents « Saison … », Essais, Horaires, Événements).');
  console.log(`Restauration depuis ${path.basename(fichier)} :`);
  if (ignores.length) console.log(`  (ignorés : ${ignores.join(', ')})`);
  await ecrireNetlify(await storeNetlify(), trouves, opts);
}

async function importerGoogle(opts) {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('Il faut GOOGLE_SERVICE_ACCOUNT_JSON (et les ID des classeurs) dans .env pour lire les Google Sheets.');
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(json), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const liste = [];
  for (const c of cibles(await nomsOnglets(), process.env)) {
    if (!c.google) {
      console.log(`  · ${c.excel} : pas de classeur Google (ID absent), ignoré`);
      continue;
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: c.google,
      range: `'${c.tab.replace(/'/g, "''")}'!A:Z`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
    liste.push({ cible: c, lignes: res.data.values || [] });
  }
  console.log('Reprise des Google Sheets :');
  await ecrireNetlify(await storeNetlify(), liste, opts);
  if (!opts.essai && process.exitCode !== 1) {
    console.log('\nEnsuite sur Netlify : STOCKAGE=netlify (ou retirez GOOGLE_SERVICE_ACCOUNT_JSON), puis redéployez.');
    console.log('Les Google Sheets restent intacts : gardez-les en lecture seule comme archive.');
  }
}

async function main() {
  if (!process.env.ENV_LOCAL_SEUL) process.env.ENV_LOCAL_SEUL = '1';
  loadEnv();
  const [commande, fichier] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const opts = { force: process.argv.includes('--force'), essai: process.argv.includes('--essai') };
  if (commande === 'exporter') return exporter(fichier);
  if (commande === 'restaurer') return restaurer(fichier, opts);
  if (commande === 'importer-google') return importerGoogle(opts);
  console.log('Usage :');
  console.log('  npm run donnees -- exporter [fichier.xlsx]');
  console.log('  npm run donnees -- restaurer fichier.xlsx [--essai] [--force]');
  console.log('  npm run donnees -- importer-google [--essai] [--force]');
  process.exitCode = 1;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((err) => {
    console.error(`\nÉchec : ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  });
}
