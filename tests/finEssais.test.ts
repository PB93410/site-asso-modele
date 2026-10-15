import { afterEach, describe, expect, it, vi } from 'vitest';
import { essaisOuverts } from '../asso.derive.js';

describe('fin des essais (saison.finEssais)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('vide : les essais restent ouverts toute l’année', () => {
    expect(essaisOuverts(new Date('2030-01-01T12:00:00+01:00').getTime(), '')).toBe(true);
  });

  it('ouverts jusqu’à 23 h 59 (heure de Paris) du dernier jour, fermés ensuite', () => {
    const fin = '2026-10-20';
    expect(essaisOuverts(new Date('2026-10-20T23:59:00+02:00').getTime(), fin)).toBe(true);
    expect(essaisOuverts(new Date('2026-10-21T00:00:00+02:00').getTime(), fin)).toBe(false);
    // 22 h 30 UTC = minuit passé à Paris en octobre : fermé.
    expect(essaisOuverts(new Date('2026-10-20T22:30:00Z').getTime(), fin)).toBe(false);
  });

  it('après la fin, le formulaire d’essai refuse les nouvelles demandes (410)', async () => {
    vi.resetModules();
    vi.doMock('../asso.derive.js', async (orig) => {
      const m = await orig<Record<string, unknown> & { essaisOuverts: (n?: number, f?: string) => boolean }>();
      return { ...m, essaisOuverts: (n = Date.now()) => m.essaisOuverts(n, '2026-10-20') };
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00+02:00'));
    const { traiter } = await import('../netlify/functions/essai.mjs');
    const r = await traiter({
      httpMethod: 'POST',
      headers: { origin: 'https://www.exemple-asso.fr' },
      body: JSON.stringify({ prenom: 'Ada', nom: 'Exemple', telephone: '0600000079' }),
    });
    expect(r.statusCode).toBe(410);
    expect(JSON.parse(r.body).error).toMatch(/essais sont terminés/);
  }, { timeout: 20_000 });
});
