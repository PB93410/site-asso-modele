/**
 * Verrou de connexion /bureau, persistant (Netlify Blobs).
 *
 * Le compteur en mémoire (consumeRateLimit) repart à zéro à chaque redémarrage
 * de la fonction : insuffisant contre un mot de passe unique partagé.
 * Ici, les échecs sont gardés dans le store « bureau-securite » :
 *   - par adresse IP (hachée, jamais stockée en clair) : 5 échecs libres,
 *     puis blocage 1, 2, 4, 8… minutes, plafonné à 24 h ;
 *   - au total (toutes IP) : plus de 50 échecs en 15 min → alerte 15 min pendant
 *     laquelle seules les IP qui ont déjà échoué sont bloquées (attaque répartie).
 *     Une IP sans échec garde l’accès : un attaquant ne peut pas fermer le bureau à tous.
 * Un succès efface le compteur de l’IP. Les échecs anciens (24 h) sont oubliés.
 * Si Blobs est indisponible (dev local sans Netlify), repli en mémoire.
 */
import { createHash } from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';

export const LOGIN_STORE = 'bureau-securite';
export const FREE_FAILURES = 5;
export const MAX_LOCK_MS = 24 * 60 * 60 * 1000;
export const FORGET_AFTER_MS = 24 * 60 * 60 * 1000;
export const GLOBAL_WINDOW_MS = 15 * 60 * 1000;
export const GLOBAL_MAX_FAILURES = 50;

// ---------- Logique pure (testée) ----------

/** Durée de blocage après `failures` échecs consécutifs. */
export function lockDuration(failures) {
  if (failures < FREE_FAILURES) return 0;
  const minutes = 2 ** (failures - FREE_FAILURES);
  return Math.min(minutes * 60 * 1000, MAX_LOCK_MS);
}

/** Millisecondes restantes de blocage (0 = libre). */
export function remainingLock(state, now) {
  if (!state || !state.lockedUntil) return 0;
  return Math.max(0, state.lockedUntil - now);
}

/** État après un échec. */
export function afterFailure(state, now) {
  const stale = !state || now - (state.last || 0) > FORGET_AFTER_MS;
  const failures = (stale ? 0 : state.failures || 0) + 1;
  const lock = lockDuration(failures);
  return { failures, last: now, lockedUntil: lock ? now + lock : 0 };
}

/** Compteur global : fenêtre glissante simple. */
export function afterGlobalFailure(state, now) {
  const fresh = !state || now - (state.start || 0) > GLOBAL_WINDOW_MS;
  const count = (fresh ? 0 : state.count || 0) + 1;
  const start = fresh ? now : state.start;
  return {
    start,
    count,
    lockedUntil: count > GLOBAL_MAX_FAILURES ? now + GLOBAL_WINDOW_MS : state?.lockedUntil || 0,
  };
}

/**
 * Attente avant de pouvoir réessayer. Le blocage général ne vise que les IP
 * qui ont un échec récent (moins de 24 h).
 */
export function lockWait(mine, all, now) {
  const own = remainingLock(mine, now);
  const recentFailure = Boolean(mine && mine.failures > 0 && now - (mine.last || 0) <= FORGET_AFTER_MS);
  const global = recentFailure ? remainingLock(all, now) : 0;
  return Math.max(own, global);
}

// ---------- Stockage ----------

const memory = new Map();

function memoryStore() {
  return {
    async get(key) {
      return memory.get(key) ?? null;
    },
    async setJSON(key, value) {
      memory.set(key, value);
    },
    async delete(key) {
      memory.delete(key);
    },
  };
}

function openStore(event) {
  try {
    const headers = {};
    for (const [key, value] of Object.entries(event.headers || {})) {
      headers[String(key).toLowerCase()] = value;
    }
    if (event?.blobs) connectLambda({ ...event, headers });
    const store = getStore({ name: LOGIN_STORE, consistency: 'strong' });
    return {
      get: (key) => store.get(key, { type: 'json' }),
      setJSON: (key, value) => store.setJSON(key, value),
      delete: (key) => store.delete(key),
    };
  } catch {
    return memoryStore();
  }
}

/** IP hachée avec le secret du site : pas d’adresse IP en clair dans le store (RGPD). */
function ipKey(ip) {
  const salt = process.env.BUREAU_SECRET || 'bureau';
  return `ip-${createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)}`;
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error('login-guard:', err?.message || err);
    return fallback;
  }
}

/** Avant de vérifier le mot de passe : { blocked, retryAfterSec }. */
export async function checkLoginLock(event, ip, now = Date.now()) {
  const store = openStore(event);
  const [mine, all] = await Promise.all([
    safe(() => store.get(ipKey(ip)), null),
    safe(() => store.get('global'), null),
  ]);
  const wait = lockWait(mine, all, now);
  return { blocked: wait > 0, retryAfterSec: Math.ceil(wait / 1000) };
}

export async function recordLoginFailure(event, ip, now = Date.now()) {
  const store = openStore(event);
  const key = ipKey(ip);
  const [mine, all] = await Promise.all([
    safe(() => store.get(key), null),
    safe(() => store.get('global'), null),
  ]);
  await Promise.all([
    safe(() => store.setJSON(key, afterFailure(mine, now))),
    safe(() => store.setJSON('global', afterGlobalFailure(all, now))),
  ]);
}

export async function clearLoginFailures(event, ip) {
  const store = openStore(event);
  await safe(() => store.delete(ipKey(ip)));
}
