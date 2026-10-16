/**
 * Demande d'avis Google (modules.demandeAvis) : chaque mercredi, un mail aux adhérents à jour qui ont rejoint
 * l'association il y a un à deux mois. Règles : _avis-google.mjs. Demande reseaux.avisGoogle, un envoi de mail
 * configuré et BUREAU_SECRET (24 caractères ou plus). Rien en démo.
 * AVIS_GOOGLE = « apercu » : compte et journalise, n'envoie rien. Aucun nom ni adresse dans les journaux.
 * Planification : config en bas.
 */

import { getStore } from '@netlify/blobs';
import { ASSO, MODULES, SITE_URL } from '../../asso.derive.js';
import { AVIS_URL, STORE, choisirDemandes, jetonStop, messageAvis } from './_avis-google.mjs';
import { getAdherentsSheetId, getAdherentsTab, readSheetAsObjects } from './_bureau-lib.mjs';
import { DEMO } from './_demo.mjs';
import { envoyerMail, modeEnvoi } from './_envoi.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const ymdParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

/** « oui », « apercu » (AVIS_GOOGLE=apercu), ou '' (inactif). */
export function modeAvis(env = process.env, modules = MODULES, demo = DEMO, lien = AVIS_URL) {
  if (demo || !modules.demandeAvis || !lien) return '';
  if (String(env.BUREAU_SECRET || '').length < 24 || !modeEnvoi(env)) return '';
  return String(env.AVIS_GOOGLE || '').trim().toLowerCase() === 'apercu' ? 'apercu' : 'oui';
}

const handler = async (event) => {
  const mode = modeAvis();
  if (!mode) return { statusCode: 200, body: 'inactif' };
  brancherStockage(event);
  const secret = process.env.BUREAU_SECRET;
  try {
    const label = ASSO.saison.label;
    const ymd = ymdParis();
    const { rows: fiches } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
    const store = getStore({ name: STORE, consistency: 'strong' });
    const cle = `saison-${label}`;
    const etats = (await store.get(cle, { type: 'json' }).catch(() => null)) || {};

    const aEnvoyer = choisirDemandes({ fiches, etats, ymd, secret });
    console.log('demande-avis', mode, `à envoyer ${aEnvoyer.length}`);
    if (mode === 'apercu' || !aEnvoyer.length) return { statusCode: 200, body: mode === 'apercu' ? 'aperçu' : 'rien à envoyer' };

    let envoyes = 0;
    try {
      for (const d of aEnvoyer) {
        const { sujet, texte } = messageAvis({
          prenoms: d.prenoms,
          desabo: `${SITE_URL}/api/avis-stop?t=${jetonStop(d.cle, label, secret)}`,
        });
        await envoyerMail({ to: d.mail, subject: sujet, text: texte });
        etats[d.cle] = { ...etats[d.cle], envoye: ymd };
        envoyes += 1;
      }
    } finally {
      // Ce qui est parti est noté, même si un envoi échoue en cours de route : jamais de doublon au passage suivant.
      if (envoyes) await store.setJSON(cle, etats);
    }
    console.log('demande-avis', `envoyés ${envoyes}`);
    return { statusCode: 200, body: `envoyés ${envoyes}` };
  } catch (err) {
    console.error('demande-avis', err?.message || err);
    return { statusCode: 500, body: 'échec' };
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);

// Chaque mercredi à 8 h (UTC).
export const config = { schedule: '0 8 * * 3' };
