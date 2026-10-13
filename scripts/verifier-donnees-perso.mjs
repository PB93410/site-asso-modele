/**
 * Contrôle des données personnelles dans le dépôt (npm run verifier:donnees, et à chaque push sur GitHub).
 *
 * Cherche dans les fichiers suivis par git les numéros de portable (06 / 07, aussi en +33)
 * et les adresses e-mail. Échoue si l'un d'eux n'est ni dans scripts/donnees-autorisees.json
 * (valeurs d'exemple des tests), ni dans asso.config.js (coordonnées publiques de l'association).
 *
 * Un vrai numéro ou un vrai e-mail d'adhérent n'a rien à faire dans le code : il reste dans les
 * données du bureau (Netlify ou Google Sheets).
 * Pour un exemple de test, prendre une valeur fictive (06 12 34 56 78, marie@exemple.fr)
 * et l'ajouter à la liste si besoin.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LISTE = path.join(ROOT, 'scripts', 'donnees-autorisees.json');
const IGNORES = [/^package-lock\.json$/, /\.(png|jpe?g|webp|gif|ico|pdf|woff2?|ttf|otf|zip|bundle)$/i];

/** « +33 6 12 34 56 78 », « 06.12.34.56.78 » → « 0612345678 ». */
export function numeroNational(brut) {
  let d = String(brut).replace(/\D/g, '');
  if (d.startsWith('33')) d = `0${d.slice(2)}`;
  return d;
}

const RE_TEL = /(?<![\w+-])(?:\+33[\s.]?|0)[67](?:[\s.]?\d{2}){4}(?!\d)/g;
const RE_MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Numéros et e-mails non autorisés d'un texte → [{ ligne, valeur }]. */
export function trouver(texte, autorises) {
  const tels = new Set(autorises.telephones.map(numeroNational));
  const motifs = (autorises.motifs || []).map((m) => new RegExp(m));
  const mails = new Set(autorises.emails.map((m) => m.toLowerCase()));
  const domaines = autorises.domaines.map((d) => d.toLowerCase());
  const out = [];
  texte.split(/\r?\n/).forEach((l, i) => {
    for (const m of l.matchAll(RE_TEL)) {
      const n = numeroNational(m[0]);
      if (!tels.has(n) && !motifs.some((re) => re.test(n))) out.push({ ligne: i + 1, valeur: m[0] });
    }
    for (const m of l.matchAll(RE_MAIL)) {
      const mail = m[0].toLowerCase();
      const domaine = mail.split('@')[1];
      if (mails.has(mail) || domaines.some((d) => domaine === d || domaine.endsWith(`.${d}`))) continue;
      out.push({ ligne: i + 1, valeur: m[0] });
    }
  });
  return out;
}

/**
 * Ajoute à la liste les numéros et e-mails de asso.config.js : ce sont les coordonnées publiques
 * de l'association (affichées sur le site), pas celles d'un adhérent.
 */
export function avecConfigPublique(autorises, texteConfig) {
  const publics = trouver(texteConfig, { telephones: [], motifs: [], emails: [], domaines: [] }).map((x) => x.valeur);
  return {
    ...autorises,
    telephones: [...autorises.telephones, ...publics.filter((v) => !v.includes('@'))],
    emails: [...autorises.emails, ...publics.filter((v) => v.includes('@'))],
  };
}

function main() {
  const config = path.join(ROOT, 'asso.config.js');
  const liste = JSON.parse(fs.readFileSync(LISTE, 'utf8'));
  const autorises = fs.existsSync(config) ? avecConfigPublique(liste, fs.readFileSync(config, 'utf8')) : liste;
  const fichiers = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((f) => f && !IGNORES.some((re) => re.test(f)) && f !== 'scripts/donnees-autorisees.json');
  let n = 0;
  for (const f of fichiers) {
    let texte;
    try {
      texte = fs.readFileSync(path.join(ROOT, f), 'utf8');
    } catch {
      continue;
    }
    for (const { ligne, valeur } of trouver(texte, autorises)) {
      // On n'affiche pas la valeur entière : le journal de GitHub est lisible par les collaborateurs.
      console.error(`${f}:${ligne} — ${valeur.slice(0, 4)}… (numéro ou e-mail non autorisé)`);
      n += 1;
    }
  }
  if (n) {
    console.error(`\n${n} donnée(s) personnelle(s) possible(s). Remplacez-les par des valeurs fictives,`);
    console.error('ou, si c’est un exemple déjà fictif, ajoutez-le à scripts/donnees-autorisees.json.');
    process.exit(1);
  }
  console.log(`Données personnelles : rien trouvé (${fichiers.length} fichiers).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
