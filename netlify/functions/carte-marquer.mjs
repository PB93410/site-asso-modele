/**
 * POST /api/carte-marquer
 * Note la date du jour dans CARTE (colonne T) quand la carte est partie
 * par WhatsApp (le bureau répond « Oui, c’est parti »). L’envoi est noté au journal.
 * Ne touche pas aux colonnes A→R ni à adhesion.mjs.
 * Body: { row, tel }
 */

import { CARTE_NUMERO_RE } from './_cartes-store.mjs';
import { journalEntry, masquerTel, noteEnvoi } from './_cartes-journal.mjs';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  handleOptions,
  headerName,
  json,
  pickRow,
  readSheetAsObjects,
  requireAuth,
  telPersonKey,
  updateRowByHeaders,
} from './_bureau-lib.mjs';

function todayFr() {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}/${get('month')}/${get('year')}`;
}

/** Écrit la date du jour en colonne T. Ne remplace pas une date déjà là. */
export async function noteCarteDate(row, tel) {
  const tab = getAdherentsTab();
  const sheetId = getAdherentsSheetId();
  const { headers, rows, colIndices } = await readSheetAsObjects(sheetId, `'${tab}'!A:Z`);
  const target = rows.find((r) => r._row === row);
  if (!target) {
    return { status: 404, body: { error: 'Cette fiche n’a pas été trouvée. Appuyez sur Actualiser.' } };
  }
  if (tel !== undefined && tel !== null && String(tel).trim() !== '') {
    const rowTel = pickRow(target, 'TEL', 'Téléphone', 'Telephone', 'Tel');
    if (telPersonKey(tel) !== telPersonKey(rowTel)) {
      return { status: 409, body: { error: 'Cette fiche a changé. Appuyez sur Actualiser.' } };
    }
  }
  if (pickRow(target, 'STATUT') !== 'À jour') {
    return { status: 400, body: { error: 'Cette fiche n’est pas à jour. Rien n’a été écrit.' } };
  }
  const numero = pickRow(target, 'NUMERO');
  if (!CARTE_NUMERO_RE.test(numero)) {
    return { status: 400, body: { error: 'Numéro manquant. Rien n’a été écrit.' } };
  }

  const carteHeader = headerName(headers, 'CARTE');
  const filteredIdx = headers.indexOf(carteHeader);
  const sheetIdx = Array.isArray(colIndices) ? colIndices[filteredIdx] : filteredIdx;
  if (filteredIdx < 0 || sheetIdx !== 19) {
    return { status: 400, body: { error: 'Colonne CARTE introuvable. Rien n’a été écrit.' } };
  }

  const telFiche = pickRow(target, 'TEL', 'Téléphone', 'Telephone', 'Tel');
  const existing = pickRow(target, 'CARTE');
  if (existing) {
    return { status: 200, body: { ok: true, row, carte: existing, already: true }, numero, tel: telFiche };
  }

  const carte = todayFr();
  await updateRowByHeaders(
    sheetId,
    tab,
    row,
    { [carteHeader]: `'${carte}` },
    headers,
    colIndices,
  );
  return { status: 200, body: { ok: true, row, carte, already: false }, numero, tel: telFiche };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON invalide' });
  }

  const row = Number(body.row);
  if (!Number.isInteger(row) || row < 2) {
    return json(400, { error: 'Numéro de ligne invalide' });
  }

  try {
    const noted = await noteCarteDate(row, body.tel);
    if (noted.status === 200) {
      await noteEnvoi(
        event,
        journalEntry({
          numero: noted.numero,
          row,
          canal: 'whatsapp',
          dest: masquerTel(noted.tel),
          renvoi: noted.body.already === true,
        }),
      );
    }
    return json(noted.status, noted.body);
  } catch (err) {
    console.error('carte-marquer error', err);
    return json(500, { error: 'Impossible d’enregistrer. Réessayez dans un instant.' });
  }
}
