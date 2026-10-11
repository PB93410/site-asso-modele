import { beforeAll, describe, expect, it, vi } from 'vitest';

// Le mode démo se lit au chargement des fonctions : à poser avant tout import dynamique.
process.env.DEMO = '1';

type Handler = (event: Record<string, unknown>) => Promise<{ statusCode: number; body: string; headers?: Record<string, string> }>;
const fn = async (name: string): Promise<Handler> => (await import(`../netlify/functions/${name}.mjs`)).handler;
const call = async (name: string, event: Record<string, unknown>) =>
  (await fn(name))({ headers: {}, queryStringParameters: {}, ...event });
const json = (r: { body: string }) => JSON.parse(r.body);

describe('mode démo — faux classeur', () => {
  it('lit les plages A1', async () => {
    const { parseA1 } = await import('../netlify/functions/_demo.mjs');
    expect(parseA1("'Saison 2026-2027'!S12")).toEqual({ tab: 'Saison 2026-2027', col: 18, row: 11 });
    expect(parseA1("'L''atelier'!A:Z")).toEqual({ tab: "L'atelier", col: 0, row: null });
    expect(parseA1('PLANNING!A5:Z')).toEqual({ tab: 'PLANNING', col: 0, row: 4 });
  });

  it('ajoute, modifie et efface comme Google Sheets', async () => {
    const { demoSheets, DEMO_IDS, resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
    const v = demoSheets().spreadsheets.values;
    const get = async () => (await v.get({ spreadsheetId: DEMO_IDS.site, range: "'PLANNING'!A:Z" })).data.values;
    const n = (await get()).length;
    const res = await v.append({ spreadsheetId: DEMO_IDS.site, range: "'PLANNING'!A:Z", requestBody: { values: [['Samedi', '10h00', 'Yoga', 'Salle', '']] } });
    expect(res.data.updates.updatedRange).toBe(`'PLANNING'!A${n + 1}:Z${n + 1}`);
    await v.batchUpdate({ spreadsheetId: DEMO_IDS.site, requestBody: { data: [{ range: `'PLANNING'!C${n + 1}`, values: [["'Stretching"]] }] } });
    expect((await get())[n][2]).toBe('Stretching');
    await v.clear({ spreadsheetId: DEMO_IDS.site, range: "'PLANNING'!A2:Z" });
    expect((await get()).length).toBe(1);
    resetDemo();
  });
});

describe('mode démo — le vrai code des fonctions, sans Google', () => {
  let H: Record<string, string>;

  beforeAll(async () => {
    const r = await call('bureau-auth', { httpMethod: 'POST', body: JSON.stringify({ password: 'demo' }) });
    expect(r.statusCode).toBe(200);
    H = { authorization: `Bearer ${json(r).token}` };
  }, 30_000);

  it('le bureau voit les essais et les adhésions fictifs', async () => {
    const ess = json(await call('essais-list', { httpMethod: 'GET', headers: H }));
    expect(ess.essais.length).toBeGreaterThan(5);
    const adh = json(await call('adhesions-pending', { httpMethod: 'GET', headers: H }));
    expect(adh.items.length).toBeGreaterThan(0);
    expect(adh.all.some((a: { statut: string }) => a.statut === 'À jour')).toBe(true);
  });

  it('une demande d’essai du site arrive dans le bureau', async () => {
    const r = await call('essai', { httpMethod: 'POST', body: JSON.stringify({ prenom: 'Zoé', nom: 'Démo', telephone: '0600000099', cours: 'Pilates' }) });
    expect(r.statusCode).toBe(200);
    const ess = json(await call('essais-list', { httpMethod: 'GET', headers: H }));
    expect(ess.essais.some((e: { prenom: string }) => e.prenom === 'Zoé')).toBe(true);
  }, 30_000);

  it('mail, agenda et carte fonctionnent avec des données fictives', async () => {
    const mail = json(await call('bureau-mail', { httpMethod: 'GET', path: '/api/bureau/mail', headers: H }));
    expect(mail.messages.length).toBeGreaterThan(0);
    const agenda = await call('bureau-agenda', {
      httpMethod: 'GET',
      path: '/api/bureau/agenda',
      headers: H,
      queryStringParameters: { from: '2020-01-01', to: '2099-12-31' },
    });
    expect(json(agenda).events.length).toBeGreaterThan(0);
    const adh = json(await call('adhesions-pending', { httpMethod: 'GET', headers: H }));
    const row = adh.all.find((a: { statut: string; numero?: string }) => a.statut === 'À jour' && a.numero).row;
    const img = await call('carte-image', { httpMethod: 'GET', headers: H, queryStringParameters: { row: String(row) } });
    expect(img.statusCode).toBe(200);
    expect(img.headers?.['Content-Type']).toBe('image/png');
  }, 30_000);
});

describe('fonctions désactivées (asso.config.js → modules)', () => {
  it('formulaire d’essai et bureau répondent « pas activé »', async () => {
    vi.resetModules();
    vi.doMock('../asso.derive.js', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      MODULES: { essais: false, adhesion: true, bureau: false, mail: false },
    }));
    const essai = await call('essai', { httpMethod: 'POST', body: '{}' });
    expect(essai.statusCode).toBe(404);
    expect(json(essai).error).toContain('pas activé');
    const auth = await call('bureau-auth', { httpMethod: 'POST', body: JSON.stringify({ password: 'demo' }) });
    expect(auth.statusCode).toBe(404);
    vi.doUnmock('../asso.derive.js');
  }, 30_000);
});
