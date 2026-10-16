import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<Record<string, unknown>>();
  return { ...m, MODULES: { ...(m.MODULES as object), bureau: true, sondageEssai: true } };
});
delete process.env.DEMO;
process.env.BUREAU_SECRET = 'secret-de-test-0123456789abcdef0123456789';

const { INTENTIONS, LIEN_SONDAGE, RAISONS, SUGGESTION_MAX, nettoyer, resumer, validerReponse } = await import('../src/lib/sondageEssai');
const { limiteConservation } = await import('../netlify/functions/_sondage-essai.mjs');
const { relanceHref } = await import('../src/data/bureauRelances');
const { SITE_URL } = await import('../asso.derive.js');

describe('mini-sondage après l’essai — validation', () => {
  it('trois questions : intention obligatoire, raison et suggestion facultatives', () => {
    expect(validerReponse({}).ok).toBe(false);
    expect(validerReponse({ intention: 'peut-être ?' }).ok).toBe(false);
    const r = validerReponse({ intention: 'non', raison: 'prix', suggestion: '  Plus de cours le soir  ' });
    expect(r).toEqual({ ok: true, reponse: { intention: 'non', raison: 'prix', suggestion: 'Plus de cours le soir' } });
  });

  it('pas de raison pour un « oui », ni pour une raison inconnue', () => {
    expect(validerReponse({ intention: 'oui', raison: 'prix' })).toMatchObject({ ok: true, reponse: { raison: '' } });
    expect(validerReponse({ intention: 'non', raison: '<script>' })).toMatchObject({ ok: true, reponse: { raison: '' } });
  });

  it('la suggestion est courte, sans saut de ligne ni caractère de contrôle', () => {
    expect(nettoyer('a\nb\u0000c')).toBe('a b c');
    expect(nettoyer('x'.repeat(1000))).toHaveLength(SUGGESTION_MAX);
    expect(nettoyer(null)).toBe('');
  });

  it('le résumé compte sans rien identifier : comptes, raisons, idées les plus récentes d’abord', () => {
    const r = resumer([
      { le: '2026-10-20', intention: 'oui', raison: '', suggestion: '' },
      { le: '2026-10-21', intention: 'non', raison: 'horaires', suggestion: 'Un cours à 20h' },
      { le: '2026-10-22', intention: 'peut-etre', raison: 'prix', suggestion: 'Paiement en 3 fois' },
      { le: '2026-10-22', intention: 'inconnu' as never },
    ]);
    expect(r.total).toBe(3);
    expect(r.intentions).toEqual({ oui: 1, 'peut-etre': 1, non: 1 });
    expect(r.raisons).toEqual({ horaires: 1, prix: 1 });
    expect(r.suggestions).toEqual(['Paiement en 3 fois', 'Un cours à 20h']);
    expect(JSON.stringify(r)).not.toMatch(/tel|nom|mail/i);
  });

  it('les libellés n’ont pas de doublon', () => {
    for (const l of [INTENTIONS, RAISONS]) expect(new Set(l.map((x) => x.id)).size).toBe(l.length);
  });
});

describe('mini-sondage après l’essai — conservation et lien', () => {
  it('douze mois', () => {
    expect(limiteConservation('2026-10-21')).toBe('2025-10-21');
    expect(limiteConservation('2026-03-31')).toBe('2025-03-31');
  });

  it('le message « merci » du bureau donne le lien du sondage', () => {
    expect(LIEN_SONDAGE).toBe(`${SITE_URL}/sondage-essai`);
    const href = relanceHref({ prenom: 'Léa', tel: '06 12 34 56 78', cours: 'Yoga', message: 'B' });
    expect(decodeURIComponent(href.split('?text=')[1])).toContain(LIEN_SONDAGE);
  });
});

describe('mini-sondage après l’essai — API', () => {
  const stock = new Map<string, unknown>();
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@netlify/blobs');
  });

  async function charger() {
    vi.resetModules();
    stock.clear();
    vi.doMock('@netlify/blobs', () => ({
      getStore: () => ({
        get: async (k: string) => stock.get(k) ?? null,
        setJSON: async (k: string, v: unknown) => void stock.set(k, v),
        list: async () => ({ blobs: [...stock.keys()].map((key) => ({ key })) }),
        delete: async (k: string) => void stock.delete(k),
      }),
    }));
    return (await import('../netlify/functions/sondage-essai.mjs')).traiter as (e: unknown) => Promise<{ statusCode: number; body: string }>;
  }
  const post = (corps: unknown, ip = '203.0.113.1') => ({
    httpMethod: 'POST',
    headers: { origin: SITE_URL, 'x-nf-client-connection-ip': ip },
    body: JSON.stringify(corps),
  });

  it('range une réponse anonyme : ni nom ni téléphone dans ce qui est gardé', async () => {
    const h = await charger();
    const r = await h(post({ intention: 'non', raison: 'prix', suggestion: 'Plus de cours le soir', telephone: '0600000001', nom: 'Exemple' }));
    expect(r.statusCode).toBe(200);
    expect(stock.size).toBe(1);
    const v = [...stock.values()][0] as Record<string, string>;
    expect(Object.keys(v).sort()).toEqual(['intention', 'le', 'raison', 'suggestion']);
    expect(JSON.stringify(v)).not.toMatch(/0600|Exemple/);
  }, { timeout: 20_000 });

  it('refuse une réponse sans intention, un envoi de robot ne range rien, la lecture demande la connexion', async () => {
    const h = await charger();
    expect((await h(post({ raison: 'prix' }, '203.0.113.2'))).statusCode).toBe(400);
    expect((await h(post({ intention: 'oui', 'bot-field': 'x' }, '203.0.113.3'))).statusCode).toBe(200);
    expect(stock.size).toBe(0);
    expect((await h({ httpMethod: 'GET', headers: {} })).statusCode).toBe(401);
  }, { timeout: 20_000 });

  it('refuse un envoi sans en-tête Origin (script) ou d’une origine étrangère : rien n’est rangé', async () => {
    const h = await charger();
    const sans = post({ intention: 'oui' }, '203.0.113.5');
    delete (sans.headers as Record<string, string>).origin;
    expect((await h(sans)).statusCode).toBe(403);
    const pirate = post({ intention: 'oui' }, '203.0.113.4');
    pirate.headers.origin = 'https://pirate.example';
    expect((await h(pirate)).statusCode).toBe(403);
    expect(stock.size).toBe(0);
  }, { timeout: 20_000 });
});
