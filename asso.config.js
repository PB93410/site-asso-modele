// ============================================================
// CONFIGURATION DE L'ASSOCIATION — fichier unique à adapter
// ============================================================
//
// Tout ce qui est propre à votre association est ici :
// nom, ville, salles, contacts, tarif, couleurs, saison.
// Le site, les fonctions Netlify et les scripts lisent ce fichier.
//
// Après modification : `npm run dev` pour vérifier, puis déployer.
// Les contenus éditoriaux (coachs, cours, FAQ, blog) sont dans src/data/.
// ============================================================

/** @type {import('./asso.config').AssoConfig} */
const ASSO = {
  // ---- Identité ----
  nom: 'Association Sportive Exemple',
  /** Nom court affiché dans le header, les mails, les cartes. */
  nomCourt: 'ASE',
  /** Préfixe des numéros d'adhérent (ex. ASE-2627-0001). Lettres, sans espace. */
  sigle: 'ASE',
  /** Type d'activité, utilisé dans les titres : « Gym, Pilates, Zumba ». */
  accroche: 'Gym, Pilates, Zumba',
  /** Phrase courte du hero. */
  slogan: 'Reprenez le sport, sans pression',
  anneeCreation: '1980',
  /** Statut juridique (mentions légales). */
  statut: 'Association loi 1901',
  rna: '', // ex. W000000000 — laisser vide si non publié
  siret: '', // laisser vide si non publié
  /** Adresse du siège social (mentions légales). */
  siege: '1 place de la Mairie, 00000 Villexemple',
  /** Responsable de la publication et du traitement RGPD (mentions légales). */
  responsablePublication: 'Le ou la président·e de l’association',
  /** Assureur responsabilité civile (mentions légales). Vide = phrase masquée. */
  assureur: '',

  // ---- Localisation ----
  ville: 'Villexemple',
  codePostal: '00000',
  departement: 'Département',
  region: 'Île-de-France',
  /** Communes voisines (SEO, page « Autour de… »). */
  communesVoisines: ['Commune A', 'Commune B', 'Commune C'],

  /** Lieux des séances. `id` sert dans le planning (colonne location = nom). */
  lieux: [
    {
      id: 'gymnase',
      nom: 'Gymnase municipal',
      rue: '1 rue de l’Exemple',
      acces: 'Parking devant le gymnase.',
    },
    {
      id: 'salle',
      nom: 'Salle des fêtes',
      rue: '2 place de la Mairie',
      acces: 'Entrée côté parc.',
    },
  ],

  // ---- Contacts ----
  siteUrl: 'https://www.exemple-asso.fr',
  email: 'contact@exemple-asso.fr',
  /** Téléphone affiché. */
  telephone: '06 00 00 00 00',
  /** Même numéro au format international, sans + ni espaces (WhatsApp). Vide = pas de WhatsApp. */
  whatsapp: '33600000000',
  reseaux: {
    instagram: '', // ex. https://www.instagram.com/monasso/
    facebook: '',
    /** Lien « Laisser un avis Google » (fiche Google Business). Vide = bloc masqué. */
    avisGoogle: '',
  },

  // ---- Fédération (laisser nom vide si aucune) ----
  federation: {
    nom: 'Fédération Exemple',
    sigle: 'FFX',
    url: 'https://www.exemple-federation.fr',
    logo: '/assets/logo-federation.svg',
  },

  // ---- Adhésion ----
  adhesion: {
    /** Tarif annuel en euros (nombre). */
    tarif: 140,
    /** Ce que comprend le tarif. */
    inclus: 'licence et assurance comprises',
    /** Nombre de séances d'essai gratuites. 0 = pas d'essai. */
    essais: 3,
    /** Paiement en ligne (HelloAsso, Yapla…). Vide = pas de paiement en ligne. */
    paiementNom: 'HelloAsso',
    paiementUrl: 'https://www.helloasso.com/',
    /** Autres moyens acceptés au bureau. */
    autresPaiements: ['chèque', 'espèces', 'chèques ANCV'],
  },

  // ---- Saison ----
  saison: {
    label: '2026-2027',
    /** Reprise des cours (AAAA-MM-JJ). */
    reprise: '2026-09-07',
    /** Fin de la période où le bouton principal pousse l'essai plutôt que l'adhésion. */
    finCampagneEssai: '2026-10-31',
  },

  // ---- Apparence ----
  couleurs: {
    /** Couleur des boutons principaux (contraste ≥ 4.5:1 avec le blanc). */
    primaire: '#C45309',
    primaireHover: '#A34608',
    /** Couleur secondaire calme (planning, liens). */
    secondaire: '#5C6B4A',
    secondaireHover: '#4A5740',
  },
  logo: '/assets/logo.svg',
  /** Photo du hero (1344×768 conseillé, .webp). */
  heroImage: '/assets/hero.svg',
  heroAlt: 'Séance collective dans le gymnase',
};

export default ASSO;
