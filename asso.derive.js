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

/**
 * Les essais sont-ils encore ouverts ? Oui toute l'année si `saison.finEssais` est vide ;
 * sinon jusqu'à la fin de ce jour-là, à l'heure de Paris.
 */
export function essaisOuverts(maintenant = Date.now(), fin = ASSO.saison.finEssais) {
  if (!fin) return true;
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(maintenant);
  return jour <= fin;
}

/** Libellé du mode « carte en ligne » (vide si pas de paiement en ligne). */
export const MODE_CARTE = ASSO.adhesion.paiementUrl
  ? `Carte (${ASSO.adhesion.paiementNom || 'en ligne'})`
  : '';

/**
 * Fonctions activées (asso.config.js → modules).
 * essais, adhesion, bureau, mail : absentes = activées.
 * presences, quiz, alertes, listeAttente, wallet, financement, rapport, attestations, espace : absentes = désactivées.
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
  listeAttente: false,
  wallet: false,
  financement: false,
  rapport: false,
  attestations: false,
  espace: false,
  parrainage: false,
  sondageEssai: false,
  clubEnChiffres: false,
  checklists: false,
  tablette: false,
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
