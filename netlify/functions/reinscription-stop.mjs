/**
 * GET /api/reinscription-stop?t=JETON — lien de désinscription des rappels de réinscription.
 * Le jeton (empreinte de l'adresse + signature) vient du mail ; il ne contient aucune adresse.
 * Réponse : une petite page, jamais de détail sur ce qui est enregistré.
 */

import { getStore } from '@netlify/blobs';
import { ASSO } from '../../asso.derive.js';
import { STORE, cleDuJetonStop } from './_relances-reinscription.mjs';
import { versV2 } from './_v2.mjs';

const page = (statusCode, titre, texte) => ({
  statusCode,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  },
  body: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titre}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1>${titre}</h1><p>${texte}</p></body></html>`,
});

const handler = async (event) => {
  if (event.httpMethod !== 'GET') return page(405, 'Lien invalide', 'Cette page ne s’ouvre que depuis le lien du mail.');
  const secret = process.env.BUREAU_SECRET;
  const label = ASSO.saison.label;
  const cle = secret && secret.length >= 24 ? cleDuJetonStop(event.queryStringParameters?.t, label, secret) : '';
  if (!cle) return page(404, 'Lien invalide', 'Ce lien n’est pas valide. Écrivez-nous en répondant à un de nos mails.');
  try {
    const store = getStore({ name: STORE, consistency: 'strong' });
    const etats = (await store.get(`saison-${label}`, { type: 'json' }).catch(() => null)) || {};
    etats[cle] = { ...etats[cle], stop: true };
    await store.setJSON(`saison-${label}`, etats);
    return page(200, 'C’est noté', 'Vous ne recevrez plus de rappel de réinscription. Votre réinscription reste possible à tout moment depuis votre espace adhérent.');
  } catch (err) {
    console.error('reinscription-stop', err?.message || err);
    return page(500, 'Réessayez', 'Nous n’avons pas pu enregistrer votre demande. Réessayez dans un instant ou écrivez-nous.');
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
