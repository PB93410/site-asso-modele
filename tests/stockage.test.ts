import { beforeAll, describe, expect, it, vi } from 'vitest';

// Faux Netlify Blobs : mêmes règles de version (etag) que le vrai store.
type Entree = { data: unknown; etag: string };
const memoire = new Map<string, Entree>();
let version = 0;
const fauxStore = {
  async get(cle: string) {
    return memoire.get(cle)?.data ?? null;
  },
  async getWithMetadata(cle: string) {
    const e = memoire.get(cle);
    return e ? { data: e.data, etag: e.etag, metadata: {} } : null;
  },
  async setJSON(cle: string, valeur: unknown, opts: { onlyIfMatch?: string; onlyIfNew?: boolean } = {}) {
    const e = memoire.get(cle);
    if (opts.onlyIfNew && e) return { modified: false };
    if (opts.onlyIfMatch && e?.etag !== opts.onlyIfMatch) return { modified: false };
    version += 1;
    memoire.set(cle, { data: JSON.parse(JSON.stringify(valeur)), etag: `"v${version}"` });
    return { modified: true, etag: `"v${version}"` };
  },
  async delete(cle: string) {
    memoire.delete(cle);
  },
  async list() {
    return { blobs: [...memoire.keys()].map((key) => ({ key, etag: memoire.get(key)!.etag })) };
  },
};
vi.mock('@netlify/blobs', () => ({ getStore: () => fauxStore, connectLambda: () => {} }));

process.env.STOCKAGE = 'netlify';
delete process.env.DEMO;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
process.env.BUREAU_PASSWORD = 'phrase de test assez longue';
process.env.BUREAU_SECRET = 'secret-de-test-0123456789abcdef0123456789';
process.env.MAIL_ENVOI = 'aucun';

type Handler = (event: Record<string, unknown>) => Promise<{ statusCode: number; body: string; headers?: Record<string, string> }>;
const fn = async (name: string): Promise<Handler> => (await import(`../netlify/functions/${name}.mjs`)).traiter;
const call = async (name: string, event: Record<string, unknown>) =>
  (await fn(name))({ headers: {}, queryStringParameters: {}, ...event });
const json = (r: { body: string }) => JSON.parse(r.body);

describe('stockage Netlify — classeur sur Blobs', () => {
  it('choisit Netlify sans compte Google, Google avec, ou ce qui est demandé', async () => {
    const { modeStockage } = await import('../netlify/functions/_stockage.mjs');
    expect(modeStockage({}, false)).toBe('netlify');
    expect(modeStockage({ GOOGLE_SERVICE_ACCOUNT_JSON: '{}' }, false)).toBe('google');
    expect(modeStockage({ GOOGLE_SERVICE_ACCOUNT_JSON: '{}', STOCKAGE: 'Netlify' }, false)).toBe('netlify');
    expect(modeStockage({}, true)).toBe('demo');
  });

  it('un onglet jamais écrit part de ses en-têtes', async () => {
    const { blobSheets } = await import('../netlify/functions/_stockage.mjs');
    const v = blobSheets({ seed: () => [['NOM', 'TEL']] }).spreadsheets.values;
    const lu = await v.get({ spreadsheetId: 'test-vierge', range: "'Essais'!A:Z" });
    expect(lu.data.values).toEqual([['NOM', 'TEL']]);
    expect(memoire.has('test-vierge/Essais')).toBe(false);
  });

  it('ajouts simultanés : aucune ligne perdue', async () => {
    const { blobSheets } = await import('../netlify/functions/_stockage.mjs');
    const v = blobSheets({ seed: () => [['NOM']] }).spreadsheets.values;
    const range = "'Essais'!A:Z";
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => v.append({ spreadsheetId: 'test-concurrence', range, requestBody: { values: [[`P${i}`]] } })),
    );
    const rows = (await v.get({ spreadsheetId: 'test-concurrence', range })).data.values;
    expect(rows.length).toBe(13);
    expect(new Set(rows.slice(1).map((r: string[]) => r[0])).size).toBe(12);
  });

  it('modifie une cellule sans toucher aux autres', async () => {
    const { blobSheets } = await import('../netlify/functions/_stockage.mjs');
    const v = blobSheets({ seed: () => [['NOM', 'STATUT'], ['Marie', 'À venir']] }).spreadsheets.values;
    await v.batchUpdate({ spreadsheetId: 'test-maj', requestBody: { data: [{ range: "'Essais'!B2", values: [['Venu']] }] } });
    expect((await v.get({ spreadsheetId: 'test-maj', range: "'Essais'!A:Z" })).data.values).toEqual([
      ['NOM', 'STATUT'],
      ['Marie', 'Venu'],
    ]);
  });
});

describe('stockage Netlify — le vrai code des fonctions, sans Google', () => {
  let H: Record<string, string>;

  beforeAll(async () => {
    const r = await call('bureau-auth', { httpMethod: 'POST', body: JSON.stringify({ password: process.env.BUREAU_PASSWORD }) });
    expect(r.statusCode).toBe(200);
    H = { authorization: `Bearer ${json(r).token}` };
  }, 30_000);

  it('une demande d’essai du site arrive dans le bureau', async () => {
    const r = await call('essai', { httpMethod: 'POST', body: JSON.stringify({ prenom: 'Zoé', nom: 'Blob', telephone: '0600000099', cours: 'Pilates' }) });
    expect(r.statusCode).toBe(200);
    const ess = json(await call('essais-list', { httpMethod: 'GET', headers: H }));
    expect(ess.essais.map((e: { prenom: string }) => e.prenom)).toEqual(['Zoé']);
    expect(ess.essaisSheetUrl).toBe('');
  }, 30_000);

  it('le planning part du CSV du site, puis se modifie depuis le bureau', async () => {
    const lu = json(await call('site-content', { httpMethod: 'GET', headers: H }));
    expect(lu.planning.length).toBeGreaterThan(0);
    const planning = [{ day: 'Samedi', time: '10h00 – 11h00', course: lu.planning[0].course, location: lu.planning[0].location, note: '' }];
    const put = await call('site-content', { httpMethod: 'PUT', headers: H, body: JSON.stringify({ planning }) });
    expect(put.statusCode).toBe(200);
    const pub = await call('sheet', { httpMethod: 'GET', queryStringParameters: { tab: 'planning' } });
    expect(pub.statusCode).toBe(200);
    expect(pub.body).toContain('Samedi');
  }, 30_000);
});

describe('stockage Netlify — adhésion, encaissement, numéro de carte', () => {
  it('du formulaire à la carte, sans Google', async () => {
    const { PAYMENT_MODES } = await import('../asso.derive.js');
    const mode = PAYMENT_MODES.find((m: string) => !m.startsWith('Chèque'));
    const r = await call('adhesion', {
      httpMethod: 'POST',
      body: JSON.stringify({
        prenom: 'Marie', nom: 'Blob', telephone: '0600000077', email: 'marie@example.fr',
        date_naissance: '01/02/1960', mode_paiement: mode, droit_image: 'Oui', qs_sport: 'Oui',
      }),
    });
    expect(r.statusCode, r.body).toBe(200);
    const auth = await call('bureau-auth', { httpMethod: 'POST', body: JSON.stringify({ password: process.env.BUREAU_PASSWORD }) });
    const H = { authorization: `Bearer ${json(auth).token}` };
    const pending = json(await call('adhesions-pending', { httpMethod: 'GET', headers: H }));
    const fiche = pending.items.find((a: { prenom: string }) => a.prenom === 'Marie');
    expect(fiche).toBeTruthy();
    expect(pending.adherentsSheetUrl).toBe('');
    const ok = await call('adhesion-validate', { httpMethod: 'POST', headers: H, body: JSON.stringify({ row: fiche.row, tel: '0600000077', statut: 'À jour' }) });
    expect(ok.statusCode, ok.body).toBe(200);
    const num = await call('carte-marquer', { httpMethod: 'POST', headers: H, body: JSON.stringify({ row: fiche.row, tel: '0600000077' }) });
    expect(num.statusCode, num.body).toBe(200);
    const apres = json(await call('adhesions-pending', { httpMethod: 'GET', headers: H }));
    const a = apres.all.find((x: { prenom: string }) => x.prenom === 'Marie');
    expect(a.statut).toBe('À jour');
    expect(a.numero).toMatch(/-001$/);
  }, 60_000);
});

describe('export Excel et sauvegarde hebdomadaire', () => {
  it('le bureau télécharge un vrai fichier Excel', async () => {
    const auth = await call('bureau-auth', { httpMethod: 'POST', body: JSON.stringify({ password: process.env.BUREAU_PASSWORD }) });
    const H = { authorization: `Bearer ${json(auth).token}` };
    const r = await call('bureau-export', { httpMethod: 'GET', headers: H });
    expect(r.statusCode).toBe(200);
    expect(r.headers?.['Content-Disposition']).toMatch(/attachment; filename=".+\.xlsx"/);
    const fichier = Buffer.from(r.body, 'base64');
    expect(fichier.subarray(0, 2).toString()).toBe('PK');
    expect((await call('bureau-export', { httpMethod: 'GET' })).statusCode).toBe(401);
  }, 30_000);

  it('cellules en texte : zéro de tête gardé, formule jamais calculée', async () => {
    const { classeurXlsx, crc32 } = await import('../netlify/functions/_xlsx.mjs');
    const { inflateRawSync } = await import('node:zlib');
    const f = classeurXlsx([{ nom: 'Adhérents', lignes: [['TEL', 'NOTE'], ['0612345678', '=HYPERLINK("x") & <b>']] }]);
    // Lit la feuille dans l'archive.
    let i = f.indexOf(Buffer.from('xl/worksheets/sheet1.xml'));
    i -= 30;
    const taille = f.readUInt32LE(i + 18);
    const nom = f.readUInt16LE(i + 26);
    const data = inflateRawSync(f.subarray(i + 30 + nom, i + 30 + nom + taille));
    expect(crc32(data)).toBe(f.readUInt32LE(i + 14));
    const x = data.toString();
    expect(x).toContain('t="inlineStr"><is><t xml:space="preserve">0612345678</t>');
    expect(x).toContain('=HYPERLINK(&quot;x&quot;) &amp; &lt;b&gt;');
    expect(x).not.toContain('<f>');
  });

  it('sauvegarde : seulement en stockage Netlify, avec un envoi de mail, sauf si coupée', async () => {
    const { sauvegardeActive } = await import('../netlify/functions/sauvegarde-hebdo.mjs');
    expect(sauvegardeActive({ STOCKAGE: 'netlify', SMTP_HOST: 'h' })).toBe(true);
    expect(sauvegardeActive({ STOCKAGE: 'netlify' })).toBe(false);
    expect(sauvegardeActive({ GOOGLE_SERVICE_ACCOUNT_JSON: '{}', SMTP_HOST: 'h' })).toBe(false);
    expect(sauvegardeActive({ STOCKAGE: 'netlify', SMTP_HOST: 'h', SAUVEGARDE_MAIL: 'non' })).toBe(false);
  });

  it('sauvegarde : le fichier part en pièce jointe à la boîte de l’asso', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    vi.stubGlobal('fetch', fetch);
    process.env.MAIL_ENVOI = 'brevo';
    process.env.BREVO_API_KEY = 'cle-test';
    try {
      const { envoyerSauvegarde } = await import('../netlify/functions/sauvegarde-hebdo.mjs');
      const nom = await envoyerSauvegarde(new Date('2026-10-12T06:00:00Z'));
      expect(nom).toMatch(/-sauvegarde-2026-10-12\.xlsx$/);
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.attachment[0].name).toBe(nom);
      expect(Buffer.from(body.attachment[0].content, 'base64').subarray(0, 2).toString()).toBe('PK');
    } finally {
      process.env.MAIL_ENVOI = 'aucun';
      delete process.env.BREVO_API_KEY;
      vi.unstubAllGlobals();
    }
  });
});
