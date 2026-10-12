/**
 * Où sont rangées les données du bureau (essais, adhérents, planning et événements) :
 *
 *   netlify : Netlify Blobs, avec le site. Rien à créer ni à partager, pas de compte Google.
 *             Le bureau est l'interface ; export Excel (CSV) et sauvegarde hebdomadaire par mail.
 *   google  : Google Sheets (compte de service), comme avant.
 *
 * Choix : STOCKAGE=netlify|google, sinon google si GOOGLE_SERVICE_ACCOUNT_JSON est présente,
 * sinon netlify. En démo : faux classeur en mémoire (_demo.mjs).
 *
 * Un onglet = une entrée du store « donnees » (clé `<classeur>/<onglet>`), écrite d'un seul
 * tenant avec contrôle de version : deux bénévoles qui écrivent en même temps ne s'écrasent pas.
 */

import { connectLambda, getStore } from '@netlify/blobs';
import { DEMO } from './_demo.mjs';
import { tableurValues } from './_tableur.mjs';

export const STORE_DONNEES = 'donnees';
export const MODES_STOCKAGE = ['netlify', 'google'];

/** Classeurs du stockage Netlify (les ID Google ne servent pas). */
export const CLASSEURS = { adherents: 'adherents', essais: 'essais', site: 'site' };

export function modeStockage(env = process.env, demo = DEMO) {
  if (demo) return 'demo';
  const choix = String(env.STOCKAGE || '').trim().toLowerCase();
  if (MODES_STOCKAGE.includes(choix)) return choix;
  return String(env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim() ? 'google' : 'netlify';
}

export const surNetlify = (env = process.env) => modeStockage(env) === 'netlify';

/** À appeler en tête de chaque fonction qui lit ou écrit les données (fonctions « Lambda »). */
export function brancherStockage(event) {
  if (!event?.blobs) return;
  const headers = {};
  for (const [key, value] of Object.entries(event.headers || {})) headers[String(key).toLowerCase()] = value;
  connectLambda({ ...event, headers });
}

export const cleOnglet = (id, tab) => `${id}/${tab}`;

/** Store des données (remplaçable en test via vi.mock de @netlify/blobs). */
export const storeDonnees = () => getStore({ name: STORE_DONNEES, consistency: 'strong' });

/**
 * Lit, modifie et réécrit une entrée JSON d'un seul tenant : si quelqu'un a écrit entre-temps,
 * on relit et on recommence. fn(données lues ou null) → { valeur à écrire, res renvoyé }.
 */
export async function modifierBlob(s, cle, fn, essais = 8) {
  for (let i = 0; i < essais; i += 1) {
    const lu = await s.getWithMetadata(cle, { type: 'json' });
    const { valeur, res } = fn(lu?.data ?? null);
    const ecrit = await s.setJSON(cle, valeur, lu?.etag ? { onlyIfMatch: lu.etag } : { onlyIfNew: true });
    if (ecrit?.modified !== false) return res;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120 * (i + 1)));
  }
  throw Object.assign(new Error('Données occupées : réessayez dans un instant.'), { code: 409 });
}

/**
 * Classeur sur Netlify Blobs, avec la même API que Google Sheets (spreadsheets.values.*).
 * @param {{ store?: () => any, seed?: (id: string, tab: string) => string[][], essais?: number }} opts
 *   store : le store Blobs (remplaçable en test) ; seed : lignes d'un onglet encore jamais écrit.
 */
export function blobSheets({ store = storeDonnees, seed = () => [], essais = 8 } = {}) {
  const lire = async (id, tab) => {
    const data = await store().get(cleOnglet(id, tab), { type: 'json' });
    return Array.isArray(data?.rows) ? data.rows : seed(id, tab).map((r) => [...r]);
  };
  const modifier = (id, tab, fn) =>
    modifierBlob(store(), cleOnglet(id, tab), (data) => {
      const rows = Array.isArray(data?.rows) ? data.rows : seed(id, tab).map((r) => [...r]);
      const res = fn(rows);
      return { valeur: { rows, maj: new Date().toISOString() }, res };
    }, essais);
  return tableurValues({ lire, modifier });
}
