import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ENVOIS,
  choisirDestinataires,
  cleDestinataire,
  cleDuJetonStop,
  fenetreEnvoi,
  jetonStop,
  messageRelance,
  numeroSuivant,
} from '../netlify/functions/_relances-reinscription.mjs';

const SECRET = 'secret-de-test-0123456789abcdef0123456789';
const fiche = (o: Record<string, string>) => ({ STATUT: 'À jour', ...o });
const ada = fiche({ PRENOM: 'Ada', NOM: 'Exemple', MAIL: 'ada@exemple.test' });

describe('relances de réinscription — calendrier et rythme', () => {
  it('seulement juin et début juillet, puis septembre (saison 2026-2027 → 2027)', () => {
    expect(fenetreEnvoi('2026-2027', '2027-06-01')).toBe(true);
    expect(fenetreEnvoi('2026-2027', '2027-07-10')).toBe(true);
    expect(fenetreEnvoi('2026-2027', '2027-07-11')).toBe(false);
    expect(fenetreEnvoi('2026-2027', '2027-08-20')).toBe(false);
    expect(fenetreEnvoi('2026-2027', '2027-09-25')).toBe(true);
    expect(fenetreEnvoi('2026-2027', '2027-09-26')).toBe(false);
    expect(fenetreEnvoi('2026-2027', '2026-10-15')).toBe(false);
    expect(fenetreEnvoi('', '2027-06-10')).toBe(false);
  });

  it('trois mails au plus, à quatorze jours d’écart, jamais après une désinscription', () => {
    expect(numeroSuivant(undefined, '2027-06-07')).toBe(1);
    expect(numeroSuivant({ n: 1, dernier: '2027-06-07' }, '2027-06-14')).toBe(0);
    expect(numeroSuivant({ n: 1, dernier: '2027-06-07' }, '2027-06-21')).toBe(2);
    expect(numeroSuivant({ n: 2, dernier: '2027-06-21' }, '2027-07-05')).toBe(3);
    expect(numeroSuivant({ n: MAX_ENVOIS, dernier: '2027-07-05' }, '2027-09-20')).toBe(0);
    expect(numeroSuivant({ n: 1, dernier: '2027-06-07', stop: true }, '2027-09-20')).toBe(0);
  });
});

describe('relances de réinscription — qui reçoit quoi', () => {
  const base = { suivante: [], etats: {}, ymd: '2027-06-07', secret: SECRET };

  it('adhérents à jour avec une adresse, pas encore réinscrits', () => {
    const annule = fiche({ PRENOM: 'Bob', NOM: 'X', MAIL: 'bob@exemple.test', STATUT: 'Annulé' });
    const sansMail = fiche({ PRENOM: 'Cy', NOM: 'Y', MAIL: '' });
    const malForme = fiche({ PRENOM: 'Di', NOM: 'Z', MAIL: 'pas-une-adresse' });
    const reinscrit = fiche({ PRENOM: 'Eve', NOM: 'W', MAIL: 'eve@exemple.test' });
    const r = choisirDestinataires({
      ...base,
      fiches: [ada, annule, sansMail, malForme, reinscrit],
      suivante: [{ PRENOM: 'Eve', NOM: 'W', MAIL: 'eve@exemple.test' }],
    });
    expect(r.map((d) => d.mail)).toEqual(['ada@exemple.test']);
    expect(r[0].numero).toBe(1);
  });

  it('une demande « En attente » (formulaire public, adresse non vérifiée) ne reçoit rien', () => {
    const publique = fiche({ PRENOM: 'Fay', NOM: 'V', MAIL: 'victime@exemple.test', STATUT: 'En attente' });
    expect(choisirDestinataires({ ...base, fiches: [publique] })).toEqual([]);
    expect(choisirDestinataires({ ...base, fiches: [{ ...publique, NUMERO: 'ASE-2627-042' }] })).toEqual([]);
    expect(choisirDestinataires({ ...base, fiches: [{ ...publique, STATUT: 'à jour' }] })).toEqual([]);
  });

  it('une adresse partagée par une famille ne reçoit qu’un mail, avec tous les prénoms', () => {
    const fils = fiche({ PRENOM: 'Léo', NOM: 'Exemple', MAIL: 'ADA@exemple.test' });
    const r = choisirDestinataires({ ...base, fiches: [ada, fils] });
    expect(r).toHaveLength(1);
    expect(r[0].prenoms).toEqual(['Ada', 'Léo']);
  });

  it('respecte l’état : rythme, désinscription, plafond par passage', () => {
    const cle = cleDestinataire('ada@exemple.test', SECRET);
    expect(choisirDestinataires({ ...base, fiches: [ada], etats: { [cle]: { n: 1, dernier: '2027-06-03' } } })).toEqual([]);
    expect(choisirDestinataires({ ...base, fiches: [ada], etats: { [cle]: { n: 1, dernier: '2027-05-20' } } })[0].numero).toBe(2);
    expect(choisirDestinataires({ ...base, fiches: [ada], etats: { [cle]: { stop: true } } })).toEqual([]);
    const beaucoup = Array.from({ length: 60 }, (_, i) => fiche({ PRENOM: `P${i}`, NOM: 'N', MAIL: `p${i}@exemple.test` }));
    expect(choisirDestinataires({ ...base, fiches: beaucoup })).toHaveLength(40);
  });
});

describe('relances de réinscription — le mail et la désinscription', () => {
  it('le mail dit quoi faire, signe au nom de l’asso et propose de se désinscrire', () => {
    const m = messageRelance({ prenoms: ['Ada', 'Léo'], numero: 1, saison: '2027-2028', lien: 'https://x.test/espace', desabo: 'https://x.test/stop?t=abc', nom: 'Association Exemple' });
    expect(m.sujet).toBe('Réinscription 2027/2028 : gardez votre place');
    expect(m.texte).toContain('Bonjour Ada et Léo,');
    expect(m.texte).toContain('https://x.test/espace');
    expect(m.texte).toContain('Association Exemple');
    expect(m.texte).toContain('https://x.test/stop?t=abc');
    expect(messageRelance({ prenoms: [], numero: 3, saison: '2027-2028', lien: 'l', desabo: 'd', nom: 'A' }).sujet).toContain('dernier rappel');
  });

  it('le jeton de désinscription ne contient aucune adresse et ne se falsifie pas', () => {
    const cle = cleDestinataire('ada@exemple.test', SECRET);
    const j = jetonStop(cle, '2026-2027', SECRET);
    expect(j).not.toMatch(/ada|exemple/);
    expect(cleDuJetonStop(j, '2026-2027', SECRET)).toBe(cle);
    expect(cleDuJetonStop(j, '2027-2028', SECRET)).toBe('');
    expect(cleDuJetonStop(`${cle}.${'x'.repeat(22)}`, '2026-2027', SECRET)).toBe('');
    expect(cleDuJetonStop(j, '2026-2027', `${SECRET}x`)).toBe('');
    expect(cleDuJetonStop('', '2026-2027', SECRET)).toBe('');
  });
});

/** Faux store Netlify Blobs partagé par les deux fonctions. */
const stock = new Map<string, unknown>();
function mockBlobs() {
  vi.doMock('@netlify/blobs', () => ({
    getStore: () => ({
      get: async (k: string) => stock.get(k) ?? null,
      setJSON: async (k: string, v: unknown) => void stock.set(k, v),
    }),
  }));
}

describe('relances de réinscription — fonction planifiée', () => {
  const mails: { to: string; subject: string; text: string }[] = [];

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    delete process.env.REINSCRIPTION_RELANCES;
  });

  async function charger(mode: string, jour = '2027-06-07T09:00:00+02:00') {
    vi.resetModules();
    stock.clear();
    mails.length = 0;
    Object.assign(process.env, { REINSCRIPTION_RELANCES: mode, BUREAU_SECRET: SECRET, SMTP_HOST: 'h' });
    delete process.env.DEMO;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(jour));
    mockBlobs();
    vi.doMock('../netlify/functions/_envoi.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      envoyerMail: async (m: { to: string; subject: string; text: string }) => void mails.push(m),
    }));
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      getAdherentsSheetId: () => 'classeur',
      readSheetAsObjects: async (_id: string, plage: string) =>
        plage.includes('2027-2028') ? { rows: [] } : { rows: [{ ...ada, _row: 2 }] },
    }));
    return (await import('../netlify/functions/relances-reinscription.mjs')).traiter as (e: unknown) => Promise<{ statusCode: number; body: string }>;
  }

  it('éteint par défaut : rien ne part', async () => {
    const traiter = await charger('');
    expect((await traiter({ headers: {} })).body).toBe('inactif');
    expect(mails).toHaveLength(0);
  }, { timeout: 20_000 });

  it('aperçu : compte sans rien envoyer ni noter', async () => {
    const traiter = await charger('apercu');
    expect((await traiter({ headers: {} })).body).toBe('aperçu');
    expect(mails).toHaveLength(0);
    expect(stock.size).toBe(0);
  }, { timeout: 20_000 });

  it('hors des fenêtres (août) : rien ne part', async () => {
    const traiter = await charger('oui', '2027-08-16T09:00:00+02:00');
    expect((await traiter({ headers: {} })).body).toBe('hors période');
    expect(mails).toHaveLength(0);
  }, { timeout: 20_000 });

  it('envoie le premier mail, le note, et n’envoie rien de plus au passage suivant', async () => {
    const traiter = await charger('oui');
    expect((await traiter({ headers: {} })).body).toBe('envoyés 1');
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe('ada@exemple.test');
    expect(mails[0].text).toContain('/api/reinscription-stop?t=');
    const etat = stock.get('saison-2026-2027') as Record<string, { n: number; dernier: string }>;
    expect(Object.values(etat)).toEqual([{ n: 1, dernier: '2027-06-07' }]);
    // Une semaine plus tard : trop tôt (14 jours).
    vi.setSystemTime(new Date('2027-06-14T09:00:00+02:00'));
    expect((await traiter({ headers: {} })).body).toBe('rien à envoyer');
    expect(mails).toHaveLength(1);
  }, { timeout: 20_000 });
});

describe('relances de réinscription — page de désinscription', () => {
  afterEach(() => vi.resetModules());

  async function charger() {
    vi.resetModules();
    stock.clear();
    process.env.BUREAU_SECRET = SECRET;
    mockBlobs();
    return (await import('../netlify/functions/reinscription-stop.mjs')).traiter as (e: unknown) => Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
  }

  it('un lien valide enregistre la désinscription, sans afficher aucune adresse', async () => {
    const traiter = await charger();
    const cle = cleDestinataire('ada@exemple.test', SECRET);
    const r = await traiter({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: jetonStop(cle, '2026-2027', SECRET) } });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('C’est noté');
    expect(r.body).not.toMatch(/ada|exemple/);
    expect(r.headers['X-Robots-Tag']).toContain('noindex');
    expect(stock.get('saison-2026-2027')).toEqual({ [cle]: { stop: true } });
  }, { timeout: 20_000 });

  it('un lien faux, modifié ou absent : 404, rien d’enregistré', async () => {
    const traiter = await charger();
    const cle = cleDestinataire('ada@exemple.test', SECRET);
    expect((await traiter({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: `${cle}.${'a'.repeat(22)}` } })).statusCode).toBe(404);
    expect((await traiter({ httpMethod: 'GET', headers: {}, queryStringParameters: {} })).statusCode).toBe(404);
    expect((await traiter({ httpMethod: 'POST', headers: {}, queryStringParameters: {} })).statusCode).toBe(405);
    expect(stock.size).toBe(0);
  }, { timeout: 20_000 });
});
