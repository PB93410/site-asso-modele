/**
 * Journal des envois de cartes (store « cartes-journal », séparé du coffre).
 * Une entrée par envoi : date, numéro, ligne, canal, destinataire masqué, renvoi.
 * N’empêche jamais un envoi : en cas d’échec, on l’écrit seulement dans les logs.
 * Lecture : node scripts/journal-cartes.mjs
 */

import { connectLambda, getStore } from '@netlify/blobs';

export const JOURNAL_STORE = 'cartes-journal';

/** « marie.dupont@gmail.com » → « ma***@gmail.com ». */
export function masquerMail(raw) {
  const s = String(raw || '').trim();
  const at = s.indexOf('@');
  if (at < 1) return '';
  return `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
}

/** « 06 12 34 56 78 » → « …78 ». */
export function masquerTel(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 2 ? `…${d.slice(-2)}` : '';
}

export function journalEntry({ numero, row, canal, dest, renvoi = false }, now = new Date()) {
  return {
    at: now.toISOString(),
    numero: String(numero || ''),
    row: Number(row) || 0,
    canal,
    dest: String(dest || ''),
    renvoi: Boolean(renvoi),
  };
}

export function journalKey(entry) {
  return `${entry.at.replace(/[:.]/g, '-')}_${entry.numero}_${entry.canal}`;
}

export async function noteEnvoi(event, entry) {
  try {
    const headers = {};
    for (const [key, value] of Object.entries(event?.headers || {})) {
      headers[String(key).toLowerCase()] = value;
    }
    if (event?.blobs) connectLambda({ ...event, headers });
    const store = getStore({ name: JOURNAL_STORE, consistency: 'strong' });
    await store.setJSON(journalKey(entry), entry);
  } catch (err) {
    console.error('journal cartes', err?.message || 'failed', entry.numero, entry.canal);
  }
}
