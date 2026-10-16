/**
 * « Ma carte sans internet » (modules.carteHorsLigne) : la personne choisit de garder sa carte sur ce téléphone.
 * Rien n'est gardé sans ce choix. « Retirer » et « Quitter » effacent tout (public/sw-carte.js).
 * Les noms de cache doivent rester identiques à ceux de public/sw-carte.js.
 */

export const CACHE_HORS_LIGNE = 'carte-hors-ligne-v1';
export const MARQUEUR_HORS_LIGNE = '/__carte-hors-ligne-actif';

/** Le navigateur sait-il garder des fichiers hors ligne ? (https ou localhost) */
export function horsLigneDisponible(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'caches' in window;
}

export async function horsLigneActif(): Promise<boolean> {
  if (!horsLigneDisponible()) return false;
  try {
    const cache = await caches.open(CACHE_HORS_LIGNE);
    return Boolean(await cache.match(MARQUEUR_HORS_LIGNE));
  } catch {
    return false;
  }
}

/** Adresses de cette page et de ses fichiers (même origine), à garder pour qu'elle s'ouvre hors ligne. */
export function fichiersDeLaPage(): string[] {
  const urls = new Set<string>(['/espace']);
  for (const e of performance.getEntriesByType('resource')) {
    const u = new URL(e.name, window.location.href);
    if (u.origin === window.location.origin && u.pathname.startsWith('/assets/')) urls.add(u.pathname + u.search);
  }
  return [...urls];
}

/** Attend que ce worker soit actif (serviceWorker.ready suivrait celui de la portée de la page, peut-être un autre). */
function attendreActif(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return Promise.resolve();
  const w = reg.installing || reg.waiting;
  if (!w) return Promise.resolve();
  return new Promise((resolve) => {
    const fin = window.setTimeout(resolve, 3000);
    w.addEventListener('statechange', () => {
      if (w.state === 'activated') {
        window.clearTimeout(fin);
        resolve();
      }
    });
  });
}

/**
 * Active la copie hors ligne : installe le service worker, pose le repère, puis relit la page, la fiche et la
 * carte pour qu'elles entrent dans le cache. `adresses` = ce que la page affiche (fiche, image de la carte).
 */
export async function activerHorsLigne(adresses: string[]): Promise<void> {
  if (!horsLigneDisponible()) throw new Error('indisponible');
  // Portée /espace : le worker des alertes (portée /) n'est pas remplacé.
  const reg = await navigator.serviceWorker.register('/sw-carte.js', { scope: '/espace' });
  await attendreActif(reg);
  const cache = await caches.open(CACHE_HORS_LIGNE);
  await cache.put(MARQUEUR_HORS_LIGNE, new Response('1'));
  // Le worker prend la main sur cette page au plus tôt (même si celui des alertes la tenait) ; on laisse un instant.
  if (!navigator.serviceWorker.controller?.scriptURL.endsWith('/sw-carte.js')) {
    await new Promise<void>((resolve) => {
      const fin = window.setTimeout(resolve, 1500);
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          window.clearTimeout(fin);
          resolve();
        },
        { once: true },
      );
    });
  }
  const toutes = [...new Set([...fichiersDeLaPage(), ...adresses])];
  await Promise.all(toutes.map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
}

/** Efface la copie (carte, fiche, page) et le repère : le worker redevient transparent. */
export async function oublierHorsLigne(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    await caches.delete(CACHE_HORS_LIGNE);
  } catch {
    /* rien à effacer */
  }
}
