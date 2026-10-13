/**
 * npm run verifier — tout ce qui manque pour mettre le site en ligne, en français simple.
 *
 *   npm run verifier                 configuration + variables + connexions (Google, mail)
 *   npm run verifier -- --hors-ligne sans tester les connexions
 *
 * Lit asso.config.js, puis .env et .env.local (sans jamais afficher un secret).
 * Ne modifie rien. Code de sortie 1 s’il reste une erreur.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSO, MODULES, SAISON_COURTE } from '../asso.derive.js';
import { valeursTexte } from '../src/lib/gabarit.js';
import { adresseAsso, messageBrevo, messageSmtp, modeEnvoi } from '../netlify/functions/_envoi.mjs';
import { modeStockage } from '../netlify/functions/_stockage.mjs';
import { avecBoite, modeBoite } from '../netlify/functions/_boite.mjs';
import { modePaiement, verifierHelloAsso } from '../netlify/functions/_paiement.mjs';
import { compteDeService, ecartsColonnes, verifierConfig, verifierContenu, verifierEnv } from './_verifier.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const horsLigne = process.argv.includes('--hors-ligne');
const couleur = process.stdout.isTTY && !process.env.NO_COLOR;
const teinte = (code, s) => (couleur ? `\x1b[${code}m${s}\x1b[0m` : s);
const SYMBOLE = { ok: teinte(32, '✔'), attention: teinte(33, '⚠'), erreur: teinte(31, '✖') };

/** .env puis .env.local, puis l’environnement (Netlify, CI) en priorité. Rien n’est écrit dans process.env. */
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

const lireContenu = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'contenu', f), 'utf8'));
const existe = (p) => fs.existsSync(path.join(ROOT, 'public', String(p).replace(/^\/+/, '')));

function afficher(titre, lignes) {
  console.log(`\n${teinte(1, titre)}`);
  for (const l of lignes) {
    console.log(`  ${SYMBOLE[l.niveau]} ${l.texte}`);
    if (l.aFaire && l.niveau !== 'ok') console.log(`      → ${l.aFaire}`);
  }
}

// ---------------------------------------------------------------------------
// Connexions Google (lecture seule)
// ---------------------------------------------------------------------------

function messageGoogle(err, quoi, email) {
  const code = err?.code || err?.response?.status;
  const msg = String(err?.message || '');
  if (code === 403) return [`${quoi} : accès refusé.`, `Partagez le classeur avec ${email || 'le compte de service'} (Éditeur).`];
  if (code === 404) return [`${quoi} : classeur introuvable.`, 'Vérifiez l’ID (dans l’adresse du classeur, entre /d/ et /edit).'];
  if (/Unable to parse range/i.test(msg)) return [`${quoi} : onglet introuvable.`, 'Vérifiez le nom de l’onglet (variable *_NAME).'];
  return [`${quoi} : ${msg.slice(0, 120) || 'erreur inconnue'}.`, 'Réessayez ; si ça persiste, vérifiez la clé du compte de service.'];
}

async function verifierConnexions(env) {
  const r = [];
  const { google } = await import('googleapis');
  const { ADHERENTS_HEADERS, ESSAIS_HEADERS } = await import('../netlify/functions/_bureau-lib.mjs');
  const email = compteDeService(env.GOOGLE_SERVICE_ACCOUNT_JSON);

  if (email && modeStockage(env, false) === 'google' && (MODULES.essais || MODULES.adhesion || MODULES.bureau)) {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const classeurs = [
      [MODULES.essais || MODULES.bureau, 'Essais', env.GOOGLE_SHEET_ESSAIS_ID, env.GOOGLE_SHEET_ESSAIS_NAME || 'Essais', ESSAIS_HEADERS],
      [MODULES.adhesion || MODULES.bureau, 'Adhérents', env.GOOGLE_SHEET_ID, env.GOOGLE_SHEET_NAME || `Saison ${ASSO.saison.label}`, [...ADHERENTS_HEADERS, ...(MODULES.bureau ? ['NUMERO', 'CARTE'] : [])]],
    ];
    if (MODULES.bureau && env.GOOGLE_SITE_SHEET_ID) {
      classeurs.push([true, 'Contenu du site (planning)', env.GOOGLE_SITE_SHEET_ID, env.GOOGLE_SITE_TAB_PLANNING || 'PLANNING', null]);
      classeurs.push([true, 'Contenu du site (événements)', env.GOOGLE_SITE_SHEET_ID, env.GOOGLE_SITE_TAB_EVENTS || 'EVENEMENTS', null]);
    }
    for (const [actif, quoi, id, onglet, attendus] of classeurs) {
      if (!actif || !id) continue;
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `'${onglet.replace(/'/g, "''")}'!A1:Z12` });
        if (!attendus) {
          r.push({ niveau: 'ok', texte: `${quoi} : onglet « ${onglet} » lisible.` });
          continue;
        }
        const lignes = res.data.values || [];
        const ecarts = lignes.map((l) => ecartsColonnes(attendus, l)).sort((a, b) => a.length - b.length)[0] || ecartsColonnes(attendus, []);
        r.push(
          ecarts.length
            ? { niveau: 'erreur', texte: `${quoi} (« ${onglet} ») : ${ecarts.slice(0, 3).join(' ; ')}${ecarts.length > 3 ? '…' : ''}`, aFaire: `En-têtes attendus : ${attendus.join(' ')}` }
            : { niveau: 'ok', texte: `${quoi} : onglet « ${onglet} », colonnes conformes.` },
        );
      } catch (err) {
        const [texte, aFaire] = messageGoogle(err, quoi, email);
        r.push({ niveau: 'erreur', texte, aFaire });
      }
    }
  }

  if (MODULES.mail && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN) {
    try {
      const client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
      client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
      await client.getAccessToken();
      r.push({ niveau: 'ok', texte: `Compte Google de l’asso connecté (${env.ASSO_GMAIL || ASSO.email}).` });
    } catch (err) {
      const grant = /invalid_grant/i.test(String(err?.message || err?.response?.data?.error || ''));
      r.push({
        niveau: 'erreur',
        texte: grant ? 'Compte Google : connexion expirée ou révoquée.' : `Compte Google : ${String(err?.message || 'erreur').slice(0, 100)}.`,
        aFaire: 'Le référent reconnecte le compte : /bureau/connexion-google, puis mettez à jour GOOGLE_REFRESH_TOKEN.',
      });
    }
  }
  r.push(...(await verifierEnvoiEnLigne(env)));
  if (MODULES.adhesion && modePaiement(env, false) === 'helloasso') {
    try {
      const nom = await verifierHelloAsso(env);
      r.push({ niveau: 'ok', texte: `HelloAsso : identifiants acceptés, association « ${nom} ».` });
    } catch (err) {
      r.push({ niveau: 'erreur', texte: `HelloAsso : ${err?.lisible ? err.message : 'injoignable depuis ce poste.'}`, aFaire: 'Voir docs/DOC-PAIEMENT.md.' });
    }
  }
  if (MODULES.mail && MODULES.bureau && modeBoite(env, false) === 'imap') {
    try {
      const n = await avecBoite(async (client) => client.mailbox.exists, env);
      r.push({ niveau: 'ok', texte: `Boîte mail (IMAP) : connexion acceptée, ${n} message(s) dans la boîte de réception.` });
    } catch (err) {
      r.push({ niveau: 'erreur', texte: `Boîte mail (IMAP) : ${err.message}`, aFaire: 'Réglages IMAP de votre fournisseur : docs/DOC-MAIL.md.' });
    }
  }
  if (!r.length) r.push({ niveau: 'attention', texte: 'Aucune connexion à tester (variables absentes ou fonctions désactivées).' });
  return r;
}

/** Se connecte au fournisseur de mail, sans rien envoyer. */
async function verifierEnvoiEnLigne(env) {
  if (!MODULES.essais && !MODULES.adhesion && !MODULES.bureau && !MODULES.presences && !MODULES.alertes) return [];
  const mode = modeEnvoi(env, false);
  if (mode === 'smtp' && env.SMTP_PASS) {
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(env.SMTP_PORT) || 465;
    const t = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER || adresseAsso(env), pass: env.SMTP_PASS },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
    try {
      await t.verify();
      return [{ niveau: 'ok', texte: `Boîte mail (SMTP ${env.SMTP_HOST}) : connexion acceptée.` }];
    } catch (err) {
      return [{ niveau: 'erreur', texte: `Boîte mail (SMTP) : ${messageSmtp(err)}`, aFaire: 'Réglages SMTP de votre fournisseur : docs/DOC-MAIL.md.' }];
    } finally {
      t.close();
    }
  }
  if (mode === 'brevo' && env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json' } });
      if (res.ok) return [{ niveau: 'ok', texte: 'Brevo : clé acceptée.' }];
      return [{ niveau: 'erreur', texte: `Brevo : ${messageBrevo(res.status)}` }];
    } catch {
      return [{ niveau: 'attention', texte: 'Brevo injoignable depuis ce poste : réessayez plus tard.' }];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------

function contenus() {
  try {
    const c = Object.fromEntries(['cours', 'coachs', 'faq', 'planning', 'evenements'].map((k) => [k, lireContenu(`${k}.json`)]));
    return verifierContenu(c, valeursTexte(ASSO, c.cours.length), existe);
  } catch (err) {
    return [{ niveau: 'erreur', texte: `contenu/ illisible : ${err.message}`, aFaire: 'Un fichier JSON est mal formé (virgule, guillemet) : ouvrez-le dans un éditeur qui le signale.' }];
  }
}

async function main() {
  console.log(teinte(1, `Vérification — ${ASSO.nom}`));
  const actifs = Object.entries(MODULES).map(([k, v]) => `${v ? teinte(32, '●') : teinte(90, '○')} ${k}`).join('   ');
  console.log(`Fonctions : ${actifs}   (asso.config.js → modules)`);

  const env = lireEnv();
  const sections = [
    ['Configuration (asso.config.js)', verifierConfig(ASSO, MODULES, existe, SAISON_COURTE)],
    ['Contenus (contenu/*.json)', contenus()],
    ['Variables (.env en local, Netlify en ligne)', verifierEnv(env, MODULES)],
  ];
  if (!horsLigne) sections.push(['Connexions (Google, mail)', await verifierConnexions(env)]);

  for (const [titre, lignes] of sections) afficher(titre, lignes);

  const tout = sections.flatMap(([, l]) => l);
  const nErr = tout.filter((l) => l.niveau === 'erreur').length;
  const nAtt = tout.filter((l) => l.niveau === 'attention').length;
  console.log('');
  if (nErr) console.log(teinte(31, `${nErr} point(s) à corriger`) + (nAtt ? `, ${nAtt} à surveiller.` : '.'));
  else console.log(teinte(32, 'Prêt à publier') + (nAtt ? ` — ${nAtt} point(s) à surveiller.` : '.'));
  console.log(teinte(90, 'Pour tout essayer sans compte Google : npm run demo'));
  process.exitCode = nErr ? 1 : 0;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
