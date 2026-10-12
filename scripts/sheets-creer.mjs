/**
 * npm run sheets:creer — crée les Google Sheets du site, prêts à l'emploi.
 *
 *   1. Connexion Google dans le navigateur, avec le compte de l'association
 *      (autorisation minimale : l'outil ne voit que les fichiers qu'il crée).
 *   2. Création des classeurs selon asso.config.js → modules : Essais, Adhérents,
 *      Contenu du site (horaires et événements préremplis depuis public/data/).
 *   3. Partage avec le compte de service (éditeur), IDs écrits dans .env.
 *   4. Mise en forme (npm run sheets:format), puis npm run verifier.
 *
 * Pourquoi pas le compte de service ? Depuis 2025, Google ne lui donne plus d'espace
 * de stockage : il ne peut pas créer de fichier, seulement modifier ceux qu'on lui partage.
 *
 * Client OAuth : GOOGLE_SETUP_CLIENT_ID / GOOGLE_SETUP_CLIENT_SECRET (type « Application de
 * bureau »), sinon GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET avec l'URI de redirection
 * http://localhost:53682/oauth2callback autorisée. Voir docs/DOC-GOOGLE-SHEETS.md.
 *
 *   --essai   montre ce qui serait créé, sans connexion
 *   --force   recrée même si des IDs sont déjà dans .env
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ASSO, MODULES } from '../asso.derive.js';
import { parseCsv } from '../netlify/functions/_demo.mjs';
import { planClasseurs, majEnv } from './_sheets-creer.mjs';
import { compteDeService } from './_verifier.mjs';
import { modeStockage } from '../netlify/functions/_stockage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 53682;
const REDIRECTION = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function lireEnv() {
  const env = {};
  for (const name of ['.env', '.env.local']) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v) env[m[1]] = v;
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (v) env[k] = v;
  return env;
}

const lireCsv = (nom) => {
  const f = path.join(ROOT, 'public', 'data', `${nom}.csv`);
  return fs.existsSync(f) ? parseCsv(fs.readFileSync(f, 'utf8')) : [];
};

function ouvrir(url) {
  const cmd =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // l'adresse est aussi affichée dans le terminal
  }
}

/** Connexion Google : petite page locale qui reçoit le code d'autorisation. */
export async function connexion(google, clientId, clientSecret, { navigateur = true, port = PORT } = {}) {
  const redirection = `http://localhost:${port}/oauth2callback`;
  const client = new google.auth.OAuth2(clientId, clientSecret, redirection);
  const etat = randomBytes(16).toString('hex');
  const url = client.generateAuthUrl({ access_type: 'online', scope: SCOPES, state: etat, prompt: 'select_account' });
  const code = await new Promise((resolve, reject) => {
    const serveur = http.createServer((req, res) => {
      const u = new URL(req.url || '/', redirection);
      if (u.pathname !== '/oauth2callback') {
        res.writeHead(404).end();
        return;
      }
      const ok = u.searchParams.get('state') === etat && u.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<!doctype html><meta charset="utf-8"><body style="font:18px system-ui;padding:3rem;max-width:36rem">${
          ok ? '<h1>C’est bon ✔</h1><p>Vous pouvez fermer cet onglet et revenir au terminal.</p>' : '<h1>Connexion refusée</h1><p>Relancez la commande.</p>'
        }</body>`,
      );
      serveur.close();
      if (ok) resolve(u.searchParams.get('code'));
      else reject(new Error(u.searchParams.get('error') === 'access_denied' ? 'Connexion annulée.' : 'Réponse de Google inattendue.'));
    });
    serveur.on('error', (err) => reject(new Error(`Port ${port} occupé (${err.code}). Fermez l’autre programme et relancez.`)));
    serveur.listen(port, '127.0.0.1', () => {
      console.log('\nConnexion Google : une page s’ouvre dans le navigateur.');
      console.log('Choisissez le compte Google de l’association (les classeurs lui appartiendront).');
      console.log(`Si rien ne s’ouvre, copiez cette adresse :\n${url}\n`);
      if (navigateur) ouvrir(url);
    });
    setTimeout(() => {
      serveur.close();
      reject(new Error('Pas de connexion après 5 minutes. Relancez la commande.'));
    }, 5 * 60_000).unref();
  });
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  return client;
}

export async function creerClasseur(sheets, drive, c, compteService) {
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: c.titre, locale: 'fr_FR', timeZone: 'Europe/Paris' },
      sheets: c.onglets.map((o) => ({ properties: { title: o.titre, gridProperties: { frozenRowCount: 1 } } })),
    },
    fields: 'spreadsheetId,spreadsheetUrl',
  });
  const id = res.data.spreadsheetId;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      valueInputOption: 'RAW',
      data: c.onglets.filter((o) => o.lignes.length).map((o) => ({ range: `'${o.titre.replace(/'/g, "''")}'!A1`, values: o.lignes })),
    },
  });
  await drive.permissions.create({
    fileId: id,
    sendNotificationEmail: false,
    requestBody: { type: 'user', role: 'writer', emailAddress: compteService },
  });
  return { id, url: res.data.spreadsheetUrl };
}

function lancer(script, args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  }).status === 0;
}

async function main() {
  const essai = process.argv.includes('--essai');
  const force = process.argv.includes('--force');
  const env = lireEnv();
  const plan = planClasseurs(ASSO, MODULES, { planning: lireCsv('planning'), evenements: lireCsv('evenements') }, env);

  if (modeStockage(env, false) !== 'google') {
    console.log('Les données du bureau sont sur Netlify (pas de compte de service Google, ni STOCKAGE=google) : rien à créer.');
    console.log('Pour utiliser Google Sheets : docs/DOC-DONNEES.md.');
    return;
  }
  if (!plan.length) {
    console.log('Aucune fonction n’utilise Google Sheets (asso.config.js → modules) : rien à créer.');
    return;
  }
  console.log(`Classeurs pour ${ASSO.nom} :`);
  for (const c of plan) console.log(`  · ${c.titre} — ${c.role} (${c.onglets.map((o) => o.titre).join(', ')})`);

  const deja = plan.filter((c) => env[c.cle]);
  if (deja.length && !force) {
    console.log(`\nDéjà dans .env : ${deja.map((c) => c.cle).join(', ')}. Rien n’est créé (--force pour recréer).`);
    process.exitCode = 1;
    return;
  }
  const compteService = compteDeService(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!compteService) {
    console.log('\nIl faut d’abord la clé du compte de service (GOOGLE_SERVICE_ACCOUNT_JSON dans .env) : docs/DOC-GOOGLE-SHEETS.md, étape 1.');
    process.exitCode = 1;
    return;
  }
  const clientId = env.GOOGLE_SETUP_CLIENT_ID || env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_SETUP_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log('\nIl faut un client OAuth Google (GOOGLE_SETUP_CLIENT_ID / GOOGLE_SETUP_CLIENT_SECRET dans .env) : docs/DOC-GOOGLE-SHEETS.md, étape 2.');
    process.exitCode = 1;
    return;
  }
  if (essai) {
    console.log(`\nAperçu seulement. Partage prévu avec ${compteService}.`);
    return;
  }

  const { google } = await import('googleapis');
  const auth = await connexion(google, clientId, clientSecret);
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const ids = {};
  for (const c of plan) {
    const { id, url } = await creerClasseur(sheets, drive, c, compteService);
    ids[c.cle] = id;
    console.log(`✔ ${c.titre}\n    ${url}`);
  }

  const fichierEnv = path.join(ROOT, '.env');
  fs.writeFileSync(fichierEnv, majEnv(fs.existsSync(fichierEnv) ? fs.readFileSync(fichierEnv, 'utf8') : '', ids));
  console.log('\nIDs enregistrés dans .env.');

  if (ids.GOOGLE_SHEET_ID && ids.GOOGLE_SHEET_ESSAIS_ID) {
    console.log('\nMise en forme (couleurs, menus, filtres)…');
    lancer('format-bureau-sheets.mjs', [], { ENV_LOCAL_SEUL: '1' });
  }
  console.log('');
  lancer('verifier.mjs');
  console.log('\nÀ reporter sur Netlify (Site configuration → Environment variables) :');
  for (const [k, v] of Object.entries(ids)) console.log(`  ${k}=${v}`);
  console.log('\nLes classeurs sont dans le Drive du compte connecté. Partagez-les ensuite avec les membres du bureau qui en ont besoin.');
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) main().catch((err) => {
  const msg = String(err?.response?.data?.error_description || err?.message || err);
  console.error(`\nÉchec : ${msg}`);
  if (/redirect_uri_mismatch/i.test(msg)) console.error(`→ Ajoutez ${REDIRECTION} aux URI de redirection du client OAuth, ou utilisez un client « Application de bureau ».`);
  if (/access_denied|not.*test user|has not completed/i.test(msg)) console.error('→ Écran de consentement en mode test : ajoutez ce compte Google aux « utilisateurs test ».');
  process.exitCode = 1;
});
