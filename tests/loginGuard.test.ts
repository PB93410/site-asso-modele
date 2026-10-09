import { describe, expect, it } from 'vitest';
import {
  FREE_FAILURES,
  GLOBAL_MAX_FAILURES,
  MAX_LOCK_MS,
  afterFailure,
  afterGlobalFailure,
  checkLoginLock,
  clearLoginFailures,
  lockDuration,
  lockWait,
  recordLoginFailure,
  remainingLock,
} from '../netlify/functions/_login-guard.mjs';

const MIN = 60 * 1000;

describe('verrou de connexion /bureau', () => {
  it('laisse 5 essais libres, puis double le blocage, plafonné à 24 h', () => {
    expect(lockDuration(FREE_FAILURES - 1)).toBe(0);
    expect(lockDuration(FREE_FAILURES)).toBe(1 * MIN);
    expect(lockDuration(FREE_FAILURES + 1)).toBe(2 * MIN);
    expect(lockDuration(FREE_FAILURES + 3)).toBe(8 * MIN);
    expect(lockDuration(FREE_FAILURES + 40)).toBe(MAX_LOCK_MS);
  });

  it('bloque après le 5e échec et oublie les échecs vieux de plus de 24 h', () => {
    let s = null;
    const t0 = 1_000_000;
    for (let i = 0; i < FREE_FAILURES; i++) s = afterFailure(s, t0 + i);
    expect(remainingLock(s, t0 + FREE_FAILURES)).toBeGreaterThan(0);
    const later = t0 + 25 * 60 * MIN;
    const fresh = afterFailure(s, later);
    expect(fresh.failures).toBe(1);
    expect(remainingLock(fresh, later)).toBe(0);
  });

  it('blocage général au-delà de 50 échecs en 15 min, toutes adresses confondues', () => {
    let g = null;
    const t0 = 5_000_000;
    for (let i = 0; i < GLOBAL_MAX_FAILURES; i++) g = afterGlobalFailure(g, t0 + i);
    expect(remainingLock(g, t0 + 100)).toBe(0);
    g = afterGlobalFailure(g, t0 + 200);
    expect(remainingLock(g, t0 + 300)).toBeGreaterThan(0);
  });

  it('blocage général : seules les IP qui ont déjà échoué attendent', () => {
    const now = 9_000_000;
    const all = { start: now, count: GLOBAL_MAX_FAILURES + 1, lockedUntil: now + 15 * MIN };
    expect(lockWait(null, all, now)).toBe(0);
    expect(lockWait(afterFailure(null, now - MIN), all, now)).toBeGreaterThan(0);
    const old = afterFailure(null, now - 25 * 60 * MIN);
    expect(lockWait(old, all, now)).toBe(0);
  });

  it('repli en mémoire hors Netlify : échecs comptés, succès efface', async () => {
    const event = { headers: {} };
    const ip = '203.0.113.9';
    const now = Date.now();
    for (let i = 0; i < FREE_FAILURES; i++) await recordLoginFailure(event, ip, now);
    expect((await checkLoginLock(event, ip, now + 1)).blocked).toBe(true);
    await clearLoginFailures(event, ip);
    expect((await checkLoginLock(event, ip, now + 1)).blocked).toBe(false);
  });
});
