/**
 * Alertes de dernière minute (modules.alertes).
 * Abonnement e-mail (consentement), jeton de désabonnement, durée de vie d’une alerte.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ALERTES_HEADERS = ['ID', 'DATE', 'SESSION', 'COURS', 'TYPE', 'MESSAGE', 'CREEE_LE', 'EXPIRE_LE'];
export const ALERTES_ABOS_HEADERS = ['MAIL', 'CONSENT', 'DATE', 'TOKEN', 'PUSH', 'ACTIF'];
export const ONGLET_ALERTES = 'ALERTES';
export const ONGLET_ALERTES_ABOS = 'ALERTES_ABOS';
export const TYPES_ALERTE = ['annulation', 'changement', 'autre'];

export function secretAlertes(env = process.env) {
  const secret = String(env.BUREAU_SECRET || env.ALERTES_SECRET || '').trim();
  if (!secret || secret.length < 24) {
    throw new Error('BUREAU_SECRET manquante ou trop courte pour les alertes.');
  }
  return secret;
}

export function nouvelIdAlerte() {
  return `al-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

export function tokenDesabonnement(mail, secret) {
  const m = String(mail || '').trim().toLowerCase();
  return createHmac('sha256', secret).update(`alerte-abo:${m}`).digest('hex').slice(0, 32);
}

export function verifierTokenDesabonnement(mail, token, secret) {
  const attendu = tokenDesabonnement(mail, secret);
  const a = Buffer.from(String(token || ''), 'utf8');
  const b = Buffer.from(attendu, 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Une alerte reste visible jusqu’au lendemain de la séance (date AAAA-MM-JJ). */
export function expireLe(dateSeance) {
  const m = String(dateSeance || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return dt.toISOString().slice(0, 10);
}

export function alerteActive(alerte, aujourdHui) {
  const exp = String(alerte.EXPIRE_LE || alerte.expireLe || '').trim();
  if (!exp) return false;
  return exp >= aujourdHui;
}

export function typeAlerte(raw) {
  const t = String(raw || '').trim().toLowerCase();
  return TYPES_ALERTE.includes(t) ? t : 'changement';
}

export function libelleType(type) {
  if (type === 'annulation') return 'Cours annulé';
  if (type === 'changement') return 'Horaire ou salle modifié';
  return 'Information';
}

export function messageAlerteMail(asso, alerte, urlDesabo) {
  const nom = asso?.nomCourt || asso?.nom || 'l’association';
  const titre = libelleType(alerte.type || alerte.TYPE);
  const cours = alerte.cours || alerte.COURS || 'un cours';
  const date = alerte.date || alerte.DATE || '';
  const texte = alerte.message || alerte.MESSAGE || '';
  return {
    subject: `${nom} — ${titre}`,
    text: `${titre} : ${cours}${date ? ` (${date})` : ''}.\n\n${texte}\n\n${nom}\n\nPour ne plus recevoir ces messages : ${urlDesabo}\n`,
  };
}

export function payloadPush(asso, alerte) {
  return {
    title: `${asso?.nomCourt || asso?.nom || 'Association'} — ${libelleType(alerte.type || alerte.TYPE)}`,
    body: String(alerte.message || alerte.MESSAGE || alerte.cours || alerte.COURS || 'Un cours a changé.').slice(0, 140),
    url: '/',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function emailValide(raw) {
  return EMAIL_RE.test(String(raw || '').trim());
}
