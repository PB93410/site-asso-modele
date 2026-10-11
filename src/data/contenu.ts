// ============================================
// CONTENUS ÉDITORIAUX — dossier contenu/ (JSON)
// ============================================
//
// Cours, animateurs, questions fréquentes, planning par défaut, événements par défaut.
// Écrits par `npm run installer` à partir du questionnaire de l'association,
// modifiables à la main (un fichier JSON se relit comme un tableau).
//
// Textes à trous : {ville}, {tarif}, {?federation| et la licence {federation}}…
// (src/lib/gabarit.js).

import coursJson from '../../contenu/cours.json';
import coachsJson from '../../contenu/coachs.json';
import faqJson from '../../contenu/faq.json';
import planningJson from '../../contenu/planning.json';
import evenementsJson from '../../contenu/evenements.json';

export interface CoursContenu {
  nom: string;
  niveau: string;
  /** Une ligne : cartes du site, description courte. */
  resume: string;
  animateur: string;
  /** 2 ou 3 mots-clés (cartes). */
  bienfaits: string[];
  image: string;
  /** Sous-titre de la page du cours. */
  accroche?: string;
  /** Texte long de la page du cours. */
  texte?: string;
  bienfaitsDetail?: { titre: string; texte: string }[];
  faq?: { question: string; reponse: string }[];
  /** Noms des cours proches (liens en bas de page). */
  liens?: string[];
  /** Message si le cours n'est pas encore au planning. */
  noteHoraire?: string;
  /** Première séance si différente de la reprise (AAAA-MM-JJ). */
  debut?: string;
}

export interface CoachContenu {
  nom: string;
  specialites: string[];
  image: string;
  bio: string;
}

export interface FaqContenu {
  question: string;
  reponse: string;
  populaire?: boolean;
}

export interface CreneauContenu {
  jour: string;
  horaire: string;
  cours: string;
  lieu: string;
  note?: string;
}

export interface EvenementContenu {
  id: string;
  date: string;
  mois: string;
  annee: string;
  titre: string;
  description: string;
  heure: string;
  lieu: string;
  miseEnAvant?: boolean;
  image?: string;
  logo?: string;
  lien?: string;
  type?: 'administratif' | 'festif' | 'sportif' | 'caritatif' | 'sortie';
}

export const COURS = coursJson as CoursContenu[];
export const COACHS_CONTENU = coachsJson as CoachContenu[];
export const FAQ_CONTENU = faqJson as FaqContenu[];
export const PLANNING_CONTENU = planningJson as CreneauContenu[];
export const EVENEMENTS_CONTENU = evenementsJson as EvenementContenu[];
