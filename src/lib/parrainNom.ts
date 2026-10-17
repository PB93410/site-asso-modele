/**
 * Parrainage (modules.parrainage) : le prénom (ou le prénom et le nom) de la personne qui a invité, donné par l'invité
 * s'il le souhaite, pour que l'association puisse la remercier.
 * Il est écrit dans une cellule du tableur (saisie « USER_ENTERED ») : on n'en garde que des lettres, espaces,
 * point, apostrophe et trait d'union, et le premier caractère est toujours une lettre, donc jamais une formule.
 */

export const PARRAIN_MAX = 60;

/** Nom sûr, ou '' s'il ne reste pas au moins deux lettres. */
export function nomParrain(brut: unknown): string {
  const s = String(brut ?? '')
    .replace(/[^\p{L}\p{M} .'’-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}]+/u, '')
    .slice(0, PARRAIN_MAX)
    .trim();
  return (s.match(/\p{L}/gu) || []).length >= 2 ? s : '';
}

/** La mention écrite dans la note de l'essai ou de l'inscription. */
export const noteParrain = (brut: unknown): string => {
  const n = nomParrain(brut);
  return n ? `Invité par ${n}` : '';
};
