/**
 * Onglets optionnels du classeur site (présences, alertes).
 * Même API Sheets : lecture, ajout, remplacement.
 */

import {
  appendRow,
  getSiteSheetId,
  readSheetValues,
  replaceSheetValues,
  rowFromHeaders,
} from './_bureau-lib.mjs';
import { lignesDepuisValeurs } from '../../src/lib/presence.js';

export async function lireOngletSite(tab, headers) {
  const id = getSiteSheetId();
  let values = [];
  try {
    values = await readSheetValues(id, tab);
  } catch {
    values = [];
  }
  if (!values.length) {
    try {
      await replaceSheetValues(id, tab, [headers]);
    } catch {
      // Onglet encore absent (Google) : la prochaine écriture le dira.
    }
    return { id, headers, lignes: [] };
  }
  return { id, ...lignesDepuisValeurs(values, headers) };
}

export async function ajouterLigneSite(tab, headers, fields) {
  const { id, lignes } = await lireOngletSite(tab, headers);
  if (!lignes.length) {
    const actuel = await readSheetValues(id, tab).catch(() => []);
    if (!actuel.length) await replaceSheetValues(id, tab, [headers]);
  }
  return appendRow(id, tab, rowFromHeaders(headers, fields));
}

export async function remplacerOngletSite(tab, headers, lignes) {
  const id = getSiteSheetId();
  const rows = [headers, ...lignes.map((l) => headers.map((h) => (l[h] == null ? '' : String(l[h]))))];
  await replaceSheetValues(id, tab, rows);
}
