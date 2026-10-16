/**
 * Inscriptions aux événements de l'association (modules.inscriptionsEvenements) : sortie, repas, marche…
 *
 * Le bureau ouvre les inscriptions d'un événement (nombre de places, covoiturage ou non) ; le public s'inscrit
 * depuis /evenements. Le tableau des événements n'est pas modifié : tout est dans le store « evenements »
 * (Netlify Blobs, lecture forte, écritures protégées : deux inscriptions simultanées ne s'écrasent pas et ne
 * dépassent pas les places). En démo : en mémoire.
 *   - « config »            : { [slug]: { titre, places, covoiturage, ouvert } }
 *   - « inscriptions-<slug> » : [{ id, prenom, nom, tel, personnes, covoiturage, le }]
 * Données personnelles : prénom, nom, téléphone, commune de départ. Effacées par le bureau après l'événement
 * (« Clore et effacer »), jamais gardées au-delà.
 */

import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { DEMO } from './_demo.mjs';
import { modifierBlob } from './_stockage.mjs';

export const STORE = 'evenements';
export const MAX_PERSONNES = 4;
export const MAX_PLACES_PROPOSEES = 6;

const SLUG_RE = /^[a-z0-9-]{3,80}$/;
const NOM_RE = /^[\p{L}][\p{L}' ’-]{1,39}$/u;

export const slugValide = (slug) => SLUG_RE.test(String(slug || ''));

const propre = (s, max) =>
  String(s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Téléphone français sur 10 chiffres, sinon ''. */
export function telephoneNational(brut) {
  const t = String(brut || '').replace(/[\s.-]/g, '').replace(/^\+33/, '0').replace(/^0033/, '0');
  return /^0[1-9]\d{8}$/.test(t) ? t : '';
}

/**
 * Contrôle d'une inscription envoyée par le public.
 * @returns {{ ok: true, champs: object } | { ok: false, erreur: string }}
 */
export function validerInscription(corps) {
  const c = corps || {};
  const prenom = propre(c.prenom, 40);
  const nom = propre(c.nom, 40);
  if (!NOM_RE.test(prenom)) return { ok: false, erreur: 'Indiquez votre prénom.' };
  if (!NOM_RE.test(nom)) return { ok: false, erreur: 'Indiquez votre nom.' };
  const tel = telephoneNational(c.telephone);
  if (!tel) return { ok: false, erreur: 'Téléphone : 10 chiffres, par exemple 06 12 34 56 78.' };
  const personnes = Number(c.personnes);
  if (!Number.isInteger(personnes) || personnes < 1 || personnes > MAX_PERSONNES) {
    return { ok: false, erreur: `Le nombre de personnes va de 1 à ${MAX_PERSONNES}.` };
  }
  const mode = ['propose', 'cherche'].includes(c.covoiturage) ? c.covoiturage : '';
  let places = 0;
  if (mode === 'propose') {
    places = Number(c.places_covoiturage);
    if (!Number.isInteger(places) || places < 1 || places > MAX_PLACES_PROPOSEES) {
      return { ok: false, erreur: `Places proposées en covoiturage : de 1 à ${MAX_PLACES_PROPOSEES}.` };
    }
  }
  return {
    ok: true,
    champs: {
      prenom,
      nom,
      tel,
      personnes,
      covoiturage: { mode, places, depart: mode ? propre(c.depart, 60) : '' },
    },
  };
}

/** Personnes déjà inscrites (une inscription peut en compter plusieurs). */
export const placesPrises = (inscriptions) => (inscriptions || []).reduce((s, i) => s + (Number(i.personnes) || 0), 0);

/**
 * L'inscription est-elle possible ? `config.places` = 0 ou absent : places illimitées.
 * @returns {{ ok: true } | { ok: false, code: number, erreur: string }}
 */
export function peutInscrire(config, inscriptions, champs) {
  if (!config || !config.ouvert) return { ok: false, code: 404, erreur: 'Les inscriptions ne sont pas ouvertes pour cet événement.' };
  if ((inscriptions || []).some((i) => i.tel === champs.tel)) {
    return { ok: false, code: 409, erreur: 'Ce numéro de téléphone est déjà inscrit à cet événement.' };
  }
  const places = Number(config.places) || 0;
  if (places > 0 && placesPrises(inscriptions) + champs.personnes > places) {
    const restantes = Math.max(0, places - placesPrises(inscriptions));
    return {
      ok: false,
      code: 409,
      erreur: restantes ? `Il ne reste que ${restantes} place${restantes > 1 ? 's' : ''}.` : 'Cet événement est complet.',
    };
  }
  return { ok: true };
}

/** Ce que le public voit d'un événement ouvert : jamais un nom ni un numéro. */
export function resumePublic(config, inscriptions) {
  const places = Number(config.places) || 0;
  const prises = placesPrises(inscriptions);
  return {
    titre: config.titre,
    places: places || null,
    restantes: places ? Math.max(0, places - prises) : null,
    complet: places > 0 && prises >= places,
    covoiturage: Boolean(config.covoiturage),
  };
}

/** Une inscription prête à ranger, avec son identifiant et sa date (AAAA-MM-JJ). */
export const nouvelleInscription = (champs, le) => ({ id: randomUUID(), ...champs, le });

/** Config saisie par le bureau → config rangée, ou null si elle est invalide. */
export function configDuBureau(corps) {
  const slug = String(corps?.slug || '');
  const titre = propre(corps?.titre, 120);
  const places = Number(corps?.places) || 0;
  if (!slugValide(slug) || titre.length < 3) return null;
  if (!Number.isInteger(places) || places < 0 || places > 500) return null;
  return { slug, config: { titre, places, covoiturage: Boolean(corps?.covoiturage), ouvert: true } };
}

// ---------------------------------------------------------------------------
// Stockage
// ---------------------------------------------------------------------------

function storeMemoire() {
  const m = new Map();
  let version = 0;
  return {
    get: async (cle) => (m.has(cle) ? JSON.parse(JSON.stringify(m.get(cle).data)) : null),
    getWithMetadata: async (cle) => (m.has(cle) ? { data: JSON.parse(JSON.stringify(m.get(cle).data)), etag: m.get(cle).etag } : null),
    setJSON: async (cle, valeur) => {
      version += 1;
      m.set(cle, { data: JSON.parse(JSON.stringify(valeur)), etag: `"v${version}"` });
      return { modified: true };
    },
    delete: async (cle) => void m.delete(cle),
  };
}
let memoireDemo = null;
const store = () => (DEMO ? (memoireDemo ||= storeMemoire()) : getStore({ name: STORE, consistency: 'strong' }));

export async function lireConfig() {
  const brut = await store().get('config', { type: 'json' }).catch(() => null);
  const out = {};
  for (const [slug, c] of Object.entries(brut || {})) {
    if (slugValide(slug) && c && typeof c.titre === 'string') out[slug] = c;
  }
  return out;
}

/** Modifie la config d'un tenant (fn reçoit la config lue, la modifie et renvoie un résultat). */
export const modifierConfig = (fn) =>
  modifierBlob(store(), 'config', (brut) => {
    const config = { ...(brut || {}) };
    const res = fn(config);
    return { valeur: config, res };
  });

export async function lireInscriptions(slug) {
  const l = await store().get(`inscriptions-${slug}`, { type: 'json' }).catch(() => null);
  return Array.isArray(l) ? l : [];
}

/** Modifie la liste d'un événement d'un tenant : fn(liste lue) → { liste, res }. */
export const modifierInscriptions = (slug, fn) =>
  modifierBlob(store(), `inscriptions-${slug}`, (brut) => {
    const { liste, res } = fn(Array.isArray(brut) ? brut : []);
    return { valeur: liste, res };
  });

export const effacerInscriptions = (slug) => store().delete(`inscriptions-${slug}`);
