import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  attestationPdf,
  expireDans,
  fabriquerPdf,
  fichePublique,
  montantPaye,
  numeroRecu,
  recuFiscalEligible,
  signerAcces,
  trouverAdherent,
  typesDisponibles,
  verifierAcces,
} from '../src/lib/attestations.js';

process.env.DEMO = '1';

const asso = {
  nom: 'Association Sportive Exemple',
  nomCourt: 'ASE',
  sigle: 'ASE',
  ville: 'Villexemple',
  siege: '1 place de la Mairie, 00000 Villexemple',
  rna: 'W000000000',
  siret: '',
  accroche: 'Gym, Pilates, Zumba',
  responsablePublication: 'La présidente',
  adhesion: { tarif: 140, inclus: 'licence et assurance' },
  saison: { label: '2026-2027', reprise: '2026-09-07' },
  attestations: { recuFiscal: false, objet: '' },
};

const fiche = {
  PRENOM: 'Emma',
  NOM: 'LAURENT',
  NUMERO: 'ASE-2627-001',
  MAIL: 'emma.laurent@example.fr',
  STATUT: 'À jour',
  MONTANT: '140',
  MODE: 'Chèque',
  DATE_PAIEMENT: '01/09/2026',
  ADRESSE: '1 rue de l’Exemple',
  CP: '00000',
  VILLE: 'Villexemple',
};

describe('attestations — règles', () => {
  it('n’offre le reçu fiscal que si l’asso est éligible', () => {
    expect(typesDisponibles(asso)).toEqual(['adhesion', 'ce']);
    expect(recuFiscalEligible({ attestations: { recuFiscal: true } })).toBe(true);
    expect(typesDisponibles({ attestations: { recuFiscal: true } })).toEqual(['adhesion', 'fiscal', 'ce']);
  });

  it('retrouve la fiche et calcule le montant', () => {
    expect(trouverAdherent([fiche], 'ase-2627-001', 'Emma.Laurent@example.fr')).toMatchObject({ PRENOM: 'Emma' });
    expect(trouverAdherent([fiche], 'ASE-2627-001', 'autre@example.fr')).toBeNull();
    expect(montantPaye(fiche, asso)).toBe(140);
    expect(montantPaye({}, asso)).toBe(140);
    expect(numeroRecu(asso, 'ASE-2627-001')).toMatch(/^ASE-20262027-/);
  });

  it('signe un lien et le refuse une fois expiré', () => {
    const secret = 'demo-secret-non-confidentiel-0123456789abcdef';
    const exp = expireDans(2, new Date('2026-10-12T10:00:00Z'));
    const token = signerAcces({ numero: 'ASE-2627-001', mail: 'emma.laurent@example.fr', exp }, secret);
    expect(
      verifierAcces(
        { numero: 'ASE-2627-001', mail: 'emma.laurent@example.fr', exp, token },
        secret,
        new Date('2026-10-12T11:00:00Z'),
      ),
    ).toBe(true);
    expect(
      verifierAcces(
        { numero: 'ASE-2627-001', mail: 'emma.laurent@example.fr', exp, token },
        secret,
        new Date('2026-10-13T10:01:00Z'),
      ),
    ).toBe(false);
    expect(
      verifierAcces(
        { numero: 'ASE-2627-002', mail: 'emma.laurent@example.fr', exp, token },
        secret,
        new Date('2026-10-12T11:00:00Z'),
      ),
    ).toBe(false);
  });

  it('fabrique les trois PDF (fiscal seulement si éligible)', () => {
    const p = fichePublique(fiche, asso);
    expect(p.prenom).toBe('Emma');
    const adh = attestationPdf('adhesion', { asso, fiche, aujourdHui: new Date('2026-10-12') });
    expect(adh.subarray(0, 5).toString()).toBe('%PDF-');
    expect(adh.includes(Buffer.from('adherent'))).toBe(true);
    expect(() => attestationPdf('fiscal', { asso, fiche })).toThrow(/eligible|éligible/i);
    const fiscal = attestationPdf('fiscal', {
      asso: { ...asso, attestations: { recuFiscal: true, objet: 'sport pour tous' } },
      fiche,
    });
    expect(fiscal.includes(Buffer.from('11580'))).toBe(true);
    expect(fiscal.includes(Buffer.from('200'))).toBe(true);
    const ce = attestationPdf('ce', { asso, fiche });
    expect(ce.includes(Buffer.from('entreprise'))).toBe(true);
    expect(fabriquerPdf({ titre: 'X', lignes: ['bonjour'] }).includes(Buffer.from('%%EOF'))).toBe(true);
  });
});

describe('attestations — fonction démo', () => {
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
      const assoM = m.ASSO as { attestations?: { recuFiscal?: boolean } };
      return {
        ...m,
        MODULES: { ...(m.MODULES as object), attestations: true, bureau: true, mail: true },
        ASSO: { ...assoM, attestations: { ...(assoM.attestations || {}), recuFiscal: false } },
      };
    });
    const { resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
    traiter = (await import('../netlify/functions/attestations.mjs')).traiter;
    const login = await (await import('../netlify/functions/bureau-auth.mjs')).traiter({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ password: 'demo' }),
    });
    auth = { authorization: `Bearer ${JSON.parse(login.body).token}` };
  }, 30_000);

  const call = (event: Record<string, unknown>) =>
    traiter({ headers: { ...auth }, queryStringParameters: {}, ...event });

  it('ouvre une session, refuse le reçu fiscal, sert l’adhésion', async () => {
    const types = JSON.parse((await call({ httpMethod: 'GET', queryStringParameters: { action: 'types' } })).body);
    expect(types.docs.map((d: { id: string }) => d.id)).toEqual(['adhesion', 'ce']);
    const ouv = JSON.parse(
      (
        await call({
          httpMethod: 'POST',
          body: JSON.stringify({ action: 'ouvrir', numero: 'ASE-2627-001', mail: 'emma.laurent@example.fr' }),
        })
      ).body,
    );
    expect(ouv.ok).toBe(true);
    expect(ouv.prenom).toBe('Emma');
    const pdf = await call({
      httpMethod: 'GET',
      queryStringParameters: { action: 'pdf', type: 'adhesion', n: ouv.numero, m: 'emma.laurent@example.fr', x: ouv.exp, t: ouv.token },
    });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers?.['Content-Type']).toBe('application/pdf');
    expect(Buffer.from(pdf.body, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    const fiscal = await call({
      httpMethod: 'GET',
      queryStringParameters: { action: 'pdf', type: 'fiscal', n: ouv.numero, m: 'emma.laurent@example.fr', x: ouv.exp, t: ouv.token },
    });
    expect(fiscal.statusCode).toBe(404);
    const bureau = await call({
      httpMethod: 'GET',
      queryStringParameters: { action: 'pdf', type: 'ce', numero: 'ASE-2627-001' },
    });
    expect(bureau.statusCode).toBe(200);
    const liste = JSON.parse((await call({ httpMethod: 'GET', queryStringParameters: { action: 'adherents' } })).body);
    expect(liste.adherents.some((a: { numero: string }) => a.numero === 'ASE-2627-001')).toBe(true);
  });
});
