/**
 * Espace adhérent sans mot de passe (modules.espace) : voir src/lib/espace.js.
 *
 * POST action=demander {mail}        envoie un code (réponse identique que l'e-mail soit connu ou non)
 * POST action=verifier {mail, code}  code bon → cookie de session (90 jours)
 * POST action=deconnecter
 * GET  action=moi                    fiches de la session (carte, paiement, attestations, présences)
 * GET  action=carte&cle=…            recto de la carte (PNG)
 * GET  action=wallet&cle=…           carte Apple Wallet (.pkpass)
 * GET  action=attestation&cle=…&type=adhesion|fiscal|ce
 * GET  action=donnees                tout ce que le site garde sur la personne (JSON, droit d'accès)
 * POST action=signaler {cle, message} demande de changement, envoyée à l'association
 * POST action=lien-bureau {numero|row} (bureau) lien à usage unique, 72 h, à envoyer par SMS ou WhatsApp
 * POST action=reinscrire {cle, …}    réinscription pour la saison suivante (juin → septembre, src/lib/reinscription.js)
 * GET  action=reinscriptions         (bureau) liste des réinscrits de la saison suivante
 *
 * L'adhérent ne modifie jamais sa fiche lui-même : le bureau garde la main.
 */

import { getStore } from '@netlify/blobs';
import { ASSO, MODULES, PAYMENT_MODES, SITE_URL } from '../../asso.derive.js';
import { attestationPdf, estAJour, libelleType, nomFichier, typesDisponibles } from '../../src/lib/attestations.js';
import {
  DUREE_LIEN_BUREAU_MS,
  MAIL_RE,
  cleMail,
  enteteCookie,
  entreeCode,
  envoiPermis,
  fichesDuMail,
  foldMail,
  lienEspace,
  lireCookie,
  lireSession,
  nouveauCode,
  secretEspace,
  signerSession,
  texteMailCode,
  verifierCode,
} from '../../src/lib/espace.js';
import { ONGLET_PRESENCES, PRESENCES_HEADERS } from '../../src/lib/presence.js';
import {
  controlerReponses,
  dejaReinscrit,
  ligneReinscription,
  ongletSaison,
  periodeReinscription,
} from '../../src/lib/reinscription.js';
import { fabriquerPkpass } from '../../src/lib/wallet.js';
import {
  ADHERENTS_HEADERS,
  appendRow,
  assertBrowserOrigin,
  clientIp,
  consumeRateLimit,
  getAdherentsSheetId,
  getAdherentsTab,
  getSheets,
  handleOptions,
  isTestPrenom,
  json,
  moduleOff,
  pickRow,
  pickValue,
  readSheetAsObjects,
  readSheetValues,
  requireAuth,
} from './_bureau-lib.mjs';
import { renderRecto } from './_carte-recto.mjs';
import { carteFiche } from './carte-image.mjs';
import { DEMO } from './_demo.mjs';
import { adresseAsso, envoyerMail, modeEnvoi } from './_envoi.mjs';
import { lireOngletSite } from './_onglet.mjs';
import { lireReference, nouvelleReference, paiementIntegre } from './_paiement.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { payloadPour } from './wallet.mjs';
import COURS from '../../contenu/cours.json';

const STORE_ESPACE = 'espace';

function storeMemoire() {
  const m = new Map();
  return {
    get: async (cle) => (m.has(cle) ? JSON.parse(JSON.stringify(m.get(cle))) : null),
    setJSON: async (cle, valeur) => {
      m.set(cle, JSON.parse(JSON.stringify(valeur)));
    },
    delete: async (cle) => {
      m.delete(cle);
    },
  };
}
let memoireDemo = null;
/** Codes en cours (empreintes seulement). En démo : en mémoire. */
export const storeEspace = () => DEMO ? (memoireDemo ||= storeMemoire()) : getStore({ name: STORE_ESPACE, consistency: 'strong' });

function basePublique(event) {
  if (DEMO) {
    const origin = String(event?.headers?.origin || '').replace(/\/+$/, '');
    if (/^https?:\/\//i.test(origin)) return origin;
    const host = String(event?.headers?.host || '').split(',')[0].trim();
    if (host) return `http://${host}`;
  }
  return SITE_URL;
}

const estTest = (r) => isTestPrenom(pickRow(r, 'PRENOM', 'Prénom', 'Prenom'), pickRow(r, 'NOM', 'Nom'));
const numeroDe = (f) => String(pickRow(f, 'NUMERO', 'Numero') || '').trim().toUpperCase();

/** Identifiant d'une fiche dans la session : numéro, sinon référence de la demande, sinon ligne. */
export function cleFiche(f) {
  const numero = numeroDe(f);
  if (numero) return numero;
  const ref = lireReference(pickRow(f, 'DETAIL', 'Detail'));
  return ref ? `ref:${ref}` : `ligne:${f._row}`;
}

async function fichesDe(mail) {
  const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
  return fichesDuMail(rows, mail, estTest);
}

async function presencesDe(fiche, mail) {
  if (!MODULES.presences) return null;
  const { lignes } = await lireOngletSite(ONGLET_PRESENCES, PRESENCES_HEADERS);
  const numero = numeroDe(fiche);
  return lignes
    .filter((l) => (numero ? String(l.NUMERO || '').trim().toUpperCase() === numero : foldMail(l.MAIL) === mail))
    .map((l) => ({ date: String(l.DATE || ''), cours: String(l.COURS || ''), horaire: String(l.HORAIRE || '') }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// Réinscription : onglet de la saison suivante
// ---------------------------------------------------------------------------

/** Crée l'onglet de la saison suivante s'il manque (Google), et y met les en-têtes. */
async function assurerOnglet(tab) {
  const id = getAdherentsSheetId();
  const sheets = await getSheets();
  let valeurs;
  try {
    valeurs = await readSheetValues(id, tab);
  } catch (err) {
    if (typeof sheets.spreadsheets.batchUpdate !== 'function') throw err;
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
    valeurs = [];
  }
  if (!(valeurs[0] || []).some((c) => String(c ?? '').trim())) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `'${tab}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[...ADHERENTS_HEADERS, 'NUMERO', 'CARTE']] },
    });
  }
}

/** Lignes déjà inscrites pour la saison suivante (vide si l'onglet n'existe pas encore). */
async function lignesSuivante(suivante) {
  try {
    const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${ongletSaison(suivante)}'!A:Z`);
    return rows;
  } catch {
    return [];
  }
}

const noms = (f) => `${pickRow(f, 'PRENOM', 'Prénom', 'Prenom') || ''} ${pickRow(f, 'NOM', 'Nom') || ''}`.trim();
const coursDeNotes = (f) =>
  (String(pickRow(f, 'NOTES') || '').match(/Cours: ([^|]+)/)?.[1] || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
const coursConnus = () => [...new Set(COURS.map((c) => c.nom))];

async function reinscrire(body, mail, fiches) {
  const periode = periodeReinscription(ASSO.saison.label, new Date(), process.env.REINSCRIPTION);
  if (!periode.ouverte) return json(409, { error: 'La réinscription n’est pas ouverte en ce moment.' });
  const f = fiches.find((x) => cleFiche(x) === String(pickValue(body, 'cle') || ''));
  if (!f) return json(404, { error: 'Fiche introuvable.' });
  if (!estAJour(f)) return json(409, { error: 'Seule une adhésion à jour cette saison peut être reconduite. Écrivez au bureau.' });
  const r = controlerReponses(body, { modes: PAYMENT_MODES, coursConnus: coursConnus() });
  if (!r.ok) return json(400, { error: r.erreur });
  const tab = ongletSaison(periode.suivante);
  try {
    await assurerOnglet(tab);
  } catch (err) {
    console.error('reinscription onglet', err?.message || err);
    return json(503, { error: `La réinscription n’est pas encore prête. Écrivez au bureau (${ASSO.email}).` });
  }
  const deja = dejaReinscrit(await lignesSuivante(periode.suivante), f);
  if (deja) return json(409, { error: `Déjà réinscrit(e) le ${pickRow(deja, 'DATE_DEMANDE')}.` });
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  await appendRow(
    getAdherentsSheetId(),
    tab,
    ligneReinscription(f, r.champs, { tarif: ASSO.adhesion.tarif, date, reference: nouvelleReference(), ancienNumero: numeroDe(f) }),
  );
  if (modeEnvoi()) {
    const saison = periode.suivante.replace('-', '/');
    await envoyerMail({
      to: mail,
      subject: `${ASSO.nomCourt || ASSO.nom} — réinscription ${saison} reçue`,
      text: `Bonjour ${pickRow(f, 'PRENOM', 'Prénom') || ''},

Votre réinscription pour la saison ${saison} est bien enregistrée.
Cours choisis : ${r.champs.cours.join(', ')}.
Règlement prévu à la rentrée : ${r.champs.mode_paiement}.

Votre nouvelle carte arrivera quand le paiement sera confirmé. À bientôt !
${ASSO.nom}`,
    }).catch((err) => console.error('reinscription mail', err?.message || err));
  }
  return json(200, { ok: true, saison: periode.suivante });
}

/** Ce que voit l'adhérent pour une fiche. */
async function vueFiche(f, mail, suivantes = null) {
  const numero = numeroDe(f);
  const statut = String(pickRow(f, 'STATUT') || '').trim();
  const aJour = estAJour(f);
  const reference = lireReference(pickRow(f, 'DETAIL', 'Detail'));
  const montant = String(pickRow(f, 'MONTANT', 'Montant') || '').trim();
  const presences = await presencesDe(f, mail);
  return {
    cle: cleFiche(f),
    prenom: pickRow(f, 'PRENOM', 'Prénom', 'Prenom') || '',
    nom: pickRow(f, 'NOM', 'Nom') || '',
    numero,
    statut,
    aJour,
    mode: pickRow(f, 'MODE') || '',
    montant,
    datePaiement: pickRow(f, 'DATE_PAIEMENT') || '',
    paiement:
      statut === 'En attente'
        ? {
            montant: montant || String(ASSO.adhesion.tarif),
            reference,
            url: paiementIntegre() && reference ? `/api/paiement?ref=${encodeURIComponent(reference)}` : ASSO.adhesion.paiementUrl || '',
            nom: ASSO.adhesion.paiementNom || '',
            iban: ASSO.adhesion.iban || '',
            autres: ASSO.adhesion.autresPaiements || [],
          }
        : null,
    carte: aJour && Boolean(numero),
    wallet: Boolean(MODULES.wallet) && aJour && Boolean(numero),
    attestations: MODULES.attestations && aJour ? typesDisponibles(ASSO).map((id) => ({ id, label: libelleType(id) })) : [],
    presences: presences ? { total: presences.length, dernieres: presences.slice(0, 12) } : null,
    reinscription: suivantes
      ? {
          possible: aJour,
          faite: pickRow(dejaReinscrit(suivantes, f) || {}, 'DATE_DEMANDE') || '',
          tel: pickRow(f, 'TEL', 'Téléphone') || '',
          adresse: pickRow(f, 'ADRESSE') || '',
          codePostal: pickRow(f, 'CP') || '',
          ville: pickRow(f, 'VILLE') || '',
          droitImage: pickRow(f, 'DROIT_IMAGE') || '',
          cours: coursDeNotes(f),
        }
      : null,
  };
}

function lireCorps(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

const avecCookie = (reponse, valeur, maxAgeS) => ({
  ...reponse,
  headers: { ...reponse.headers, 'Set-Cookie': enteteCookie(valeur, { secure: !DEMO, ...(maxAgeS === undefined ? {} : { maxAgeS }) }) },
});

const fichier = (contenu, type, nom) => ({
  statusCode: 200,
  headers: {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${nom}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  },
  body: Buffer.from(contenu).toString('base64'),
  isBase64Encoded: true,
});

/** Crée un code, l'écrit dans le store et renvoie le lien. */
async function preparerCode(secret, mail, event, { duree, avant } = {}) {
  const code = nouveauCode();
  await storeEspace().setJSON(cleMail(secret, mail), entreeCode(secret, code, { duree, avant }));
  return { code, lien: lienEspace(basePublique(event), mail, code) };
}

const DEJA_PARTI = 'Si cette adresse est celle d’une fiche d’adhérent, un code vient de partir. Pensez à regarder dans les indésirables.';

async function demander(event, body, secret) {
  const mail = foldMail(pickValue(body, 'mail', 'email'));
  if (!MAIL_RE.test(mail)) return json(400, { error: 'Adresse e-mail invalide.' });
  if (!consumeRateLimit(`espace-dem:${clientIp(event)}`, 5, 10 * 60 * 1000).ok) {
    return json(429, { error: 'Trop de demandes. Réessayez dans quelques minutes.' });
  }
  if (!modeEnvoi()) {
    return json(503, { error: `L’envoi des mails n’est pas encore réglé. Demandez votre lien au bureau (${ASSO.email}).` });
  }
  const fiches = await fichesDe(mail);
  // Même réponse que l'e-mail soit connu ou non : on ne dit pas qui est adhérent.
  if (!fiches.length) return json(200, { ok: true, message: DEJA_PARTI, ...(DEMO ? { demo: { trouve: false } } : {}) });
  const store = storeEspace();
  const avant = await store.get(cleMail(secret, mail), { type: 'json' });
  if (!envoiPermis(avant)) return json(200, { ok: true, message: DEJA_PARTI });
  const { code, lien } = await preparerCode(secret, mail, event, { avant });
  try {
    await envoyerMail({
      to: mail,
      subject: `${ASSO.nomCourt || ASSO.nom} — votre code d’accès`,
      text: texteMailCode({ asso: ASSO, prenom: fiches.length === 1 ? pickRow(fiches[0], 'PRENOM', 'Prénom') : '', code, lien }),
    });
  } catch (err) {
    console.error('espace demander', err?.message || err);
    return json(502, { error: 'Le mail n’est pas parti. Réessayez dans un instant, ou demandez votre lien au bureau.' });
  }
  return json(200, { ok: true, message: DEJA_PARTI, ...(DEMO ? { demo: { trouve: true, code, lien } } : {}) });
}

async function verifier(event, body, secret) {
  const mail = foldMail(pickValue(body, 'mail', 'email'));
  if (!consumeRateLimit(`espace-ver:${clientIp(event)}`, 20, 10 * 60 * 1000).ok) {
    return json(429, { error: 'Trop d’essais. Réessayez dans quelques minutes.' });
  }
  if (!MAIL_RE.test(mail)) return json(400, { error: 'Adresse e-mail invalide.' });
  const store = storeEspace();
  const cle = cleMail(secret, mail);
  const r = verifierCode(await store.get(cle, { type: 'json' }), secret, pickValue(body, 'code'));
  if (r.entree) await store.setJSON(cle, r.entree);
  else await store.delete(cle);
  if (r.etat === 'ok') return avecCookie(json(200, { ok: true }), signerSession(mail, secret));
  const erreurs = {
    faux: 'Ce code ne correspond pas. Vérifiez les 6 chiffres du dernier mail reçu.',
    bloque: 'Trop d’essais avec ce code. Demandez-en un nouveau.',
    expire: 'Ce code a expiré. Demandez-en un nouveau.',
    absent: 'Ce code n’est plus valable (déjà utilisé, ou remplacé par un plus récent). Demandez-en un nouveau.',
  };
  return json(r.etat === 'faux' ? 400 : 410, { error: erreurs[r.etat], etat: r.etat });
}

async function lienBureau(event, body, secret) {
  const auth = requireAuth(event, { roles: ['admin', 'seance'] });
  if (!auth.ok) return auth.response;
  const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
  const numero = String(pickValue(body, 'numero') || '').trim().toUpperCase();
  const row = Number(pickValue(body, 'row'));
  const fiche = rows.find((r) => (numero ? numeroDe(r) === numero : r._row === row));
  if (!fiche) return json(404, { error: 'Fiche introuvable. Appuyez sur Actualiser.' });
  const mail = foldMail(pickRow(fiche, 'MAIL', 'Mail', 'EMAIL'));
  if (!MAIL_RE.test(mail)) return json(400, { error: 'Cette fiche n’a pas d’e-mail valable : corrigez-le d’abord.' });
  const { lien } = await preparerCode(secret, mail, event, { duree: DUREE_LIEN_BUREAU_MS });
  return json(200, { ok: true, lien, prenom: pickRow(fiche, 'PRENOM', 'Prénom') || '' });
}

async function signaler(event, body, mail, fiches) {
  if (!consumeRateLimit(`espace-sig:${mail}`, 5, 60 * 60 * 1000).ok) {
    return json(429, { error: 'Plusieurs messages viennent de partir. Réessayez plus tard.' });
  }
  const f = fiches.find((x) => cleFiche(x) === String(pickValue(body, 'cle') || ''));
  const message = String(pickValue(body, 'message') || '').trim().slice(0, 1500);
  if (!f) return json(404, { error: 'Fiche introuvable.' });
  if (message.length < 3) return json(400, { error: 'Écrivez ce qui a changé.' });
  if (!modeEnvoi()) return json(503, { error: `Écrivez directement à ${ASSO.email}.` });
  const qui = `${pickRow(f, 'PRENOM', 'Prénom') || ''} ${pickRow(f, 'NOM', 'Nom') || ''}`.trim();
  try {
    await envoyerMail({
      to: adresseAsso(),
      replyTo: mail,
      subject: `Espace adhérent — changement signalé (${qui})`,
      text: `${qui}${numeroDe(f) ? ` (${numeroDe(f)})` : ''} signale depuis son espace adhérent :

${message}

À reporter sur la fiche dans le bureau. Répondre à ce mail répond à l’adhérent.`,
    });
  } catch (err) {
    console.error('espace signaler', err?.message || err);
    return json(502, { error: `Le message n’est pas parti. Écrivez directement à ${ASSO.email}.` });
  }
  return json(200, { ok: true });
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('espace');
  if (off) return off;

  const q = event.queryStringParameters || {};
  const body = lireCorps(event);
  if (body === null) return json(400, { error: 'Requête illisible.' });
  const action = String(q.action || body.action || 'moi').trim();
  let secret;
  try {
    secret = secretEspace();
  } catch (err) {
    console.error('espace', err.message);
    return json(503, { error: 'L’espace adhérent n’est pas encore prêt. Demandez au bureau.' });
  }

  if (event.httpMethod === 'POST') {
    const origine = assertBrowserOrigin(event);
    if (!origine.ok) return json(origine.status, { error: origine.error });
    if (action === 'demander') return demander(event, body, secret);
    if (action === 'verifier') return verifier(event, body, secret);
    if (action === 'lien-bureau') return lienBureau(event, body, secret);
    if (action === 'deconnecter') return avecCookie(json(200, { ok: true }), '', 0);
  }

  if (action === 'reinscriptions') {
    const auth = requireAuth(event, { roles: ['admin', 'seance'] });
    if (!auth.ok) return auth.response;
    const periode = periodeReinscription(ASSO.saison.label, new Date(), process.env.REINSCRIPTION);
    const lignes = await lignesSuivante(periode.suivante);
    return json(200, {
      saison: periode.suivante,
      ouverte: periode.ouverte,
      liste: lignes
        .filter((r) => pickRow(r, 'SOURCE') === 'Réinscription')
        .map((r) => ({ nom: noms(r), date: pickRow(r, 'DATE_DEMANDE') || '', cours: coursDeNotes(r).join(', '), mode: pickRow(r, 'MODE') || '' })),
    });
  }

  const mail = lireSession(lireCookie(event.headers), secret);
  if (!mail) {
    if (action === 'moi') return json(200, { connecte: false });
    return json(401, { error: 'Session terminée. Reconnectez-vous avec votre e-mail.' });
  }
  const fiches = await fichesDe(mail);

  if (event.httpMethod === 'POST' && action === 'signaler') return signaler(event, body, mail, fiches);
  if (event.httpMethod === 'POST' && action === 'reinscrire') return reinscrire(body, mail, fiches);

  if (action === 'moi') {
    const periode = periodeReinscription(ASSO.saison.label, new Date(), process.env.REINSCRIPTION);
    const suivantes = periode.ouverte ? await lignesSuivante(periode.suivante) : null;
    return json(200, {
      connecte: true,
      mail,
      fiches: await Promise.all(fiches.map((f) => vueFiche(f, mail, suivantes))),
      reinscription: periode.ouverte ? { saison: periode.suivante, au: periode.au, cours: coursConnus(), modes: PAYMENT_MODES } : null,
      signaler: Boolean(modeEnvoi()),
      contact: ASSO.email,
    });
  }

  if (action === 'donnees') {
    const export_ = {
      association: ASSO.nom,
      exporteLe: new Date().toISOString(),
      note: 'Données de votre fiche d’adhérent sur ce site. Pour corriger : « Signaler un changement » dans votre espace.',
      fiches: await Promise.all(
        fiches.map(async (f) => ({
          fiche: Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith('_'))),
          presences: (await presencesDe(f, mail)) || [],
        })),
      ),
    };
    return fichier(JSON.stringify(export_, null, 2), 'application/json; charset=utf-8', 'mes-donnees.json');
  }

  const f = fiches.find((x) => cleFiche(x) === String(q.cle || ''));
  if (!f) return json(404, { error: 'Fiche introuvable.' });

  if (action === 'carte') {
    const c = carteFiche(f);
    if (c.error) return c.error;
    return fichier(await renderRecto(c), 'image/png', `carte-${c.numero}.png`);
  }
  if (action === 'wallet') {
    if (!MODULES.wallet || !estAJour(f) || !numeroDe(f)) return json(404, { error: 'Carte Wallet indisponible.' });
    const pass = await payloadPour(numeroDe(f));
    const signe = Boolean(process.env.APPLE_PASS_CERT) && !DEMO;
    return fichier(fabriquerPkpass(pass, { signe }), 'application/vnd.apple.pkpass', `${numeroDe(f)}.pkpass`);
  }
  if (action === 'attestation') {
    const type = String(q.type || 'adhesion');
    if (!MODULES.attestations || !estAJour(f) || !typesDisponibles(ASSO).includes(type)) {
      return json(404, { error: 'Document indisponible.' });
    }
    return fichier(attestationPdf(type, { asso: ASSO, fiche: f }), 'application/pdf', nomFichier(type, numeroDe(f)));
  }
  return json(400, { error: 'Action inconnue.' });
}

export { handler as traiter };
export default versV2(handler);
