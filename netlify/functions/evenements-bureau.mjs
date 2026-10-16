/**
 * /api/evenements-bureau (modules.inscriptionsEvenements) — réservé au bureau (porte « Bureau — admin »).
 *   GET  : événements ouverts et leurs inscrits.
 *   POST : { action: 'ouvrir', slug, titre, places, covoiturage }  ouvre ou modifie
 *          { action: 'fermer', slug }                              ferme les inscriptions, garde la liste
 *          { action: 'retirer', slug, id }                         retire un inscrit
 *          { action: 'effacer', slug }                             clôt : efface la liste et l'ouverture
 */

import { clientIp, consumeRateLimit, handleOptions, json, moduleOff, requireAuth } from './_bureau-lib.mjs';
import {
  configDuBureau,
  effacerInscriptions,
  lireConfig,
  lireInscriptions,
  modifierConfig,
  modifierInscriptions,
  slugValide,
} from './_evenements.mjs';
import { versV2 } from './_v2.mjs';

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('inscriptionsEvenements');
  if (off) return off;
  const auth = requireAuth(event, { roles: ['admin'] });
  if (!auth.ok) return auth.response;

  if (event.httpMethod === 'GET') {
    const config = await lireConfig();
    const inscriptions = {};
    for (const slug of Object.keys(config)) inscriptions[slug] = await lireInscriptions(slug);
    return json(200, { config, inscriptions });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée' });
  if (!consumeRateLimit(`evenements-bureau:${clientIp(event)}`, 60, 15 * 60 * 1000).ok) {
    return json(429, { error: 'Trop de changements. Réessayez dans quelques minutes.' });
  }

  let corps = {};
  try {
    corps = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Message illisible.' });
  }
  const action = String(corps.action || '');
  const slug = String(corps.slug || '');

  if (action === 'ouvrir') {
    const c = configDuBureau(corps);
    if (!c) return json(400, { error: 'Événement ou nombre de places invalide.' });
    await modifierConfig((config) => {
      config[c.slug] = c.config;
    });
    return json(200, { ok: true });
  }
  if (!slugValide(slug) || !(await lireConfig())[slug]) return json(404, { error: 'Événement inconnu.' });

  if (action === 'fermer') {
    await modifierConfig((config) => {
      if (config[slug]) config[slug] = { ...config[slug], ouvert: false };
    });
    return json(200, { ok: true });
  }
  if (action === 'retirer') {
    const id = String(corps.id || '');
    await modifierInscriptions(slug, (liste) => ({ liste: liste.filter((i) => i.id !== id), res: null }));
    return json(200, { ok: true });
  }
  if (action === 'effacer') {
    await modifierConfig((config) => {
      delete config[slug];
    });
    await effacerInscriptions(slug);
    return json(200, { ok: true });
  }
  return json(400, { error: 'Action inconnue.' });
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
