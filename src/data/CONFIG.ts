// ============================================
// CONFIGURATION DU SITE
// ============================================
// Les valeurs propres à l'association viennent de asso.config.js (racine).

import { ASSO, SAISON_COURTE, SEASON_PREFIX, TARIF_LABEL } from './asso';

export { SEASON_PREFIX };
export const SEASON_LABEL = ASSO.saison.label;
/** Verso commun des cartes, public. Mettre la saison dans le nom (cache /assets d'un an). */
export const CARTE_VERSO_URL = `/assets/carte-verso-${SAISON_COURTE}.png`;
export const CLUB_PHONE_DISPLAY = ASSO.telephone;
export const SAISON = SEASON_LABEL;
export const EMAIL_CONTACT = ASSO.email;
export const WHATSAPP_NUMBER = ASSO.whatsapp;
export const TARIF_ADHESION = TARIF_LABEL;

// ============================================
// DATES DE SAISON (asso.config.js → saison)
// ============================================
/** Reprise des cours (00h00 heure de Paris). */
export const REPRISE_AT = new Date(`${ASSO.saison.reprise}T00:00:00+02:00`).getTime();
/** Fin du bandeau « un essai reste possible ». */
export const BANDEAU_END = new Date(`${ASSO.saison.finCampagneEssai}T23:59:59+01:00`).getTime();
/**
 * Bouton principal header / hero = essai tant que la campagne d'essai est active
 * (et que l'asso propose des essais). Ensuite : Adhérer.
 */
export const ESSAI_CTA_UNTIL = ASSO.adhesion.essais > 0 ? BANDEAU_END : 0;

/**
 * Planning et événements : lecture live `/api/sheet` (édités depuis /bureau).
 * Coachs : CSV local (photos dans le code).
 */
export const SHEET_CSV = {
  coachs: '/data/coachs.csv',
  evenements: '/api/sheet?tab=evenements',
  planning: '/api/sheet?tab=planning',
};

export const GOOGLE_SHEET_URL = '';

export const TEXTE_INSCRIPTION = "S'inscrire en ligne";
export const SOUS_TITRE_INSCRIPTION = `Les inscriptions pour la saison ${SEASON_LABEL} sont ouvertes.`;
export const MSG_PREVENIR_WHATSAPP = `Bonjour, je souhaiterais avoir des informations sur les inscriptions pour la saison ${SEASON_LABEL}.`;
export const MSG_ESSAI_WHATSAPP = `Bonjour, je souhaiterais faire un cours d'essai.`;
