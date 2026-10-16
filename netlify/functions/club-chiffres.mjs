/**
 * GET /api/club-chiffres (modules.clubEnChiffres) — chiffres publics et anonymes du club (page /le-club-en-chiffres).
 * Totaux arrondis et tranches de 10 personnes au moins : voir _club-chiffres.mjs. Ni nom, ni essai, ni montant.
 * Réponse gardée une heure : le registre n'est lu qu'une fois par heure et par région.
 */

import { clientIp, consumeRateLimit, json, moduleOff } from './_bureau-lib.mjs';
import { publier } from './_club-chiffres.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { donnees } from './rapport.mjs';

const handler = async (event) => {
  brancherStockage(event);
  const off = moduleOff('clubEnChiffres');
  if (off) return off;
  if (event.httpMethod !== 'GET') return json(405, { ok: false });
  if (!consumeRateLimit(`club-chiffres:${clientIp(event)}`, 30, 10 * 60 * 1000).ok) return json(429, { ok: false });
  try {
    const rapport = await donnees();
    return json(200, { ok: true, ...publier(rapport) }, { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' });
  } catch (err) {
    console.error('club-chiffres', err?.message || err);
    return json(503, { ok: false });
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
