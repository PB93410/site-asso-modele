/**
 * Messages WhatsApp des relances.
 * File principale = classifyRelances() dans bureauRelancesQueue.ts.
 */

import type { RelanceMsg } from '../lib/bureauRelancesQueue';
import { telDedupeKey } from '../lib/bureauSearch';
import { ASSO, PAIEMENTS_BUREAU, SITE_URL, TARIF_LABEL } from './asso';

export const MSG_A = `Bonjour {prenom},
On ne t’a pas encore vu(e) au cours d’essai.
Tous niveaux, matériel sur place.
Tu peux encore essayer : ${SITE_URL}/essai
Si tu ne peux pas, réponds à ce message.
${ASSO.nom}`;

export const MSG_B = `Bonjour {prenom},
Merci d’être venu(e) à {cours}.
Si le rythme te convient, l’adhésion est ${TARIF_LABEL}/an (${ASSO.adhesion.inclus}) :
{adhesion}
${PAIEMENTS_BUREAU} au bureau${ASSO.adhesion.paiementUrl ? ', carte ensuite' : ''}.
Tu continues ?
${ASSO.nom}`;

export const MSG_C = `Bonjour {prenom},
Tu peux encore réserver un essai ici :
${SITE_URL}/essai
À bientôt,
${ASSO.nom}`;

export function phoneToWa(tel: string) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 10) d = `33${d.slice(1)}`;
  if (!(d.startsWith('33') && d.length >= 11)) return '';
  return d;
}

function tplFor(message: RelanceMsg) {
  if (message === 'A') return MSG_A;
  if (message === 'C') return MSG_C;
  return MSG_B;
}

/**
 * Lien du message B : « Adhérer en 1 minute » (formulaire prérempli, jeton signé par essais-list),
 * sinon la page des tarifs.
 */
export function lienAdhesionMessage(jeton = '') {
  return jeton
    ? `Pour adhérer en 1 minute (tes coordonnées sont déjà remplies) : ${SITE_URL}/inscription?e=${encodeURIComponent(jeton)}`
    : `${SITE_URL}/tarifs`;
}

/** Ligne calculée ou figée : prenom, tel, cours, message A|B|C. */
export function relanceHref(row: {
  prenom: string;
  tel: string;
  cours: string;
  message: RelanceMsg | 'A' | 'B' | 'C';
  lienAdhesion?: string;
}) {
  const d = phoneToWa(row.tel);
  if (!d) return '';
  const text = tplFor(row.message)
    .replace('{prenom}', row.prenom)
    .replace('{cours}', row.cours)
    .replace('{adhesion}', lienAdhesionMessage(row.lienAdhesion));
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function liveRowKey(prio: string, tel: string) {
  return `${prio}-${telDedupeKey(tel)}`;
}
