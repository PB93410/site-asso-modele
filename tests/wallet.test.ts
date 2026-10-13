import { beforeAll, describe, expect, it, vi } from 'vitest';
import { champsPass, fabriquerPkpass, googleSaveUrl, prochainCours } from '../src/lib/wallet.js';
import { crc32, zipStore } from '../src/lib/zipStore.js';

process.env.DEMO = '1';

describe('wallet — pkpass et aperçu', () => {
  it('fabrique un ZIP store avec CRC connu', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    const z = zipStore([{ name: 'hello.txt', data: Buffer.from('hi') }]);
    expect(z.subarray(0, 2).toString()).toBe('PK');
  });

  it('met le prochain cours et l’alerte sur le pass', () => {
    const p = champsPass({
      asso: { nom: 'Association Sportive Exemple', nomCourt: 'ASE' },
      prenom: 'Marie',
      nom: 'Exemple',
      numero: 'ASE-2627-001',
      prochain: 'Lundi 10h · Pilates',
      alerte: 'Séance déplacée',
    }) as {
      generic: {
        auxiliaryFields: { value: string }[];
        backFields: { key: string }[];
      };
    };
    expect(p.generic.auxiliaryFields[0].value).toBe('Lundi 10h · Pilates');
    expect(p.generic.backFields.some((f) => f.key === 'alerte')).toBe(true);
    const bin = fabriquerPkpass(p, { signe: false });
    expect(bin.subarray(0, 2).toString()).toBe('PK');
    expect(bin.includes(Buffer.from('unsigned-demo'))).toBe(true);
    expect(googleSaveUrl('abc.def')).toBe('https://pay.google.com/gp/v/save/abc.def');
    expect(prochainCours([{ day: 'Lundi', time: '10h', course: 'Pilates' }], new Date('2026-10-12T08:00:00+02:00'))).toContain(
      'Pilates',
    );
  });
});

describe('wallet — fonction démo', () => {
  type Handler = (event: Record<string, unknown>) => Promise<{
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
    isBase64Encoded?: boolean;
  }>;
  let traiter: Handler;
  let auth: Record<string, string>;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock('../asso.derive.js', async (orig) => {
      const m = await orig<Record<string, unknown>>();
      return { ...m, MODULES: { ...(m.MODULES as object), wallet: true, bureau: true, alertes: true } };
    });
    const { resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
    traiter = (await import('../netlify/functions/wallet.mjs')).traiter;
    const login = await (await import('../netlify/functions/bureau-auth.mjs')).traiter({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ password: 'demo' }),
    });
    auth = { authorization: `Bearer ${JSON.parse(login.body).token}` };
  }, 30_000);

  const call = (event: Record<string, unknown>) =>
    traiter({ headers: { ...auth }, queryStringParameters: {}, ...event });

  it('sert un aperçu et un pkpass non signé', async () => {
    const apercu = JSON.parse((await call({ httpMethod: 'GET', queryStringParameters: { action: 'apercu' } })).body);
    expect(apercu.demo).toBe(true);
    expect(apercu.pass.generic.primaryFields[0].value).toBeTruthy();
    const pk = await call({ httpMethod: 'GET', queryStringParameters: { action: 'pkpass', numero: 'ASE-2627-001' } });
    expect(pk.statusCode).toBe(200);
    expect(pk.headers?.['Content-Type']).toBe('application/vnd.apple.pkpass');
    expect(pk.isBase64Encoded).toBe(true);
    const google = JSON.parse((await call({ httpMethod: 'GET', queryStringParameters: { action: 'google' } })).body);
    expect(google.demo).toBe(true);
    expect(google.message).toMatch(/démo/i);
  });

  it('la carte d’un adhérent (nom, prénom) est réservée au bureau', async () => {
    const sans = (q: Record<string, string>) => traiter({ headers: {}, httpMethod: 'GET', queryStringParameters: q });
    expect((await sans({ action: 'apercu', numero: 'ASE-2627-001' })).statusCode).toBe(401);
    expect((await sans({ action: 'pkpass', numero: 'ASE-2627-001' })).statusCode).toBe(401);
    expect((await sans({ action: 'apercu' })).statusCode).toBe(200);
  });
});
