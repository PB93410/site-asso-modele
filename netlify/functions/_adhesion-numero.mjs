/**
 * Numéro d'adhérent (colonne S) attribué au passage « À jour ».
 * Partagé par la validation au bureau (adhesion-validate) et le paiement en ligne (_paiement.mjs).
 * Un numéro attribué est définitif : on le garde s'il existe, on ne renumérote jamais.
 */

import { SEASON_PREFIX, headerName, nextAdherentNumero, pickRow, readSheetAsObjects } from './_bureau-lib.mjs';

/** NUMERO seulement s’il est vraiment en colonne S (index 18). */
export function numeroHeaderIfColumnS(headers, colIndices) {
  const name = headerName(headers, 'NUMERO');
  const filteredIdx = (headers || []).indexOf(name);
  if (filteredIdx < 0) return '';
  const sheetIdx = Array.isArray(colIndices) ? colIndices[filteredIdx] : filteredIdx;
  if (sheetIdx !== 18) return '';
  return headers[filteredIdx];
}

function numerosOf(rows) {
  return (rows || []).map((r) => pickRow(r, 'NUMERO'));
}

/**
 * Numéro à écrire pour la ligne `row` (relit le classeur juste avant pour éviter un doublon).
 * @returns {Promise<{ header: string, numero: string }>} header vide = pas de colonne NUMERO en S.
 */
export async function numeroPourLigne({ sheetId, tab, headers, colIndices, rows, row, target }) {
  const numeroHeader = numeroHeaderIfColumnS(headers, colIndices);
  if (!numeroHeader) return { header: '', numero: '' };
  const current = pickRow(target, 'NUMERO');
  if (current) return { header: numeroHeader, numero: current };
  let numero = nextAdherentNumero(numerosOf(rows), SEASON_PREFIX);
  const fresh = await readSheetAsObjects(sheetId, `'${tab}'!A:Z`);
  if (!numeroHeaderIfColumnS(fresh.headers, fresh.colIndices)) return { header: numeroHeader, numero: '' };
  const freshRow = fresh.rows.find((r) => r._row === row);
  const freshCurrent = freshRow ? pickRow(freshRow, 'NUMERO') : '';
  if (freshCurrent) return { header: numeroHeader, numero: freshCurrent };
  const list = numerosOf(fresh.rows);
  if (list.some((n) => n === numero)) numero = nextAdherentNumero(list, SEASON_PREFIX);
  return { header: numeroHeader, numero };
}
