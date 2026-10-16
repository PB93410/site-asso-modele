import { describe, expect, it } from 'vitest';
import { controlerSite, controlesDuSite, sujetProbleme, texteProbleme } from '../netlify/functions/_controle-site.mjs';
import { controleSiteActif } from '../netlify/functions/controle-site.mjs';

const BASE = 'https://exemple.fr';
const sansPause = async () => {};
const TOUS = { essais: true, adhesion: true, espace: true };
const CONTROLES = controlesDuSite(TOUS, 'ASE');

/** Faux fetch : réponses par chemin, consommées dans l'ordre à chaque appel. */
function fauxFetch(reponses: Record<string, ({ status: number; texte?: string } | Error)[]>) {
  const appels: string[] = [];
  const fn = async (url: string) => {
    const chemin = url.replace(BASE, '');
    appels.push(chemin);
    const file = reponses[chemin] || [{ status: 404 }];
    const r = file.length > 1 ? file.shift()! : file[0];
    if (r instanceof Error) throw r;
    return { status: r.status, text: async () => r.texte ?? '' } as Response;
  };
  return { fn: fn as unknown as typeof fetch, appels };
}

const toutBon = () => {
  const r: Record<string, { status: number; texte?: string }[]> = {};
  for (const c of CONTROLES) r[c.chemin] = [{ status: c.attendu, texte: c.contient || 'ok' }];
  return r;
};

describe('contrôle de nuit du site', () => {
  it('ne contrôle que les pages des modules activés', () => {
    const chemins = (m: Record<string, boolean>) => controlesDuSite(m, 'ASE').map((c) => c.chemin);
    expect(chemins(TOUS)).toEqual(['/', '/tarifs/', '/essai/', '/inscription/', '/espace', '/.netlify/functions/health', '/api/essai']);
    expect(chemins({ essais: false, adhesion: true, espace: false })).toEqual(['/', '/tarifs/', '/inscription/', '/.netlify/functions/health']);
  });

  it('tout répond : rien à signaler', async () => {
    const { fn } = fauxFetch(toutBon());
    expect(await controlerSite(fn, BASE, CONTROLES, 0, sansPause)).toEqual([]);
  });

  it('une page en 404 est signalée après un second essai', async () => {
    const r = toutBon();
    r['/essai/'] = [{ status: 404 }];
    const { fn, appels } = fauxFetch(r);
    const echecs = await controlerSite(fn, BASE, CONTROLES, 0, sansPause);
    expect(echecs).toEqual([{ nom: 'Essai', chemin: '/essai/', attendu: 200, recu: 'code 404' }]);
    expect(appels.filter((p) => p === '/essai/')).toHaveLength(2);
    expect(appels.filter((p) => p === '/tarifs/')).toHaveLength(1);
  });

  it('un échec passager (le second essai réussit) ne donne aucune alerte', async () => {
    const r = toutBon();
    r['/tarifs/'] = [{ status: 502 }, { status: 200, texte: 'ok' }];
    const { fn } = fauxFetch(r);
    expect(await controlerSite(fn, BASE, CONTROLES, 0, sansPause)).toEqual([]);
  });

  it('une page blanche en 200 et un serveur injoignable sont des problèmes', async () => {
    const r = toutBon();
    r['/'] = [{ status: 200, texte: '<html></html>' }];
    r['/.netlify/functions/health'] = [new Error('boom')];
    const { fn } = fauxFetch(r);
    const echecs = await controlerSite(fn, BASE, CONTROLES, 0, sansPause);
    expect(echecs.map((e) => [e.chemin, e.recu])).toEqual([
      ['/', 'page vide ou inattendue'],
      ['/.netlify/functions/health', 'injoignable'],
    ]);
  });

  it('le mail dit quoi faire et ne contient aucune donnée personnelle', () => {
    const echecs = [{ nom: 'Essai', chemin: '/essai/', attendu: 200, recu: 'code 404' }];
    expect(sujetProbleme(echecs, 'ASE')).toBe('[ASE] Le site a un problème (1 page)');
    const texte = texteProbleme(echecs, BASE);
    expect(texte).toContain('Essai (/essai/) : code 404, attendu 200');
    expect(texte).toContain('Publish deploy');
    expect(texte).not.toMatch(/@|\b0[67] ?\d{2}/);
  });

  it('éteint sans envoi de mail, en démo, ou avec CONTROLE_SITE=non', () => {
    expect(controleSiteActif({})).toBe(false);
    expect(controleSiteActif({ MAIL_ENVOI: 'brevo', CONTROLE_SITE: 'non' })).toBe(false);
  });
});
