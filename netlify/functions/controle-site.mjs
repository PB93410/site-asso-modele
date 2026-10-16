/**
 * Contrôle de nuit du site public : les pages et l'API d'essai répondent-elles ? Mail à la boîte de
 * l'asso seulement en cas de problème. Lecture seule, aucune donnée personnelle.
 * Actif dès qu'un envoi de mail est configuré (docs/DOC-MAIL.md) ; CONTROLE_SITE=non le coupe.
 * Rien en démo. Planification : config en bas.
 */

import { SITE_URL } from '../../asso.derive.js';
import { controlerSite, sujetProbleme, texteProbleme } from './_controle-site.mjs';
import { adresseAsso, envoyerMail, modeEnvoi } from './_envoi.mjs';
import { versV2 } from './_v2.mjs';

export function controleSiteActif(env = process.env) {
  if (String(env.CONTROLE_SITE || '').trim().toLowerCase() === 'non') return false;
  const mode = modeEnvoi(env);
  // Tant que siteUrl est l'adresse d'exemple, il n'y a pas de site à contrôler.
  return Boolean(mode) && mode !== 'demo' && /^https:\/\//.test(SITE_URL) && !/exemple/.test(SITE_URL);
}

const handler = async () => {
  if (!controleSiteActif()) return { statusCode: 200, body: 'contrôle inactif' };
  try {
    const echecs = await controlerSite(fetch, SITE_URL);
    console.log('controle-site', `en échec ${echecs.length}`);
    if (!echecs.length) return { statusCode: 200, body: 'ok' };
    await envoyerMail({ to: adresseAsso(), subject: sujetProbleme(echecs), text: texteProbleme(echecs, SITE_URL) });
    return { statusCode: 200, body: 'alerte envoyée' };
  } catch (err) {
    console.error('controle-site', err?.message || err);
    return { statusCode: 500, body: 'échec' };
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);

// Chaque nuit à 3 h 30 (UTC).
export const config = { schedule: '30 3 * * *' };
