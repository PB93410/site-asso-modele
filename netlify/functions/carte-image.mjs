/**
 * GET /api/carte-image?numero=ASE-2627-001
 * PNG du coffre privé. Réservé au bureau (jeton). Pas de cache public.
 */

import { connectLambda, getStore } from '@netlify/blobs';
import { CARTES_STORE, isCarteImageNumero } from './_cartes-store.mjs';
import { handleOptions, json, requireAuth } from './_bureau-lib.mjs';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  const numero = String(event.queryStringParameters?.numero || '').trim();
  if (!isCarteImageNumero(numero)) {
    return json(400, { error: 'Numéro de carte invalide' });
  }

  try {
    const headers = {};
    for (const [key, value] of Object.entries(event.headers || {})) {
      headers[String(key).toLowerCase()] = value;
    }
    connectLambda({ ...event, headers });
    const store = getStore(CARTES_STORE);
    const data = await store.get(numero, { type: 'arrayBuffer' });
    if (!data) return json(404, { error: 'Image de la carte introuvable' });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      body: Buffer.from(data).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('carte-image', err?.message || 'failed');
    return json(500, { error: 'Image de la carte introuvable' });
  }
}
