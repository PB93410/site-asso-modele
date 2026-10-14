/**
 * Contrôle du matin (adhérents dans Google Sheets) : chaque numéro d'adhérent doit rester sur la
 * fiche de la personne qui l'a reçu (registre des numéros, _registre-numeros.mjs). Mail à la boîte
 * de l'asso seulement en cas de décalage. Lecture seule du classeur ; n'écrit que le registre.
 * Rien avec le stockage Netlify (personne ne trie le classeur), ni en démo. Planification : config en bas.
 */

import { ASSO, MODULES } from '../../asso.derive.js';
import { getAdherentsSheetId, getAdherentsTab, pickRow, readSheetAsObjects } from './_bureau-lib.mjs';
import { adresseAsso, envoyerMail, modeEnvoi } from './_envoi.mjs';
import { controlerRegistre, ecrireRegistre, lireRegistre, texteAlerte } from './_registre-numeros.mjs';
import { brancherStockage, modeStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

export function controleActif(env = process.env) {
  if (!MODULES.adhesion && !MODULES.bureau) return false;
  if (String(env.BUREAU_SECRET || '').length < 24) return false;
  return modeStockage(env) === 'google' && Boolean(modeEnvoi(env));
}

const handler = async (event) => {
  if (!controleActif()) return { statusCode: 200, body: 'contrôle inactif' };
  brancherStockage(event);
  try {
    const onglet = getAdherentsTab();
    const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${onglet}'!A:Z`);
    const fiches = rows.map((r) => ({
      ligne: r._row,
      numero: pickRow(r, 'NUMERO'),
      tel: pickRow(r, 'TEL', 'Téléphone', 'Tel'),
      prenom: pickRow(r, 'PRENOM', 'Prénom', 'Prenom'),
    }));
    const res = controlerRegistre(fiches, await lireRegistre(), process.env.BUREAU_SECRET);
    await ecrireRegistre(res.registre);
    console.log('controle-numeros', res.amorcage ? 'amorçage' : '', `nouveaux ${res.nouveaux.length}`, `décalés ${res.decales.length}`, `doublons ${res.doublons.length}`);
    if (!res.decales.length && !res.doublons.length) return { statusCode: 200, body: 'ok' };
    await envoyerMail({
      to: adresseAsso(),
      subject: `[${ASSO.sigle}] Numéros d’adhérent décalés dans le classeur (${res.decales.length + res.doublons.length})`,
      text: texteAlerte(res, onglet),
    });
    return { statusCode: 200, body: 'alerte envoyée' };
  } catch (err) {
    console.error('controle-numeros', err?.message || err);
    return { statusCode: 500, body: 'échec' };
  }
};

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);

// Chaque jour à 5 h (UTC).
export const config = { schedule: '0 5 * * *' };
