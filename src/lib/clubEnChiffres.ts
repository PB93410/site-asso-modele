/** Page publique « Le club en chiffres » (modules.clubEnChiffres) : ce qui ne dépend pas du registre. */

import { ASSO } from '../data/asso';

/** Nombre d'années depuis la création, à l'année près (0 si l'année n'est pas renseignée). */
export function anciennete(aujourdhui: Date, creation: string = ASSO.anneeCreation): number {
  const an = Number(String(creation || '').match(/\d{4}/)?.[0]);
  return an ? Math.max(0, aujourdhui.getFullYear() - an) : 0;
}
