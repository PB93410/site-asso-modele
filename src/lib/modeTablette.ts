/**
 * Mode tablette du forum (/essai/tablette) : temps avant l'écran vierge.
 * Le but : la personne suivante ne voit jamais les données de la précédente.
 */

/** Après un envoi réussi : secondes d'affichage du « merci » avant de tout effacer. */
export const SECONDES_AVANT_RAZ = 10;

/** Données saisies mais écran délaissé : secondes avant de tout effacer. */
export const SECONDES_INACTIVITE = 90;

/** Y a-t-il quelque chose à effacer à l'écran ? */
export function aDesDonnees(champs: { prenom: string; nom: string; telephone: string; cours: string; email?: string }): boolean {
  return Boolean(champs.prenom.trim() || champs.nom.trim() || champs.telephone.trim() || champs.cours || (champs.email || '').trim());
}
