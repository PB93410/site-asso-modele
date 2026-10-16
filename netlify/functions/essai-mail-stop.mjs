/**
 * GET /api/essai-mail-stop?t=JETON (modules.essaiMail) — lien de désinscription des mails de l'essai (rappel de la veille,
 * mot après l'essai).
 * Le jeton (empreinte du téléphone + signature) vient du mail ; il ne contient ni adresse ni numéro.
 * L'adresse est effacée. La page ne dit rien de ce qui est enregistré.
 */

import { arreterMail, cleDuJetonStopMail } from './_essai-mails.mjs';
import { versV2 } from './_v2.mjs';

const ymdParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

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
  const cle = cleDuJetonStopMail(event.queryStringParameters?.t, process.env.BUREAU_SECRET);
  if (!cle) return page(404, 'Lien invalide', 'Ce lien n’est pas valide. Écrivez-nous en répondant à un de nos mails.');
  try {
    await arreterMail(cle, ymdParis());
    return page(200, 'C’est noté', 'Votre adresse est effacée : vous ne recevrez plus de message pour votre essai. Votre essai reste réservé.');
  } catch (err) {
    console.error('essai-mail-stop', err?.message || err);
    return page(500, 'Réessayez', 'Nous n’avons pas pu enregistrer votre demande. Réessayez dans un instant ou écrivez-nous.');
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
