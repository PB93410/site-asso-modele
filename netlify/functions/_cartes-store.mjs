import { SEASON_PREFIX as DEFAULT_PREFIX } from '../../asso.derive.js';
/**
 * Format du numéro de carte. Les cartes ne sont plus stockées : le recto est fabriqué
 * à l’envoi (_carte-recto.mjs). Un numéro attribué est définitif, ne jamais renuméroter.
 */

/** Préfixe des numéros d'adhérent : asso.config.js (sigle + saison), ou ADHERENT_PREFIX. */
export const SEASON_PREFIX = process.env.ADHERENT_PREFIX || DEFAULT_PREFIX;

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function carteNumeroPattern(prefix = SEASON_PREFIX) {
  return new RegExp(`^${escapeRegExp(prefix)}\\d{3}$`);
}

export const CARTE_NUMERO_RE = carteNumeroPattern();

export function isCarteImageNumero(raw) {
  return CARTE_NUMERO_RE.test(String(raw || '').trim());
}

/** Prochain numéro préfixe-NNN : le max + 1. Les trous et le hors-format ne comptent pas. */
export function nextAdherentNumero(existing, prefix = SEASON_PREFIX) {
  const re = new RegExp(`^${escapeRegExp(prefix)}(\\d{3})$`);
  let max = 0;
  for (const raw of existing || []) {
    const m = String(raw || '').trim().match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}
