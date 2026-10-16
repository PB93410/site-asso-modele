/**
 * Réponses au mini-sondage après l'essai (modules.sondageEssai). Store « sondage-essai », une entrée par réponse,
 * sans identité : { le, intention, raison, suggestion }. Conservation 12 mois (les plus anciennes sont effacées à
 * la lecture du bureau). En démo : en mémoire.
 */

import { getStore } from '@netlify/blobs';
import { DEMO } from './_demo.mjs';

export const STORE = 'sondage-essai';
export const MAX_REPONSES = 1500;
export const MOIS_CONSERVATION = 12;

function storeMemoire() {
  const m = new Map();
  return {
    get: async (cle) => (m.has(cle) ? JSON.parse(JSON.stringify(m.get(cle))) : null),
    setJSON: async (cle, valeur) => void m.set(cle, JSON.parse(JSON.stringify(valeur))),
    delete: async (cle) => void m.delete(cle),
    list: async () => ({ blobs: [...m.keys()].map((key) => ({ key })) }),
  };
}
let memoireDemo = null;
const store = () => (DEMO ? (memoireDemo ||= storeMemoire()) : getStore(STORE));

/** « 2026-10-21 » → « 2025-10-21 » pour 12 mois. */
export function limiteConservation(ymd, mois = MOIS_CONSERVATION) {
  const [y, m, d] = ymd.split('-').map(Number);
  const i = m - 1 - mois;
  const an = y + Math.floor(i / 12);
  const mm = ((i % 12) + 12) % 12;
  const dernier = new Date(Date.UTC(an, mm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(an, mm, Math.min(d, dernier))).toISOString().slice(0, 10);
}

/** Range une réponse. Renvoie false si le plafond est atteint (protège contre un déluge de faux envois). */
export async function ajouterReponse(reponse, ymd) {
  const s = store();
  const { blobs } = await s.list();
  if ((blobs || []).length >= MAX_REPONSES) return false;
  const cle = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await s.setJSON(cle, { le: ymd, ...reponse });
  return true;
}

/** Toutes les réponses gardées ; efface au passage celles qui dépassent la conservation. */
export async function lireReponses(ymd) {
  const s = store();
  const limite = limiteConservation(ymd);
  const { blobs } = await s.list();
  const out = [];
  for (const b of blobs || []) {
    const v = await s.get(b.key, { type: 'json' }).catch(() => null);
    if (!v) continue;
    if (typeof v.le === 'string' && v.le < limite) {
      await s.delete(b.key);
      continue;
    }
    out.push(v);
  }
  return out;
}
