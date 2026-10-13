/** Contrôles des cartes d'adhérent (onglet Cartes du bureau). */

import { SEASON_PREFIX } from '../data/CONFIG';
import { nationalFrTel } from './bureauSearch';

const NUMERO_RE = new RegExp(`^${SEASON_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d{3}$`);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** STATUT exact « À jour » (pas Essai / En attente). */
export function isAJourCarte(statut: string) {
  return String(statut || '').trim() === 'À jour';
}

export function isNumeroCarte(raw: string) {
  return NUMERO_RE.test(String(raw || '').trim());
}

export function isCarteMail(raw: string) {
  return EMAIL_RE.test(String(raw || '').trim());
}

/** Mobile FR 06/07 — 10 chiffres nationaux. Retourne digits wa.me (33…) ou null. */
export function mobileFrWaDigits(raw: string): string | null {
  const n = nationalFrTel(raw);
  if (n.length !== 10) return null;
  if (!n.startsWith('06') && !n.startsWith('07')) return null;
  return `33${n.slice(1)}`;
}
