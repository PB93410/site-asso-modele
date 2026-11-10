/**
 * GET  /api/reglages — tarif et fin des essais (public : pas de donnée personnelle).
 * PUT  /api/reglages — bureau : enregistre l’onglet REGLAGES (prochain déploiement pour l’accueil).
 */

import { requireAuth, json } from './_bureau-lib.mjs';
import { ecrireReglages, erreurReglages, lireReglages, normaliserReglages } from './_reglages.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const handler = async (event) => {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod === 'GET') {
    try {
      return json(200, await lireReglages(), { 'Cache-Control': 'no-store, private' });
    } catch (err) {
      console.error('reglages GET', err?.message || err);
      return json(500, { error: 'Chargement impossible.' });
    }
  }
  if (event.httpMethod !== 'PUT') return json(405, { error: 'Méthode non autorisée.' });
  const auth = requireAuth(event, { roles: ['admin'] });
  if (!auth.ok) return auth.response;
  let corps = {};
  try {
    corps = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Requête illisible.' });
  }
  const reglages = normaliserReglages(corps.reglages || corps);
  const err = erreurReglages(reglages);
  if (err) return json(400, { error: err });
  try {
    const sauves = await ecrireReglages(reglages);
    return json(200, {
      ok: true,
      reglages: sauves,
      message: 'Enregistré. Le site public se met à jour au prochain déploiement ; les formulaires, tout de suite.',
    });
  } catch (e) {
    console.error('reglages PUT', e?.message || e);
    return json(e?.code === 400 ? 400 : 500, { error: e?.code === 400 ? e.message : 'Enregistrement impossible.' });
  }
};

export { handler as traiter };
export default versV2(handler);
