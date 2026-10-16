import { afterEach, describe, expect, it, vi } from 'vitest';

const LIEN = 'https://g.page/r/exemple-avis/review';
vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<{ ASSO: Record<string, unknown>; MODULES: object }>();
  const ASSO = { ...m.ASSO, reseaux: { ...(m.ASSO.reseaux as object), avisGoogle: LIEN } };
  return { ...m, ASSO, MODULES: { ...m.MODULES, demandeAvis: true } };
});
delete process.env.DEMO;

const { AVIS_URL, choisirDemandes, cleDuJetonStop, dateAdhesion, jetonStop, messageAvis, versYmd } = await import('../netlify/functions/_avis-google.mjs');
const { cleDestinataire } = await import('../netlify/functions/_relances-reinscription.mjs');
const { modeAvis } = await import('../netlify/functions/demande-avis.mjs');
const { ASSO } = await import('../asso.derive.js');

const SECRET = 'secret-de-test-0123456789abcdef0123456789';
const YMD = '2026-11-15';
const fiche = (o: Record<string, string>) => ({ STATUT: 'À jour', MAIL: 'ada@exemple.fr', PRENOM: 'Ada', NOM: 'Exemple', DATE_PAIEMENT: '10/10/2026', ...o });
const base = { etats: {}, ymd: YMD, secret: SECRET };

describe('avis Google — dates', () => {
  it('lit les dates françaises et ISO ; le paiement passe avant la demande', () => {
    expect(versYmd('08/10/2026')).toBe('2026-10-08');
    expect(versYmd('2026-10-08 12:34')).toBe('2026-10-08');
    expect(versYmd('hier')).toBe('');
    expect(dateAdhesion({ DATE_PAIEMENT: '10/10/2026', DATE_DEMANDE: '01/10/2026' })).toBe('2026-10-10');
    expect(dateAdhesion({ DATE_DEMANDE: '01/10/2026' })).toBe('2026-10-01');
    expect(dateAdhesion({})).toBe('');
  });
});

describe('avis Google — qui reçoit la demande', () => {
  it('un mois à deux mois après l’adhésion, pas avant, pas après', () => {
    const nb = (d: string) => choisirDemandes({ ...base, fiches: [fiche({ DATE_PAIEMENT: d })] }).length;
    expect(nb('16/10/2026')).toBe(1); // 30 jours
    expect(nb('10/10/2026')).toBe(1); // 36 jours
    expect(nb('17/09/2026')).toBe(1); // 59 jours
    expect(nb('17/10/2026')).toBe(0); // 29 jours : trop tôt
    expect(nb('15/09/2026')).toBe(0); // 61 jours : trop tard
    expect(nb('')).toBe(0);
  });

  it('seulement les fiches « À jour » : le formulaire public ne vaut rien', () => {
    const publique = fiche({ STATUT: 'En attente', MAIL: 'victime@exemple.fr' });
    expect(choisirDemandes({ ...base, fiches: [publique] })).toEqual([]);
    expect(choisirDemandes({ ...base, fiches: [{ ...publique, NUMERO: 'ASE-2627-010' }] })).toEqual([]);
    expect(choisirDemandes({ ...base, fiches: [fiche({ STATUT: 'Annulé' }), fiche({ MAIL: 'pas-une-adresse' }), fiche({ MAIL: '' })] })).toEqual([]);
  });

  it('une adresse partagée par une famille reçoit un seul mail, avec tous les prénoms', () => {
    const r = choisirDemandes({ ...base, fiches: [fiche({}), fiche({ PRENOM: 'Léo', MAIL: 'ADA@exemple.fr' })] });
    expect(r).toHaveLength(1);
    expect(r[0].prenoms).toEqual(['Ada', 'Léo']);
  });

  it('jamais deux fois, jamais après une désinscription, vingt au plus par passage', () => {
    const cle = cleDestinataire('ada@exemple.fr', SECRET);
    expect(choisirDemandes({ ...base, fiches: [fiche({})], etats: { [cle]: { envoye: '2026-11-04' } } })).toEqual([]);
    expect(choisirDemandes({ ...base, fiches: [fiche({})], etats: { [cle]: { stop: true } } })).toEqual([]);
    const beaucoup = Array.from({ length: 30 }, (_, i) => fiche({ PRENOM: `P${i}`, MAIL: `p${i}@exemple.fr` }));
    expect(choisirDemandes({ ...base, fiches: beaucoup })).toHaveLength(20);
  });
});

describe('avis Google — le mail et la désinscription', () => {
  it('le mail donne le lien direct, n’impose rien et invite à répondre en cas de souci', () => {
    const m = messageAvis({ prenoms: ['Ada', 'Léo'], desabo: 'https://x.fr/stop?t=abc' });
    expect(m.sujet).toBe(`Votre avis sur ${ASSO.nom}`);
    expect(m.texte).toContain('Bonjour Ada et Léo,');
    expect(m.texte).toContain(AVIS_URL);
    expect(m.texte).toContain('Aucune obligation');
    expect(m.texte).toContain('en répondant à ce message');
    expect(m.texte).toContain('https://x.fr/stop?t=abc');
    expect(AVIS_URL).toBe(LIEN);
    expect(m.texte).toContain(String(ASSO.nom));
  });

  it('le jeton de désinscription ne contient aucune adresse et ne se falsifie pas', () => {
    const cle = cleDestinataire('ada@exemple.fr', SECRET);
    const j = jetonStop(cle, '2026-2027', SECRET);
    expect(j).not.toMatch(/ada|exemple/);
    expect(cleDuJetonStop(j, '2026-2027', SECRET)).toBe(cle);
    expect(cleDuJetonStop(j, '2027-2028', SECRET)).toBe('');
    expect(cleDuJetonStop(`${cle}.${'x'.repeat(22)}`, '2026-2027', SECRET)).toBe('');
    expect(cleDuJetonStop('', '2026-2027', SECRET)).toBe('');
  });
});

describe('avis Google — quand il tourne', () => {
  it('module, lien d’avis, secret et envoi de mail requis ; AVIS_GOOGLE=apercu compte sans envoyer', () => {
    const env = { BUREAU_SECRET: SECRET, SMTP_HOST: 'h' };
    expect(modeAvis(env, { demandeAvis: true }, false, LIEN)).toBe('oui');
    expect(modeAvis({ ...env, AVIS_GOOGLE: 'apercu' }, { demandeAvis: true }, false, LIEN)).toBe('apercu');
    expect(modeAvis(env, { demandeAvis: false }, false, LIEN)).toBe('');
    expect(modeAvis(env, { demandeAvis: true }, false, '')).toBe('');
    expect(modeAvis({ SMTP_HOST: 'h' }, { demandeAvis: true }, false, LIEN)).toBe('');
    expect(modeAvis(env, { demandeAvis: true }, true, LIEN)).toBe('');
  });
});

describe('avis Google — fonction planifiée et page de désinscription', () => {
  const stock = new Map<string, unknown>();
  const mails: { to: string; text: string }[] = [];
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    delete process.env.AVIS_GOOGLE;
  });

  function simulerBlobs() {
    vi.doMock('@netlify/blobs', () => ({
      getStore: () => ({
        get: async (k: string) => stock.get(k) ?? null,
        setJSON: async (k: string, v: unknown) => void stock.set(k, v),
      }),
    }));
  }

  async function charger(mode: string, lignes: Record<string, string>[]) {
    vi.resetModules();
    stock.clear();
    mails.length = 0;
    process.env.AVIS_GOOGLE = mode;
    Object.assign(process.env, { BUREAU_SECRET: SECRET, SMTP_HOST: 'h' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${YMD}T09:00:00+01:00`));
    simulerBlobs();
    vi.doMock('../netlify/functions/_envoi.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      envoyerMail: async (m: { to: string; text: string }) => void mails.push(m),
    }));
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      getAdherentsSheetId: () => 'adh',
      readSheetAsObjects: async () => ({ rows: lignes }),
    }));
    return (await import('../netlify/functions/demande-avis.mjs')).traiter as (e: unknown) => Promise<{ statusCode: number; body: string }>;
  }

  it('aperçu sans rien envoyer ni noter', async () => {
    const traiter = await charger('apercu', [fiche({})]);
    expect((await traiter({ headers: {} })).body).toBe('aperçu');
    expect(mails).toHaveLength(0);
    expect(stock.size).toBe(0);
  }, { timeout: 20_000 });

  it('envoie une demande, la note, et n’en renvoie pas une seconde', async () => {
    const traiter = await charger('', [fiche({})]);
    expect((await traiter({ headers: {} })).body).toBe('envoyés 1');
    expect(mails[0].to).toBe('ada@exemple.fr');
    expect(mails[0].text).toContain('/api/avis-stop?t=');
    expect(Object.values(stock.get(`saison-${ASSO.saison.label}`) as Record<string, { envoye: string }>)).toEqual([{ envoye: YMD }]);
    expect((await traiter({ headers: {} })).body).toBe('rien à envoyer');
    expect(mails).toHaveLength(1);
  }, { timeout: 20_000 });

  it('la page de désinscription enregistre un lien valide et refuse un faux', async () => {
    vi.resetModules();
    stock.clear();
    process.env.BUREAU_SECRET = SECRET;
    simulerBlobs();
    const { traiter } = await import('../netlify/functions/avis-stop.mjs');
    const label = String(ASSO.saison.label);
    const cle = cleDestinataire('ada@exemple.fr', SECRET);
    const ok = await traiter({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: jetonStop(cle, label, SECRET) } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).not.toMatch(/ada|exemple/);
    expect(stock.get(`saison-${label}`)).toEqual({ [cle]: { stop: true } });
    stock.clear();
    expect((await traiter({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: `${cle}.${'a'.repeat(22)}` } })).statusCode).toBe(404);
    expect(stock.size).toBe(0);
  }, { timeout: 20_000 });
});
