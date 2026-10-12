/**
 * GET /api/essais-list
 * Essais : 1 ligne = 1 créneau. Badge = À venir | Relancé (hors tests).
 */

import {
  adherentAJourKey,
  foldStatut,
  getAdherentsSheetId,
  getAdherentsTab,
  getEssaisSheetId,
  getEssaisTab,
  googleSheetEditUrl,
  handleOptions,
  isEssaiAVenir,
  isTestPrenom,
  json,
  pickRow,
  readSheetAsObjects,
  requireAuth,
  telPersonKey,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

function looksLikeDateOnly(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) return true;
  return false;
}

function mapEssaiRow(r) {
  const n = parseInt(pickRow(r, 'N_ESSAI', 'N° essai', 'N essai'), 10);
  const creneauRaw = pickRow(r, 'CRENEAU');
  const dateEssai = pickRow(r, 'Date essai');
  // Ne pas coller une date JJ/MM/AAAA dans CRENEAU (ancien repli Date essai).
  const creneau =
    creneauRaw ||
    (dateEssai && !looksLikeDateOnly(dateEssai) ? dateEssai : '');
  return {
    source: 'essai',
    row: r._row,
    prenom: pickRow(r, 'PRENOM', 'Prénom', 'Prenom'),
    nom: pickRow(r, 'NOM', 'Nom'),
    tel: pickRow(r, 'TEL', 'Téléphone', 'Telephone', 'Tel'),
    cours: pickRow(r, 'COURS', 'Cours'),
    creneau,
    statut: pickRow(r, 'STATUT', 'Statut') || 'À venir',
    nEssai: Number.isFinite(n) && n > 0 ? n : 1,
    dateDemande: pickRow(r, 'DATE_DEMANDE', 'Date essai'),
    present: pickRow(r, 'Présent', 'PRESENT', 'Present'),
    dateRelance: pickRow(r, 'Date relance', 'DATE_RELANCE', 'Date Relance'),
    notes: pickRow(r, 'NOTES', 'Remarque'),
    sourceLead: pickRow(r, 'SOURCE') || 'Formulaire',
  };
}

/** Garde les clés (tél, tél|prénom) dont le téléphone figure dans Essais. */
export function onlyEssaiPhones(keys, aJourKeys, essaiTels) {
  return {
    keys: [...new Set((keys || []).filter((k) => essaiTels.has(k)))],
    aJourKeys: [...new Set((aJourKeys || []).filter((k) => essaiTels.has(String(k).split('|')[0])))],
  };
}

function hasIdentity(item) {
  return Boolean((item.prenom || item.nom || item.tel).trim());
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = requireAuth(event, { roles: ['admin', 'seance'] });
  if (!auth.ok) return auth.response;

  try {
    const sheetId = getEssaisSheetId();
    const [essais, aJour] = await Promise.all([
      readSheetAsObjects(sheetId, `'${getEssaisTab()}'!A:Z`),
      (async () => {
        const keys = [];
        const aJourKeys = [];
        try {
          const adh = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
          for (const r of adh.rows) {
            if (foldStatut(pickRow(r, 'STATUT', 'Statut')) !== 'a jour') continue;
            const prenom = pickRow(r, 'PRENOM', 'Prénom');
            const nom = pickRow(r, 'NOM', 'Nom');
            if (isTestPrenom(prenom, nom)) continue;
            const tel = pickRow(r, 'TEL', 'Téléphone', 'Tel');
            const telKey = telPersonKey(tel);
            if (telKey) keys.push(telKey);
            const full = adherentAJourKey(tel, prenom);
            if (full) aJourKeys.push(full);
          }
        } catch {
          /* feuille Adhérents optionnelle pour le badge */
        }
        return { keys, aJourKeys };
      })(),
    ]);

    const essaiItems = essais.rows
      .map(mapEssaiRow)
      .filter(hasIdentity)
      .filter((i) => !isTestPrenom(i.prenom, i.nom));

    const aVenir = essaiItems.filter((i) => isEssaiAVenir(i.statut));

    // Minimisation : seulement les adhérents à jour qui ont aussi une ligne Essais.
    const essaiTels = new Set(essaiItems.map((i) => telPersonKey(i.tel)).filter(Boolean));
    const aJourKeysVisibles = onlyEssaiPhones(aJour.keys, aJour.aJourKeys, essaiTels);

    const body = {
      counts: {
        forum: 0,
        essais: essaiItems.length,
        aTraiter: aVenir.length,
        aVenir: aVenir.length,
        total: essaiItems.length,
      },
      aTraiter: aVenir,
      autres: essaiItems.filter((i) => !isEssaiAVenir(i.statut)),
      forum: [],
      essais: essaiItems,
      adherentsAJour: aJourKeysVisibles.keys,
      adherentsAJourKeys: aJourKeysVisibles.aJourKeys,
      ntfyUrl: process.env.BUREAU_NTFY_TOPIC
        ? `https://ntfy.sh/${encodeURIComponent(process.env.BUREAU_NTFY_TOPIC)}`
        : '',
      essaisSheetUrl: googleSheetEditUrl(sheetId),
      adherentsSheetUrl: googleSheetEditUrl(getAdherentsSheetId()),
    };
    if (auth.role === 'seance') {
      delete body.essaisSheetUrl;
      delete body.adherentsSheetUrl;
      delete body.ntfyUrl;
    }
    return json(200, body);
  } catch (err) {
    console.error('essais-list error', err);
    return json(500, {
      error: 'Impossible de charger la liste. Réessayez dans un instant.',
    });
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
