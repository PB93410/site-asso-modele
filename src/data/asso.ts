// Accès typé à asso.config.js + valeurs dérivées (adresse complète, téléphone international…).
import { ASSO, VILLE_SLUG } from '../../asso.derive.js';
import type { AssoLieu } from '../../asso.config';

export { ASSO };
export type { AssoLieu };
export {
  SITE_URL,
  SEASON_PREFIX,
  SAISON_COURTE,
  MODE_CARTE,
  PAYMENT_MODES,
  VILLE_SLUG,
  slugify,
} from '../../asso.derive.js';
export const TEL_INTL = ASSO.whatsapp ? `+${ASSO.whatsapp}` : '';
export const TARIF_LABEL = `${ASSO.adhesion.tarif} €`;
export const HAS_FEDERATION = Boolean(ASSO.federation.nom);
export const HAS_PAIEMENT_EN_LIGNE = Boolean(ASSO.adhesion.paiementUrl);
export const NB_ESSAIS = ASSO.adhesion.essais;
/** « 3 essais gratuits » / « 1 essai gratuit » */
export const ESSAIS_LABEL =
  NB_ESSAIS > 1 ? `${NB_ESSAIS} essais gratuits` : NB_ESSAIS === 1 ? '1 essai gratuit' : '';
/** « 3 cours d'essai » */
export const COURS_ESSAI_LABEL = `${NB_ESSAIS} cours d’essai`;
/** « licence FFX comprise » ou le texte libre `adhesion.inclus` */
export const INCLUS_LABEL = ASSO.adhesion.inclus;
/** « affiliée FFX » ou chaîne vide */
export const FEDERATION_LABEL = HAS_FEDERATION ? `affiliée ${ASSO.federation.sigle || ASSO.federation.nom}` : '';
/** « chèque, espèces, chèques ANCV » */
export const PAIEMENTS_BUREAU = ASSO.adhesion.autresPaiements.join(', ');
export const PAIEMENT_NOM = ASSO.adhesion.paiementNom || 'paiement en ligne';

export function lieuAdresse(lieu: AssoLieu) {
  return `${lieu.rue}, ${ASSO.codePostal} ${ASSO.ville}`;
}

export function lieuParNom(nom: string): AssoLieu | undefined {
  const n = nom.trim().toLowerCase();
  return ASSO.lieux.find((l) => l.nom.toLowerCase() === n || l.id === n);
}

export function mapsUrl(lieu: AssoLieu) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lieu.nom}, ${lieuAdresse(lieu)}`,
  )}`;
}

/** Page SEO locale « Autour de <ville> ». */
export const AUTOUR_PATH = `/autour-de-${VILLE_SLUG}`;
