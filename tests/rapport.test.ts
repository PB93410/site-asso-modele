import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ageAu, calculerRapport, rapportCsv, rapportPdf, trancheAge } from '../src/lib/rapport.js';

process.env.DEMO = '1';

describe('rapport annuel — totaux', () => {
  const maintenant = new Date(2026, 9, 12);

  it('exclut les fiches test et calcule la conversion', () => {
    const r = calculerRapport(
      {
        adherents: [
          { PRENOM: 'Ada', NOM: 'Lovelace', STATUT: 'À jour', DATE_NAISSANCE: '01/03/1960', VILLE: 'Villexemple' },
          { PRENOM: 'Bob', NOM: 'Martin', STATUT: 'En attente', DATE_NAISSANCE: '15/06/1990', VILLE: 'Commune A' },
          { PRENOM: 'Test', NOM: 'X', STATUT: 'À jour', DATE_NAISSANCE: '01/01/2000', VILLE: 'Villexemple' },
        ],
        essais: [
          { PRENOM: 'Ada', NOM: 'Lovelace', STATUT: 'Adhérent' },
          { PRENOM: 'Eve', NOM: 'Essai', STATUT: 'Venu' },
          { PRENOM: 'Test', NOM: 'Y', STATUT: 'Adhérent' },
        ],
        presences: [
          { PRENOM: 'Ada', NOM: 'Lovelace', COURS: 'Pilates' },
          { PRENOM: 'Test', NOM: 'X', COURS: 'Pilates' },
        ],
      },
      maintenant,
    );
    expect(r.adhérentsAJour).toBe(1);
    expect(r.adhesionsEnAttente).toBe(1);
    expect(r.essais).toBe(2);
    expect(r.essaisDevenusAdherents).toBe(1);
    expect(r.conversionEssaiPct).toBe(50);
    expect(r.presences).toBe(1);
    expect(r.parAge['60 ans et plus']).toBe(1);
    expect(r.parCommune.Villexemple).toBe(1);
    expect(r.parCours.Pilates).toBe(1);
    expect(trancheAge(ageAu('01/03/1960', maintenant))).toBe('60 ans et plus');
  });

  it('exporte CSV et un PDF minimal', () => {
    const r = calculerRapport({
      adherents: [{ PRENOM: 'Ada', NOM: 'L', STATUT: 'À jour', DATE_NAISSANCE: '1960', VILLE: 'Villexemple' }],
      essais: [],
      presences: [],
    });
    r.saison = '2026-2027';
    const csv = rapportCsv(r);
    expect(csv).toContain('Adhérents à jour');
    expect(csv).toContain('Villexemple');
    const pdf = rapportPdf(r, { nom: 'Association Sportive Exemple' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.includes(Buffer.from('%%EOF'))).toBe(true);
  });
});

describe('rapport — fonction démo', () => {
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
      return { ...m, MODULES: { ...(m.MODULES as object), rapport: true, bureau: true, presences: true } };
    });
    const { resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
    traiter = (await import('../netlify/functions/rapport.mjs')).traiter;
    const login = await (await import('../netlify/functions/bureau-auth.mjs')).traiter({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ password: 'demo' }),
    });
    auth = { authorization: `Bearer ${JSON.parse(login.body).token}` };
  }, 30_000);

  const call = (event: Record<string, unknown>) =>
    traiter({ headers: { ...auth }, queryStringParameters: {}, ...event });

  it('sert JSON, CSV et PDF', async () => {
    const json = JSON.parse((await call({ httpMethod: 'GET', queryStringParameters: { action: 'json' } })).body);
    expect(json.saison).toBeTruthy();
    expect(json.adhérentsAJour).toBeGreaterThan(0);
    const csv = await call({ httpMethod: 'GET', queryStringParameters: { action: 'csv' } });
    expect(csv.headers?.['Content-Type']).toMatch(/text\/csv/);
    expect(csv.body).toContain('Adhérents à jour');
    const pdf = await call({ httpMethod: 'GET', queryStringParameters: { action: 'pdf' } });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers?.['Content-Type']).toBe('application/pdf');
    expect(pdf.isBase64Encoded).toBe(true);
    expect(Buffer.from(pdf.body, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
  });
});
