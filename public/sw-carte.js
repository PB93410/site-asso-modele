/*
 * Service worker « ma carte sans internet » (espace adhérent, modules.carteHorsLigne). Portée : /espace seulement,
 * pour ne pas remplacer celui des alertes (sw-alertes.js, portée /).
 *
 * Inactif tant que la personne n'a pas demandé « Garder ma carte sur ce téléphone » : sans le repère
 * ci-dessous dans le cache, il laisse passer chaque requête telle quelle. Actif, il suit « réseau d'abord » :
 * en ligne, le site est toujours celui du serveur (jamais une vieille version) ; hors ligne, il rend la
 * dernière copie de la page, de ses fichiers, de la fiche et de la carte de CETTE personne.
 * « Quitter » ou « Retirer » vide le cache (src/lib/horsLigne.ts).
 *
 * Les noms ci-dessous doivent rester identiques à src/lib/horsLigne.ts (tests/horsLigne.test.ts le vérifie).
 */
const CACHE = 'carte-hors-ligne-v1';
const MARQUEUR = '/__carte-hors-ligne-actif';

/** Ce qui peut être gardé : la page, ses fichiers, la fiche et la carte. Rien d'autre (ni attestations, ni bureau). */
function autorise(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  if (p === '/espace' || p === '/espace/') return true;
  if (p.startsWith('/assets/')) return true;
  if (p === '/api/espace') {
    const action = url.searchParams.get('action');
    return action === 'moi' || action === 'carte';
  }
  return false;
}

/** Clé de cache : /espace et /espace/ sont la même page, sans paramètre. */
function cle(url) {
  if (url.pathname === '/espace' || url.pathname === '/espace/') return '/espace';
  return url.pathname + url.search;
}

async function repondre(request, url) {
  const cache = await caches.open(CACHE);
  if (!(await cache.match(MARQUEUR))) return fetch(request);
  const k = cle(url);
  try {
    const res = await fetch(request);
    if (res.ok && res.status === 200) {
      try {
        await cache.put(k, res.clone());
      } catch (e) {
        /* cache plein ou réponse non gardable : on sert quand même la réponse du réseau */
      }
    }
    return res;
  } catch (err) {
    const gardee = await cache.match(k, { ignoreVary: true });
    if (gardee) return gardee;
    throw err;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!autorise(url)) return;
  event.respondWith(repondre(request, url));
});
