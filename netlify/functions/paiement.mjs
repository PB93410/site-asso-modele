/**
 * GET /api/paiement?ref=ASE-K7M4QP — ouvre le paiement en ligne d'une demande d'adhésion.
 *
 * Crée un paiement HelloAsso tout neuf (ils expirent vite) pour le montant de l'adhésion,
 * pré-rempli avec le nom et le mail de la demande, puis redirige le payeur vers HelloAsso.
 * Lien réutilisable : le bureau peut le renvoyer par WhatsApp pour une relance.
 */

import { clientIp, consumeRateLimit, moduleOff } from './_bureau-lib.mjs';
import { clientHelloAsso, noterIntention, paiementIntegre, personneDeReference, referenceValide, storePaiements } from './_paiement.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const vers = (location) => ({ statusCode: 302, headers: { Location: location, 'Cache-Control': 'no-store' }, body: '' });
const inscription = (paiement, ref) =>
  vers(`/inscription?ok=1&mode=carte&paiement=${paiement}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`);

async function handler(event) {
  brancherStockage(event);
  const off = moduleOff('adhesion');
  if (off) return off;
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: { Allow: 'GET' }, body: '' };

  const ref = String(event.queryStringParameters?.ref || '').trim().toUpperCase();
  if (!paiementIntegre()) return vers('/inscription');
  if (!referenceValide(ref)) return inscription('introuvable');
  if (!consumeRateLimit(`paiement:${clientIp(event)}`, 10, 15 * 60 * 1000).ok) return inscription('patienter', ref);

  try {
    const personne = await personneDeReference(ref);
    if (!personne) return inscription('introuvable');
    // Déjà réglée, ou rien à payer (aides qui couvrent toute la cotisation).
    if (!personne.enAttente || personne.centimes <= 0) return inscription('deja', ref);
    const intention = await clientHelloAsso().creerIntention(personne, process.env);
    if (!intention?.id || !intention?.redirectUrl) throw new Error('réponse HelloAsso sans adresse de paiement');
    await noterIntention(ref, intention.id, storePaiements(), Date.now(), personne.centimes);
    return vers(intention.redirectUrl);
  } catch (err) {
    console.error('paiement:', err?.message || err);
    return inscription('erreur', ref);
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
