/**
 * POST /api/bureau-auth
 * Body: { password: "..." }
 * Returns: { token: "..." } if OK
 * LOT-3 : erreur 500 explicite si BUREAU_PASSWORD / BUREAU_SECRET absentes
 */

import {
  checkPassword,
  clientIp,
  consumeRateLimit,
  createBureauToken,
  handleOptions,
  json,
  moduleOff,
} from './_bureau-lib.mjs';
import { checkLoginLock, clearLoginFailures, recordLoginFailure } from './_login-guard.mjs';
import { versV2 } from './_v2.mjs';

function tooMany(retryAfterSec) {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return json(
    429,
    {
      error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      retryAfterSec,
    },
    { 'Retry-After': String(retryAfterSec) },
  );
}

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('bureau');
  if (off) return off;
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const ip = clientIp(event);
  // Garde rapide en mémoire (rafales), puis verrou persistant (Blobs).
  if (!consumeRateLimit(`bureau-auth:${ip}`, 10, 15 * 60 * 1000).ok) {
    await new Promise((r) => setTimeout(r, 800));
    return tooMany(15 * 60);
  }
  const lock = await checkLoginLock(event, ip);
  if (lock.blocked) {
    await new Promise((r) => setTimeout(r, 800));
    return tooMany(lock.retryAfterSec);
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON invalide' });
  }

  const password = body.password;
  let role;
  try {
    role = checkPassword(password);
  } catch (err) {
    console.error('bureau-auth config error', err);
    return json(500, {
      error: 'Configuration serveur incomplète. Contactez l’administrateur du site.',
    });
  }
  if (!role) {
    await recordLoginFailure(event, ip);
    await new Promise((r) => setTimeout(r, 400));
    return json(401, { error: 'Mot de passe incorrect. Réessayez, ou demandez-le au bureau.' });
  }
  await clearLoginFailures(event, ip);

  let token;
  try {
    token = createBureauToken(role);
  } catch (err) {
    console.error('bureau-auth token error', err);
    return json(500, {
      error: 'Configuration serveur incomplète. Contactez l’administrateur du site.',
    });
  }

  return json(200, {
    token,
    role,
    expiresInHours: 12,
    message: 'Connexion réussie',
  });
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
