/**
 * GET /api/adhesion-prefill?e=JETON — prénom, nom et téléphone de la personne qui a fait un essai,
 * pour préremplir /inscription depuis le lien envoyé par le bureau. Rien d'autre n'est renvoyé.
 * Sans jeton valide : 404, sans dire pourquoi. Quota par visiteur.
 */

import {
  clientIp,
  consumeRateLimit,
  getEssaisSheetId,
  getEssaisTab,
  json,
  moduleOff,
  pickRow,
  readSheetAsObjects,
  telPersonKey,
} from './_bureau-lib.mjs';
import { personneDuLien } from './_lien-adhesion.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const TEL = ['TEL', 'Téléphone', 'Telephone', 'Tel'];

/** 0612345678 → « 06 12 34 56 78 ». */
function telAffiche(tel9) {
  return `0${tel9}`.replace(/(\d{2})(?=\d)/g, '$1 ');
}

const handler = async (event) => {
  brancherStockage(event);
  const off = moduleOff('adhesion');
  if (off) return off;
  if (event.httpMethod !== 'GET') return json(405, { ok: false });
  if (!consumeRateLimit(`prefill:${clientIp(event)}`, 20, 10 * 60 * 1000).ok) {
    return json(429, { ok: false });
  }
  const jeton = event.queryStringParameters?.e || '';
  if (!jeton || jeton.length > 80) return json(404, { ok: false });
  try {
    const { rows } = await readSheetAsObjects(getEssaisSheetId(), `'${getEssaisTab()}'!A:Z`);
    const tel9 = personneDuLien(jeton, rows.map((r) => pickRow(r, ...TEL)), process.env.BUREAU_SECRET);
    if (!tel9) return json(404, { ok: false });
    // La ligne la plus récente de cette personne.
    const ligne = [...rows].reverse().find((r) => telPersonKey(pickRow(r, ...TEL)) === tel9);
    return json(200, {
      ok: true,
      prenom: pickRow(ligne, 'PRENOM', 'Prénom', 'Prenom'),
      nom: pickRow(ligne, 'NOM', 'Nom'),
      telephone: telAffiche(tel9),
    });
  } catch (err) {
    console.error('adhesion-prefill', err?.message || err);
    return json(404, { ok: false });
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
