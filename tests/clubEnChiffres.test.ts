import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<Record<string, unknown>>();
  return { ...m, MODULES: { ...(m.MODULES as object), clubEnChiffres: true } };
});

const { anciennete } = await import('../src/lib/clubEnChiffres');
const { arrondi5, publier, SEUIL } = await import('../netlify/functions/_club-chiffres.mjs');
const { calculerRapport } = await import('../src/lib/rapport.js');

const AU = new Date('2026-10-15T12:00:00+02:00');
const fiche = (i: number, naissance: string, ville: string, statut = 'À jour') => ({
  STATUT: statut,
  PRENOM: `P${i}`,
  NOM: `N${i}`,
  DATE_NAISSANCE: naissance,
  VILLE: ville,
  MODE: 'Chèque',
  MONTANT: '140',
});
/** n fiches nées en `annee`, dans `ville`. */
const groupe = (n: number, annee: number, ville: string, debut = 0) =>
  Array.from({ length: n }, (_, i) => fiche(debut + i, `15/06/${annee}`, ville));
const rapport = (adherents: Record<string, string>[], essais: Record<string, string>[] = []) => ({
  ...calculerRapport({ adherents, essais }, AU),
  saison: '2026-2027',
});

describe('le club en chiffres — rendre publiable', () => {
  it('arrondit le total vers le bas, par 5', () => {
    expect(arrondi5(118)).toBe(115);
    expect(arrondi5(5)).toBe(5);
    expect(arrondi5(4)).toBe(0);
    expect(arrondi5(undefined)).toBe(0);
  });

  it('montre les tranches et les communes assez fournies, regroupe les écritures, cache les petites', () => {
    const pub = publier(
      rapport([
        ...groupe(40, 1965, 'Villexemple'), // 61 ans
        ...groupe(25, 1995, 'Bourg-Exemple', 100), // 31 ans
        ...groupe(6, 1985, 'VILLE-SUR-EXEMPLE', 200), // 41 ans
        ...groupe(6, 1985, 'ville sur exemple', 300), // même commune, autre saisie
        ...groupe(4, 2015, 'Hameau-Exemple', 400), // 11 ans : tranche et commune sous le seuil
      ]),
    );
    expect(pub.saison).toBe('2026-2027');
    expect(pub.adherentsPlusDe).toBe(80); // 81 fiches
    expect(pub.parAge.map((a: { tranche: string }) => a.tranche).sort()).toEqual(['18–39 ans', '40–59 ans', '60 ans et plus']);
    expect(pub.parAge.every((a: { pct: number }) => a.pct % 5 === 0)).toBe(true);
    expect(pub.communes).toEqual([
      { nom: 'Villexemple', plusDe: 40 },
      { nom: 'Bourg-Exemple', plusDe: 25 },
      { nom: 'Ville-sur-Exemple', plusDe: 10 },
    ]);
    expect(pub.nbCommunes).toBe(4);
    expect(JSON.stringify(pub)).not.toMatch(/Hameau/);
    expect(SEUIL).toBe(10);
  });

  it('ne publie que des totaux : ni essais, ni argent, ni paiement, ni nom', () => {
    const essais = [{ STATUT: 'Adhérent', PRENOM: 'Z', NOM: 'Y', TEL: '0600000001', COURS: 'Zumba' }];
    const pub = publier(rapport(groupe(30, 1970, 'Villexemple'), essais));
    expect(Object.keys(pub).sort()).toEqual(['adherentsPlusDe', 'communes', 'nbCommunes', 'parAge', 'saison']);
    expect(JSON.stringify(pub)).not.toMatch(/P\d|N\d|Chèque|essai|conversion|0600/i);
  });

  it('les fiches de test, les non-à-jour et le « non renseigné » ne comptent pas', () => {
    const pub = publier(
      rapport([
        ...groupe(12, 1970, 'Villexemple'),
        fiche(900, '', ''),
        { ...fiche(901, '15/06/1970', 'Villexemple'), PRENOM: 'Test' },
        fiche(902, '15/06/1970', 'Villexemple', 'En attente'),
      ]),
    );
    expect(pub.adherentsPlusDe).toBe(10); // 13 à jour : 12 + la fiche sans date ni ville
    expect(pub.communes).toEqual([{ nom: 'Villexemple', plusDe: 10 }]);
    expect(pub.nbCommunes).toBe(1);
  });

  it('une toute petite association n’affiche rien qui isole quelqu’un', () => {
    const pub = publier(rapport(groupe(7, 1970, 'Villexemple')));
    expect(pub.parAge).toEqual([]);
    expect(pub.communes).toEqual([]);
    expect(pub.adherentsPlusDe).toBe(5);
  });
});

describe('le club en chiffres — page', () => {
  it('l’ancienneté suit l’année, rien si l’année manque', () => {
    expect(anciennete(new Date('2026-10-15'), '1980')).toBe(46);
    expect(anciennete(new Date('1970-01-01'), '1980')).toBe(0);
    expect(anciennete(new Date('2026-10-15'), '')).toBe(0);
  });
});

describe('le club en chiffres — API publique', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../netlify/functions/rapport.mjs');
  });

  async function charger(lecture: () => Promise<unknown>) {
    vi.resetModules();
    vi.doMock('../netlify/functions/rapport.mjs', () => ({ donnees: lecture }));
    return (await import('../netlify/functions/club-chiffres.mjs')).traiter as (
      e: unknown,
    ) => Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
  }
  const get = (ip: string) => ({ httpMethod: 'GET', headers: { 'x-nf-client-connection-ip': ip } });

  it('répond sans connexion, gardé une heure, avec les seuls chiffres publics', async () => {
    const traiter = await charger(async () => rapport(groupe(30, 1970, 'Villexemple')));
    const r = await traiter(get('a'));
    expect(r.statusCode).toBe(200);
    expect(r.headers['Cache-Control']).toContain('max-age=3600');
    const d = JSON.parse(r.body);
    expect(d.ok).toBe(true);
    expect(d.adherentsPlusDe).toBe(30);
    expect(d).not.toHaveProperty('adhérentsAJour');
    expect(d).not.toHaveProperty('essais');
  }, { timeout: 20_000 });

  it('si le registre ne répond pas : 503 sans détail, jamais gardé', async () => {
    const traiter = await charger(async () => {
      throw new Error('quota Google');
    });
    const r = await traiter(get('b'));
    expect(r.statusCode).toBe(503);
    expect(r.body).not.toMatch(/quota|Google/);
    expect(r.headers['Cache-Control']).toMatch(/no-store/);
  }, { timeout: 20_000 });

  it('seulement en lecture, avec un quota par visiteur', async () => {
    const traiter = await charger(async () => rapport([]));
    expect((await traiter({ httpMethod: 'POST', headers: {} })).statusCode).toBe(405);
    let dernier = 0;
    for (let i = 0; i < 31; i += 1) dernier = (await traiter(get('c'))).statusCode;
    expect(dernier).toBe(429);
  }, { timeout: 20_000 });
});
