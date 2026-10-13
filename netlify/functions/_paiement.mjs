/**
 * Paiement de l'adhésion en ligne.
 *
 * Mode (variable PAIEMENT, sinon déduit) :
 *   helloasso → paiement HelloAsso créé par le site ; l'adhésion passe « À jour » toute seule
 *               quand HelloAsso confirme (retour du payeur, notification, ou rattrapage horaire).
 *   lien      → simple lien vers la page de paiement (asso.config.js → adhesion.paiementUrl) :
 *               le site ne sait pas qui a payé, le bureau pointe à la main.
 *   aucun     → pas de paiement en ligne.
 *
 * Chaque demande d'adhésion reçoit une référence (ex. ASE-K7M4QP), écrite dans DETAIL : elle relie
 * le paiement HelloAsso à la ligne, et sert de libellé pour un virement.
 *
 * Rien de ce que HelloAsso (ou un navigateur) nous envoie n'est cru sur parole : on relit toujours
 * le paiement auprès de l'API HelloAsso avant de valider une adhésion.
 */

import { getStore } from '@netlify/blobs';
import { ASSO, MODE_CARTE, SITE_URL } from '../../asso.derive.js';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  isPendingAdhesion,
  pickRow,
  readSheetAsObjects,
  updateRowByHeaders,
} from './_bureau-lib.mjs';
import { numeroPourLigne } from './_adhesion-numero.mjs';
import { DEMO } from './_demo.mjs';
import { adresseAsso, envoyerMail } from './_envoi.mjs';
import { modifierBlob } from './_stockage.mjs';

export const MODES_PAIEMENT = ['helloasso', 'lien', 'aucun'];

/** helloasso | lien | aucun (demo en démo : HelloAsso simulé). */
export function modePaiement(env = process.env, demo = DEMO) {
  const choix = String(env.PAIEMENT || '').trim().toLowerCase();
  if (choix === 'aucun') return 'aucun';
  if (demo && choix !== 'lien') return ASSO.adhesion.paiementUrl ? 'demo' : 'aucun';
  if (MODES_PAIEMENT.includes(choix)) return choix;
  if (String(env.HELLOASSO_CLIENT_ID || '').trim()) return 'helloasso';
  return ASSO.adhesion.paiementUrl ? 'lien' : 'aucun';
}

/** Le site crée et vérifie lui-même le paiement (HelloAsso, ou sa simulation en démo). */
export const paiementIntegre = (env = process.env, demo = DEMO) => ['helloasso', 'demo'].includes(modePaiement(env, demo));

/** Adresse publique du site (retours HelloAsso). */
export function origineSite(env = process.env) {
  return String(env.SITE_ORIGIN || env.URL || SITE_URL).replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Référence de paiement
// ---------------------------------------------------------------------------

/** Lettres et chiffres sans confusion possible (pas de 0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function nouvelleReference(alea = Math.random) {
  let s = '';
  for (let i = 0; i < 6; i += 1) s += ALPHABET[Math.floor(alea() * ALPHABET.length)];
  return `${ASSO.sigle}-${s}`;
}

const motifReference = () => new RegExp(`\\b${ASSO.sigle}-[${ALPHABET}]{6}\\b`);

/** Référence trouvée dans un texte (DETAIL, libellé de virement…), en majuscules. */
export function lireReference(texte) {
  return String(texte || '').toUpperCase().match(motifReference())?.[0] || '';
}

export const referenceValide = (ref) => lireReference(ref) === String(ref || '');

// ---------------------------------------------------------------------------
// API HelloAsso
// ---------------------------------------------------------------------------

const vrai = (v) => /^(1|true|oui)$/i.test(String(v || '').trim());

export function hoteHelloAsso(env = process.env) {
  return vrai(env.HELLOASSO_SANDBOX) ? 'https://api.helloasso-sandbox.com' : 'https://api.helloasso.com';
}

export function reglagesHelloAsso(env = process.env) {
  const a = (k) => String(env[k] || '').trim();
  return {
    hote: hoteHelloAsso(env),
    clientId: a('HELLOASSO_CLIENT_ID'),
    clientSecret: a('HELLOASSO_CLIENT_SECRET'),
    organisation: a('HELLOASSO_ORGANISATION'),
    sandbox: vrai(env.HELLOASSO_SANDBOX),
  };
}

function erreurLisible(message, status) {
  return Object.assign(new Error(message), { lisible: true, status });
}

let jetonCache = { cle: '', valeur: '', expire: 0 };

/** Jeton d'accès (identifiants client), gardé en mémoire jusqu'à une minute avant expiration. */
export async function jetonHelloAsso(env = process.env, f = fetch) {
  const r = reglagesHelloAsso(env);
  if (!r.clientId || !r.clientSecret) throw erreurLisible('HelloAsso : HELLOASSO_CLIENT_ID et HELLOASSO_CLIENT_SECRET manquants.');
  const cle = `${r.hote}|${r.clientId}`;
  if (jetonCache.cle === cle && jetonCache.expire > Date.now()) return jetonCache.valeur;
  const res = await f(`${r.hote}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: r.clientId, client_secret: r.clientSecret }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw erreurLisible(`HelloAsso refuse les identifiants (HTTP ${res.status}) : vérifiez HELLOASSO_CLIENT_ID et HELLOASSO_CLIENT_SECRET${r.sandbox ? ' (compte de test)' : ''}.`, res.status);
  }
  const duree = Number(data.expires_in) || 1800;
  jetonCache = { cle, valeur: data.access_token, expire: Date.now() + Math.max(60, duree - 60) * 1000 };
  return data.access_token;
}

export function oublierJeton() {
  jetonCache = { cle: '', valeur: '', expire: 0 };
}

async function appelHelloAsso(chemin, { method = 'GET', body } = {}, env = process.env, f = fetch) {
  const r = reglagesHelloAsso(env);
  if (!r.organisation) throw erreurLisible('HelloAsso : HELLOASSO_ORGANISATION manquante (le nom court de l’asso dans l’adresse HelloAsso).');
  const jeton = await jetonHelloAsso(env, f);
  const res = await f(`${r.hote}/v5/organizations/${encodeURIComponent(r.organisation)}${chemin}`, {
    method,
    headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) oublierJeton();
    const detail = Array.isArray(data?.errors) ? data.errors.map((e) => e?.message).filter(Boolean).join(' ; ') : data?.message || '';
    throw Object.assign(erreurLisible(`HelloAsso a répondu HTTP ${res.status}${detail ? ` : ${detail}` : ''}.`, res.status), { reponse: data });
  }
  return data;
}

/** Contrôle des réglages (npm run verifier) : jeton, puis fiche de l'association → son nom. */
export async function verifierHelloAsso(env = process.env, f = fetch) {
  const org = await appelHelloAsso('', {}, env, f);
  return String(org?.name || reglagesHelloAsso(env).organisation);
}

/** Montant d'une fiche en centimes : colonne MONTANT (reste à payer après aides), sinon le tarif. */
export function centimesDe(montant) {
  const n = Number(String(montant ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
  const euros = String(montant ?? '').trim() !== '' && Number.isFinite(n) ? n : Number(ASSO.adhesion.tarif);
  return Math.round(euros * 100);
}

const enEuros = (centimes) => `${(centimes / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;

/** Corps de création du paiement (montants en centimes). */
export function corpsPaiement({ reference, prenom, nom, email, centimes = centimesDe('') }, origine, avecPayeur = true) {
  const qui = `${prenom || ''} ${nom || ''}`.replace(/\s+/g, ' ').trim();
  const ref = encodeURIComponent(reference);
  const corps = {
    totalAmount: centimes,
    initialAmount: centimes,
    itemName: `Adhésion ${ASSO.saison.label}${qui ? ` — ${qui}` : ''}`.slice(0, 250),
    backUrl: `${origine}/inscription?ok=1&mode=carte&paiement=annule&ref=${ref}`,
    errorUrl: `${origine}/api/paiement-retour?ref=${ref}&erreur=1`,
    returnUrl: `${origine}/api/paiement-retour?ref=${ref}`,
    containsDonation: false,
    metadata: { reference },
  };
  if (avecPayeur) {
    const payer = {};
    if (prenom) payer.firstName = String(prenom).slice(0, 255);
    if (nom) payer.lastName = String(nom).slice(0, 255);
    if (email) payer.email = String(email).slice(0, 255);
    if (Object.keys(payer).length) corps.payer = payer;
  }
  return corps;
}

/** Crée le paiement chez HelloAsso → { id, redirectUrl }. */
export async function creerIntention(personne, env = process.env, f = fetch) {
  const origine = origineSite(env);
  try {
    return await appelHelloAsso('/checkout-intents', { method: 'POST', body: corpsPaiement(personne, origine) }, env, f);
  } catch (err) {
    // Nom ou mail refusés par HelloAsso (caractères, format) : on laisse le payeur les saisir.
    if (err?.status === 400) return appelHelloAsso('/checkout-intents', { method: 'POST', body: corpsPaiement(personne, origine, false) }, env, f);
    throw err;
  }
}

export function lireIntention(id, env = process.env, f = fetch) {
  return appelHelloAsso(`/checkout-intents/${encodeURIComponent(id)}`, {}, env, f);
}

const ETATS_PAYES = new Set(['Authorized', 'Registered']);
const ETATS_REFUSES = new Set(['Refused', 'Canceled', 'Abandoned', 'Error', 'Refunded', 'Refunding', 'Contested']);

/**
 * Lecture d'un paiement relu chez HelloAsso.
 * @returns {{ etat: 'paye' | 'attente' | 'refuse', commande?: string, montant?: number }}
 */
export function etatPaiement(intention, reference, attenduCentimes = centimesDe('')) {
  if (!intention || intention?.metadata?.reference !== reference) return { etat: 'attente' };
  const commande = intention.order;
  if (!commande) return { etat: 'attente' };
  const paiements = Array.isArray(commande.payments) ? commande.payments : [];
  const payes = paiements.filter((p) => ETATS_PAYES.has(p?.state));
  const montant = Number(commande.amount?.total) || payes.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (payes.length && montant >= attenduCentimes) return { etat: 'paye', commande: String(commande.id || ''), montant };
  if (paiements.length && paiements.every((p) => ETATS_REFUSES.has(p?.state))) return { etat: 'refuse' };
  return { etat: 'attente' };
}

// ---------------------------------------------------------------------------
// Démo : HelloAsso simulé (aucun appel, paiement toujours accepté)
// ---------------------------------------------------------------------------

const montantsDemo = new Map();
export const demoHelloAsso = {
  creerIntention: async ({ reference, centimes = centimesDe('') }) => {
    montantsDemo.set(`demo-${reference}`, centimes);
    return {
      id: `demo-${reference}`,
      redirectUrl: `/api/paiement-retour?ref=${encodeURIComponent(reference)}&checkoutIntentId=demo-${encodeURIComponent(reference)}`,
    };
  },
  lireIntention: async (id) => {
    const reference = String(id).replace(/^demo-/, '');
    const centimes = montantsDemo.get(String(id)) ?? centimesDe('');
    return {
      id,
      metadata: { reference },
      order: { id: 4242, amount: { total: centimes }, payments: [{ id: 1, amount: centimes, state: 'Authorized' }] },
    };
  },
};

const vraiHelloAsso = {
  creerIntention: (personne, env) => creerIntention(personne, env),
  lireIntention: (id, env) => lireIntention(id, env),
};

export const clientHelloAsso = (env = process.env, demo = DEMO) => (modePaiement(env, demo) === 'demo' ? demoHelloAsso : vraiHelloAsso);

// ---------------------------------------------------------------------------
// Suivi des paiements ouverts (Netlify Blobs)
// ---------------------------------------------------------------------------

export const STORE_PAIEMENTS = 'paiements';
const CLE_SUIVI = 'suivi';
const JOUR = 86_400_000;
/** Un paiement ouvert est relu par le rattrapage pendant 7 jours, puis oublié au bout de 30. */
export const DUREE_RATTRAPAGE = 7 * JOUR;
const DUREE_OUBLI = 30 * JOUR;

function storeMemoire() {
  const m = new Map();
  let v = 0;
  return {
    async getWithMetadata(cle) {
      return m.has(cle) ? { data: JSON.parse(JSON.stringify(m.get(cle).data)), etag: m.get(cle).etag } : null;
    },
    async setJSON(cle, valeur, opts = {}) {
      const e = m.get(cle);
      if ((opts.onlyIfNew && e) || (opts.onlyIfMatch && e?.etag !== opts.onlyIfMatch)) return { modified: false };
      v += 1;
      m.set(cle, { data: JSON.parse(JSON.stringify(valeur)), etag: `v${v}` });
      return { modified: true };
    },
  };
}

let memoireDemo = null;
export const storePaiements = () =>
  DEMO ? (memoireDemo ||= storeMemoire()) : getStore({ name: STORE_PAIEMENTS, consistency: 'strong' });

/** Applique fn(suivi) au suivi des paiements (écriture protégée), en oubliant les entrées trop vieilles. */
async function modifierSuivi(s, fn, maintenant = Date.now()) {
  return modifierBlob(s, CLE_SUIVI, (lu) => {
    const suivi = {};
    for (const [ref, e] of Object.entries(lu || {})) if (maintenant - (e?.cree || 0) < DUREE_OUBLI) suivi[ref] = e;
    const res = fn(suivi);
    return { valeur: suivi, res };
  });
}

export async function lireSuivi(s = storePaiements()) {
  return (await s.getWithMetadata(CLE_SUIVI))?.data || {};
}

/** Note un paiement créé pour une référence, avec le montant attendu (centimes). */
export function noterIntention(reference, id, s = storePaiements(), maintenant = Date.now(), centimes = centimesDe('')) {
  return modifierSuivi(s, (suivi) => {
    const e = suivi[reference] || { cree: maintenant, intentions: [], etat: 'ouvert' };
    if (!e.intentions.includes(String(id))) e.intentions.push(String(id));
    e.centimes = centimes;
    suivi[reference] = e;
  }, maintenant);
}

function noterEtat(reference, champs, s, maintenant = Date.now()) {
  return modifierSuivi(s, (suivi) => {
    if (suivi[reference]) Object.assign(suivi[reference], champs);
  }, maintenant);
}

/** Références encore ouvertes et assez récentes pour être relues. */
export function referencesARelire(suivi, maintenant = Date.now()) {
  return Object.entries(suivi)
    .filter(([, e]) => e?.etat === 'ouvert' && maintenant - (e.cree || 0) < DUREE_RATTRAPAGE)
    .map(([ref]) => ref);
}

// ---------------------------------------------------------------------------
// Adhésion correspondante
// ---------------------------------------------------------------------------

function aujourdhui() {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}/${get('month')}/${get('year')}`;
}

/** Ligne Adhérents portant cette référence (DETAIL), avec ce qu'il faut pour l'écrire. */
export async function trouverAdhesion(reference) {
  const sheetId = getAdherentsSheetId();
  const tab = getAdherentsTab();
  const lu = await readSheetAsObjects(sheetId, `'${tab}'!A:Z`);
  const target = lu.rows.find((r) => lireReference(pickRow(r, 'DETAIL')) === reference);
  return { sheetId, tab, ...lu, target };
}

/** Prénom, nom et mail de la demande (pour pré-remplir HelloAsso), ou null. */
export async function personneDeReference(reference) {
  const { target } = await trouverAdhesion(reference);
  if (!target) return null;
  return {
    reference,
    enAttente: isPendingAdhesion(target),
    centimes: centimesDe(pickRow(target, 'MONTANT', 'Montant')),
    prenom: pickRow(target, 'PRENOM', 'Prénom'),
    nom: pickRow(target, 'NOM', 'Nom'),
    email: pickRow(target, 'MAIL', 'Email'),
  };
}

/**
 * Passe l'adhésion « À jour » (mode carte, n° de commande HelloAsso, numéro d'adhérent).
 * @returns {Promise<{ fait: boolean, raison?: string, numero?: string, prenom?: string, nom?: string }>}
 */
export async function marquerAdhesionPayee(reference, { commande = '' } = {}) {
  const { sheetId, tab, headers, rows, colIndices, target } = await trouverAdhesion(reference);
  if (!target) return { fait: false, raison: 'introuvable' };
  const prenom = pickRow(target, 'PRENOM', 'Prénom');
  const nom = pickRow(target, 'NOM', 'Nom');
  if (!isPendingAdhesion(target)) return { fait: false, raison: 'deja', prenom, nom, numero: pickRow(target, 'NUMERO') };
  const updates = {
    STATUT: 'À jour',
    DATE_PAIEMENT: aujourdhui(),
    DETAIL: `${ASSO.adhesion.paiementNom || 'HelloAsso'}${commande ? ` commande ${commande}` : ''} · Réf. ${reference}`,
  };
  if (MODE_CARTE) updates.MODE = MODE_CARTE;
  const row = target._row;
  const n = await numeroPourLigne({ sheetId, tab, headers, colIndices, rows, row, target });
  if (n.numero) updates[n.header] = n.numero;
  await updateRowByHeaders(sheetId, tab, row, updates, headers, colIndices);
  return { fait: true, numero: n.numero, prenom, nom };
}

export function mailPaiementRecu({ prenom, nom, numero, commande, reference, raison, centimes = centimesDe('') }) {
  const qui = `${prenom || ''} ${nom || ''}`.replace(/\s+/g, ' ').trim() || 'Sans nom';
  if (raison === 'introuvable') {
    return {
      subject: `[${ASSO.sigle}] Paiement reçu — demande ${reference} introuvable`,
      text: [
        `Un paiement de ${enEuros(centimes)} est arrivé (${ASSO.adhesion.paiementNom || 'HelloAsso'}${commande ? `, commande ${commande}` : ''}) pour la référence ${reference},`,
        'mais aucune demande d’adhésion ne porte cette référence (ligne supprimée ou modifiée ?).',
        '',
        `Retrouvez le payeur dans l’espace ${ASSO.adhesion.paiementNom || 'HelloAsso'} de l’asso, puis passez son adhésion à jour dans le bureau (${SITE_URL}/bureau).`,
      ].join('\n'),
    };
  }
  return {
    subject: `[${ASSO.sigle}] Paiement reçu — ${qui}`,
    text: [
      `${qui} a payé ${enEuros(centimes)} en ligne (${ASSO.adhesion.paiementNom || 'HelloAsso'}${commande ? `, commande ${commande}` : ''}).`,
      '',
      `L’adhésion est passée « À jour »${numero ? `, numéro ${numero}` : ''}. Rien à pointer.`,
      `Référence : ${reference}`,
      '',
      `Reste à faire : la carte d’adhérent, dans le bureau (${SITE_URL}/bureau).`,
    ].join('\n'),
  };
}

/**
 * Relit chez HelloAsso les paiements d'une référence et valide l'adhésion si l'un est payé.
 * `idPropose` (retour du payeur, notification) n'est relu que s'il a bien été créé pour cette référence.
 * @returns {Promise<{ etat: 'paye' | 'attente' | 'refuse' | 'inconnu', numero?: string }>}
 */
export async function confirmerPaiement(reference, { idPropose = '', env = process.env, client = clientHelloAsso(env), store = storePaiements(), mail = envoyerMail } = {}) {
  if (!referenceValide(reference)) return { etat: 'inconnu' };
  const suivi = await lireSuivi(store);
  const entree = suivi[reference];
  if (entree?.etat === 'paye') return { etat: 'paye', numero: entree.numero || '' };
  // Sans suivi (effacé ?), l'identifiant proposé reste vérifiable : la relecture contrôle la référence.
  const ids = entree ? [...entree.intentions].reverse() : [];
  if (idPropose) {
    const i = ids.indexOf(String(idPropose));
    if (i >= 0) ids.splice(i, 1);
    ids.unshift(String(idPropose));
  }
  if (!ids.length) return { etat: 'inconnu' };
  // Montant attendu : celui noté à la création du paiement, sinon celui de la fiche.
  const attendu = entree?.centimes ?? (await personneDeReference(reference))?.centimes ?? centimesDe('');
  let vu = 'attente';
  for (const id of ids) {
    const lu = etatPaiement(await client.lireIntention(id, env), reference, attendu);
    if (lu.etat === 'refuse' && vu === 'attente') vu = 'refuse';
    if (lu.etat !== 'paye') continue;
    const res = await marquerAdhesionPayee(reference, { commande: lu.commande });
    await noterEtat(reference, { etat: 'paye', commande: lu.commande || '', numero: res.numero || '', paye: Date.now() }, store);
    if (res.fait || res.raison === 'introuvable') {
      try {
        await mail({ to: adresseAsso(env), ...mailPaiementRecu({ ...res, commande: lu.commande, reference, centimes: lu.montant || attendu }) }, env);
      } catch (err) {
        console.error('paiement mail:', err?.message || err);
      }
    }
    return { etat: 'paye', numero: res.numero || '' };
  }
  return { etat: vu };
}
