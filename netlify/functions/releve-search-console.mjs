/**
 * Relevé Search Console du lundi : visites, recherches et pages, envoyé à la boîte de l’asso.
 * Couper : SEARCH_CONSOLE=non. Demande le compte Google connecté (scope Search Console).
 */

import { ASSO } from '../../asso.derive.js';
import { adresseAsso, envoyerMail, modeEnvoi } from './_envoi.mjs';
import { releveSearchConsole, texteMailReleve } from './_search-console.mjs';
import { versV2 } from './_v2.mjs';

export function releveActif(env = process.env) {
  if (/^(non|0|false)$/i.test(String(env.SEARCH_CONSOLE || '').trim())) return false;
  if (/^(non|0|false)$/i.test(String(env.GOOGLE_REFRESH_TOKEN || '').trim())) return false;
  return Boolean(modeEnvoi(env)) && Boolean(String(env.GOOGLE_REFRESH_TOKEN || '').trim());
}

export async function envoyerReleve(now = new Date()) {
  const r = await releveSearchConsole(now);
  await envoyerMail({
    to: adresseAsso(),
    subject: `[${ASSO.sigle}] Recherches Google — ${r.periode.debut} → ${r.periode.fin}`,
    text: texteMailReleve(r),
  });
  return r;
}

const handler = async () => {
  if (!releveActif()) return { statusCode: 200, body: 'relevé inactif' };
  try {
    const r = await envoyerReleve();
    console.log('relevé search console', r.periode.debut, r.periode.fin, r.clics);
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('relevé search console', err?.message || err);
    return { statusCode: 500, body: 'échec' };
  }
};

export { handler as traiter };
export default versV2(handler);

// Chaque lundi à 6 h 30 (UTC), après la sauvegarde.
export const config = { schedule: '30 6 * * 1' };
