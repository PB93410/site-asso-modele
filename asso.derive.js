// Valeurs calculées à partir de asso.config.js, partagées par le site,
// les fonctions Netlify et les scripts. Pas besoin de modifier ce fichier.
import ASSO from './asso.config.js';

export { ASSO };

export const SITE_URL = ASSO.siteUrl.replace(/\/+$/, '');

const [anDebut = '', anFin = ''] = ASSO.saison.label.split('-');
/** « 2627 » pour la saison 2026-2027 */
export const SAISON_COURTE = `${anDebut.slice(2)}${anFin.slice(2)}`;
/** Préfixe des numéros d'adhérent : ASE-2627- */
export const SEASON_PREFIX = `${ASSO.sigle}-${SAISON_COURTE}-`;

/** Libellé du mode « carte en ligne » (vide si pas de paiement en ligne). */
export const MODE_CARTE = ASSO.adhesion.paiementUrl
  ? `Carte (${ASSO.adhesion.paiementNom || 'en ligne'})`
  : '';

/**
 * Fonctions activées (asso.config.js → modules).
 * essais, adhesion, bureau, mail : absentes = activées.
 * presences, quiz, alertes : absentes = désactivées.
 * Le mail du bureau demande le bureau.
 */
export const MODULES = {
  essais: true,
  adhesion: true,
  bureau: true,
  mail: true,
  presences: false,
  quiz: false,
  alertes: false,
  ...(ASSO.modules || {}),
};
if (!MODULES.bureau) MODULES.mail = false;

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Modes de paiement proposés dans le formulaire d'inscription et acceptés par /api/adhesion. */
export const PAYMENT_MODES = [
  ...(MODE_CARTE ? [MODE_CARTE] : []),
  ...ASSO.adhesion.autresPaiements.map(cap),
  'Virement',
  'Autre',
].filter((m, i, all) => all.indexOf(m) === i);

/** « Villexemple » → « villexemple » (URL des pages d'activité et « Autour de… »). */
export function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
export const VILLE_SLUG = slugify(ASSO.ville);
