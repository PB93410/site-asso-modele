/**
 * Parrainage léger (modules.parrainage) : un adhérent invite une personne. Le lien est le même pour tout le monde :
 * il ne contient ni nom ni numéro, donc rien ne relie l'invité à son parrain.
 * - Tant que les essais sont ouverts : /essai/?source=parrainage. La demande d'essai garde seulement la provenance
 *   « Parrainage », que le bureau voit dans ses chiffres.
 * - Après la fin des essais : /inscription/?source=parrainage. Le formulaire coche alors « Invité par un adhérent »
 *   dans « Comment nous avez-vous connus ? », que la personne peut changer.
 */

import { ASSO, MODULES, SITE_URL, essaisOuverts } from '../data/asso';

export const LIEN_PARRAINAGE = `${SITE_URL}/essai/?source=parrainage`;
export const LIEN_PARRAINAGE_ADHESION = `${SITE_URL}/inscription/?source=parrainage`;

/** Réponse à « Comment nous avez-vous connus ? » quand la personne arrive par un lien de parrainage. */
export const CONNU_PARRAINAGE = 'Invité par un adhérent';

/** Le lien des essais ne sert que si le formulaire d'essai existe et que les essais sont ouverts. */
const versEssai = (maintenant: number) => MODULES.essais && essaisOuverts(maintenant);

/** « Invité par un adhérent » si l'adresse de la page porte ?source=parrainage, sinon ''. */
export function connuDepuisLien(search: string): string {
  if (!MODULES.parrainage) return '';
  try {
    return new URLSearchParams(search).get('source')?.trim().toLowerCase() === 'parrainage' ? CONNU_PARRAINAGE : '';
  } catch {
    return '';
  }
}

/** Le lien à donner à la date donnée. */
export const lienParrainage = (maintenant: number = Date.now()) =>
  versEssai(maintenant) ? LIEN_PARRAINAGE : LIEN_PARRAINAGE_ADHESION;

/** Message à envoyer à la personne invitée. Pas de prénom : l'adhérent l'écrit comme il veut. */
export function messageParrainage(maintenant: number = Date.now()): string {
  const lien = lienParrainage(maintenant);
  const nom = ASSO.nomCourt || ASSO.nom;
  return versEssai(maintenant)
    ? `Je fais du sport à ${nom} et je t'invite à venir essayer un cours gratuitement, sans engagement. Tu choisis ton cours ici : ${lien}`
    : `Je fais du sport à ${nom} et je pense que ça te plairait. Tu peux voir les cours et t'inscrire ici : ${lien}`;
}

/** Lien WhatsApp (sans numéro : l'adhérent choisit la personne dans l'application). */
export const lienWhatsAppParrainage = (message: string = messageParrainage()) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;
