/**
 * GET /api/bureau-recherches — Search Console, 4 dernières semaines (porte Bureau — admin).
 */

import { json, requireAuth } from './_bureau-lib.mjs';
import { googleErrorMessage } from './_google-user.mjs';
import { releveSearchConsole } from './_search-console.mjs';
import { versV2 } from './_v2.mjs';

const handler = async (event) => {
  const auth = requireAuth(event, { roles: ['admin'] });
  if (!auth.ok) return auth.response;
  if (event.httpMethod !== 'GET') return json(405, { error: 'Méthode non autorisée.' });
  try {
    return json(200, await releveSearchConsole(), { 'Cache-Control': 'no-store, private' });
  } catch (err) {
    console.error('bureau-recherches', err?.message || err);
    return json(503, { error: googleErrorMessage(err) });
  }
};

export { handler as traiter };
export default versV2(handler);
