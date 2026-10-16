/**
 * /api/evenement-inscription (modules.inscriptionsEvenements) — public.
 *   GET  : événements dont les inscriptions sont ouvertes, avec les places restantes. Ni nom ni numéro.
 *   POST : { slug, prenom, nom, telephone, personnes, covoiturage, places_covoiturage, depart, bot-field }
 */

import { SITE_URL } from '../../asso.derive.js';
import { assertBrowserOrigin, clientIp, consumeRateLimit, moduleOff, pickValue } from './_bureau-lib.mjs';
import {
  lireConfig,
  lireInscriptions,
  modifierInscriptions,
  nouvelleInscription,
  peutInscrire,
  resumePublic,
  slugValide,
  validerInscription,
} from './_evenements.mjs';
import { versV2 } from './_v2.mjs';

const CORS = {
  'Access-Control-Allow-Origin': process.env.SITE_ORIGIN || SITE_URL,
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
};
const rep = (statusCode, corps, extra = {}) => ({ statusCode, headers: { ...CORS, 'Cache-Control': 'no-store', ...extra }, body: JSON.stringify(corps) });
const ymdParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

const handler = async (event) => {
  const off = moduleOff('inscriptionsEvenements');
  if (off) return off;
  if (event.httpMethod === 'GET') {
    try {
      const config = await lireConfig();
      const ouvertes = {};
      for (const [slug, c] of Object.entries(config)) {
        if (c.ouvert) ouvertes[slug] = resumePublic(c, await lireInscriptions(slug));
      }
      return rep(200, { ok: true, ouvertes }, { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' });
    } catch (err) {
      console.error('evenement-inscription lecture', err?.message || err);
      return rep(503, { ok: false });
    }
  }
  if (event.httpMethod !== 'POST') return rep(405, { ok: false });

  const origine = assertBrowserOrigin(event);
  if (!origine.ok) return rep(origine.status, { ok: false, error: origine.error });
  if (!consumeRateLimit(`evenement-inscription:${clientIp(event)}`, 10, 10 * 60 * 1000).ok) {
    return rep(429, { ok: false, error: 'Trop de demandes. Réessayez dans quelques minutes.' });
  }
  if (event.body && event.body.length > 5_000) return rep(413, { ok: false });

  let corps = {};
  try {
    corps = JSON.parse(event.body || '{}');
  } catch {
    return rep(400, { ok: false, error: 'Message illisible.' });
  }
  if (pickValue(corps, 'bot-field')) return rep(200, { ok: true });

  const slug = String(corps.slug || '');
  if (!slugValide(slug)) return rep(404, { ok: false, error: 'Événement inconnu.' });
  const v = validerInscription(corps);
  if (!v.ok) return rep(400, { ok: false, error: v.erreur });

  try {
    const config = (await lireConfig())[slug];
    // Lecture, contrôle des places et écriture d'un tenant : une inscription simultanée relit et recompte.
    const verdict = await modifierInscriptions(slug, (inscriptions) => {
      const ok = peutInscrire(config, inscriptions, v.champs);
      return { liste: ok.ok ? [...inscriptions, nouvelleInscription(v.champs, ymdParis())] : inscriptions, res: ok };
    });
    if (!verdict.ok) return rep(verdict.code, { ok: false, error: verdict.erreur });
    return rep(200, { ok: true, titre: config.titre });
  } catch (err) {
    console.error('evenement-inscription', err?.message || err);
    return rep(500, { ok: false, error: 'L’enregistrement a échoué. Réessayez dans un instant ou contactez-nous.' });
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
