/**
 * E-mail facultatif laissé à la demande d'essai (modules.essaiMail), pour deux messages seulement : le rappel de la veille et un mot
 * après l'essai (avec le lien « Adhérer en 1 minute »). L'adresse ne sert à rien d'autre.
 *
 * Elle n'est PAS écrite dans le tableau des essais (pas de colonne à ajouter) : store « essai-mails », sous une empreinte
 * (HMAC). Chaque adresse est liée à UNE demande précise : téléphone + minute de la demande (la colonne DATE_DEMANDE ;
 * le créneau, lui, peut être fixé plus tard par le bureau). Ainsi, saisir le numéro de quelqu'un d'autre dans le formulaire ne peut jamais détourner ses
 * rappels vers une autre adresse : cela crée seulement une autre demande, avec sa propre entrée.
 * Les envois déjà faits sont notés dans la colonne NOTES de l'essai (« Mail veille essai jj/mm/aaaa »).
 * En démo : en mémoire.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { adherentAJourKey, foldStatut, isTestPrenom, pickRow, telPersonKey } from './_bureau-lib.mjs';
import { DEMO } from './_demo.mjs';
import { mercisDuJour, rappelsDeCeSoir, ymdToFr } from '../../src/lib/rappelVeille.ts';

export const STORE = 'essai-mails';

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PRENOM_RE = /^[\p{L}][\p{L}' ’-]{0,39}$/u;
const CLE_RE = /^m-[0-9a-f]{24}$/;

/** Adresse nettoyée (minuscules, ≤ 120 caractères), ou '' si elle n'a pas la forme d'une adresse. */
export function mailValide(brut) {
  const s = String(brut || '').trim().toLowerCase();
  return s.length <= 120 && MAIL_RE.test(s) ? s : '';
}

/** Prénom sûr à écrire dans un mail : des lettres, rien d'autre. Sinon '' (le mail n'est pas envoyé). */
export function prenomPourMail(brut) {
  const s = String(brut || '').replace(/\s+/g, ' ').trim();
  return PRENOM_RE.test(s) ? s : '';
}

const hmac = (secret, texte) => createHmac('sha256', secret).update(texte).digest('hex').slice(0, 24);
const secretOk = (secret) => String(secret || '').length >= 24;

/** Empreinte du téléphone seul : sert au lien de désinscription et au repère « stop ». */
export function cleTel(tel, secret) {
  const t = telPersonKey(tel);
  return t && secretOk(secret) ? `m-${hmac(secret, `essai-mail:${t}`)}` : '';
}

/**
 * Minute de la demande, « 2026-10-10 10:00 », sinon ''. Accepte la valeur écrite par le site (« 2026-10-10T10:00:12 »)
 * et celle que Google Sheets affiche s'il l'a lue comme une date (« 10/10/2026 10:00:12 »).
 */
export function minuteDemande(brut) {
  const s = String(brut || '');
  const iso = s.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (iso) return `${iso[1]} ${iso[2]}`;
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2})/);
  return fr ? `${fr[3]}-${fr[2]}-${fr[1]} ${fr[4].padStart(2, '0')}:${fr[5]}` : '';
}

/** Empreinte d'UNE demande d'essai : téléphone + minute de la demande. '' s'il manque l'un des deux. */
export function cleEssai(e, secret) {
  const t = telPersonKey(e?.tel);
  const minute = minuteDemande(e?.demandeLe);
  return t && minute && secretOk(secret) ? `m-${hmac(secret, `essai-mail-demande:${t}|${minute}`)}` : '';
}

function storeMemoire() {
  const m = new Map();
  return {
    get: async (cle) => (m.has(cle) ? JSON.parse(JSON.stringify(m.get(cle))) : null),
    setJSON: async (cle, valeur) => void m.set(cle, JSON.parse(JSON.stringify(valeur))),
    delete: async (cle) => void m.delete(cle),
    list: async () => ({ blobs: [...m.keys()].map((key) => ({ key })) }),
  };
}
let memoireDemo = null;
const storeDe = () => (DEMO ? (memoireDemo ||= storeMemoire()) : getStore(STORE));

/**
 * Range l'adresse de CETTE demande. Une demande qui a déjà une entrée n'est jamais réécrite.
 * `demande` = { tel, demandeLe } : les valeurs écrites dans la ligne de l'essai.
 */
export async function ecrireMail(demande, mail, ymd, secret) {
  const cle = cleEssai(demande, secret);
  const adresse = mailValide(mail);
  if (!cle || !adresse) return false;
  const store = storeDe();
  if (await store.get(cle, { type: 'json' }).catch(() => null)) return false;
  await store.setJSON(cle, { mail: adresse, le: ymd, p: cleTel(demande.tel, secret) });
  return true;
}

/** Durée de conservation de l'adresse : celle des demandes d'essai non abouties (registre RGPD, 12 mois). */
export const MOIS_CONSERVATION = 12;

const signatureStop = (cle, secret) =>
  createHmac('sha256', secret).update(`essai-mail-stop:${cle}`).digest('base64url').slice(0, 22);

/** Jeton du lien de désinscription : l'empreinte du téléphone et sa signature, aucune adresse. */
export const jetonStopMail = (cle, secret) => `${cle}.${signatureStop(cle, secret)}`;

/** La clé que ce jeton désigne, ou '' s'il est faux ou modifié. */
export function cleDuJetonStopMail(jeton, secret) {
  const [cle, sig] = String(jeton || '').split('.');
  if (!CLE_RE.test(cle || '') || !sig || !secretOk(secret)) return '';
  const attendu = Buffer.from(signatureStop(cle, secret));
  const recu = Buffer.from(sig);
  return attendu.length === recu.length && timingSafeEqual(attendu, recu) ? cle : '';
}

/**
 * Désinscription : efface toutes les adresses liées à ce téléphone et pose un repère « stop » pour ce téléphone.
 * Une nouvelle demande avec adresse crée une nouvelle entrée, que le repère n'empêche pas de servir : voir lireMails.
 */
export async function arreterMail(cleTelephone, ymd) {
  if (!CLE_RE.test(cleTelephone)) return false;
  const store = storeDe();
  const { blobs } = await store.list();
  for (const b of blobs || []) {
    if (!CLE_RE.test(b.key) || b.key === cleTelephone) continue;
    const v = await store.get(b.key, { type: 'json' }).catch(() => null);
    if (v?.p === cleTelephone) await store.delete(b.key);
  }
  await store.setJSON(cleTelephone, { stop: true, le: ymd });
  return true;
}

/** « 2026-10-21 » → « 2025-10-21 » pour 12 mois. */
function ilYaMois(ymd, mois) {
  const [y, m, d] = ymd.split('-').map(Number);
  const i = m - 1 - mois;
  const an = y + Math.floor(i / 12);
  const mm = ((i % 12) + 12) % 12;
  const dernier = new Date(Date.UTC(an, mm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(an, mm, Math.min(d, dernier))).toISOString().slice(0, 10);
}

/** Efface les entrées plus vieilles que la durée de conservation. Renvoie le nombre d'entrées effacées. */
export async function purgerMails(ymd) {
  const store = storeDe();
  const limite = ilYaMois(ymd, MOIS_CONSERVATION);
  const { blobs } = await store.list();
  let n = 0;
  for (const b of blobs || []) {
    if (!CLE_RE.test(b.key)) continue;
    const v = await store.get(b.key, { type: 'json' }).catch(() => null);
    if (v && typeof v.le === 'string' && v.le < limite) {
      await store.delete(b.key);
      n += 1;
    }
  }
  return n;
}

/**
 * Les adresses des demandes données : Map empreinte de la demande → adresse. Un téléphone désinscrit
 * (repère « stop » posé après la demande) n'a plus d'adresse ; une demande faite après le « stop » est une
 * nouvelle volonté de la personne et fonctionne.
 * @param {{ tel: string, demandeLe: string }[]} essais
 */
export async function lireMails(essais, secret) {
  const store = storeDe();
  const stops = new Map();
  const out = new Map();
  for (const e of essais) {
    const cle = cleEssai(e, secret);
    if (!cle || out.has(cle)) continue;
    const v = await store.get(cle, { type: 'json' }).catch(() => null);
    if (!v?.mail) continue;
    const phone = cleTel(e.tel, secret);
    if (!stops.has(phone)) stops.set(phone, await store.get(phone, { type: 'json' }).catch(() => null));
    if (stops.get(phone)?.stop && String(stops.get(phone).le) >= String(v.le)) continue;
    out.set(cle, v.mail);
  }
  return out;
}

const lettres = (s) => foldStatut(s).replace(/[^a-z]/g, '');
const cleNom = (prenom, nom) => (lettres(prenom) && lettres(nom) ? `${lettres(nom)}|${lettres(prenom)}` : '');

/**
 * Les personnes déjà adhérentes, d'après le tableau des adhérents de la saison : « À jour », ou « En attente »
 * (demande d'adhésion faite : ni rappel d'essai ni invitation à adhérer). Deux clés : téléphone + prénom, et nom + prénom
 * (une personne peut adhérer avec un autre numéro ; ne pas lui écrire vaut mieux que le contraire).
 * @param {Record<string, string>[]} fiches lignes de l'onglet Adhérents
 */
export function adherentsConnus(fiches) {
  const parTel = new Set();
  const parNom = new Set();
  for (const r of fiches || []) {
    const statut = foldStatut(pickRow(r, 'STATUT', 'Statut'));
    if (statut !== 'a jour' && statut !== 'en attente') continue;
    const prenom = pickRow(r, 'PRENOM', 'Prénom', 'Prenom');
    const nom = pickRow(r, 'NOM', 'Nom');
    if (isTestPrenom(prenom, nom)) continue;
    const t = adherentAJourKey(pickRow(r, 'TEL', 'Téléphone', 'Telephone', 'Tel'), prenom);
    if (t) parTel.add(t);
    const n = cleNom(prenom, nom);
    if (n) parNom.add(n);
  }
  return { parTel, parNom };
}

/** Cet essai est-il celui d'une personne déjà adhérente ? */
export const estAdherent = (e, connus) =>
  Boolean(connus) &&
  (connus.parTel.has(adherentAJourKey(e.tel, e.prenom)) || connus.parNom.has(cleNom(e.prenom, e.nom)));

const MAIL_ENVOYE_RE = /Mail (veille|merci) essai (\d{2}\/\d{2}\/\d{4})/g;

/** Dates d'essai (jj/mm/aaaa) pour lesquelles ce mail est déjà parti. */
export function mailsEnvoyes(notes, type) {
  return [...String(notes || '').matchAll(MAIL_ENVOYE_RE)].filter((m) => m[1] === type).map((m) => m[2]);
}

export const noteMail = (type, essaiYmd) => `Mail ${type} essai ${ymdToFr(essaiYmd)}`;

/**
 * Les mails à envoyer ce soir. Un essai déjà rappelé ou remercié par WhatsApp (note du bureau) n'en reçoit pas ;
 * un mail déjà parti non plus ; une adresse ne reçoit qu'un mail de chaque sorte par passage (un tiers ne peut pas
 * faire écrire plusieurs fois à la même boîte). Sans adresse connue pour CETTE demande, rien.
 * @param {{ row: number, prenom: string, tel: string, cours: string, creneau: string, demandeLe: string, statut: string, notes: string }[]} essais
 * @param {Map<string, string>} mails  empreinte de la demande → adresse
 * @param {{ parTel: Set<string>, parNom: Set<string> }} [adherents]  personnes déjà adhérentes : elles ne reçoivent rien
 * @returns {{ type: 'veille' | 'merci', essai: object, mail: string, essaiYmd: string }[]}
 */
export function planMails(essais, mails, ymd, secret, adherents) {
  const out = [];
  const vus = new Set();
  const ajouter = (type, liste) => {
    for (const e of liste) {
      const mail = mails.get(cleEssai(e, secret));
      if (!mail || !prenomPourMail(e.prenom) || estAdherent(e, adherents)) continue;
      const essaiYmd = String(e.creneau || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/)?.slice(1).reverse().join('-') || '';
      if (!essaiYmd || mailsEnvoyes(e.notes, type).includes(ymdToFr(essaiYmd))) continue;
      const cle = `${type}|${mail}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push({ type, essai: e, mail, essaiYmd });
    }
  };
  ajouter('veille', rappelsDeCeSoir(essais, ymd));
  ajouter('merci', mercisDuJour(essais, ymd));
  return out;
}
