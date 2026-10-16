/**
 * Accueil du bureau : l'ordre de la liste « À faire » selon le rôle de la personne.
 * Le rôle ne change que l'ORDRE : rien n'est caché ni protégé par ce choix (pas de mot de passe en plus).
 * Il se retient sur le téléphone, rien n'est envoyé au serveur.
 */

export type RoleBureau = 'tresorerie' | 'presidence' | 'benevole';
export type ActionId = 'pointer' | 'confirmer' | 'encaisser' | 'relances' | 'cartes';

export const ROLES: { id: RoleBureau; label: string }[] = [
  { id: 'tresorerie', label: 'Trésorerie' },
  { id: 'presidence', label: 'Présidence' },
  { id: 'benevole', label: 'Bénévole' },
];

export const ROLE_PAR_DEFAUT: RoleBureau = 'benevole';
const CLE_ROLE = 'bureau-role';

/** Plus le nombre est petit, plus la ligne est haute. */
const PRIORITE: Record<ActionId, Record<RoleBureau, number>> = {
  encaisser: { tresorerie: 1, presidence: 3, benevole: 4 },
  cartes: { tresorerie: 2, presidence: 4, benevole: 5 },
  pointer: { tresorerie: 3, presidence: 5, benevole: 1 },
  confirmer: { tresorerie: 4, presidence: 1, benevole: 2 },
  relances: { tresorerie: 5, presidence: 2, benevole: 3 },
};

/** Les actions dans l'ordre du rôle (tri stable : à égalité, l'ordre d'origine reste). */
export function ordonnerActions<T extends { cle: string }>(actions: T[], role: RoleBureau): T[] {
  const rang = (a: T) => PRIORITE[a.cle as ActionId]?.[role] ?? 99;
  return [...actions].sort((a, b) => rang(a) - rang(b));
}

export const estRole = (v: unknown): v is RoleBureau => ROLES.some((r) => r.id === v);

/** Le rôle retenu sur ce téléphone, ou le rôle par défaut. Ne plante jamais (navigation privée, stockage bloqué). */
export function lireRole(): RoleBureau {
  try {
    const v = window.localStorage.getItem(CLE_ROLE);
    return estRole(v) ? v : ROLE_PAR_DEFAUT;
  } catch {
    return ROLE_PAR_DEFAUT;
  }
}

export function retenirRole(role: RoleBureau): void {
  try {
    window.localStorage.setItem(CLE_ROLE, role);
  } catch {
    /* le choix vaut pour cette visite seulement */
  }
}
