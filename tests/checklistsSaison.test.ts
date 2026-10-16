import { describe, expect, it, vi } from 'vitest';

vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<Record<string, unknown>>();
  return { ...m, MODULES: { ...(m.MODULES as object), bureau: true, checklists: true } };
});
delete process.env.DEMO;

const { CHECKLISTS, CHECKLISTS_DEFAUT } = await import('../src/data/checklistsSaison');
const { avancement, cleCoche, jourCourt } = await import('../src/lib/checklistsSaison');
const { appliquer, cleValide, cochesPropres, saisonValide } = await import('../netlify/functions/_checklists.mjs');

describe('checklists de saison — les listes', () => {
  it('sans listes dans asso.config.js : celles par défaut', () => {
    expect(CHECKLISTS).toBe(CHECKLISTS_DEFAUT);
  });

  it('chaque clé « liste:étape » est acceptée par le serveur, sans doublon', () => {
    const cles = CHECKLISTS.flatMap((l) => l.etapes.map((e) => cleCoche(l, e.id)));
    expect(cles.length).toBeGreaterThan(15);
    expect(new Set(cles).size).toBe(cles.length);
    for (const c of cles) expect(cleValide(c), c).toBe(true);
  });

  it('chaque étape a un texte et un responsable connu', () => {
    for (const l of CHECKLISTS) {
      expect(l.etapes.length).toBeGreaterThan(0);
      for (const e of l.etapes) {
        expect(e.texte.length).toBeGreaterThan(8);
        expect(['bureau', 'référent']).toContain(e.qui);
      }
    }
  });
});

describe('checklists de saison — avancement', () => {
  const liste = CHECKLISTS[0];
  it('compte les cases cochées de la liste seulement', () => {
    const coches = {
      [cleCoche(liste, liste.etapes[0].id)]: { le: '2026-10-15' },
      'autre:chose': { le: '2026-10-15' },
    };
    expect(avancement(liste, coches)).toEqual({ faites: 1, total: liste.etapes.length, fini: false });
  });
  it('fini quand tout est coché', () => {
    const coches = Object.fromEntries(liste.etapes.map((e) => [cleCoche(liste, e.id), { le: '2026-10-15' }]));
    expect(avancement(liste, coches).fini).toBe(true);
  });
  it('date courte', () => {
    expect(jourCourt('2026-10-15')).toBe('15/10');
    expect(jourCourt('')).toBe('');
  });
});

describe('checklists de saison — serveur', () => {
  it('valide la saison et la clé', () => {
    expect(saisonValide('2026-2027')).toBe(true);
    expect(saisonValide('2026')).toBe(false);
    expect(cleValide('forum:stand')).toBe(true);
    expect(cleValide('Forum:Stand')).toBe(false);
    expect(cleValide('../etc:passwd')).toBe(false);
    expect(cleValide('seul')).toBe(false);
  });

  it('coche et décoche une case sans toucher aux autres, et écarte le contenu mal formé', () => {
    const a = appliquer({}, 'forum:stand', true, '2026-10-15');
    const b = appliquer(a, 'cartes:envoi', true, '2026-10-16');
    expect(b).toEqual({ 'forum:stand': { le: '2026-10-15' }, 'cartes:envoi': { le: '2026-10-16' } });
    expect(appliquer(b, 'forum:stand', false, '2026-10-17')).toEqual({ 'cartes:envoi': { le: '2026-10-16' } });
    expect(cochesPropres({ 'forum:stand': { le: 'hier' }, 'MAUVAIS': { le: '2026-10-15' }, ok: 3 })).toEqual({});
  });
});

describe('checklists de saison — API', () => {
  const stock = new Map<string, unknown>();
  async function charger(authOk = true) {
    vi.resetModules();
    stock.clear();
    vi.doMock('@netlify/blobs', () => ({
      getStore: () => ({
        get: async (k: string) => stock.get(k) ?? null,
        setJSON: async (k: string, v: unknown) => void stock.set(k, v),
      }),
    }));
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      requireAuth: () => (authOk ? { ok: true, role: 'admin' } : { ok: false, response: { statusCode: 401, body: '{}' } }),
    }));
    const { traiter } = await import('../netlify/functions/checklists.mjs');
    return traiter as (e: unknown) => Promise<{ statusCode: number; body: string }>;
  }
  const post = (corps: unknown) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(corps) });

  it('sans connexion : refusé', async () => {
    const handler = await charger(false);
    expect((await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { saison: '2026-2027' } })).statusCode).toBe(401);
  }, { timeout: 20_000 });

  it('coche une case, la relit, la décoche', async () => {
    const handler = await charger();
    const r = await handler(post({ saison: '2026-2027', cle: 'forum:stand', fait: true }));
    expect(r.statusCode).toBe(200);
    expect(Object.keys(JSON.parse(r.body).coches)).toEqual(['forum:stand']);
    const lu = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { saison: '2026-2027' } });
    expect(JSON.parse(lu.body).coches['forum:stand'].le).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const retire = await handler(post({ saison: '2026-2027', cle: 'forum:stand', fait: false }));
    expect(JSON.parse(retire.body).coches).toEqual({});
  }, { timeout: 20_000 });

  it('une autre saison repart de zéro', async () => {
    const handler = await charger();
    await handler(post({ saison: '2026-2027', cle: 'forum:stand', fait: true }));
    const autre = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { saison: '2027-2028' } });
    expect(JSON.parse(autre.body).coches).toEqual({});
  }, { timeout: 20_000 });

  it('refuse une demande mal formée', async () => {
    const handler = await charger();
    expect((await handler(post({ saison: '2026-2027', cle: 'x', fait: true }))).statusCode).toBe(400);
    expect((await handler(post({ saison: '2026-2027', cle: 'forum:stand', fait: 'oui' }))).statusCode).toBe(400);
    expect((await handler(post({ saison: 'x', cle: 'forum:stand', fait: true }))).statusCode).toBe(400);
  }, { timeout: 20_000 });
});
