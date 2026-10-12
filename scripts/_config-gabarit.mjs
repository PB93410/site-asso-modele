/**
 * Écrit asso.config.js à partir d'une configuration, avec les commentaires d'aide.
 * Garantie (tests/dossier.test.ts) : rendreConfig(config actuelle) redonne le fichier à l'identique.
 * Un champ ajouté à asso.config.js doit l'être ici aussi.
 */

/** Chaîne JS entre apostrophes droites. */
const q = (s) => `'${String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const liste = (a) => `[${(a || []).map(q).join(', ')}]`;
const bool = (v) => (v === false ? 'false' : 'true');

function lieu(l) {
  const lignes = [`      id: ${q(l.id)},`, `      nom: ${q(l.nom)},`, `      rue: ${q(l.rue)},`];
  if (l.acces) lignes.push(`      acces: ${q(l.acces)},`);
  if (l.codePostal) lignes.push(`      codePostal: ${q(l.codePostal)},`);
  if (l.ville) lignes.push(`      ville: ${q(l.ville)},`);
  if (Number.isFinite(l.lat) && Number.isFinite(l.lon)) lignes.push(`      lat: ${l.lat},`, `      lon: ${l.lon},`);
  return `    {\n${lignes.join('\n')}\n    },`;
}

export function rendreConfig(c) {
  const m = c.modules || {};
  return `// ============================================================
// CONFIGURATION DE L'ASSOCIATION — fichier unique à adapter
// ============================================================
//
// Tout ce qui est propre à votre association est ici :
// nom, ville, salles, contacts, tarif, couleurs, saison.
// Le site, les fonctions Netlify et les scripts lisent ce fichier.
//
// Après modification : \`npm run verifier\`, puis \`npm run dev\` pour voir le site.
// Pour tout essayer sans compte Google : \`npm run demo\` (mot de passe bureau : demo).
// Les contenus éditoriaux (coachs, cours, FAQ, blog) sont dans src/data/.
// ============================================================

/** @type {import('./asso.config').AssoConfig} */
const ASSO = {
  // ---- Fonctions du site ----
  // Montez le site par étapes : mettez false à ce qui n'est pas encore branché.
  // Le site vitrine (cours, planning, tarifs, contact) marche toujours, sans réglage.
  // \`npm run verifier\` dit ce qui manque pour chaque fonction activée.
  modules: {
    /** Formulaire d'essai gratuit → Google Sheet Essais. Sinon /essai propose d'appeler ou d'écrire. */
    essais: ${bool(m.essais)},
    /** Inscription en ligne → Google Sheet Adhérents. Sinon /inscription explique comment s'inscrire. */
    adhesion: ${bool(m.adhesion)},
    /** Espace /bureau des bénévoles (essais, encaissements, cartes, planning). */
    bureau: ${bool(m.bureau)},
    /** Boîte mail et agenda du compte Google de l'asso, dans le bureau (demande le bureau).
     *  L'envoi des alertes et des cartes n'en dépend pas : docs/DOC-MAIL.md. */
    mail: ${bool(m.mail)},
  },

  // ---- Identité ----
  nom: ${q(c.nom)},
  /** Nom court affiché dans le header, les mails, les cartes. */
  nomCourt: ${q(c.nomCourt)},
  /** Préfixe des numéros d'adhérent (ex. ASE-2627-0001). Lettres, sans espace. */
  sigle: ${q(c.sigle)},
  /** Type d'activité, utilisé dans les titres : « Gym, Pilates, Zumba ». */
  accroche: ${q(c.accroche)},
  /** Phrase courte du hero. */
  slogan: ${q(c.slogan)},
  anneeCreation: ${q(c.anneeCreation)},
  /** Statut juridique (mentions légales). */
  statut: ${q(c.statut)},
  rna: ${q(c.rna)}, // ex. W000000000 — laisser vide si non publié
  siret: ${q(c.siret)}, // laisser vide si non publié
  /** Adresse du siège social (mentions légales). */
  siege: ${q(c.siege)},
  /** Responsable de la publication et du traitement RGPD (mentions légales). */
  responsablePublication: ${q(c.responsablePublication)},
  /** Assureur responsabilité civile (mentions légales). Vide = phrase masquée. */
  assureur: ${q(c.assureur)},

  // ---- Localisation ----
  ville: ${q(c.ville)},
  codePostal: ${q(c.codePostal)},
  departement: ${q(c.departement)},
  region: ${q(c.region)},
  /** Communes voisines (SEO, page « Autour de… »). */
  communesVoisines: ${liste(c.communesVoisines)},

  /** Lieux des séances. \`id\` sert dans le planning (colonne location = nom). */
  lieux: [
${(c.lieux || []).map(lieu).join('\n')}
  ],

  // ---- Contacts ----
  siteUrl: ${q(c.siteUrl)},
  email: ${q(c.email)},
  /** Téléphone affiché. */
  telephone: ${q(c.telephone)},
  /** Même numéro au format international, sans + ni espaces (WhatsApp). Vide = pas de WhatsApp. */
  whatsapp: ${q(c.whatsapp)},
  reseaux: {
    instagram: ${q(c.reseaux?.instagram)}, // ex. https://www.instagram.com/monasso/
    facebook: ${q(c.reseaux?.facebook)},
    /** Lien « Laisser un avis Google » (fiche Google Business). Vide = bloc masqué. */
    avisGoogle: ${q(c.reseaux?.avisGoogle)},
  },

  // ---- Fédération (laisser nom vide si aucune) ----
  federation: {
    nom: ${q(c.federation?.nom)},
    sigle: ${q(c.federation?.sigle)},
    url: ${q(c.federation?.url)},
    logo: ${q(c.federation?.logo)},
  },

  // ---- Adhésion ----
  adhesion: {
    /** Tarif annuel en euros (nombre). */
    tarif: ${Number(c.adhesion?.tarif) || 0},
    /** Ce que comprend le tarif. */
    inclus: ${q(c.adhesion?.inclus)},
    /** Nombre de séances d'essai gratuites. 0 = pas d'essai. */
    essais: ${Number(c.adhesion?.essais) || 0},
    /** Paiement en ligne (HelloAsso, Yapla…). Vide = pas de paiement en ligne. */
    paiementNom: ${q(c.adhesion?.paiementNom)},
    paiementUrl: ${q(c.adhesion?.paiementUrl)},
    /** Autres moyens acceptés au bureau. */
    autresPaiements: ${liste(c.adhesion?.autresPaiements)},
  },

  // ---- Saison ----
  saison: {
    label: ${q(c.saison?.label)},
    /** Reprise des cours (AAAA-MM-JJ). */
    reprise: ${q(c.saison?.reprise)},
    /** Fin de la période où le bouton principal pousse l'essai plutôt que l'adhésion. */
    finCampagneEssai: ${q(c.saison?.finCampagneEssai)},
  },

  // ---- Apparence ----
  couleurs: {
    /** Couleur des boutons principaux (contraste ≥ 4.5:1 avec le blanc). */
    primaire: ${q(c.couleurs?.primaire)},
    primaireHover: ${q(c.couleurs?.primaireHover)},
    /** Couleur secondaire calme (planning, liens). */
    secondaire: ${q(c.couleurs?.secondaire)},
    secondaireHover: ${q(c.couleurs?.secondaireHover)},
  },
  logo: ${q(c.logo)},
  /** Photo du hero (1344×768 conseillé, .webp). */
  heroImage: ${q(c.heroImage)},
  heroAlt: ${q(c.heroAlt)},
};

export default ASSO;
`;
}
