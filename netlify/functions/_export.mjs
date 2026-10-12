/**
 * Toutes les données du bureau en un classeur Excel : export depuis /bureau
 * et sauvegarde hebdomadaire par mail (stockage Netlify).
 */

import { ASSO, MODULES } from '../../asso.derive.js';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  getEssaisSheetId,
  getEssaisTab,
  getEventsTab,
  getPlanningTab,
  getSiteSheetId,
  readSheetValues,
} from './_bureau-lib.mjs';
import { classeurXlsx } from './_xlsx.mjs';

/** Onglets exportés selon les fonctions activées (cellules en texte : aucune formule exécutée). */
export async function ongletsBureau() {
  const onglets = [];
  if (MODULES.adhesion || MODULES.bureau) {
    onglets.push({ nom: getAdherentsTab(), lignes: await readSheetValues(getAdherentsSheetId(), getAdherentsTab()) });
  }
  if (MODULES.essais || MODULES.bureau) {
    onglets.push({ nom: 'Essais', lignes: await readSheetValues(getEssaisSheetId(), getEssaisTab()) });
  }
  if (MODULES.bureau) {
    onglets.push({ nom: 'Horaires', lignes: await readSheetValues(getSiteSheetId(), getPlanningTab()) });
    onglets.push({ nom: 'Événements', lignes: await readSheetValues(getSiteSheetId(), getEventsTab()) });
  }
  return onglets;
}

export function nomFichierExport(quoi = 'donnees', date = new Date()) {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date);
  return `${ASSO.sigle}-${quoi}-${jour}.xlsx`;
}

export async function classeurBureau() {
  return classeurXlsx(await ongletsBureau());
}
