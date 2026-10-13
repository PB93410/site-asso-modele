/**
 * Rattrapage des paiements en ligne, toutes les heures (fonction planifiée).
 *
 * Si le payeur ferme l'onglet avant de revenir sur le site, et que la notification HelloAsso
 * n'est pas branchée ou s'est perdue, l'adhésion serait restée « En attente » :
 * on relit ici les paiements ouverts depuis moins de 7 jours.
 */

import { MODULES } from '../../asso.derive.js';
import { confirmerPaiement, lireSuivi, modePaiement, referencesARelire, storePaiements } from './_paiement.mjs';
import { versV2 } from './_v2.mjs';

export async function rattraper({ store = storePaiements(), confirmer = confirmerPaiement, maintenant = Date.now() } = {}) {
  const refs = referencesARelire(await lireSuivi(store), maintenant);
  const bilan = { relus: refs.length, payes: 0, erreurs: 0 };
  for (const ref of refs) {
    try {
      if ((await confirmer(ref, { store })).etat === 'paye') bilan.payes += 1;
    } catch (err) {
      bilan.erreurs += 1;
      console.error(`rattrapage ${ref}:`, err?.message || err);
    }
  }
  return bilan;
}

async function handler() {
  if (!MODULES.adhesion || modePaiement() !== 'helloasso') return { statusCode: 200, body: 'paiement en ligne non branché' };
  const bilan = await rattraper();
  console.log('rattrapage paiements:', JSON.stringify(bilan));
  return { statusCode: 200, body: JSON.stringify(bilan) };
}

export const config = { schedule: '@hourly' };

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
