/**
 * Netlify Function — Proxy Google Sheets CSV
 *
 * Usage :
 *   GET /.netlify/functions/sheet?tab=planning
 *   GET /.netlify/functions/sheet?tab=evenements
 *   GET /.netlify/functions/sheet?tab=coachs
 *
 * (ou via redirect /api/sheet?tab=...)
 *
 * Avantages :
 * - Pas de CORS
 * - Cache contrôlé côté Netlify
 * - Protection des URLs de publication Google
 * - Fallback propre en cas d’erreur
 */

import {
  getEventsTab,
  getPlanningTab,
  getSiteSheetId,
  readSheetValues,
  rowsToCsv,
} from './_bureau-lib.mjs';
import { MODULES, SITE_URL } from '../../asso.derive.js';
import { brancherStockage, surNetlify } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

/**
 * URL « Publier sur le Web → CSV » de chaque onglet (facultatif, variables Netlify).
 * Sans URL ni GOOGLE_SITE_SHEET_ID : 502 → le site affiche les données de src/data/siteData.ts.
 */
const TABS = {
  coachs: process.env.SHEET_CSV_COACHS || '',
  evenements: process.env.SHEET_CSV_EVENEMENTS || '',
  planning: process.env.SHEET_CSV_PLANNING || '',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handler(event) {
  brancherStockage(event);
  // Préflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const tab = (event.queryStringParameters?.tab || '').toLowerCase().trim();

  if (!tab || !(tab in TABS)) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Paramètre tab manquant ou invalide',
        allowed: Object.keys(TABS),
        example: '/.netlify/functions/sheet?tab=planning',
      }),
    };
  }

  try {
    // Stockage Netlify : planning et événements modifiés depuis /bureau.
    const liveId = surNetlify()
      ? MODULES.bureau && getSiteSheetId()
      : process.env.GOOGLE_SITE_SHEET_ID ||
        process.env.GOOGLE_SHEET_ESSAIS_ID ||
        process.env.GOOGLE_SUIVI_SHEET_ID;
    if (liveId && (tab === 'planning' || tab === 'evenements')) {
      const name = tab === 'planning' ? getPlanningTab() : getEventsTab();
      const values = await readSheetValues(liveId, name);
      if (values.length > 0) {
        return {
          statusCode: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/csv; charset=utf-8',
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
            'X-Sheet-Tab': tab,
            'X-Sheet-Source': 'live',
          },
          body: rowsToCsv(values),
        };
      }
    }

    if (!TABS[tab]) throw new Error('aucune source configurée');
    const res = await fetch(TABS[tab], {
      redirect: 'follow',
      headers: {
        Accept: 'text/csv,text/plain,*/*',
        'User-Agent': 'SiteAsso-NetlifyFunction/1.0',
      },
    });

    const text = await res.text();
    const head = text.slice(0, 300).toLowerCase();

    if (!res.ok) {
      throw new Error(`Google Sheets HTTP ${res.status}`);
    }

    // Protection : ne jamais renvoyer du HTML (page de login / erreur Google)
    if (head.includes('<!doctype') || head.includes('<html') || head.includes('<head')) {
      throw new Error('Réponse HTML reçue au lieu de CSV (Sheet non publié ?)');
    }

    // Nettoyage BOM Excel / Sheets
    const csv = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Sheet-Tab': tab,
      },
      body: csv,
    };
  } catch (err) {
    console.error(`[sheet] ${tab}:`, err.message || err);

    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Impossible de récupérer le CSV Google Sheets',
        tab,
      }),
    };
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
