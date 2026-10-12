/**
 * GET /api/bureau-export — toutes les données du bureau en un fichier Excel (.xlsx).
 * Porte admin seulement. Marche avec le stockage Netlify comme avec Google Sheets.
 */

import { classeurBureau, nomFichierExport } from './_export.mjs';
import { handleOptions, json, requireAuth } from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { XLSX_TYPE } from './_xlsx.mjs';

export async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  try {
    const fichier = await classeurBureau();
    const ok = json(200, {});
    return {
      statusCode: 200,
      headers: {
        ...ok.headers,
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="${nomFichierExport()}"`,
      },
      body: fichier.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('bureau-export', err?.message || err);
    return json(500, { error: 'Export impossible pour le moment. Réessayez dans quelques minutes.' });
  }
}
