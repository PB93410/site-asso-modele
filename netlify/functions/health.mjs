/**
 * Netlify Function — Health check
 * GET /.netlify/functions/health
 */
import { ASSO } from '../../asso.derive.js';

export async function handler() {
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
