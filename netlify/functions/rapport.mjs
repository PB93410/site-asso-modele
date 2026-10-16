/**
 * Rapport annuel (modules.rapport).
 * GET action=json|csv|pdf
 */

import { ASSO, MODULES } from '../../asso.derive.js';
import { calculerRapport, rapportCsv, rapportPdf } from '../../src/lib/rapport.js';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  getEssaisSheetId,
  getEssaisTab,
  handleOptions,
  json,
  moduleOff,
  readSheetAsObjects,
  requireAuth,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { lireOngletSite } from './_onglet.mjs';
import { PRESENCES_HEADERS, ONGLET_PRESENCES } from '../../src/lib/presence.js';

/** Totaux du registre (aussi pour la page publique « Le club en chiffres », qui les arrondit). */
export async function donnees() {
  const adh = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
  const ess = await readSheetAsObjects(getEssaisSheetId(), `'${getEssaisTab()}'!A:Z`);
  let presences = [];
  if (MODULES.presences) {
    try {
      const { lignes } = await lireOngletSite(ONGLET_PRESENCES, PRESENCES_HEADERS);
      presences = lignes;
    } catch {
      presences = [];
    }
  }
  const r = calculerRapport({ adherents: adh.rows, essais: ess.rows, presences });
  r.saison = ASSO.saison.label;
  return r;
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('rapport');
  if (off) return off;
  const auth = requireAuth(event, { roles: ['admin'] });
  if (!auth.ok) return auth.response;

  const q = event.queryStringParameters || {};
  const action = String(q.action || 'json').trim();
  const r = await donnees();

  if (action === 'json') return json(200, r);

  if (action === 'csv') {
    const csv = rapportCsv(r);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${ASSO.sigle}-rapport-${ASSO.saison.label}.csv"`,
        'Cache-Control': 'no-store',
      },
      body: `\uFEFF${csv}`,
    };
  }

  if (action === 'pdf') {
    const pdf = rapportPdf(r, ASSO);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${ASSO.sigle}-rapport-${ASSO.saison.label}.pdf"`,
        'Cache-Control': 'no-store',
      },
      body: pdf.toString('base64'),
      isBase64Encoded: true,
    };
  }

  return json(400, { error: 'Action inconnue.' });
}

export { handler as traiter };
export default versV2(handler);
