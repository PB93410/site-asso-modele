/**
 * GET /api/paiement-retour?ref=…&checkoutIntentId=… — HelloAsso y renvoie le payeur après le paiement.
 *
 * Les paramètres ajoutés par HelloAsso ne sont pas crus : le paiement est relu auprès de l'API
 * (confirmerPaiement) et l'adhésion validée s'il est bien payé. Puis retour sur /inscription.
 */

import { clientIp, consumeRateLimit, moduleOff } from './_bureau-lib.mjs';
import { confirmerPaiement, paiementIntegre } from './_paiement.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const vers = (location) => ({ statusCode: 302, headers: { Location: location, 'Cache-Control': 'no-store' }, body: '' });

/** Etat lu → message affiché par /inscription. */
const MESSAGES = { paye: 'ok', attente: 'attente', refuse: 'refuse', inconnu: 'introuvable' };

async function handler(event) {
  brancherStockage(event);
  const off = moduleOff('adhesion');
  if (off) return off;
  if (!paiementIntegre()) return vers('/inscription');

  const q = event.queryStringParameters || {};
  const ref = String(q.ref || '').trim().toUpperCase();
  const suite = (paiement) => vers(`/inscription?ok=1&mode=carte&paiement=${paiement}&ref=${encodeURIComponent(ref)}`);
  if (!consumeRateLimit(`paiement-retour:${clientIp(event)}`, 20, 15 * 60 * 1000).ok) return suite('attente');

  try {
    const lu = await confirmerPaiement(ref, { idPropose: String(q.checkoutIntentId || '').trim() });
    if (lu.etat === 'attente' && q.erreur) return suite('refuse');
    return suite(MESSAGES[lu.etat] || 'attente');
  } catch (err) {
    console.error('paiement-retour:', err?.message || err);
    // Le rattrapage horaire et la notification HelloAsso valideront quand même l'adhésion.
    return suite('attente');
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
