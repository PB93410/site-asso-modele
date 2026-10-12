/**
 * GET /api/bureau/google/start
 * Session bureau requise → URL OAuth (compte asso).
 */

import { handleOptions, json, moduleOff, requireAuth } from './_bureau-lib.mjs';
import {
  buildConsentUrl,
  createGoogleOAuthState,
  googleErrorMessage,
} from './_google-user.mjs';
import { versV2 } from './_v2.mjs';

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('mail');
  if (off) return off;
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  try {
    const state = createGoogleOAuthState();
    const url = buildConsentUrl(state);
    return json(200, { url });
  } catch (err) {
    console.error('bureau-google-start', err?.message || err);
    return json(500, { error: googleErrorMessage(err) });
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
