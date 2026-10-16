/**
 * Checklists de saison du bureau (modules.checklists) : une case cochée = une date, partagée par tous les bénévoles.
 * Store « checklists », une entrée par saison. Les listes elles-mêmes sont dans src/data/checklistsSaison.ts
 * (ou asso.config.js → checklists). Aucune donnée personnelle. En démo : en mémoire.
 */

import { getStore } from '@netlify/blobs';
import { DEMO } from './_demo.mjs';

export const STORE = 'checklists';

const SAISON_RE = /^\d{4}-\d{4}$/;
/** « liste:étape », en minuscules, chiffres et tirets. */
const CLE_RE = /^[a-z0-9-]{1,40}:[a-z0-9-]{1,60}$/;

export function saisonValide(saison) {
  return SAISON_RE.test(String(saison || ''));
}

export function cleValide(cle) {
  return CLE_RE.test(String(cle || ''));
}

/** Garde les cases bien formées : { « liste:étape »: { le: « AAAA-MM-JJ » } }. */
export function cochesPropres(brut) {
  const out = {};
  if (!brut || typeof brut !== 'object') return out;
  for (const [cle, v] of Object.entries(brut)) {
    const le = String(v?.le || '');
    if (cleValide(cle) && /^\d{4}-\d{2}-\d{2}$/.test(le)) out[cle] = { le };
  }
  return out;
}

/** Coche ou décoche une case ; ne touche pas aux autres. */
export function appliquer(coches, cle, fait, aujourdhui) {
  const suite = { ...cochesPropres(coches) };
  if (fait) suite[cle] = { le: aujourdhui };
  else delete suite[cle];
  return suite;
}

const memoireDemo = new Map();
const store = () =>
  DEMO
    ? { get: async (k) => memoireDemo.get(k) ?? null, setJSON: async (k, v) => void memoireDemo.set(k, v) }
    : getStore(STORE);

export async function lireCoches(saison) {
  try {
    return cochesPropres(await store().get(`saison-${saison}`, { type: 'json' }));
  } catch (err) {
    console.error('checklists lecture', err?.message || err);
    return {};
  }
}

export async function ecrireCoches(saison, coches) {
  await store().setJSON(`saison-${saison}`, coches);
}
