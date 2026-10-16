/**
 * /api/sondage-essai (modules.sondageEssai)
 *   POST (public) : { intention, raison, suggestion, bot-field } — une réponse anonyme.
 *   GET  (bureau, admin) : le résumé des réponses (comptes + suggestions), sans identité.
 */

import { SITE_URL } from '../../asso.derive.js';
import { assertBrowserOrigin, clientIp, consumeRateLimit, json, moduleOff, pickValue, requireAuth } from './_bureau-lib.mjs';
import { DEMO } from './_demo.mjs';
import { ajouterReponse, lireReponses } from './_sondage-essai.mjs';
import { versV2 } from './_v2.mjs';
import { resumer, validerReponse } from '../../src/lib/sondageEssai.ts';

const CORS = {
  'Access-Control-Allow-Origin': process.env.SITE_ORIGIN || SITE_URL,
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
};
const rep = (statusCode, corps) => ({ statusCode, headers: { ...CORS, 'Cache-Control': 'no-store' }, body: JSON.stringify(corps) });
const ymdParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

const handler = async (event) => {
  const off = moduleOff('sondageEssai');
  if (off) return off;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  if (event.httpMethod === 'GET') {
    const auth = requireAuth(event, { roles: ['admin'] });
    if (!auth.ok) return auth.response;
    try {
      return json(200, resumer(await lireReponses(ymdParis())));
    } catch (err) {
      console.error('sondage-essai lecture', err?.message || err);
      return json(500, { error: 'Lecture impossible.' });
    }
  }
  if (event.httpMethod !== 'POST') return rep(405, { ok: false });

  // Un navigateur envoie toujours Origin pour un POST : sans elle, c'est un script, pas une personne qui répond.
  const avecOrigine = Boolean(event.headers?.origin || event.headers?.Origin) || DEMO;
  const origine = avecOrigine ? assertBrowserOrigin(event) : { ok: false, status: 403, error: 'Origine non autorisée' };
  if (!origine.ok) return rep(origine.status, { ok: false, error: origine.error });
  if (!consumeRateLimit(`sondage-essai:${clientIp(event)}`, 5, 10 * 60 * 1000).ok) {
    return rep(429, { ok: false, error: 'Trop de réponses. Réessayez dans quelques minutes.' });
  }
  if (event.body && event.body.length > 3_000) return rep(413, { ok: false });

  let corps = {};
  try {
    corps = JSON.parse(event.body || '{}');
  } catch {
    return rep(400, { ok: false, error: 'Message illisible.' });
  }
  if (pickValue(corps, 'bot-field')) return rep(200, { ok: true });
  const v = validerReponse(corps);
  if (!v.ok) return rep(400, { ok: false, error: v.erreur });
  try {
    if (!(await ajouterReponse(v.reponse, ymdParis()))) return rep(503, { ok: false, error: 'Le sondage est complet. Merci !' });
    return rep(200, { ok: true });
  } catch (err) {
    console.error('sondage-essai écriture', err?.message || err);
    return rep(500, { ok: false, error: 'L’enregistrement a échoué. Réessayez plus tard.' });
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
