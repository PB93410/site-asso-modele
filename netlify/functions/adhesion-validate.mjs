/**
 * POST /api/adhesion-validate
 * Body: {
 *   row: number,          // 1-based sheet row
 *   statut?: string,      // default "À jour"
 *   datePaiement?: string,
 *   detail?: string,
 *   mode?: string,
 *   notes?: string
 * }
 */

import {
  ADHERENTS_MODES,
  ADHERENTS_STATUTS,
  getAdherentsSheetId,
  getAdherentsTab,
  handleOptions,
  isPendingAdhesion,
  json,
  pickRow,
  readSheetAsObjects,
  requireAuth,
  telPersonKey,
  updateRowByHeaders,
} from './_bureau-lib.mjs';
import { numeroPourLigne } from './_adhesion-numero.mjs';
import { lireReference } from './_paiement.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { MODULES } from '../../asso.derive.js';
import { notifierSuivant } from './_liste-attente.mjs';

async function handler(event) {
  brancherStockage(event);
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

  const statut = (body.statut || 'À jour').trim();
  if (!ADHERENTS_STATUTS.includes(statut)) {
    return json(400, { error: 'Statut inconnu.' });
  }
  const mode = (body.mode || '').trim();
  if (mode && !ADHERENTS_MODES.includes(mode)) {
    return json(400, { error: 'Mode de paiement inconnu.' });
  }
  const datePaiement = (body.datePaiement || '').trim();
  const detail = (body.detail || '').trim();
  const notes = (body.notes || '').trim();

  try {
    // Re-read headers to be safe
    const tab = getAdherentsTab();
    const sheetId = getAdherentsSheetId();
    const { headers, rows, colIndices } = await readSheetAsObjects(sheetId, `'${tab}'!A:Z`);

    const target = rows.find((r) => r._row === row);
    if (!target) {
      return json(404, { error: 'Cette fiche n’a pas été trouvée. Appuyez sur Actualiser.' });
    }
    const sentTel = body.tel;
    if (sentTel !== undefined && sentTel !== null && String(sentTel).trim() !== '') {
      const rowTel = pickRow(target, 'TEL', 'Téléphone', 'Telephone', 'Tel');
      if (telPersonKey(sentTel) !== telPersonKey(rowTel)) {
        return json(409, { error: 'Cette fiche a changé. Appuyez sur Actualiser.' });
      }
    }

    const currentStatut = pickRow(target, 'STATUT', 'Statut');
    const expected = String(body.expectedStatut || '').trim();
    if (expected && currentStatut && expected !== currentStatut) {
      return json(409, {
        error: 'Cette fiche a déjà changé. Appuyez sur Actualiser.',
      });
    }

    const reverting = Boolean(body.clearPaiement) || statut === 'En attente';
    if (reverting) {
      if (currentStatut && currentStatut !== 'À jour' && !isPendingAdhesion(target)) {
        return json(409, {
          error: 'Cette fiche a déjà changé. Appuyez sur Actualiser.',
        });
      }
    } else if (statut === 'À jour' && !isPendingAdhesion(target)) {
      return json(409, {
        error: 'Cette fiche n’est plus en attente. Appuyez sur Actualiser.',
      });
    }

    const updates = { STATUT: statut };
    if (body.clearPaiement || statut === 'En attente') {
      updates.DATE_PAIEMENT = '';
    } else if (datePaiement) {
      updates.DATE_PAIEMENT = datePaiement;
    }
    if (detail) {
      // La référence de paiement reste dans DETAIL : elle relie un paiement en ligne ou un virement à la fiche.
      const ref = lireReference(pickRow(target, 'DETAIL'));
      updates.DETAIL = ref && !lireReference(detail) ? `${detail} · Réf. ${ref}` : detail;
    }
    if (mode) updates.MODE = mode;
    if (notes) {
      // Append note rather than overwrite if existing
      const existing = pickRow(target, 'NOTES', 'Notes');
      updates.NOTES = existing
        ? `${existing} | Bureau: ${notes}`
        : `Bureau: ${notes}`;
    }

    const existingPay = pickRow(target, 'DATE_PAIEMENT');
    if (statut === 'À jour' && !datePaiement && !body.clearPaiement && !String(existingPay || '').trim()) {
      const parts = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).formatToParts(new Date());
      const get = (type) => parts.find((p) => p.type === type)?.value || '';
      updates.DATE_PAIEMENT = `${get('day')}/${get('month')}/${get('year')}`;
    }

    let numero = '';
    if (statut === 'À jour' && !reverting) {
      const n = await numeroPourLigne({ sheetId, tab, headers, colIndices, rows, row, target });
      numero = n.numero;
      if (numero) updates[n.header] = numero;
    }

    await updateRowByHeaders(sheetId, tab, row, updates, headers, colIndices);

    let listeAttente = null;
    if (MODULES.listeAttente && statut === 'Arrêt') {
      const notes = pickRow(target, 'NOTES', 'Notes');
      const m = String(notes || '').match(/Cours:\s*([^|]+)/i);
      const cours = (m ? m[1] : '').split(',')[0].trim();
      if (cours && cours !== 'Non précisé') {
        try {
          listeAttente = await notifierSuivant({ type: 'adhesion', cours }, event);
        } catch (err) {
          console.error('adhesion-validate liste attente', err?.message || err);
        }
      }
    }

    return json(200, {
      ok: true,
      row,
      updates,
      numero,
      message: `${pickRow(target, 'PRENOM', 'Prénom', 'Prenom')} ${pickRow(target, 'NOM', 'Nom')} → ${statut}`,
      listeAttente,
    });
  } catch (err) {
    console.error('adhesion-validate error', err);
    return json(500, {
      error: 'Impossible d’enregistrer. Réessayez dans un instant.',
    });
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
