import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { CACHE_HORS_LIGNE, MARQUEUR_HORS_LIGNE } from '../src/lib/horsLigne';

const SW = fs.readFileSync(path.join(__dirname, '../public/sw-carte.js'), 'utf8');
const ORIGINE = 'https://exemple.fr';

/** Charge public/sw-carte.js dans un bac à sable : faux cache, faux réseau, faux événements. */
function monter(reseau: (url: string) => Response | Error) {
  const stock = new Map<string, Response>();
  const appels: string[] = [];
  const norm = (k: string | Request) => String(typeof k === 'string' ? k : k.url).replace(ORIGINE, '');
  const cache = {
    match: async (k: string | Request) => stock.get(norm(k))?.clone(),
    put: async (k: string | Request, r: Response) => void stock.set(norm(k), r),
  };
  const ecouteurs: Record<string, (e: unknown) => void> = {};
  const contexte = {
    self: {
      location: { origin: ORIGINE },
      addEventListener: (type: string, fn: (e: unknown) => void) => void (ecouteurs[type] = fn),
      skipWaiting: () => {},
      clients: { claim: async () => {} },
    },
    caches: { open: async () => cache },
    fetch: async (req: Request) => {
      appels.push(norm(req));
      const r = reseau(norm(req));
      if (r instanceof Error) throw r;
      return r;
    },
    URL,
    Response,
  };
  vm.runInNewContext(SW, contexte);
  /** Envoie une requête au worker : renvoie la réponse, ou null si le worker laisse passer (pas d'interception). */
  async function requete(url: string, methode = 'GET') {
    let reponse: Promise<Response> | null = null;
    ecouteurs.fetch({
      request: { method: methode, url: `${ORIGINE}${url}` },
      respondWith: (p: Promise<Response>) => void (reponse = p),
    });
    return reponse;
  }
  return { stock, appels, requete, activer: () => stock.set(MARQUEUR_HORS_LIGNE, new Response('1')) };
}

const ok = (corps: string) => new Response(corps, { status: 200 });

describe('service worker « ma carte sans internet »', () => {
  it('les noms de cache sont les mêmes que dans l’application', () => {
    expect(SW).toContain(`const CACHE = '${CACHE_HORS_LIGNE}';`);
    expect(SW).toContain(`const MARQUEUR = '${MARQUEUR_HORS_LIGNE}';`);
  });

  it('sans le choix de la personne : transparent, rien n’est gardé', async () => {
    const sw = monter(() => ok('page'));
    const r = await sw.requete('/api/espace?action=moi');
    expect(await (await r!).text()).toBe('page');
    expect(sw.stock.size).toBe(0);
  });

  it('avec le choix : réseau d’abord, copie gardée, rendue hors ligne', async () => {
    let enLigne = true;
    const sw = monter((u) => (enLigne ? ok(`reseau:${u}`) : new Error('hors ligne')));
    sw.activer();
    expect(await (await (await sw.requete('/api/espace?action=moi'))!).text()).toBe('reseau:/api/espace?action=moi');
    enLigne = false;
    expect(await (await (await sw.requete('/api/espace?action=moi'))!).text()).toBe('reseau:/api/espace?action=moi');
  });

  it('en ligne, la version du serveur gagne toujours sur la copie', async () => {
    let version = 'v1';
    const sw = monter(() => ok(version));
    sw.activer();
    await sw.requete('/espace');
    version = 'v2';
    expect(await (await (await sw.requete('/espace'))!).text()).toBe('v2');
  });

  it('/espace et /espace/ sont la même page gardée', async () => {
    let enLigne = true;
    const sw = monter(() => (enLigne ? ok('shell') : new Error('hors ligne')));
    sw.activer();
    await sw.requete('/espace/');
    enLigne = false;
    expect(await (await (await sw.requete('/espace'))!).text()).toBe('shell');
  });

  it('hors ligne et rien en copie : l’erreur réseau est rendue telle quelle', async () => {
    const sw = monter(() => new Error('hors ligne'));
    sw.activer();
    await expect(sw.requete('/api/espace?action=carte&cle=X')).rejects.toThrow('hors ligne');
  });

  it('ne touche à rien d’autre : attestations, données, bureau, POST, autre site', async () => {
    const sw = monter(() => ok('x'));
    sw.activer();
    for (const u of [
      '/api/espace?action=attestation&cle=X',
      '/api/espace?action=donnees',
      '/api/bureau-auth',
      '/api/essais-list',
      '/bureau',
      '/blog/',
    ]) {
      expect(await sw.requete(u), u).toBeNull();
    }
    expect(await sw.requete('/api/espace?action=moi', 'POST')).toBeNull();
    expect(sw.stock.has('/api/espace?action=attestation&cle=X')).toBe(false);
  });

  it('garde les fichiers de la page (/assets/) mais pas les réponses en erreur', async () => {
    const sw = monter((u) => (u.includes('manquant') ? new Response('non', { status: 404 }) : ok('js')));
    sw.activer();
    await sw.requete('/assets/index-abc.js');
    await sw.requete('/assets/manquant.js');
    expect(sw.stock.has('/assets/index-abc.js')).toBe(true);
    expect(sw.stock.has('/assets/manquant.js')).toBe(false);
  });
});
