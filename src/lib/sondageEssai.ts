/**
 * Mini-sondage après l'essai : trois questions, anonyme.
 * 1. Intention d'adhérer ; 2. si ce n'est pas un « oui », la raison ; 3. une suggestion (facultative, courte).
 * Aucun nom, téléphone ni adresse n'est demandé ni gardé : le lien est le même pour tout le monde.
 */

import { SITE_URL } from '../data/asso';

export const INTENTIONS = [
  { id: 'oui', label: 'Oui, je compte adhérer' },
  { id: 'peut-etre', label: 'Peut-être, je réfléchis' },
  { id: 'non', label: 'Non, pas pour l’instant' },
] as const;

export const RAISONS = [
  { id: 'horaires', label: 'Les horaires ne me conviennent pas' },
  { id: 'cours', label: 'Les cours ne m’ont pas convaincu(e)' },
  { id: 'prix', label: 'Le prix' },
  { id: 'lieu', label: 'Le lieu ou le trajet' },
  { id: 'temps', label: 'Je manque de temps' },
  { id: 'ailleurs', label: 'Je me suis inscrit(e) ailleurs' },
  { id: 'autre', label: 'Autre raison' },
] as const;

export type Intention = (typeof INTENTIONS)[number]['id'];
export type Raison = (typeof RAISONS)[number]['id'];

export const SUGGESTION_MAX = 300;
export const LIEN_SONDAGE = `${SITE_URL}/sondage-essai`;

export type Reponse = { intention: Intention; raison: Raison | ''; suggestion: string };

const ids = <T extends { id: string }>(l: readonly T[]) => l.map((x) => x.id) as string[];

/** Texte propre : espaces réduits, sans caractères de contrôle, limité. */
export function nettoyer(brut: unknown, max = SUGGESTION_MAX): string {
  return String(brut ?? '')
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Valide une réponse reçue. La raison n'est gardée que si l'intention n'est pas un « oui ». */
export function validerReponse(
  corps: Record<string, unknown> | null | undefined,
): { ok: true; reponse: Reponse } | { ok: false; erreur: string } {
  const intention = String(corps?.intention || '');
  if (!ids(INTENTIONS).includes(intention)) return { ok: false, erreur: 'Choisissez une réponse à la première question.' };
  const raisonBrute = String(corps?.raison || '');
  const raison = intention !== 'oui' && ids(RAISONS).includes(raisonBrute) ? (raisonBrute as Raison) : '';
  return { ok: true, reponse: { intention: intention as Intention, raison, suggestion: nettoyer(corps?.suggestion) } };
}

export type ResumeSondage = {
  total: number;
  intentions: Record<Intention, number>;
  raisons: Partial<Record<Raison, number>>;
  /** Suggestions les plus récentes d'abord, sans date ni identité. */
  suggestions: string[];
};

export function resumer(reponses: Array<Partial<Reponse> & { le?: string }>): ResumeSondage {
  const intentions: Record<Intention, number> = { oui: 0, 'peut-etre': 0, non: 0 };
  const raisons: Partial<Record<Raison, number>> = {};
  const suggestions: Array<{ le: string; s: string }> = [];
  for (const r of reponses) {
    if (!r.intention || !(r.intention in intentions)) continue;
    intentions[r.intention] += 1;
    if (r.raison && ids(RAISONS).includes(r.raison)) raisons[r.raison] = (raisons[r.raison] || 0) + 1;
    const s = nettoyer(r.suggestion);
    if (s) suggestions.push({ le: String(r.le || ''), s });
  }
  suggestions.sort((a, b) => (a.le < b.le ? 1 : a.le > b.le ? -1 : 0));
  return {
    total: intentions.oui + intentions['peut-etre'] + intentions.non,
    intentions,
    raisons,
    suggestions: suggestions.map((x) => x.s),
  };
}
