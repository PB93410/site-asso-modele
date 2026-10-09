import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  adherentAJourKey,
  createBureauToken,
  requireAuth,
  verifyBureauToken,
} from '../netlify/functions/_bureau-lib.mjs';
import { adherentEssaiKey } from '../src/lib/bureauSearch';

const SECRET = 'bureau-secret-pour-les-tests-32';
const ENV_KEYS = ['BUREAU_SECRET', 'BUREAU_PASSWORD', 'BUREAU_PASSWORD_SEANCE'] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.BUREAU_SECRET = SECRET;
  process.env.BUREAU_PASSWORD = 'mdp-admin';
  process.env.BUREAU_PASSWORD_SEANCE = 'mdp-seance';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('jeton bureau', () => {
  it('jeton admin → admin', () => {
    const token = createBureauToken('admin');
    expect(verifyBureauToken(token)).toEqual({ ok: true, role: 'admin' });
  });

  it('jeton seance → seance', () => {
    const token = createBureauToken('seance');
    expect(verifyBureauToken(token)).toEqual({ ok: true, role: 'seance' });
  });

  it('ancien format sans rôle → refusé', () => {
    const exp = Date.now() + 60_000;
    const sig = createHmac('sha256', SECRET).update(`bureau:${exp}`).digest('hex');
    expect(verifyBureauToken(`${exp}.${sig}`).ok).toBe(false);
  });

  it('jeton seance refusé par requireAuth par défaut', () => {
    const token = createBureauToken('seance');
    const result = requireAuth({ headers: { authorization: `Bearer ${token}` } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.statusCode).toBe(403);
    expect(JSON.parse(result.response.body).error).toBe('Accès réservé au bureau.');
  });

  it('signature modifiée → refus', () => {
    const token = createBureauToken('admin');
    const flipped = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(verifyBureauToken(flipped).ok).toBe(false);
  });
});

describe('clé adhérent à jour', () => {
  it('le serveur et le front produisent la même clé', () => {
    expect(adherentAJourKey('+33 6 12 34 56 78', 'Émilie')).toBe(
      adherentEssaiKey('+33 6 12 34 56 78', 'Émilie'),
    );
    expect(adherentAJourKey('0612345678', 'Marie')).toBe(adherentEssaiKey('0612345678', 'Marie'));
  });
});
