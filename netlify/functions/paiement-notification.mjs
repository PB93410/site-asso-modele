/**
 * POST /api/paiement-notification — notifications HelloAsso (« URL de callback » dans
 * l'espace HelloAsso de l'asso → Mon compte → Intégrations et API).
 *
 * Le contenu n'est pas cru : on n'en tire que la référence (metadata) et l'identifiant du paiement,
 * puis on relit le paiement auprès de l'API HelloAsso avant de valider quoi que ce soit.
 */

import { moduleOff } from './_bureau-lib.mjs';
import { confirmerPaiement, lireReference, paiementIntegre } from './_paiement.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const reponse = (statusCode, body = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

/** Référence et identifiant de paiement dans une notification (formats Order / Payment). */
export function lireNotification(n) {
  const data = n?.data || {};
  const ref = lireReference(n?.metadata?.reference || data?.metadata?.reference || '');
  const id = data.checkoutIntentId || data.order?.checkoutIntentId || '';
  return { ref, id: id ? String(id) : '' };
}

async function handler(event) {
  brancherStockage(event);
  const off = moduleOff('adhesion');
  if (off) return off;
  if (event.httpMethod !== 'POST') return reponse(405, { ok: false });
  if (!paiementIntegre()) return reponse(200, { ok: true, ignore: 'paiement en ligne non branché' });
  if ((event.body || '').length > 200_000) return reponse(413, { ok: false });

  let n;
  try {
    n = JSON.parse(event.body || '{}');
  } catch {
    return reponse(400, { ok: false });
  }
  const { ref, id } = lireNotification(n);
  // Formulaires HelloAsso hors site, dons… : rien à faire, mais on accuse réception.
  if (!ref) return reponse(200, { ok: true, ignore: 'sans référence du site' });

  try {
    const lu = await confirmerPaiement(ref, { idPropose: id });
    return reponse(200, { ok: true, etat: lu.etat });
  } catch (err) {
    console.error('paiement-notification:', err?.message || err);
    // 500 : HelloAsso renverra la notification ; le rattrapage horaire passe aussi.
    return reponse(500, { ok: false });
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
