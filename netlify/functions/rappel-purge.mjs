/**
 * Rappel de purge RGPD : chaque mois, un mail à la boîte de l'asso quand des essais ont plus de 12 mois et
 * ne mènent à aucune adhésion (durée annoncée sur la page de confidentialité, docs/DOC-DONNEES.md).
 *
 * Ne supprime RIEN : il compte, avec les mêmes règles que scripts/archive-saison.mjs, et dit quoi lancer.
 * Aucun nom, aucun téléphone dans le mail ni dans les journaux.
 * Actif avec le module essais, le stockage Google et un envoi de mail configuré ; PURGE_RAPPEL=non le coupe.
 * Rien en démo. Planification : config en bas.
 */

import { ASSO, MODULES } from '../../asso.derive.js';
import { getAdherentsSheetId, getAdherentsTab, getEssaisSheetId, getEssaisTab, readSheetValues } from './_bureau-lib.mjs';
import { adresseAsso, envoyerMail, modeEnvoi } from './_envoi.mjs';
import { modeStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import {
  addMonthsYmd,
  aJourKeysFromAdherents,
  essaiArchiveYmd,
  parisTodayYmd,
  rowsFromValues,
  selectEssaiRows,
} from '../../scripts/archive-saison.mjs';

export function rappelPurgeActif(env = process.env, modules = MODULES) {
  if (!modules.essais) return false;
  if (String(env.PURGE_RAPPEL || '').trim().toLowerCase() === 'non') return false;
  const mode = modeEnvoi(env);
  return modeStockage(env) === 'google' && Boolean(mode) && mode !== 'demo';
}

/** Combien d'essais sont à purger, et depuis quand : { n, avant, plusAncien } (aucune donnée personnelle). */
export function compterAPurger(essaisValues, adherentsValues, aujourdhui) {
  const avant = addMonthsYmd(aujourdhui, -12);
  const essais = rowsFromValues(essaisValues).rows;
  const adherents = rowsFromValues(adherentsValues).rows;
  const aPurger = selectEssaiRows(essais, aJourKeysFromAdherents(adherents), avant);
  const dates = aPurger.map((r) => essaiArchiveYmd(r.creneau, r.dateDemande)).filter(Boolean).sort();
  return { n: aPurger.length, avant, plusAncien: dates[0] || '' };
}

const fr = (ymd) => ymd.split('-').reverse().join('/');

export function messagePurge({ n, avant, plusAncien }, sigle = ASSO.sigle) {
  return {
    sujet: `[${sigle}] RGPD : ${n} ancien${n > 1 ? 's' : ''} essai${n > 1 ? 's' : ''} à supprimer`,
    texte: `Bonjour,

${n} ligne${n > 1 ? 's' : ''} du tableau des essais ${n > 1 ? 'ont' : 'a'} plus de 12 mois (avant le ${fr(avant)}${plusAncien ? `, la plus ancienne date du ${fr(plusAncien)}` : ''}) et ne correspond${n > 1 ? 'ent' : ''} à aucun adhérent à jour.

La page de confidentialité du site annonce 12 mois de conservation pour les demandes qui n’ont pas abouti : ces lignes sont à supprimer.

À faire par la personne qui s’occupe du site (rien ne se supprime tout seul) :
  1. Aperçu, qui ne modifie rien :  node scripts/archive-saison.mjs --avant ${avant}
  2. Si le compte vous convient :     node scripts/archive-saison.mjs --avant ${avant} --apply
Le script garde d’abord une copie dans tmp/archives/ (à supprimer après un mois : elle contient des données personnelles).

Ce message revient chaque mois tant qu’il reste des lignes à supprimer.
Le site`,
  };
}

const handler = async () => {
  if (!rappelPurgeActif()) return { statusCode: 200, body: 'inactif' };
  try {
    const [essais, adherents] = await Promise.all([
      readSheetValues(getEssaisSheetId(), getEssaisTab()),
      readSheetValues(getAdherentsSheetId(), getAdherentsTab()),
    ]);
    const c = compterAPurger(essais, adherents, parisTodayYmd());
    console.log('rappel-purge', `à purger ${c.n}`);
    if (!c.n) return { statusCode: 200, body: 'rien à purger' };
    const { sujet, texte } = messagePurge(c);
    await envoyerMail({ to: adresseAsso(), subject: sujet, text: texte });
    return { statusCode: 200, body: 'rappel envoyé' };
  } catch (err) {
    console.error('rappel-purge', err?.message || err);
    return { statusCode: 500, body: 'échec' };
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);

// Le 2 de chaque mois à 8 h (UTC).
export const config = { schedule: '0 8 2 * *' };
