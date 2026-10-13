import type { AssoConfig, AssoModules } from '../../asso.config';

export interface DossierLieu {
  nom: string;
  rue: string;
  codePostal?: string;
  ville?: string;
  acces?: string;
  lat?: number;
  lon?: number;
}

export interface DossierCreneau {
  jour: string;
  debut: string;
  fin: string;
  cours: string;
  lieu: string;
  note?: string;
}

export interface DossierCours {
  nom: string;
  description: string;
  niveau?: string;
  animateur?: string;
  bienfaits?: string[];
}

export interface DossierCoach {
  prenom: string;
  cours: string[];
  bio: string;
  /** data URL JPEG/PNG/WebP, publiée seulement avec `accord`. */
  photo?: string;
  accord?: boolean;
}

export interface Dossier {
  version: number;
  envoyeLe: string;
  contact: { nom: string; role: string; email: string; telephone: string };
  association: {
    nom: string;
    nomCourt: string;
    sigle: string;
    accroche: string;
    slogan: string;
    anneeCreation: string;
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
  };
  lieux: DossierLieu[];
  contacts: {
    email: string;
    telephone: string;
    whatsapp: boolean;
    siteSouhaite: string;
    instagram: string;
    facebook: string;
    avisGoogle: string;
  };
  federation: { nom: string; sigle: string; url: string };
  adhesion: {
    tarif: number;
    inclus: string;
    essais: number;
    paiementNom: string;
    paiementUrl: string;
    autresPaiements: string[];
  };
  saison: { label: string; reprise: string };
  cours: DossierCours[];
  planning: DossierCreneau[];
  coachs: DossierCoach[];
  /** Vide = FAQ du modèle conservée. Les textes peuvent contenir {tarif}, {ville}… */
  faq: { question: string; reponse: string; populaire?: boolean }[];
  apparence: { couleur: string; secondaire: string; logo: string; hero: string; heroAlt: string };
  modules: AssoModules;
  listeAttente: { capaciteDefaut: number; delaiReponseHeures: number };
  financement: { passSport: number; ancvMax: number; comiteEntreprise: number };
  attestations: { recuFiscal: boolean; objet: string };
  remarques: string;
}

export interface ErreurDossier {
  etape: 'association' | 'lieux' | 'contacts' | 'adhesion' | 'cours' | 'animateurs' | 'faq' | 'apparence' | 'envoi';
  champ: string;
  message: string;
}

export declare const DOSSIER_VERSION: number;
export declare const JOURS: string[];
export declare function contraste(a: string, b?: string): number | null;
export declare function assombrir(color: string, part: number): string;
export declare function couleurLisible(color: string, min?: number): string;
export declare function couleurSurvol(color: string): string;
export declare function sigleDepuis(nom: string): string;
export declare function slugify(s: string): string;
export declare function saisonCourante(date?: Date): string;
export declare function telAffiche(raw: string): string;
export declare function whatsappDepuis(raw: string): string;
export declare function plageHoraire(debut: string, fin: string): string;
export declare function dossierVide(date?: Date): Dossier;
export declare function normaliserDossier(raw: unknown): Dossier;
export declare function erreursDossier(dossier: unknown): ErreurDossier[];
export declare function imagesDossier(dossier: unknown): { cle: string; chemin: string; dataUrl: string }[];
export declare function configDepuisDossier(dossier: unknown, base: AssoConfig): AssoConfig;
export declare function planningCsv(dossier: unknown): string;
export declare function contenuDepuisDossier(dossier: unknown): {
  cours: { nom: string; niveau: string; resume: string; animateur: string; bienfaits: string[]; image: string; texte: string }[];
  coachs: { nom: string; specialites: string[]; image: string; bio: string }[];
  faq: { question: string; reponse: string; populaire?: boolean }[] | null;
  planning: { jour: string; horaire: string; cours: string; lieu: string; note: string }[];
  evenements: never[];
};
