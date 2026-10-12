/**
 * GET /api/adhesions-pending
 * Liste À payer / Mail À traiter = STATUT exact « En attente ».
 * En-têtes Adhérents (ne pas renommer) : NOM … DATE_DEMANDE.
 */

import {
  getAdherentsSheetId,
  getAdherentsTab,
  googleSheetEditUrl,
  handleOptions,
  isPendingAdhesion,
  isTestPrenom,
  json,
  pickRow,
  readSheetAsObjects,
  requireAuth,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';

export async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  try {
    const tab = getAdherentsTab();
    const range = `'${tab}'!A:Z`;
    const { rows } = await readSheetAsObjects(getAdherentsSheetId(), range);

    const mapped = [];
    const pending = [];
    for (const r of rows) {
      const item = {
        row: r._row,
        nom: pickRow(r, 'NOM'),
        prenom: pickRow(r, 'PRENOM'),
        tel: pickRow(r, 'TEL'),
        mail: pickRow(r, 'MAIL'),
        mode: pickRow(r, 'MODE'),
        statut: pickRow(r, 'STATUT'),
        montant: pickRow(r, 'MONTANT'),
        detail: pickRow(r, 'DETAIL'),
        datePaiement: pickRow(r, 'DATE_PAIEMENT'),
        source: pickRow(r, 'SOURCE'),
        notes: pickRow(r, 'NOTES'),
        dateDemande: pickRow(r, 'DATE_DEMANDE'),
        numero: pickRow(r, 'NUMERO'),
        carte: pickRow(r, 'CARTE'),
      };
      if (!(item.prenom || item.nom || item.tel).trim()) continue;
      mapped.push(item);
      if (isPendingAdhesion(r) && !isTestPrenom(item.prenom, item.nom)) pending.push(item);
    }
    pending.sort((a, b) => String(b.dateDemande).localeCompare(String(a.dateDemande)));

    return json(200, {
      count: pending.length,
      items: pending,
      all: mapped,
      adherentsSheetUrl: googleSheetEditUrl(getAdherentsSheetId()),
    });
  } catch (err) {
    console.error('adhesions-pending error', err);
    return json(500, { error: 'Impossible de charger la liste. Réessayez dans un instant.' });
  }
}
