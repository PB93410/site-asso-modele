import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimEncoreValable,
  estComplet,
  expireLe,
  filePour,
  occupesAdhesion,
  occupesEssai,
  signerClaim,
  verifierClaim,
  waHref,
} from '../src/lib/listeAttente.js';

process.env.DEMO = '1';

describe('liste d’attente — règles', () => {
  it('compte les places occupées et ignore les fiches test', () => {
    const essais = [
      { PRENOM: 'Ada', NOM: 'Lovelace', STATUT: 'À venir', COURS: 'Pilates', CRENEAU: 'Lundi 10h' },
      { PRENOM: 'Bob', NOM: 'Martin', STATUT: 'Confirmé', COURS: 'Pilates', CRENEAU: 'Lundi 10h00' },
      { PRENOM: 'Test', NOM: 'X', STATUT: 'À venir', COURS: 'Pilates', CRENEAU: 'Lundi 10h' },
      { PRENOM: 'Eve', NOM: 'Annul', STATUT: 'Annulé', COURS: 'Pilates', CRENEAU: 'Lundi 10h' },
    ];
    expect(occupesEssai(essais, 'Pilates', 'Lundi 10h').map((e) => e.PRENOM)).toEqual(['Ada', 'Bob']);
    expect(estComplet({ occupes: 20, file: 0, capacite: 20 })).toBe(true);
    expect(estComplet({ occupes: 19, file: 0, capacite: 20 })).toBe(false);
  });

  it('compte les adhésions à jour sur le cours, pas les arrêts', () => {
    const adh = [
      { PRENOM: 'Ada', NOM: 'L', STATUT: 'À jour', NOTES: 'Cours: Pilates' },
      { PRENOM: 'Bob', NOM: 'M', STATUT: 'En attente', NOTES: 'Cours: Pilates' },
      { PRENOM: 'Eve', NOM: 'A', STATUT: 'Arrêt', NOTES: 'Cours: Pilates' },
      { PRENOM: 'Test', NOM: 'X', STATUT: 'À jour', NOTES: 'Cours: Pilates' },
    ];
    expect(occupesAdhesion(adh, 'Pilates')).toHaveLength(1);
  });

  it('ordonne la file et signe le lien de place', () => {
    const file = filePour(
      [
        { TYPE: 'essai', COURS: 'Pilates', CRENEAU: 'Lundi 10h', STATUT: 'attente', RANG: '2', DATE: 'b' },
        { TYPE: 'essai', COURS: 'Pilates', CRENEAU: 'Lundi 10h', STATUT: 'notifie', RANG: '1', DATE: 'a' },
        { TYPE: 'essai', COURS: 'Zumba', CRENEAU: 'Lundi 10h', STATUT: 'attente', RANG: '1', DATE: 'c' },
      ],
      'essai',
      'Pilates',
      'Lundi 10h',
    );
    expect(file.map((l) => l.RANG)).toEqual(['1', '2']);
    const secret = 'demo-secret-non-confidentiel-0123456789abcdef';
    const t = signerClaim('la-1', secret);
    expect(verifierClaim('la-1', t, secret)).toBe(true);
    expect(verifierClaim('la-2', t, secret)).toBe(false);
    const exp = expireLe(48, new Date('2026-10-12T10:00:00.000Z'));
    expect(claimEncoreValable({ STATUT: 'notifie', EXPIRE_LE: exp }, new Date('2026-10-12T11:00:00.000Z'))).toBe(true);
    expect(claimEncoreValable({ STATUT: 'attente', EXPIRE_LE: exp }, new Date('2026-10-12T11:00:00.000Z'))).toBe(false);
    expect(waHref('0612345678', 'bonjour')).toMatch(/^https:\/\/wa\.me\/33612345678\?text=/);
  });
});

describe('liste d’attente — fonction démo', () => {
  type Handler = (event: Record<string, unknown>) => Promise<{ statusCode: number; body: string }>;
  let traiter: Handler;
  let auth: Record<string, string>;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock('../asso.derive.js', async (orig) => {
      const m = await orig<Record<string, unknown>>();
      return { ...m, MODULES: { ...(m.MODULES as object), listeAttente: true, bureau: true, mail: true } };
    });
    const { resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
    traiter = (await import('../netlify/functions/liste-attente.mjs')).traiter;
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

  it('le bureau voit la file démo et peut prévenir', async () => {
    const files = JSON.parse((await call({ httpMethod: 'GET', queryStringParameters: { action: 'files' } })).body);
    expect(files.files.length).toBeGreaterThan(0);
    const l = files.files[0];
    const notif = JSON.parse(
      (
        await call({
          httpMethod: 'POST',
          body: JSON.stringify({ action: 'notifier', type: l.TYPE, cours: l.COURS, creneau: l.CRENEAU }),
        })
      ).body,
    );
    expect(notif.ok).toBe(true);
    expect(notif.whatsapp).toMatch(/^https:\/\/wa\.me\//);
    expect(notif.url).toContain('/liste-attente/place?t=');
  });

  it('GET claim ne consomme pas, POST accepte', async () => {
    const apercu = await call({
      httpMethod: 'GET',
      queryStringParameters: { action: 'claim', t: 'demo-token-liste-attente-0001' },
    });
    expect(apercu.statusCode).toBe(200);
    expect(JSON.parse(apercu.body).ok).toBe(true);
    const encore = await call({
      httpMethod: 'GET',
      queryStringParameters: { action: 'claim', t: 'demo-token-liste-attente-0001' },
    });
    expect(JSON.parse(encore.body).deja).toBeFalsy();
    const ok = await call({
      httpMethod: 'POST',
      body: JSON.stringify({ action: 'claim', token: 'demo-token-liste-attente-0001' }),
    });
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body)).toMatchObject({ ok: true });
    const deja = await call({
      httpMethod: 'GET',
      queryStringParameters: { action: 'claim', t: 'demo-token-liste-attente-0001' },
    });
    expect(JSON.parse(deja.body).deja).toBe(true);
  });
});
