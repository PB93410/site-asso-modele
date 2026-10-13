// ============================================================
// CONFIGURATION DE L'ASSOCIATION — fichier unique à adapter
// ============================================================
//
// Tout ce qui est propre à votre association est ici :
// nom, ville, salles, contacts, tarif, couleurs, saison.
// Le site, les fonctions Netlify et les scripts lisent ce fichier.
//
// Après modification : `npm run verifier`, puis `npm run dev` pour voir le site.
// Pour tout essayer sans compte Google : `npm run demo` (mot de passe bureau : demo).
// Les contenus éditoriaux (coachs, cours, FAQ, blog) sont dans src/data/.
// ============================================================

/** @type {import('./asso.config').AssoConfig} */
const ASSO = {
  // ---- Fonctions du site ----
  // Montez le site par étapes : mettez false à ce qui n'est pas encore branché.
  // Le site vitrine (cours, planning, tarifs, contact) marche toujours, sans réglage.
  // `npm run verifier` dit ce qui manque pour chaque fonction activée.
  modules: {
    /** Formulaire d'essai gratuit → tableau Essais du bureau. Sinon /essai propose d'appeler ou d'écrire. */
    essais: true,
    /** Inscription en ligne → tableau Adhérents du bureau. Sinon /inscription explique comment s'inscrire. */
    adhesion: true,
    /** Espace /bureau des bénévoles (essais, encaissements, cartes, planning). */
    bureau: true,
    /** Boîte mail de l'asso lue dans le bureau, en IMAP ou Gmail (demande le bureau). L'envoi des
     *  alertes et des cartes n'en dépend pas (docs/DOC-MAIL.md), l'agenda non plus (docs/DOC-AGENDA.md). */
    mail: true,
    /** Pointage aux séances par QR (un code par cours et par jour). Page publique + stats au bureau. */
    presences: false,
    /** Quiz public « Quel cours pour moi ? » (5 à 7 questions, recommandation, lien essai ou adhésion). */
    quiz: false,
    /** Alertes de dernière minute (annulation / changement) : bandeau sur le site, mail, notification. */
    alertes: false,
    /** File d’attente quand un cours ou un créneau est complet. Place proposée avec un délai. */
    listeAttente: false,
    /** Carte adhérent dans Apple Wallet et Google Wallet. */
    wallet: false,
    /** Aides (Pass'Sport, ANCV, comité d’entreprise) sur le formulaire d’adhésion. */
    financement: false,
    /** Rapport annuel (AG, subvention) : effectifs, essais, présences, âges, communes. */
    rapport: false,
    /** Attestations PDF (adhésion, reçu fiscal si éligible, comité d’entreprise). */
    attestations: false,
  },

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
    /** Paiement en ligne. Vide = pas de paiement en ligne.
     *  Avec HelloAsso branché (docs/DOC-PAIEMENT.md), le site crée le paiement et valide
     *  l'adhésion tout seul ; sinon ce lien est seulement affiché et le bureau pointe à la main. */
    paiementNom: 'HelloAsso',
    paiementUrl: 'https://www.helloasso.com/',
    /** Autres moyens acceptés au bureau. */
    autresPaiements: ['chèque', 'espèces', 'chèques ANCV'],
    /** IBAN de l'asso, affiché pour payer par virement avec la référence de la demande. Vide = pas affiché. */
    iban: '',
  },

  // ---- Liste d'attente (modules.listeAttente) ----
  listeAttente: {
    /** Places par défaut pour un créneau (essai) ou un cours (adhésion). */
    capaciteDefaut: 20,
    /** Heures pour accepter une place libérée. */
    delaiReponseHeures: 48,
  },

  // ---- Attestations (modules.attestations) ----
  attestations: {
    /** Reçu fiscal (modèle Cerfa) : seulement si l’association est éligible (intérêt général). */
    recuFiscal: false,
    /** Objet social, mentionné sur le reçu fiscal. Vide = l’accroche. */
    objet: '',
  },

  // ---- Aides (modules.financement) ----
  financement: {
    /** Pass'Sport, en euros. 0 = non proposé. */
    passSport: 50,
    /** Plafond chèques ANCV, en euros. 0 = non proposé. */
    ancvMax: 40,
    /** Aide type comité d’entreprise, en euros. 0 = non proposée. */
    comiteEntreprise: 30,
  },

  // ---- Saison ----
  saison: {
    label: '2026-2027',
    /** Reprise des cours (AAAA-MM-JJ). */
    reprise: '2026-09-07',
    /** Fin de la période où le bouton principal pousse l'essai plutôt que l'adhésion. */
    finCampagneEssai: '2026-10-31',
    /** Premier jour sans cours de l'été (AAAA-MM-JJ). Vide = non annoncé. */
    fin: '2027-07-04',
    /**
     * Vacances sans cours (dates de la zone scolaire : education.gouv.fr/calendrier-scolaire).
     * du = premier jour sans cours, reprise = jour où les cours reprennent. Vide = cours toute l'année.
     */
    pauses: [
      { libelle: 'vacances de la Toussaint', du: '2026-10-18', reprise: '2026-11-02' },
      { libelle: 'vacances de Noël', du: '2026-12-20', reprise: '2027-01-04' },
      { libelle: 'vacances d’hiver', du: '2027-02-07', reprise: '2027-02-22' },
      { libelle: 'vacances de printemps', du: '2027-04-04', reprise: '2027-04-19' },
    ],
    /** Pas de cours les jours fériés (calculés tout seuls), sauf ces dates (AAAA-MM-JJ). */
    feriesAvecCours: [],
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
