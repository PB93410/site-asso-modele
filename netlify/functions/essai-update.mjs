/**
 * POST /api/essai-update
 * Essais : STATUT = À venir | Venu | Absent | Annulé | Adhérent | Relancé
 */

import {
  ESSAIS_STATUTS,
  getEssaisSheetId,
  getEssaisTab,
  handleOptions,
  headerName,
  json,
  pickRow,
  readSheetAsObjects,
  requireAuth,
  telPersonKey,
  updateRowByHeaders,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const ESSAI_STATUTS = new Set(ESSAIS_STATUTS);

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

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = requireAuth(event, { roles: ['admin', 'seance'] });
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON invalide' });
  }

  const source = (body.source || 'essai').toLowerCase();
  const row = Number(body.row);

  const seanceStatuts = new Set(['Venu', 'Absent', 'Confirmé', 'Relancé', 'Annulé']);
  if (auth.role === 'seance' && body.statut !== undefined && body.statut !== null) {
    const statutSeance = String(body.statut).trim();
    if (statutSeance && !seanceStatuts.has(statutSeance)) {
      return json(403, { error: 'Accès réservé au bureau.' });
    }
  }

  if (source !== 'essai') {
    return json(400, { error: 'source doit être "essai"' });
  }
  if (!Number.isInteger(row) || row < 2) {
    return json(400, { error: 'Numéro de ligne invalide' });
  }

  const sheetName = getEssaisTab();

  const relanceMsg = body.relanceMsg === undefined || body.relanceMsg === null
    ? ''
    : String(body.relanceMsg).trim();
  if (relanceMsg && !['A', 'B', 'C'].includes(relanceMsg)) {
    return json(400, { error: 'Message de relance inconnu.' });
  }

  try {
    const sheetId = getEssaisSheetId();
    const { headers, rows } = await readSheetAsObjects(sheetId, `'${sheetName}'!A:Z`);
    const target = rows.find((r) => r._row === row);
    if (!target) {
      return json(400, { error: 'Cette fiche n’a pas été trouvée. Appuyez sur Actualiser.' });
    }
    const sentTel = body.tel;
    if (sentTel !== undefined && sentTel !== null && String(sentTel).trim() !== '') {
      const rowTel = pickRow(target, 'TEL', 'Téléphone', 'Telephone', 'Tel');
      if (telPersonKey(sentTel) !== telPersonKey(rowTel)) {
        return json(409, { error: 'Cette fiche a changé. Appuyez sur Actualiser.' });
      }
    }

    const updates = {};

    if (body.statut !== undefined && !relanceMsg) {
      const statut = String(body.statut).trim();
      if (statut && !ESSAI_STATUTS.has(statut)) {
        return json(400, { error: 'Statut essai inconnu.' });
      }
      updates[headerName(headers, 'STATUT')] = statut;
    }
    const noteParts = [];
    if (body.notes !== undefined || body.remarque !== undefined) {
      const note = String(body.notes || body.remarque || '').trim();
      if (note) noteParts.push(note);
    }
    if (relanceMsg) {
      noteParts.push(`Relance ${relanceMsg} ${todayFr()}`);
      const current = pickRow(target, 'STATUT', 'Statut');
      if (current !== 'Venu') {
        updates[headerName(headers, 'STATUT')] = 'Relancé';
      }
    }
    if (noteParts.length) {
      const existing = pickRow(target, 'NOTES', 'Remarque');
      const note = noteParts.join(' | ');
      updates[headerName(headers, 'NOTES')] = existing ? `${existing} | ${note}` : note;
    }

    if (Object.keys(updates).length === 0) {
      return json(400, { error: 'Aucune mise à jour fournie' });
    }

    await updateRowByHeaders(sheetId, sheetName, row, updates, headers);

    return json(200, {
      ok: true,
      source,
      row,
      updates,
      message: `${pickRow(target, 'PRENOM', 'Prénom', 'Prenom')} ${pickRow(target, 'NOM', 'Nom')} mis à jour`,
    });
  } catch (err) {
    console.error('essai-update error', err);
    return json(500, {
      error: 'Impossible d’enregistrer. Réessayez dans un instant.',
    });
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
