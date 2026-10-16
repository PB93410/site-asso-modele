/**
 * Checklists de saison (modules.checklists).
 * GET  /api/checklists?saison=2026-2027 — cases cochées de la saison (bureau).
 * POST /api/checklists — { saison, cle: « liste:étape », fait: true | false } : coche ou décoche.
 */

import { clientIp, consumeRateLimit, handleOptions, json, moduleOff, requireAuth } from './_bureau-lib.mjs';
import { appliquer, cleValide, ecrireCoches, lireCoches, saisonValide } from './_checklists.mjs';
import { versV2 } from './_v2.mjs';

function ymdParis(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('checklists');
  if (off) return off;
  const auth = requireAuth(event, { roles: ['admin'] });
  if (!auth.ok) return auth.response;

  if (event.httpMethod === 'GET') {
    const saison = event.queryStringParameters?.saison || '';
    if (!saisonValide(saison)) return json(400, { error: 'Saison inconnue.' });
    return json(200, { coches: await lireCoches(saison) });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée' });
  if (!consumeRateLimit(`checklists:${clientIp(event)}`, 120, 15 * 60 * 1000).ok) {
    return json(429, { error: 'Trop de changements. Réessayez dans quelques minutes.' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Message illisible.' });
  }
  const saison = String(body.saison || '');
  const cle = String(body.cle || '');
  if (!saisonValide(saison) || !cleValide(cle) || typeof body.fait !== 'boolean') {
    return json(400, { error: 'Demande incomplète.' });
  }
  const coches = appliquer(await lireCoches(saison), cle, body.fait, ymdParis());
  await ecrireCoches(saison, coches);
  return json(200, { coches });
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
