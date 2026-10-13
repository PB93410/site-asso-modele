/**
 * Espace adhérent sans mot de passe (modules.espace).
 *
 * L'adhérent donne l'e-mail de sa fiche et reçoit un code à 6 chiffres, plus un lien qui porte
 * ce code. Le lien met l'e-mail et le code après le # : ils restent dans le navigateur, jamais
 * dans les journaux du serveur. Un code bon ouvre une session : un cookie signé (HttpOnly) garde
 * l'appareil connecté 90 jours. Aucun mot de passe, rien à retenir.
 *
 * Le store ne garde que l'empreinte du code, sous une clé tirée de l'e-mail (jamais l'e-mail en clair).
 * Changer BUREAU_SECRET déconnecte tout le monde.
 */

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const DUREE_CODE_MS = 15 * 60 * 1000;
/** Lien préparé par le bureau (envoyé par SMS ou WhatsApp) : plus long, toujours à usage unique. */
export const DUREE_LIEN_BUREAU_MS = 72 * 60 * 60 * 1000;
export const ESSAIS_CODE = 5;
export const DUREE_SESSION_MS = 90 * 24 * 60 * 60 * 1000;
/** Envois de code par e-mail : au plus 3 par quart d'heure. */
export const ENVOIS_MAX = 3;
export const FENETRE_ENVOIS_MS = 15 * 60 * 1000;
export const COOKIE = 'espace';
export const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const foldMail = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();

export function secretEspace(env = process.env) {
  const secret = String(env.BUREAU_SECRET || '').trim();
  if (secret.length < 24) throw new Error('BUREAU_SECRET manquante ou trop courte pour l’espace adhérent.');
  return secret;
}

const empreinte = (secret, texte) => createHmac('sha256', secret).update(texte).digest('hex');

function egal(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** Clé du store pour un e-mail : pas d'adresse en clair dans Netlify Blobs. */
export const cleMail = (secret, mail) => `m-${empreinte(secret, `espace-mail:${foldMail(mail)}`).slice(0, 40)}`;

export const nouveauCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** « 482917 » → « 482 917 » (plus facile à recopier). */
export const codeLisible = (code) => `${String(code).slice(0, 3)} ${String(code).slice(3)}`;

/**
 * Entrée du store après l'envoi d'un code : empreinte, expiration, essais remis à zéro.
 * `envois` garde les dates des derniers envois (limite par e-mail).
 */
export function entreeCode(secret, code, { maintenant = Date.now(), duree = DUREE_CODE_MS, avant = null } = {}) {
  const envois = (avant?.envois || []).filter((t) => maintenant - t < FENETRE_ENVOIS_MS);
  return { h: empreinte(secret, `espace-code:${code}`), exp: maintenant + duree, essais: 0, envois: [...envois, maintenant] };
}

/** Encore un envoi possible pour cet e-mail ? */
export function envoiPermis(entree, maintenant = Date.now()) {
  return (entree?.envois || []).filter((t) => maintenant - t < FENETRE_ENVOIS_MS).length < ENVOIS_MAX;
}

/**
 * Vérifie un code tapé (ou porté par le lien).
 * @returns {{ etat: 'ok' | 'faux' | 'expire' | 'bloque' | 'absent', entree: object | null }}
 *   entree = ce qu'il faut réécrire dans le store (null = effacer).
 */
export function verifierCode(entree, secret, code, maintenant = Date.now()) {
  if (!entree?.h) return { etat: 'absent', entree: null };
  if (maintenant > entree.exp) return { etat: 'expire', entree: null };
  if ((entree.essais || 0) >= ESSAIS_CODE) return { etat: 'bloque', entree };
  const propre = String(code || '').replace(/\D/g, '');
  if (propre.length === 6 && egal(empreinte(secret, `espace-code:${propre}`), entree.h)) return { etat: 'ok', entree: null };
  const essais = (entree.essais || 0) + 1;
  return { etat: essais >= ESSAIS_CODE ? 'bloque' : 'faux', entree: { ...entree, essais } };
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const deB64 = (s) => Buffer.from(String(s || ''), 'base64url').toString('utf8');

/** Valeur du cookie de session : données lisibles + signature. */
export function signerSession(mail, secret, maintenant = Date.now()) {
  const donnees = b64(JSON.stringify({ m: foldMail(mail), exp: maintenant + DUREE_SESSION_MS }));
  return `${donnees}.${empreinte(secret, `espace-session:${donnees}`).slice(0, 43)}`;
}

/** E-mail de la session, ou '' si absente, falsifiée ou expirée. */
export function lireSession(valeur, secret, maintenant = Date.now()) {
  const [donnees, signature] = String(valeur || '').split('.');
  if (!donnees || !signature || !egal(signature, empreinte(secret, `espace-session:${donnees}`).slice(0, 43))) return '';
  try {
    const { m, exp } = JSON.parse(deB64(donnees));
    return Number(exp) > maintenant && MAIL_RE.test(m) ? foldMail(m) : '';
  } catch {
    return '';
  }
}

export function lireCookie(headers, nom = COOKIE) {
  const brut = String(headers?.cookie || headers?.Cookie || '');
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) return morceau.slice(i + 1).trim();
  }
  return '';
}

/** En-tête Set-Cookie. Chemin limité à l'API de l'espace : le reste du site ne le reçoit pas. */
export function enteteCookie(valeur, { secure = true, maxAgeS = DUREE_SESSION_MS / 1000 } = {}) {
  return [
    `${COOKIE}=${valeur}`,
    'Path=/api/espace',
    `Max-Age=${Math.round(maxAgeS)}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** Lien du mail : e-mail et code après le #, jamais envoyés au serveur dans l'adresse. */
export function lienEspace(base, mail, code) {
  const q = new URLSearchParams({ m: foldMail(mail), c: String(code) });
  return `${String(base || '').replace(/\/+$/, '')}/espace#${q}`;
}

/** Texte du mail de connexion. */
export function texteMailCode({ asso, prenom, code, lien, duree = 'pendant 15 minutes' }) {
  return `Bonjour${prenom ? ` ${prenom}` : ''},

Votre code pour ouvrir votre espace adhérent : ${codeLisible(code)}
Il est valable ${duree}, une seule fois.

Ou ouvrez directement ce lien, sur l’appareil où vous voulez consulter votre espace :
${lien}

Vous n’avez rien demandé ? Ignorez ce message : sans le code, personne ne peut entrer.
${asso.nom}`;
}

/** Fiches de la saison qui portent cet e-mail (une famille peut partager une adresse). */
export function fichesDuMail(rows, mail, estTest = () => false) {
  const m = foldMail(mail);
  if (!m) return [];
  return (rows || []).filter((r) => {
    const em = foldMail(r.MAIL || r.Mail || r.EMAIL || r.Email || r.mail);
    return em === m && !estTest(r);
  });
}
