/**
 * Contrôles de `npm run verifier`, sans réseau (testables).
 * Chaque contrôle renvoie { niveau: 'ok' | 'attention' | 'erreur', texte, aFaire? }.
 */

import { contraste } from '../src/lib/dossier.js';
import { remplir } from '../src/lib/gabarit.js';

export { contraste };

const ok = (texte) => ({ niveau: 'ok', texte });
const attention = (texte, aFaire) => ({ niveau: 'attention', texte, aFaire });
const erreur = (texte, aFaire) => ({ niveau: 'erreur', texte, aFaire });

// ---------------------------------------------------------------------------
// Configuration (asso.config.js)
// ---------------------------------------------------------------------------

const EXEMPLE = /exemple|villexemple|\b00000\b|06 00 00 00 00|0600000000/i;

/** Chemins des champs texte qui contiennent encore une valeur d’exemple. */
export function valeursExemple(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' && EXEMPLE.test(v)) out.push(p);
    else if (Array.isArray(v)) v.forEach((x, i) => out.push(...(typeof x === 'object' ? valeursExemple(x, `${p}[${i}]`) : EXEMPLE.test(String(x)) ? [`${p}[${i}]`] : [])));
    else if (v && typeof v === 'object') out.push(...valeursExemple(v, p));
  }
  return out;
}

/**
 * @param {object} asso    asso.config.js
 * @param {object} modules MODULES (asso.derive.js)
 * @param {(publicPath: string) => boolean} existe  fichier présent dans public/ ?
 * @param {string} saisonCourte « 2627 »
 */
export function verifierConfig(asso, modules, existe, saisonCourte) {
  const r = [];
  const manquants = ['nom', 'nomCourt', 'sigle', 'ville', 'codePostal', 'email', 'telephone', 'siteUrl'].filter(
    (k) => !String(asso[k] || '').trim(),
  );
  r.push(
    manquants.length
      ? erreur(`Champs vides : ${manquants.join(', ')}.`, 'Remplissez-les dans asso.config.js.')
      : ok('Identité et contacts remplis.'),
  );

  if (!/^[A-Z0-9]{2,8}$/.test(asso.sigle || '')) {
    r.push(erreur(`Sigle « ${asso.sigle} » : 2 à 8 lettres majuscules ou chiffres.`, 'Il sert aux numéros d’adhérent (ex. ASE-2627-001).'));
  }
  if (!/^\d{5}$/.test(String(asso.codePostal || ''))) r.push(erreur('Code postal : 5 chiffres attendus.'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asso.email || '')) r.push(erreur(`E-mail « ${asso.email} » invalide.`));
  if (!/^https:\/\/[^/]+/.test(asso.siteUrl || '')) {
    r.push(erreur(`siteUrl « ${asso.siteUrl} » : doit commencer par https://`, 'Mettez l’adresse finale du site.'));
  }

  const m = String(asso.saison?.label || '').match(/^(\d{4})-(\d{4})$/);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) {
    r.push(erreur(`Saison « ${asso.saison?.label} » : format attendu 2026-2027.`));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asso.saison?.reprise || '') || Number.isNaN(Date.parse(asso.saison?.reprise))) {
    r.push(erreur('saison.reprise : date au format AAAA-MM-JJ attendue.'));
  }

  const lieux = (asso.lieux || []).filter((l) => l.nom && l.rue);
  r.push(lieux.length ? ok(`${lieux.length} lieu(x) de cours.`) : erreur('Aucun lieu de cours avec nom et rue.', 'Ajoutez-en un dans lieux.'));

  if (!(Number(asso.adhesion?.tarif) > 0)) r.push(erreur('adhesion.tarif : montant attendu (ex. 140).'));

  const exemples = valeursExemple(asso);
  if (exemples.length) {
    r.push(
      attention(
        `Valeurs d’exemple encore présentes : ${exemples.slice(0, 6).join(', ')}${exemples.length > 6 ? `… (${exemples.length})` : ''}.`,
        'Remplacez-les par celles de votre association avant de publier.',
      ),
    );
  }

  const legal = ['rna', 'siege', 'responsablePublication'].filter((k) => !String(asso[k] || '').trim());
  if (legal.length) r.push(attention(`Mentions légales incomplètes : ${legal.join(', ')}.`, 'Obligatoires sur un site associatif.'));

  for (const [nom, champ, min, niveau] of [
    ['primaire', 'boutons', 4.5, erreur],
    ['secondaire', 'liens et planning', 4.5, attention],
  ]) {
    const c = contraste(asso.couleurs?.[nom]);
    if (c === null) r.push(erreur(`couleurs.${nom} « ${asso.couleurs?.[nom]} » : format #rrggbb attendu.`));
    else if (c < min) {
      r.push(niveau(`couleurs.${nom} : contraste ${c.toFixed(1)}:1 avec le blanc (${champ}), il faut ${min}:1.`, 'Prenez une teinte plus foncée : texte illisible pour une partie du public.'));
    }
  }
  if (r.every((x) => !/couleurs\./.test(x.texte))) r.push(ok('Couleurs lisibles (contraste ≥ 4,5:1).'));

  const fichiers = [
    [asso.logo, 'logo', 'npm run identite'],
    ['/assets/logo-512.png', 'logo PNG (cartes, Google)', 'npm run identite'],
    ['/assets/og-image.png', 'image de partage', 'npm run identite'],
    [asso.heroImage, 'photo du hero', 'Ajoutez la photo dans public/assets/.'],
  ];
  if (modules.bureau && modules.adhesion) {
    fichiers.push([`/assets/carte-verso-${saisonCourte}.png`, 'verso de carte de la saison', 'npm run identite -- --force']);
  }
  if (asso.federation?.logo) fichiers.push([asso.federation.logo, 'logo de la fédération', 'Ajoutez-le dans public/assets/.']);
  const absents = fichiers.filter(([p]) => p && !existe(p));
  for (const [p, quoi, faire] of absents) r.push(erreur(`Fichier manquant : ${p} (${quoi}).`, faire));
  if (!absents.length) r.push(ok('Logo, images et verso de carte présents.'));
  if (/hero\.svg$/.test(asso.heroImage || '')) {
    r.push(attention('Photo du hero : c’est l’illustration d’exemple.', 'Une vraie photo de cours (1344×768, .webp) rassure beaucoup plus.'));
  }

  if (asso.modules?.mail && asso.modules?.bureau === false) {
    r.push(attention('modules.mail est activé mais pas le bureau : le mail est ignoré.'));
  }
  return r;
}

// ---------------------------------------------------------------------------
// Variables d’environnement (selon les fonctions activées)
// ---------------------------------------------------------------------------

/** Compte de service : adresse à inviter dans les classeurs, ou null si la clé est illisible. */
export function compteDeService(raw) {
  try {
    const j = JSON.parse(String(raw || ''));
    return j.client_email && j.private_key ? j.client_email : null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{essais: boolean, adhesion: boolean, bureau: boolean, mail: boolean}} modules
 */
export function verifierEnv(env, modules) {
  const r = [];
  const a = (k) => String(env[k] || '').trim();
  const actifs = Object.entries(modules).filter(([, v]) => v).map(([k]) => k);
  if (!actifs.length) {
    r.push(ok('Site vitrine seul : aucune variable nécessaire.'));
    return r;
  }

  const besoinSheets = modules.essais || modules.adhesion || modules.bureau;
  if (besoinSheets) {
    if (!a('GOOGLE_SERVICE_ACCOUNT_JSON')) {
      r.push(erreur('GOOGLE_SERVICE_ACCOUNT_JSON manquante.', 'Clé JSON du compte de service Google : voir docs/DOC-GOOGLE-SHEETS.md.'));
    } else {
      const email = compteDeService(a('GOOGLE_SERVICE_ACCOUNT_JSON'));
      r.push(
        email
          ? ok(`Compte de service : ${email}`)
          : erreur('GOOGLE_SERVICE_ACCOUNT_JSON illisible (JSON sans client_email / private_key).', 'Collez le contenu complet du fichier .json téléchargé.'),
      );
    }
  }

  // [modules qui en ont besoin, variable, aide]
  const besoins = [
    [['essais', 'bureau'], 'GOOGLE_SHEET_ESSAIS_ID', 'ID du classeur Essais (dans son adresse, entre /d/ et /edit).'],
    [['adhesion', 'bureau'], 'GOOGLE_SHEET_ID', 'ID du classeur Adhérents.'],
    [['bureau'], 'BUREAU_PASSWORD', 'Mot de passe partagé du bureau.'],
    [['bureau'], 'BUREAU_SECRET', 'Longue chaîne aléatoire (32 caractères ou plus).'],
    [['mail'], 'GOOGLE_CLIENT_ID', 'Voir docs/DOC-BUREAU-GOOGLE.md.'],
    [['mail'], 'GOOGLE_CLIENT_SECRET', 'Voir docs/DOC-BUREAU-GOOGLE.md.'],
    [['mail'], 'GOOGLE_REFRESH_TOKEN', 'Le référent connecte le compte une fois : /bureau/connexion-google.'],
  ];
  const incomplets = new Set();
  for (const [mods, cle, aide] of besoins) {
    const qui = mods.filter((m) => modules[m]);
    if (!qui.length || a(cle)) continue;
    r.push(erreur(`${cle} manquante.`, aide));
    qui.forEach((m) => incomplets.add(m));
  }
  if (besoinSheets && !compteDeService(a('GOOGLE_SERVICE_ACCOUNT_JSON'))) {
    ['essais', 'adhesion', 'bureau'].filter((m) => modules[m]).forEach((m) => incomplets.add(m));
  }
  if (incomplets.size) {
    const liste = [...incomplets];
    r.push(
      attention(
        `Pas encore prêt pour : ${liste.join(', ')}.`,
        `Pour publier sans attendre : dans asso.config.js → modules, mettez ${liste.map((m) => `${m}: false`).join(', ')}. Le site vitrine marche sans.`,
      ),
    );
  }

  if (modules.bureau && a('BUREAU_SECRET') && a('BUREAU_SECRET').length < 32) {
    r.push(erreur('BUREAU_SECRET trop courte (32 caractères minimum).', 'Générez-la : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'));
  }
  if (modules.bureau && a('BUREAU_PASSWORD')) {
    if (/^(demo|seance|motdepasse|password|1234)/i.test(a('BUREAU_PASSWORD'))) {
      r.push(erreur('BUREAU_PASSWORD trop facile à deviner.', 'Choisissez une phrase d’au moins 12 caractères.'));
    } else if (a('BUREAU_PASSWORD').length < 12) {
      r.push(attention('BUREAU_PASSWORD courte (moins de 12 caractères).', 'Une phrase de 3 ou 4 mots est plus sûre et facile à retenir.'));
    }
  }
  if (modules.bureau && !a('GOOGLE_SITE_SHEET_ID')) {
    r.push(attention('GOOGLE_SITE_SHEET_ID absente : le planning et les événements se modifieront dans le classeur Essais.', 'Facultatif : un classeur « contenu site » séparé.'));
  }
  if (/^(1|true|oui)$/i.test(a('DEMO'))) {
    r.push(erreur('DEMO est activé : le site tourne sur des données fictives.', 'Retirez DEMO des variables de production.'));
  }
  if (!r.some((x) => x.niveau === 'erreur')) r.push(ok(`Variables présentes pour : ${actifs.join(', ')}.`));
  return r;
}

/** En-têtes attendus en tête d’onglet ; renvoie la liste des écarts (vide si conforme). */
export function ecartsColonnes(attendus, lus) {
  const out = [];
  attendus.forEach((h, i) => {
    const v = String(lus?.[i] ?? '').trim();
    if (v.toUpperCase().replace(/\s+/g, '_') !== h) out.push(`colonne ${i + 1} : « ${v || 'vide'} » au lieu de « ${h} »`);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Contenus (contenu/*.json)
// ---------------------------------------------------------------------------


/**
 * Cohérence des contenus : planning ↔ cours, cours ↔ animateurs, textes à trous.
 * @param {{ cours: object[], coachs: object[], faq: object[], planning: object[], evenements: object[] }} c
 * @param {Record<string, string>} valeurs valeursTexte(asso, nbCours)
 * @param {(publicPath: string) => boolean} existe
 */
export function verifierContenu(c, valeurs, existe = () => true) {
  const r = [];
  const noms = new Set(c.cours.map((x) => x.nom));
  if (!c.cours.length) r.push(erreur('Aucun cours dans contenu/cours.json.'));
  const horsCours = [...new Set(c.planning.map((p) => p.cours).filter((n) => !noms.has(n)))];
  if (horsCours.length) {
    r.push(erreur(`Planning : cours inconnus ${horsCours.map((n) => `« ${n} »`).join(', ')}.`, 'Même nom, à la lettre près, que dans contenu/cours.json.'));
  }
  const sansCreneau = c.cours.filter((x) => !x.noteHoraire && !c.planning.some((p) => p.cours === x.nom)).map((x) => x.nom);
  if (sansCreneau.length) r.push(attention(`Cours sans créneau au planning : ${sansCreneau.join(', ')}.`, 'Ajoutez un créneau, ou une noteHoraire (« Reprise en janvier »).'));
  if (c.coachs.length) {
    const coachs = new Set(c.coachs.map((x) => x.nom));
    const inconnus = [...new Set(c.cours.map((x) => x.animateur).filter((a) => a && !coachs.has(a)))];
    if (inconnus.length) r.push(attention(`Animateurs absents de contenu/coachs.json : ${inconnus.join(', ')}.`));
  }
  const images = [...c.cours, ...c.coachs].map((x) => x.image).filter((img) => img && !existe(img));
  if (images.length) r.push(erreur(`Images manquantes : ${images.join(', ')}.`, 'npm run identite crée les illustrations ; ou ajoutez la photo dans public/assets/.'));
  const textes = [
    ...c.faq.flatMap((f) => [f.question, f.reponse]),
    ...c.cours.flatMap((x) => [x.resume, x.texte, x.accroche]),
    ...c.coachs.map((x) => x.bio),
    ...c.planning.map((p) => p.lieu),
    ...c.evenements.map((e) => e.lieu),
  ].filter(Boolean);
  const restes = [...new Set(textes.map((t) => remplir(t, valeurs)).flatMap((t) => t.match(/\{[^}]*\}/g) || []))];
  if (restes.length) r.push(erreur(`Textes à trous inconnus : ${restes.join(', ')}.`, `Disponibles : ${Object.keys(valeurs).map((k) => `{${k}}`).join(' ')}`));
  if (!r.some((x) => x.niveau === 'erreur')) {
    r.push(ok(`${c.cours.length} cours, ${c.coachs.length} animateur(s), ${c.faq.length} questions, ${c.planning.length} créneaux.`));
  }
  return r;
}
