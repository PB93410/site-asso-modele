/** Réinscription en un clic : période, contrôle des réponses, et parcours depuis l'espace adhérent. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  controlerReponses,
  dejaReinscrit,
  ligneReinscription,
  periodeReinscription,
  saisonSuivante,
} from '../src/lib/reinscription.js';

vi.mock('@netlify/blobs', async () => (await import('./fauxBlobs')).fauxBlobs().module);
vi.mock('../netlify/functions/_envoi.mjs', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  modeEnvoi: () => 'smtp',
  envoyerMail: async () => {},
}));

const SECRET = 'secret-de-test-assez-long-0123456789';
const REPONSES = {
  telephone: '06 00 00 00 72',
  adresse: '3 rue Neuve',
  code_postal: '00000',
  ville: 'Villexemple',
  cours: ['Pilates'],
  mode_paiement: 'Virement',
  droit_image: 'Non',
  qs_sport: 'Oui',
  message: 'Merci !',
};

describe('réinscription — règles', () => {
  it('saison suivante et période juin → septembre', () => {
    expect(saisonSuivante('2026-2027')).toBe('2027-2028');
    expect(saisonSuivante('n’importe quoi')).toBe('');
    expect(periodeReinscription('2026-2027', new Date('2027-05-31T20:00:00Z')).ouverte).toBe(false);
    expect(periodeReinscription('2026-2027', new Date('2027-06-01T08:00:00+02:00'))).toMatchObject({ ouverte: true, suivante: '2027-2028' });
    expect(periodeReinscription('2026-2027', new Date('2027-09-30T20:00:00+02:00')).ouverte).toBe(true);
    expect(periodeReinscription('2026-2027', new Date('2027-10-01T08:00:00+02:00')).ouverte).toBe(false);
    // Une fois la saison suivante configurée, plus de réinscription pour la suivante de la suivante.
    expect(periodeReinscription('2027-2028', new Date('2027-09-15T08:00:00+02:00')).ouverte).toBe(false);
    // Réglage du référent (variable REINSCRIPTION).
    expect(periodeReinscription('2026-2027', new Date('2027-05-02T08:00:00+02:00'), 'ouverte').ouverte).toBe(true);
    expect(periodeReinscription('2026-2027', new Date('2027-06-10T08:00:00+02:00'), 'fermee').ouverte).toBe(false);
  });

  it('contrôle des réponses', () => {
    const opts = { modes: ['Virement', 'Chèque'], coursConnus: ['Pilates', 'Yoga'] };
    expect(controlerReponses(REPONSES, opts)).toMatchObject({ ok: true, champs: { telephone: '0600000072', cours: ['Pilates'] } });
    expect(controlerReponses({ ...REPONSES, cours: ['Inconnu'] }, opts)).toEqual({ ok: false, erreur: 'Choisissez au moins un cours.' });
    expect(controlerReponses({ ...REPONSES, qs_sport: '' }, opts).ok).toBe(false);
    expect(controlerReponses({ ...REPONSES, mode_paiement: 'Bitcoin' }, opts).ok).toBe(false);
    expect(controlerReponses({ ...REPONSES, telephone: '12' }, opts).ok).toBe(false);
  });

  it('identité reprise de la fiche, réponses du formulaire, sans numéro', () => {
    const fiche = { NOM: 'Durand', PRENOM: 'Alice', MAIL: 'alice@exemple.fr', DATE_NAISSANCE: '01/02/1970', NUMERO: 'ASE-2627-007' };
    const { champs } = controlerReponses(REPONSES, { modes: ['Virement'], coursConnus: [] }) as { champs: never };
    const l = ligneReinscription(fiche, champs, { tarif: 140, date: '10/06/2027', reference: 'ASE-K7M4QP', ancienNumero: 'ASE-2627-007' });
    expect(l).toHaveLength(18);
    expect(l.slice(0, 5)).toEqual(['Durand', 'Alice', '0600000072', 'alice@exemple.fr', '01/02/1970']);
    expect(l[9]).toBe('En attente');
    expect(l[11]).toBe('Réinscription · Réf. ASE-K7M4QP');
    expect(l[15]).toBe('Réinscription');
    expect(l[16]).toBe('Cours: Pilates | Ancien n° ASE-2627-007 | Message: Merci !');
    expect(dejaReinscrit([{ PRENOM: 'alice', NOM: 'DURAND', MAIL: 'Alice@Exemple.fr' }], fiche)).toBeTruthy();
    expect(dejaReinscrit([{ PRENOM: 'Paul', NOM: 'Durand', MAIL: 'alice@exemple.fr' }], fiche)).toBeNull();
  });
});

type Reponse = { statusCode: number; body: string };
const call = async (name: string, event: Record<string, unknown>): Promise<Reponse> =>
  (await import(`../netlify/functions/${name}.mjs`)).traiter({ headers: {}, queryStringParameters: {}, ...event });

describe('réinscription — parcours', { timeout: 20_000 }, () => {
  const env0 = { ...process.env };
  let signer: (mail: string, secret: string) => string;
  let cle = '';
  beforeAll(async () => {
    process.env.STOCKAGE = 'netlify';
    delete process.env.DEMO;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.BUREAU_SECRET = SECRET;
    process.env.BUREAU_PASSWORD = 'mot de passe de test';
    process.env.MAIL_ENVOI = 'aucun';
    const insc = await call('adhesion', {
      httpMethod: 'POST',
      body: JSON.stringify({
        prenom: 'Alice', nom: 'Retour', telephone: '0600000073', email: 'alice.retour@exemple.fr', date_naissance: '01/02/1970',
        mode_paiement: 'Virement', droit_image: 'Oui', qs_sport: 'Oui', cours: 'Pilates',
      }),
    });
    expect(insc.statusCode, insc.body).toBe(200);
    const { marquerAdhesionPayee } = await import('../netlify/functions/_paiement.mjs');
    cle = (await marquerAdhesionPayee(JSON.parse(insc.body).reference)).numero as string;
    signer = (await import('../src/lib/espace.js')).signerSession;
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterAll(() => {
    vi.useRealTimers();
    process.env = env0;
  });

  // Session signée à la date simulée (90 jours).
  const cookie = () => `espace=${signer('alice.retour@exemple.fr', SECRET)}`;
  const moi = async () => JSON.parse((await call('espace', { httpMethod: 'GET', headers: { cookie: cookie() }, queryStringParameters: { action: 'moi' } })).body);
  const reinscrire = (corps: Record<string, unknown>) =>
    call('espace', { httpMethod: 'POST', headers: { cookie: cookie() }, body: JSON.stringify({ action: 'reinscrire', cle, ...corps }) });

  it('fermée en mai', async () => {
    vi.setSystemTime(new Date('2027-05-20T10:00:00+02:00'));
    expect((await moi()).reinscription).toBeNull();
    expect((await reinscrire(REPONSES)).statusCode).toBe(409);
  });

  it('en juin : fiche reprise, ligne dans l’onglet de la saison suivante, une seule fois', async () => {
    vi.setSystemTime(new Date('2027-06-10T10:00:00+02:00'));
    const avant = await moi();
    expect(avant.reinscription).toMatchObject({ saison: '2027-2028' });
    expect(avant.fiches[0].reinscription).toMatchObject({ possible: true, faite: '', tel: '0600000073', cours: ['Pilates'] });

    const r = await reinscrire(REPONSES);
    expect(r.statusCode, r.body).toBe(200);
    expect((await reinscrire(REPONSES)).statusCode).toBe(409);
    expect((await moi()).fiches[0].reinscription.faite).toBe('10/06/2027');

    const { readSheetAsObjects, getAdherentsSheetId, getAdherentsTab } = await import('../netlify/functions/_bureau-lib.mjs');
    const { rows } = await readSheetAsObjects(getAdherentsSheetId(), "'Saison 2027-2028'!A:Z");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ PRENOM: 'Alice', TEL: '0600000072', STATUT: 'En attente', SOURCE: 'Réinscription', NUMERO: '' });
    // La saison en cours n'est pas touchée.
    const actuelle = (await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`)).rows;
    expect(actuelle.filter((x: Record<string, string>) => x.PRENOM === 'Alice')).toHaveLength(1);
  });

  it('le bureau voit la liste', async () => {
    expect((await call('espace', { httpMethod: 'GET', queryStringParameters: { action: 'reinscriptions' } })).statusCode).toBe(401);
    const login = await call('bureau-auth', { httpMethod: 'POST', body: JSON.stringify({ password: 'mot de passe de test' }) });
    const token = JSON.parse(login.body).token;
    const r = await call('espace', { httpMethod: 'GET', headers: { authorization: `Bearer ${token}` }, queryStringParameters: { action: 'reinscriptions' } });
    expect(JSON.parse(r.body)).toMatchObject({ saison: '2027-2028', ouverte: true, liste: [{ nom: 'Alice Retour', cours: 'Pilates', mode: 'Virement' }] });
  });
});
