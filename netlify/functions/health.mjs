/**
 * Netlify Function — Health check
 * GET /.netlify/functions/health
 */
import { ASSO } from '../../asso.derive.js';
import { versV2 } from './_v2.mjs';

async function handler() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      status: 'ok',
      service: ASSO.sigle.toLowerCase(),
      timestamp: new Date().toISOString(),
    }),
  };
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
