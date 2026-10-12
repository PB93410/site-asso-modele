import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@netlify/blobs', async () => (await import('./fauxBlobs')).fauxBlobs().module);

process.env.STOCKAGE = 'netlify';
delete process.env.DEMO;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
delete process.env.GOOGLE_REFRESH_TOKEN;
process.env.BUREAU_PASSWORD = 'phrase de test assez longue';
process.env.BUREAU_SECRET = 'secret-de-test-0123456789abcdef0123456789';

type Handler = (event: Record<string, unknown>) => Promise<{ statusCode: number; body: string; headers?: Record<string, string> }>;
const call = async (name: string, event: Record<string, unknown>) =>
  ((await import(`../netlify/functions/${name}.mjs`)).traiter as Handler)({ headers: {}, queryStringParameters: {}, ...event });
const json = (r: { body: string }) => JSON.parse(r.body);

describe('agenda — format .ics', () => {
  it('heure de Paris → UTC, été comme hiver', async () => {
    const { versDate } = await import('../netlify/functions/_agenda.mjs');
    expect(versDate('2026-07-14T10:00:00').toISOString()).toBe('2026-07-14T08:00:00.000Z');
    expect(versDate('2026-12-01T10:00').toISOString()).toBe('2026-12-01T09:00:00.000Z');
    expect(versDate('2026-03-29T03:30:00').toISOString()).toBe('2026-03-29T01:30:00.000Z');
    expect(versDate('2026-09-08T10:00:00+02:00').toISOString()).toBe('2026-09-08T08:00:00.000Z');
  });

  it('protège le texte et coupe les lignes longues sans casser les accents', async () => {
    const { calendrierIcs, plier, texteIcs } = await import('../netlify/functions/_agenda.mjs');
    expect(texteIcs('AG; salle 2, étage\nentrée B')).toBe('AG\\; salle 2\\, étage\\nentrée B');
    const long = `DESCRIPTION:${'é'.repeat(100)}`;
    const lignes = plier(long).split('\r\n');
    expect(lignes.length).toBeGreaterThan(1);
    for (const l of lignes) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
    expect(lignes.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(long);
    const ics = calendrierIcs(
      [{ id: 'a1', summary: 'Assemblée générale', location: 'Gymnase', start: { dateTime: '2026-11-20T19:00:00' }, end: { dateTime: '2026-11-20T21:00:00' } }],
      { maintenant: new Date('2026-10-12T00:00:00Z'), domaine: 'club.fr' },
    );
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('UID:a1@club.fr\r\nDTSTAMP:20261012T000000Z\r\nDTSTART:20261120T180000Z\r\nDTEND:20261120T200000Z\r\nSUMMARY:Assemblée générale');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('lien secret : stable, dérivé du secret, vide sans secret', async () => {
    const { cleAbonnement, lienAbonnement } = await import('../netlify/functions/_agenda.mjs');
    const env = { BUREAU_SECRET: 'x'.repeat(40) };
    expect(cleAbonnement(env)).toMatch(/^[0-9a-f]{32}$/);
    expect(cleAbonnement(env)).toBe(cleAbonnement({ ...env }));
    expect(cleAbonnement({ BUREAU_SECRET: 'y'.repeat(40) })).not.toBe(cleAbonnement(env));
    expect(cleAbonnement({ AGENDA_ICS_CLE: 'ma-cle' })).toBe('ma-cle');
    expect(lienAbonnement({}, 'https://club.fr')).toBe('');
    expect(lienAbonnement(env, 'https://club.fr/')).toBe(`https://club.fr/api/agenda.ics?cle=${cleAbonnement(env)}`);
  });

  it('choisit Netlify sans Google, Google si le compte est connecté', async () => {
    const { modeAgenda } = await import('../netlify/functions/_agenda.mjs');
    expect(modeAgenda({}, false)).toBe('netlify');
    expect(modeAgenda({ GOOGLE_REFRESH_TOKEN: 't' }, false)).toBe('google');
    expect(modeAgenda({ GOOGLE_REFRESH_TOKEN: 't', AGENDA: 'netlify' }, false)).toBe('netlify');
  });
});

describe('agenda sur Netlify — le vrai code des fonctions', () => {
  let H: Record<string, string>;
  beforeAll(async () => {
    const r = await call('bureau-auth', { httpMethod: 'POST', body: JSON.stringify({ password: process.env.BUREAU_PASSWORD }) });
    H = { authorization: `Bearer ${json(r).token}` };
  }, 30_000);

  it('créer, modifier, lister, s’abonner, supprimer', async () => {
    const cree = await call('bureau-agenda', {
      httpMethod: 'POST',
      path: '/api/bureau/agenda',
      headers: H,
      body: JSON.stringify({ title: 'Réunion du bureau', date: '2026-11-03', startTime: '18:30', endTime: '20:00', location: 'Salle B' }),
    });
    expect(cree.statusCode, cree.body).toBe(201);
    const id = json(cree).event.id;
    const modif = await call('bureau-agenda', { httpMethod: 'PATCH', path: `/api/bureau/agenda/${id}`, headers: H, body: JSON.stringify({ startTime: '19:00' }) });
    expect(json(modif).event.startTime).toBe('19:00');

    const liste = json(
      await call('bureau-agenda', { httpMethod: 'GET', path: '/api/bureau/agenda', headers: H, queryStringParameters: { from: '2026-11-01', to: '2026-11-30' } }),
    );
    expect(liste.events.map((e: { title: string }) => e.title)).toEqual(['Réunion du bureau']);
    const cle = new URL(liste.abonnement).searchParams.get('cle');

    const ics = await call('agenda-ics', { httpMethod: 'GET', queryStringParameters: { cle } });
    expect(ics.statusCode).toBe(200);
    expect(ics.headers?.['Content-Type']).toMatch(/text\/calendar/);
    expect(ics.body).toContain('SUMMARY:Réunion du bureau');
    expect(ics.body).toContain('DTSTART:20261103T180000Z');
    expect((await call('agenda-ics', { httpMethod: 'GET', queryStringParameters: { cle: 'mauvaise' } })).statusCode).toBe(404);
    expect((await call('agenda-ics', { httpMethod: 'GET' })).statusCode).toBe(404);

    expect((await call('bureau-agenda', { httpMethod: 'DELETE', path: `/api/bureau/agenda/${id}`, headers: H })).statusCode).toBe(200);
    expect((await call('bureau-agenda', { httpMethod: 'DELETE', path: `/api/bureau/agenda/${id}`, headers: H })).statusCode).toBe(404);
  }, 30_000);

  it('sans connexion au bureau : refusé', async () => {
    const r = await call('bureau-agenda', { httpMethod: 'GET', path: '/api/bureau/agenda', queryStringParameters: { from: '2026-11-01', to: '2026-11-30' } });
    expect(r.statusCode).toBe(401);
  });
});
