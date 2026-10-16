/** Calculs des checklists de saison : clé d'une case, avancement, étapes restantes. */
import type { Checklist } from '../data/checklistsSaison';

export type Coches = Record<string, { le: string }>;

/** Clé d'une case, identique côté serveur : « liste:étape ». */
export const cleCoche = (liste: Checklist, etapeId: string) => `${liste.id}:${etapeId}`;

export function avancement(liste: Checklist, coches: Coches): { faites: number; total: number; fini: boolean } {
  const faites = liste.etapes.filter((e) => coches[cleCoche(liste, e.id)]).length;
  return { faites, total: liste.etapes.length, fini: faites === liste.etapes.length };
}

/** « 2026-10-15 » → « 15/10 » (la saison suffit à situer l'année). */
export function jourCourt(ymd: string): string {
  const [, m, d] = String(ymd || '').split('-');
  return m && d ? `${d}/${m}` : '';
}
