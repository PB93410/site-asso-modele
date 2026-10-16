import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<Record<string, unknown>>();
  return { ...m, MODULES: { ...(m.MODULES as object), bureau: true, inscriptionsEvenements: true } };
});
delete process.env.DEMO;

const { configDuBureau, peutInscrire, placesPrises, resumePublic, slugValide, validerInscription } = await import('../netlify/functions/_evenements.mjs');
const { dateLisible, libellePlaces, resumeCovoiturage, slugEvenement, telAffiche } = await import('../src/lib/evenements');

const OK = { prenom: 'Ada', nom: 'Exemple', telephone: '06 12 34 56 78', personnes: 2, covoiturage: '', places_covoiturage: 0, depart: '' };
const inscrit = (o: Record<string, unknown> = {}) => ({ id: 'x', prenom: 'Ada', nom: 'Exemple', tel: '0612345678', personnes: 1, covoiturage: { mode: '', places: 0, depart: '' }, le: '2026-10-15', ...o });

describe('événements — l’adresse et les dates', () => {
  it('un événement a une adresse stable et lisible', () => {
    const e = { title: 'Marche solidaire', date: '18', month: 'OCT', year: '2026' };
    expect(slugEvenement(e)).toBe('marche-solidaire-2026-oct');
    expect(slugValide(slugEvenement(e))).toBe(true);
    expect(slugEvenement({ title: 'Fête de fin d’année', date: '4-5', month: 'DÉC', year: '2026' })).toBe('fete-de-fin-d-annee-2026-dec');
    expect(slugValide('../etc')).toBe(false);
    expect(slugValide('a')).toBe(false);
  });

  it('les dates et les places se lisent bien', () => {
    expect(dateLisible({ title: '', date: '18', month: 'OCT', year: '2026' })).toBe('18 octobre 2026');
    expect(dateLisible({ title: '', date: '4-5', month: 'DÉC', year: '2026' })).toBe('4-5 décembre 2026');
    expect(dateLisible({ title: '', date: '', month: 'DÉC', year: '2026' })).toBe('décembre 2026');
    expect(libellePlaces({ titre: 'x', places: 20, restantes: 12, complet: false, covoiturage: false })).toBe('Il reste 12 places');
    expect(libellePlaces({ titre: 'x', places: 20, restantes: 1, complet: false, covoiturage: false })).toBe('Il reste 1 place');
    expect(libellePlaces({ titre: 'x', places: 20, restantes: 0, complet: true, covoiturage: false })).toBe('Complet');
    expect(libellePlaces({ titre: 'x', places: null, restantes: null, complet: false, covoiturage: false })).toBe('Inscriptions ouvertes');
    expect(telAffiche('0612345678')).toBe('06 12 34 56 78');
  });
});

describe('événements — contrôle d’une inscription', () => {
  it('accepte une inscription complète et range le téléphone sur 10 chiffres', () => {
    const r = validerInscription(OK);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.champs).toMatchObject({ prenom: 'Ada', nom: 'Exemple', tel: '0612345678', personnes: 2, covoiturage: { mode: '', places: 0, depart: '' } });
    const intl = validerInscription({ ...OK, telephone: '+33 6 12 34 56 78' });
    expect(intl.ok && intl.champs.tel).toBe('0612345678');
  });

  it('refuse un prénom, un nom, un téléphone ou un nombre de personnes incorrects', () => {
    for (const mauvais of [{ prenom: '' }, { prenom: '<b>x</b>' }, { nom: '1' }, { telephone: '0612' }, { personnes: 0 }, { personnes: 5 }, { personnes: 'deux' }]) {
      expect(validerInscription({ ...OK, ...mauvais }).ok, JSON.stringify(mauvais)).toBe(false);
    }
  });

  it('covoiturage : places proposées entre 1 et 6, mode inconnu ignoré, départ nettoyé', () => {
    const propose = validerInscription({ ...OK, covoiturage: 'propose', places_covoiturage: 3, depart: '  Villexemple\n' });
    expect(propose.ok && propose.champs.covoiturage).toEqual({ mode: 'propose', places: 3, depart: 'Villexemple' });
    expect(validerInscription({ ...OK, covoiturage: 'propose', places_covoiturage: 0 }).ok).toBe(false);
    expect(validerInscription({ ...OK, covoiturage: 'propose', places_covoiturage: 9 }).ok).toBe(false);
    const cherche = validerInscription({ ...OK, covoiturage: 'cherche' });
    expect(cherche.ok && cherche.champs.covoiturage.mode).toBe('cherche');
    const inconnu = validerInscription({ ...OK, covoiturage: 'hacker', depart: 'x' });
    expect(inconnu.ok && inconnu.champs.covoiturage).toEqual({ mode: '', places: 0, depart: '' });
  });
});

describe('événements — places', () => {
  const config = { titre: 'Repas', places: 5, covoiturage: true, ouvert: true };
  const champs = (o: Record<string, unknown> = {}) => ({ tel: '0600000009', personnes: 2, ...o });

  it('compte les personnes, pas les inscriptions', () => {
    expect(placesPrises([inscrit({ personnes: 2 }), inscrit({ personnes: 3, tel: '2' })])).toBe(5);
    expect(placesPrises([])).toBe(0);
  });

  it('refuse au-delà des places, avec le nombre restant', () => {
    expect(peutInscrire(config, [inscrit({ personnes: 3 })], champs()).ok).toBe(true);
    const trop = peutInscrire(config, [inscrit({ personnes: 4 })], champs());
    expect(trop).toMatchObject({ ok: false, code: 409, erreur: 'Il ne reste que 1 place.' });
    const complet = peutInscrire(config, [inscrit({ personnes: 5 })], champs());
    expect(complet).toMatchObject({ ok: false, erreur: 'Cet événement est complet.' });
  });

  it('un même téléphone ne s’inscrit qu’une fois ; fermé ou inconnu : refusé ; 0 place = illimité', () => {
    expect(peutInscrire(config, [inscrit({ tel: '0600000009' })], champs())).toMatchObject({ ok: false, code: 409 });
    expect(peutInscrire({ ...config, ouvert: false }, [], champs())).toMatchObject({ ok: false, code: 404 });
    expect(peutInscrire(undefined, [], champs())).toMatchObject({ ok: false, code: 404 });
    expect(peutInscrire({ ...config, places: 0 }, [inscrit({ personnes: 400 })], champs()).ok).toBe(true);
  });

  it('le public ne voit jamais un nom ni un numéro', () => {
    const r = resumePublic(config, [inscrit({ personnes: 2 })]);
    expect(r).toEqual({ titre: 'Repas', places: 5, restantes: 3, complet: false, covoiturage: true });
    expect(JSON.stringify(r)).not.toMatch(/Ada|Exemple|0612/);
    expect(resumePublic({ ...config, places: 0 }, []).restantes).toBeNull();
  });
});

describe('événements — ce que fait le bureau', () => {
  it('configuration : titre, places de 0 à 500, adresse valide', () => {
    expect(configDuBureau({ slug: 'repas-2026-dec', titre: 'Repas de Noël', places: 40, covoiturage: true })).toEqual({
      slug: 'repas-2026-dec',
      config: { titre: 'Repas de Noël', places: 40, covoiturage: true, ouvert: true },
    });
    expect(configDuBureau({ slug: 'repas-2026-dec', titre: 'Repas', places: -1 })).toBeNull();
    expect(configDuBureau({ slug: 'repas-2026-dec', titre: 'Repas', places: 900 })).toBeNull();
    expect(configDuBureau({ slug: 'Mauvais Slug', titre: 'Repas', places: 5 })).toBeNull();
    expect(configDuBureau({ slug: 'repas-2026-dec', titre: 'x', places: 5 })).toBeNull();
  });

  it('couvre le covoiturage : places proposées contre personnes qui cherchent', () => {
    const l = [
      inscrit({ covoiturage: { mode: 'propose', places: 3, depart: '' } }),
      inscrit({ covoiturage: { mode: 'propose', places: 2, depart: '' } }),
      inscrit({ personnes: 2, covoiturage: { mode: 'cherche', places: 0, depart: '' } }),
      inscrit({}),
    ];
    expect(resumeCovoiturage(l)).toEqual({ proposees: 5, cherchent: 2 });
  });
});

describe('événements — API', () => {
  let memoire = new Map<string, unknown>();
  let role: 'admin' | 'seance' | null = 'admin';
  afterEach(() => vi.resetModules());

  async function charger() {
    vi.resetModules();
    const { fauxBlobs } = await import('./fauxBlobs');
    const faux = fauxBlobs();
    memoire = faux.memoire;
    vi.doMock('@netlify/blobs', () => faux.module);
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      requireAuth: () => (role === 'admin' ? { ok: true, role: 'admin' } : { ok: false, response: { statusCode: role ? 403 : 401, body: '{}' } }),
    }));
    const pub = (await import('../netlify/functions/evenement-inscription.mjs')).traiter as (e: unknown) => Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
    const bureau = (await import('../netlify/functions/evenements-bureau.mjs')).traiter as typeof pub;
    return { pub, bureau };
  }
  const post = (corps: unknown, ip = 'ip-1') => ({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': ip }, body: JSON.stringify(corps) });
  const ouvrir = { action: 'ouvrir', slug: 'repas-2026-dec', titre: 'Repas de Noël', places: 3, covoiturage: true };
  const inscription = (o: Record<string, unknown> = {}) => ({ slug: 'repas-2026-dec', ...OK, personnes: 1, ...o });

  it('le bureau ouvre, le public voit les places sans aucun nom, s’inscrit, et le complet est refusé', async () => {
    role = 'admin';
    const { pub, bureau } = await charger();
    expect((await bureau(post(ouvrir))).statusCode).toBe(200);

    let lu = JSON.parse((await pub({ httpMethod: 'GET', headers: {} })).body);
    expect(lu.ouvertes['repas-2026-dec']).toEqual({ titre: 'Repas de Noël', places: 3, restantes: 3, complet: false, covoiturage: true });

    expect((await pub(post(inscription({ personnes: 2 })))).statusCode).toBe(200);
    expect((await pub(post(inscription({ telephone: '06 98 76 54 32', prenom: 'Léo' })))).statusCode).toBe(200);
    lu = JSON.parse((await pub({ httpMethod: 'GET', headers: {} })).body);
    expect(lu.ouvertes['repas-2026-dec'].complet).toBe(true);
    expect(JSON.stringify(lu)).not.toMatch(/Ada|Léo|0612|0698|0600/);

    const trop = await pub(post(inscription({ telephone: '06 00 00 00 33', prenom: 'Zoé' })));
    expect(trop.statusCode).toBe(409);
    expect(JSON.parse(trop.body).error).toContain('complet');
  }, { timeout: 20_000 });

  it('refuse un doublon de téléphone, un événement fermé ou inconnu, un robot et un message mal formé', async () => {
    role = 'admin';
    const { pub, bureau } = await charger();
    await bureau(post(ouvrir));
    expect((await pub(post(inscription()))).statusCode).toBe(200);
    expect((await pub(post(inscription()))).statusCode).toBe(409);
    expect((await pub(post(inscription({ slug: 'inconnu-2026-xxx' })))).statusCode).toBe(404);
    expect((await pub(post(inscription({ 'bot-field': 'x', telephone: '06 00 00 00 22' })))).body).toBe('{"ok":true}');
    expect((await pub(post(inscription({ telephone: '0612' })))).statusCode).toBe(400);
    expect((await pub({ httpMethod: 'POST', headers: {}, body: 'pas du json' })).statusCode).toBe(400);
    await bureau(post({ action: 'fermer', slug: 'repas-2026-dec' }));
    expect((await pub(post(inscription({ telephone: '06 00 00 00 44' })))).statusCode).toBe(404);
    const lu = JSON.parse((await pub({ httpMethod: 'GET', headers: {} })).body);
    expect(lu.ouvertes).toEqual({});
  });

  it('le bureau voit les inscrits, en retire un, puis clôt et efface tout', async () => {
    role = 'admin';
    const { pub, bureau } = await charger();
    await bureau(post(ouvrir));
    await pub(post(inscription({ covoiturage: 'propose', places_covoiturage: 2, depart: 'Villexemple' })));
    let vue = JSON.parse((await bureau({ httpMethod: 'GET', headers: {} })).body);
    const [premier] = vue.inscriptions['repas-2026-dec'];
    expect(premier).toMatchObject({ prenom: 'Ada', tel: '0612345678', covoiturage: { mode: 'propose', places: 2, depart: 'Villexemple' } });

    await bureau(post({ action: 'retirer', slug: 'repas-2026-dec', id: premier.id }));
    vue = JSON.parse((await bureau({ httpMethod: 'GET', headers: {} })).body);
    expect(vue.inscriptions['repas-2026-dec']).toEqual([]);

    await pub(post(inscription()));
    await bureau(post({ action: 'effacer', slug: 'repas-2026-dec' }));
    vue = JSON.parse((await bureau({ httpMethod: 'GET', headers: {} })).body);
    expect(vue.config).toEqual({});
    expect(memoire.has('inscriptions-repas-2026-dec')).toBe(false);
  });

  it('deux personnes en même temps pour la dernière place : une seule passe, rien n’est perdu', async () => {
    role = 'admin';
    const { pub, bureau } = await charger();
    await bureau(post({ ...ouvrir, places: 2 }));
    expect((await pub(post(inscription()))).statusCode).toBe(200);
    const [a, b] = await Promise.all([
      pub(post(inscription({ telephone: '06 11 11 11 11', prenom: 'Léo' }), 'ip-a')),
      pub(post(inscription({ telephone: '06 77 88 99 00', prenom: 'Zoé' }), 'ip-b')),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const vue = JSON.parse((await bureau({ httpMethod: 'GET', headers: {} })).body);
    expect(vue.inscriptions['repas-2026-dec']).toHaveLength(2);
  }, { timeout: 20_000 });

  it('la partie bureau est fermée sans connexion et à la porte « séance »', async () => {
    const { bureau } = await charger();
    role = null;
    expect((await bureau({ httpMethod: 'GET', headers: {} })).statusCode).toBe(401);
    role = 'seance';
    expect((await bureau(post(ouvrir))).statusCode).toBe(403);
    role = 'admin';
  });
});
