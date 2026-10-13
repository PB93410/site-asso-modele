/** Paiement en ligne avec les modules aides (reste à payer) et liste d'attente. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@netlify/blobs', async () => (await import('./fauxBlobs')).fauxBlobs().module);
vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<Record<string, unknown>>();
  return { ...m, MODULES: { ...(m.MODULES as object), financement: true, listeAttente: true } };
});
// Un seul cours complet : « Zumba ».
vi.mock('../netlify/functions/_liste-attente.mjs', () => ({
  etatPlace: async ({ cours }: { cours: string }) => ({ complet: cours === 'Zumba' }),
  inscrireFile: async () => ({ rang: 3 }),
  notifierSuivant: async () => ({ ok: false }),
}));

process.env.STOCKAGE = 'netlify';
delete process.env.DEMO;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
process.env.MAIL_ENVOI = 'aucun';

const HA = { HELLOASSO_CLIENT_ID: 'id-test', HELLOASSO_CLIENT_SECRET: 'secret-test', HELLOASSO_ORGANISATION: 'asso-exemple', SITE_ORIGIN: 'https://club.fr' };

type Reponse = { statusCode: number; body: string; headers?: Record<string, string> };
const call = async (name: string, event: Record<string, unknown>): Promise<Reponse> =>
  (await import(`../netlify/functions/${name}.mjs`)).traiter({ headers: {}, queryStringParameters: {}, ...event });

/** Faux HelloAsso : garde les corps envoyés, paie au montant demandé. */
const intentions = new Map<number, Record<string, unknown>>();
const payes = new Set<number>();
let suivant = 500;
const repondre = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
async function fauxFetch(url: string, init: RequestInit = {}) {
  if (url.endsWith('/oauth2/token')) return repondre(200, { access_token: 'j', expires_in: 1800 });
  const m = url.match(/checkout-intents(?:\/(\d+))?$/);
  if (!m) return repondre(404, {});
  if (init.method === 'POST') {
    suivant += 1;
    intentions.set(suivant, JSON.parse(String(init.body)));
    return repondre(200, { id: suivant, redirectUrl: `https://checkout.exemple/${suivant}` });
  }
  const id = Number(m[1]);
  const c = intentions.get(id)!;
  const order = payes.has(id) ? { id: 1, amount: { total: c.totalAmount }, payments: [{ amount: c.totalAmount, state: 'Authorized' }] } : undefined;
  return repondre(200, { id, metadata: c.metadata, ...(order ? { order } : {}) });
}

describe('paiement en ligne + aides + liste d’attente', () => {
  const env0 = { ...process.env };
  let MODE_CARTE = '';
  beforeAll(async () => {
    Object.assign(process.env, HA);
    vi.stubGlobal('fetch', fauxFetch);
    MODE_CARTE = (await import('../asso.derive.js')).MODE_CARTE;
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(HA)) delete process.env[k];
    Object.assign(process.env, env0);
  });

  const inscrire = async (prenom: string, telephone: string, extra: Record<string, string>) => {
    const r = await call('adhesion', {
      httpMethod: 'POST',
      body: JSON.stringify({
        prenom, nom: 'Aides', telephone, email: 'x@exemple.fr', date_naissance: '01/02/1960',
        mode_paiement: MODE_CARTE, droit_image: 'Oui', qs_sport: 'Oui', ...extra,
      }),
    });
    expect(r.statusCode, r.body).toBe(200);
    return JSON.parse(r.body);
  };

  it('Pass’Sport : HelloAsso encaisse le reste à payer, et c’est ce montant qui est vérifié', async () => {
    const { ASSO } = await import('../asso.derive.js');
    const reste = ASSO.adhesion.tarif - ASSO.financement.passSport;
    const d = await inscrire('Paul', '0600000091', { pass_sport: 'oui', cours: 'Pilates' });
    expect(d.montant).toBe(String(reste));
    expect(d.paiementUrl).toBeTruthy();
    const go = await call('paiement', { httpMethod: 'GET', queryStringParameters: { ref: d.reference } });
    const id = Number(go.headers?.Location.split('/').pop());
    expect(intentions.get(id)).toMatchObject({ totalAmount: reste * 100, initialAmount: reste * 100 });
    payes.add(id);
    const ret = await call('paiement-retour', { httpMethod: 'GET', queryStringParameters: { ref: d.reference, checkoutIntentId: String(id) } });
    expect(ret.headers?.Location).toContain('paiement=ok');
  }, 60_000);

  it('cours complet : sur liste d’attente, pas de lien de paiement', async () => {
    const d = await inscrire('Lou', '0600000092', { cours: 'Zumba' });
    expect(d.listeAttente).toBe(true);
    expect(d.reference).toBeTruthy();
    expect(d.paiementUrl).toBeUndefined();
  }, 60_000);
});
