/**
 * npm run installer -- <dossier.json>
 *
 * Installe le dossier envoyé par une association (questionnaire en ligne /configurer) :
 *   asso.config.js, public/data/planning.csv, logo et photo dans public/assets/,
 * puis logo/favicons/verso (npm run identite) et contrôle (npm run verifier).
 * Récapitulatif pour le référent : tmp/installation-<sigle>.md (jamais commité : il
 * contient le contact du bénévole).
 *
 *   --force   remplace une configuration déjà installée (autre que l'exemple du modèle)
 *   --essai   montre ce qui serait écrit, sans rien écrire
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configDepuisDossier, erreursDossier, imagesDossier, normaliserDossier, planningCsv } from '../src/lib/dossier.js';
import { rendreConfig } from './_config-gabarit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXEMPLE = 'Association Sportive Exemple';

/** Lit un dossier .json (le questionnaire l'envoie aussi en pièce jointe). */
export function lireDossier(fichier) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(fichier, 'utf8').replace(/^﻿/, ''));
  } catch (err) {
    throw new Error(`Dossier illisible (${path.basename(fichier)}) : ${err.message}`);
  }
  return normaliserDossier(raw);
}

/** Récapitulatif pour le référent : ce que l'outil ne sait pas encore installer seul. */
export function recapitulatif(dossier, config) {
  const d = normaliserDossier(dossier);
  const lignes = [
    `# Installation — ${config.nom}`,
    '',
    `Dossier envoyé le ${d.envoyeLe || '—'}, installé le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}.`,
    '',
    '## Contact',
    '',
    `- ${d.contact.nom}${d.contact.role ? ` (${d.contact.role})` : ''}`,
    `- ${d.contact.email}${d.contact.telephone ? ` · ${d.contact.telephone}` : ''}`,
    '',
    '## Fonctions demandées',
    '',
    ...Object.entries(config.modules).map(([k, v]) => `- ${v ? '[x]' : '[ ]'} ${k}`),
    '',
    '## Cours à reprendre dans src/data (siteData.ts → ACTIVITIES, activityPages.ts)',
    '',
    ...d.cours.map((c) => `- **${c.nom}** — ${String(c.description || '').trim() || '(pas de description)'}`),
    '',
  ];
  if (d.remarques.trim()) lignes.push('## Remarques de l’association', '', d.remarques.trim(), '');
  lignes.push(
    '## À faire',
    '',
    '- [ ] Relire le site : `npm run demo` (bureau : mot de passe demo), le montrer à l’association',
    '- [ ] Cours, coachs, FAQ dans src/data/',
    ...(config.modules.essais || config.modules.adhesion || config.modules.bureau
      ? ['- [ ] Google : compte de service, classeurs (docs/DOC-GOOGLE-SHEETS.md)']
      : []),
    ...(config.modules.mail ? ['- [ ] Compte Google de l’asso : /bureau/connexion-google (docs/DOC-BUREAU-GOOGLE.md)'] : []),
    '- [ ] Netlify : site relié au dépôt, variables, domaine',
    '- [ ] `npm run verifier` sans ✖',
    '',
  );
  return lignes.join('\n');
}

/**
 * Écrit les fichiers du dossier dans `root`. Renvoie la liste des fichiers écrits.
 * @param {{ dossier: object, root?: string, base: object, essai?: boolean }} opts
 */
export function installerDossier({ dossier, root = ROOT, base, essai = false }) {
  const d = normaliserDossier(dossier);
  const config = configDepuisDossier(d, base);
  const ecrits = [];
  const ecrire = (rel, contenu) => {
    ecrits.push(rel);
    if (essai) return;
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contenu);
  };
  for (const img of imagesDossier(d)) {
    ecrire(`public/${img.chemin}`, Buffer.from(img.dataUrl.split(',')[1], 'base64'));
  }
  ecrire('asso.config.js', rendreConfig(config));
  if (d.planning.length) ecrire('public/data/planning.csv', planningCsv(d));
  ecrire(`tmp/installation-${config.sigle.toLowerCase()}.md`, recapitulatif(d, config));
  return { config, ecrits };
}

function lancer(script, args = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { cwd: ROOT, stdio: 'inherit' });
  return r.status === 0;
}

async function main() {
  const fichier = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const force = process.argv.includes('--force');
  const essai = process.argv.includes('--essai');
  if (!fichier) {
    console.log('Usage : npm run installer -- chemin/vers/dossier-ASSO.json [--essai] [--force]');
    process.exitCode = 1;
    return;
  }

  const dossier = lireDossier(path.resolve(fichier));
  const erreurs = erreursDossier(dossier).filter((e) => e.etape !== 'envoi');
  if (erreurs.length) {
    console.log('Le dossier est incomplet :');
    for (const e of erreurs) console.log(`  ✖ ${e.message}`);
    console.log('Complétez-le avec l’association (ou corrigez le .json), puis relancez.');
    process.exitCode = 1;
    return;
  }

  // Configuration actuelle : base pour les champs que le questionnaire ne demande pas.
  const { default: base } = await import(`${pathToFileURL(path.join(ROOT, 'asso.config.js')).href}?t=${Date.now()}`);
  if (base.nom !== EXEMPLE && base.nom !== dossier.association.nom && !force && !essai) {
    console.log(`Ce projet est déjà configuré pour « ${base.nom} ».`);
    console.log('Utilisez une copie neuve du modèle par association, ou ajoutez --force pour remplacer.');
    process.exitCode = 1;
    return;
  }

  const { config, ecrits } = installerDossier({ dossier, base, essai });
  console.log(`${essai ? 'Aperçu — rien n’est écrit' : 'Installé'} : ${config.nom} (${config.sigle})`);
  for (const f of ecrits) console.log(`  ${essai ? '·' : '✔'} ${f}`);
  if (dossier.apparence.couleur.toUpperCase() !== config.couleurs.primaire) {
    console.log(`  · couleur ${dossier.apparence.couleur} assombrie en ${config.couleurs.primaire} pour rester lisible`);
  }
  if (essai) return;

  console.log('\nLogo, favicons, image de partage, verso de carte…');
  lancer('make-identity.mjs', ['--force']);
  console.log('');
  lancer('verifier.mjs', ['--hors-ligne']);
  console.log(`\nSuite : tmp/installation-${config.sigle.toLowerCase()}.md (cours à reprendre, contact, à faire).`);
  console.log('Pour montrer le site à l’association : npm run demo');
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
