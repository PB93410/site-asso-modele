export interface AssoLieu {
  id: string;
  nom: string;
  rue: string;
  acces?: string;
  /** Si la salle n'est pas dans la ville de l'association. */
  codePostal?: string;
  ville?: string;
  /** Coordonnées GPS (données structurées, plan). */
  lat?: number;
  lon?: number;
}

export interface AssoModules {
  essais: boolean;
  adhesion: boolean;
  bureau: boolean;
  mail: boolean;
  /** Pointage par QR. Absent = désactivé. */
  presences: boolean;
  /** Quiz « Quel cours pour moi ? ». Absent = désactivé. */
  quiz: boolean;
  /** Alertes de dernière minute. Absent = désactivé. */
  alertes: boolean;
  /** File d’attente. Absent = désactivé. */
  listeAttente: boolean;
  /** Carte Apple / Google Wallet. Absent = désactivé. */
  wallet: boolean;
  /** Aides sur l’adhésion. Absent = désactivé. */
  financement: boolean;
  /** Rapport annuel. Absent = désactivé. */
  rapport: boolean;
  /** Attestations PDF. Absent = désactivé. */
  attestations: boolean;
  /** Espace adhérent sans mot de passe. Absent = désactivé. */
  espace: boolean;
  /** Parrainage dans l'espace adhérent. Absent = désactivé. */
  parrainage: boolean;
  /** Mini-sondage après l'essai. Absent = désactivé. */
  sondageEssai: boolean;
}

export interface AssoListeAttente {
  capaciteDefaut: number;
  delaiReponseHeures: number;
}

export interface AssoFinancement {
  passSport: number;
  ancvMax: number;
  comiteEntreprise: number;
}

export interface AssoAttestations {
  /** Reçu fiscal : seulement si l’association est éligible. */
  recuFiscal: boolean;
  objet: string;
}

export interface AssoConfig {
  /** Fonctions activées. essais / adhesion / bureau / mail : absentes = on. Autres modules : absentes = off. */
  modules?: Partial<AssoModules>;
  nom: string;
  nomCourt: string;
  sigle: string;
  /** Préréglage du questionnaire. Vide = autre / aucun. */
  typeAsso?: string;
  accroche: string;
  slogan: string;
  anneeCreation: string;
  statut: string;
  rna: string;
  siret: string;
  siege: string;
  responsablePublication: string;
  assureur: string;
  ville: string;
  codePostal: string;
  departement: string;
  region: string;
  communesVoisines: string[];
  lieux: AssoLieu[];
  siteUrl: string;
  email: string;
  telephone: string;
  whatsapp: string;
  reseaux: { instagram: string; facebook: string; avisGoogle: string };
  federation: { nom: string; sigle: string; url: string; logo: string };
  adhesion: {
    tarif: number;
    inclus: string;
    essais: number;
    paiementNom: string;
    paiementUrl: string;
    autresPaiements: string[];
    /** IBAN affiché pour le virement (facultatif). */
    iban?: string;
  };
  listeAttente: AssoListeAttente;
  financement: AssoFinancement;
  attestations: AssoAttestations;
  saison: {
    label: string;
    reprise: string;
    finCampagneEssai: string;
    /** Dernier jour où l'on peut demander un essai (AAAA-MM-JJ). Vide ou absent = toute l'année. */
    finEssais?: string;
    /** Premier jour sans cours de l'été (AAAA-MM-JJ), ou vide. */
    fin: string;
    /** Vacances sans cours : du = premier jour sans cours, reprise = jour où les cours reprennent. */
    pauses: { libelle: string; du: string; reprise: string }[];
    /** Jours fériés où les cours ont lieu quand même. */
    feriesAvecCours: string[];
  };
  couleurs: { primaire: string; primaireHover: string; secondaire: string; secondaireHover: string };
  logo: string;
  heroImage: string;
  heroAlt: string;
}

declare const ASSO: AssoConfig;
export default ASSO;
