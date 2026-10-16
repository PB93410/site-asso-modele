import { afterEach, describe, expect, it, vi } from 'vitest';
import { lienAdhesionMessage, relanceHref } from '../src/data/bureauRelances';
import { SITE_URL } from '../src/data/asso';
import { personneDuLien, signerLienAdhesion } from '../netlify/functions/_lien-adhesion.mjs';

const SECRET = 'secret-de-test-0123456789abcdef0123456789';
const MAINTENANT = new Date('2026-10-21T10:00:00+02:00').getTime();
const TELS = ['06 12 34 56 78', '07 00 00 00 02'];

describe('lien « Adhérer en 1 minute » — jeton', () => {
  it('ne contient aucune donnée lisible et ne dépend pas de la mise en forme du numéro', () => {
    const j = signerLienAdhesion('06 12 34 56 78', SECRET, MAINTENANT);
    expect(j).toMatch(/^[0-9a-z]+\.[A-Za-z0-9_-]{22}$/);
    expect(j).not.toMatch(/612345678/);
    expect(signerLienAdhesion('+33 6 12 34 56 78', SECRET, MAINTENANT)).toBe(j);
  });

  it('retrouve la bonne personne parmi les téléphones connus', () => {
    expect(personneDuLien(signerLienAdhesion(TELS[0], SECRET, MAINTENANT), TELS, SECRET, MAINTENANT)).toBe('612345678');
    expect(personneDuLien(signerLienAdhesion(TELS[1], SECRET, MAINTENANT), TELS, SECRET, MAINTENANT)).toBe('700000002');
  });

  it('refuse un jeton modifié, périmé, d’un autre secret ou d’un téléphone inconnu', () => {
    const j = signerLienAdhesion(TELS[0], SECRET, MAINTENANT);
    const [exp, sig] = j.split('.');
    expect(personneDuLien(`${exp}.${sig.slice(0, -1)}x`, TELS, SECRET, MAINTENANT)).toBe('');
    expect(personneDuLien(j, TELS, SECRET, MAINTENANT + 46 * 24 * 3600 * 1000)).toBe('');
    expect(personneDuLien(j, TELS, `${SECRET}x`, MAINTENANT)).toBe('');
    expect(personneDuLien(j, ['06 99 99 99 99'], SECRET, MAINTENANT)).toBe('');
    // Échéance rallongée à la main : la signature ne correspond plus.
    expect(personneDuLien(`zzzzzz.${sig}`, TELS, SECRET, MAINTENANT)).toBe('');
    expect(personneDuLien('', TELS, SECRET, MAINTENANT)).toBe('');
  });

  it('sans secret solide ou sans numéro utilisable : pas de jeton', () => {
    expect(signerLienAdhesion(TELS[0], '', MAINTENANT)).toBe('');
    expect(signerLienAdhesion(TELS[0], 'court', MAINTENANT)).toBe('');
    expect(signerLienAdhesion('0612', SECRET, MAINTENANT)).toBe('');
  });
});

describe('lien « Adhérer en 1 minute » — message « merci » du bureau', () => {
  const texte = (href: string) => decodeURIComponent(href.split('?text=')[1] || '');
  const ligne = { prenom: 'Léa', tel: '06 12 34 56 78', cours: 'Yoga', message: 'B' as const };

  it('avec le jeton : lien personnel ; sans : la page des tarifs, sans promesse de préremplissage', () => {
    const avec = texte(relanceHref({ ...ligne, lienAdhesion: 'abc.def' }));
    expect(avec).toContain(`${SITE_URL}/inscription?e=abc.def`);
    expect(avec).toContain('déjà remplies');
    const sans = texte(relanceHref(ligne));
    expect(sans).toContain(`${SITE_URL}/tarifs`);
    expect(sans).not.toContain('?e=');
    expect(sans).not.toContain('{adhesion}');
    expect(lienAdhesionMessage('')).toBe(`${SITE_URL}/tarifs`);
  });

  it('les autres messages ne changent pas', () => {
    expect(texte(relanceHref({ ...ligne, message: 'A', lienAdhesion: 'abc.def' }))).not.toContain('?e=');
  });
});

describe('lien « Adhérer en 1 minute » — API de préremplissage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../netlify/functions/_bureau-lib.mjs');
  });

  async function charger() {
    vi.resetModules();
    process.env.BUREAU_SECRET = SECRET;
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      getEssaisSheetId: () => 'classeur',
      readSheetAsObjects: async () => ({
        rows: [
          { _row: 2, Prénom: 'Léa', Nom: 'Exemple', Téléphone: '0612345678' },
          { _row: 3, Prénom: 'Zoé', Nom: 'Démo', Téléphone: '0700000002' },
        ],
      }),
    }));
    const { traiter } = await import('../netlify/functions/adhesion-prefill.mjs');
    return traiter as (e: unknown) => Promise<{ statusCode: number; body: string }>;
  }
  const requete = (e: string) => ({ httpMethod: 'GET', headers: { 'x-nf-client-connection-ip': `ip-${e}` }, queryStringParameters: { e } });

  it('un jeton valide renvoie prénom, nom et téléphone, rien d’autre', async () => {
    const traiter = await charger();
    const r = await traiter(requete(signerLienAdhesion('0612345678', SECRET)));
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ ok: true, prenom: 'Léa', nom: 'Exemple', telephone: '06 12 34 56 78' });
  }, { timeout: 20_000 });

  it('jeton inconnu, périmé ou absent : 404 sans explication', async () => {
    const traiter = await charger();
    expect((await traiter(requete('n-importe-quoi'))).statusCode).toBe(404);
    expect((await traiter(requete(''))).statusCode).toBe(404);
    const r = await traiter(requete(signerLienAdhesion('0612345678', SECRET, Date.now() - 60 * 24 * 3600 * 1000)));
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toMatch(/Léa|0612/);
  }, { timeout: 20_000 });

  it('seule la méthode GET est acceptée', async () => {
    const traiter = await charger();
    expect((await traiter({ httpMethod: 'POST', headers: {}, queryStringParameters: {} })).statusCode).toBe(405);
  }, { timeout: 20_000 });
});
