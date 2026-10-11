/**
 * GET /api/carte-image?row=12&numero=ASE-2627-001
 * Recto PNG fabriqué à l’instant à partir de la fiche (ligne `row`). Réservé au bureau (jeton).
 * `numero` = celui affiché à l’écran : s’il ne correspond plus à la fiche, refus (écran périmé).
 * Pas de cache.
 */

import { renderRecto } from './_carte-recto.mjs';
import { isCarteImageNumero } from './_cartes-store.mjs';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  handleOptions,
  isTestPrenom,
  json,
  pickRow,
  readSheetAsObjects,
  requireAuth,
} from './_bureau-lib.mjs';

/** Fiche qui peut recevoir une carte, ou la réponse d’erreur. */
export function carteFiche(target, numeroAffiche) {
  if (!target) return { error: json(404, { error: 'Cette fiche n’a pas été trouvée. Appuyez sur Actualiser.' }) };
  const prenom = pickRow(target, 'PRENOM', 'Prénom', 'Prenom');
  const nom = pickRow(target, 'NOM', 'Nom');
  if (isTestPrenom(prenom, nom)) return { error: json(400, { error: 'Fiche de test. Rien n’a été envoyé.' }) };
  if (pickRow(target, 'STATUT') !== 'À jour') {
    return { error: json(400, { error: 'Cette fiche n’est pas à jour. Rien n’a été envoyé.' }) };
  }
  const numero = pickRow(target, 'NUMERO');
  if (!isCarteImageNumero(numero)) return { error: json(400, { error: 'Numéro manquant. Rien n’a été envoyé.' }) };
  if (numeroAffiche && numeroAffiche !== numero) {
    return { error: json(409, { error: 'Cette fiche a changé. Appuyez sur Actualiser.' }) };
  }
  if (!String(prenom).trim() && !String(nom).trim()) {
    return { error: json(400, { error: 'Nom et prénom manquants. Rien n’a été envoyé.' }) };
  }
  return { prenom, nom, numero };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  const row = Number(event.queryStringParameters?.row);
  if (!Number.isInteger(row) || row < 2) {
    return json(400, { error: 'Numéro de ligne invalide' });
  }
  const numeroAffiche = String(event.queryStringParameters?.numero || '').trim();

  try {
    const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
    const fiche = carteFiche(
      rows.find((r) => r._row === row),
      numeroAffiche,
    );
    if (fiche.error) return fiche.error;
    const png = await renderRecto(fiche);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      body: png.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('carte-image', err?.message || 'failed');
    return json(500, { error: 'La carte n’a pas pu être fabriquée. Réessayez dans un instant.' });
  }
}
