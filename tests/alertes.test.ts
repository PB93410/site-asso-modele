import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  alerteActive,
  emailValide,
  expireLe,
  tokenDesabonnement,
  typeAlerte,
  verifierTokenDesabonnement,
} from '../src/lib/alertes.js';

process.env.DEMO = '1';

describe('alertes — règles', () => {
  it('expire le lendemain de la séance et reconnaît le type', () => {
    expect(expireLe('2026-10-12')).toBe('2026-10-13');
    expect(alerteActive({ EXPIRE_LE: '2026-10-13' }, '2026-10-12')).toBe(true);
    expect(alerteActive({ EXPIRE_LE: '2026-10-12' }, '2026-10-13')).toBe(false);
    expect(typeAlerte('Annulation')).toBe('annulation');
    expect(typeAlerte('n’importe')).toBe('changement');
    expect(emailValide('marie@example.fr')).toBe(true);
    expect(emailValide('pas-un-mail')).toBe(false);
  });

  it('signe et vérifie le lien de désabonnement', () => {
    const secret = 'demo-secret-non-confidentiel-0123456789abcdef';
    const t = tokenDesabonnement('Marie.Exemple@example.fr', secret);
    expect(verifierTokenDesabonnement('marie.exemple@example.fr', t, secret)).toBe(true);
    expect(verifierTokenDesabonnement('autre@example.fr', t, secret)).toBe(false);
  });
});

describe('alertes — fonction démo', () => {
  type Handler = (event: Record<string, unknown>) => Promise<{ statusCode: number; body: string }>;
  let traiter: Handler;
  let auth: Record<string, string>;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock('../asso.derive.js', async (orig) => {
      const m = await orig<Record<string, unknown>>();
      return { ...m, MODULES: { ...(m.MODULES as object), alertes: true, bureau: true, mail: true } };
    });
    const { resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
    traiter = (await import('../netlify/functions/alertes.mjs')).traiter;
    const login = await (await import('../netlify/functions/bureau-auth.mjs')).traiter({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ password: 'demo' }),
    });
    auth = { authorization: `Bearer ${JSON.parse(login.body).token}` };
  }, 30_000);

  beforeEach(async () => {
    const { resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
  });

  const call = (event: Record<string, unknown>) =>
    traiter({ headers: { ...auth }, queryStringParameters: {}, ...event });

  it('refuse un abonnement sans consentement, accepte avec', async () => {
    const sans = await call({
      httpMethod: 'POST',
      body: JSON.stringify({ action: 'abo', mail: 'marie@example.fr', consent: false }),
    });
    expect(sans.statusCode).toBe(400);
    const avec = await call({
      httpMethod: 'POST',
      body: JSON.stringify({ action: 'abo', mail: 'marie@example.fr', consent: true }),
    });
    expect(avec.statusCode).toBe(200);
    const token = JSON.parse(avec.body).token;
    const off = await call({ httpMethod: 'GET', queryStringParameters: { action: 'desabo', t: token } });
    expect(off.statusCode).toBe(200);
  });

  it('le bureau publie une alerte visible sur le site, puis la retire', async () => {
    const pub = await call({
      httpMethod: 'POST',
      headers: { ...auth },
      body: JSON.stringify({
        action: 'creer',
        date: '2026-10-20',
        cours: 'Pilates',
        type: 'annulation',
        message: 'Gymnase fermé ce jour-là.',
      }),
    });
    expect(pub.statusCode).toBe(200);
    const id = JSON.parse(pub.body).alerte.id;
    const liste = JSON.parse((await call({ httpMethod: 'GET', queryStringParameters: { action: 'liste' } })).body);
    expect(liste.alertes.some((a: { id: string }) => a.id === id)).toBe(true);
    expect(liste.alertes[0].message).not.toMatch(/@/);
    const del = await call({ httpMethod: 'DELETE', headers: { ...auth }, queryStringParameters: { id } });
    expect(del.statusCode).toBe(200);
  });
});
