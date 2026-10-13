/**
 * Pointage aux séances (modules.presences).
 * Jeton HMAC valable le jour même. Logique partagée site / fonctions / tests.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const PRESENCES_HEADERS = ['DATE', 'SESSION', 'COURS', 'HORAIRE', 'NUMERO', 'PRENOM', 'NOM', 'MAIL', 'HEURE'];
export const ONGLET_PRESENCES = 'PRESENCES';
export const SEMAINES_INACTIF_DEFAUT = 3;

export function slugSession(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Identifiant stable d’un créneau : jour + horaire + cours. */
export function sessionId(jour, horaire, cours) {
  return slugSession(`${jour}-${horaire}-${cours}`);
}

export function parisYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function parisJour(date = new Date()) {
  const j = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long' }).format(date);
  return j.charAt(0).toUpperCase() + j.slice(1);
}

/** Jour de la semaine (Lundi…) pour une date AAAA-MM-JJ, calendrier de Paris. */
export function jourDeYmd(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  const j = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long' }).format(dt);
  return j.charAt(0).toUpperCase() + j.slice(1);
}

export function ajouterJoursYmd(ymd, n) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function secretPresence(env = process.env) {
  const secret = String(env.BUREAU_SECRET || env.PRESENCE_SECRET || '').trim();
  if (!secret || secret.length < 24) {
    throw new Error('BUREAU_SECRET manquante ou trop courte pour signer les QR.');
  }
  return secret;
}

export function signerPresence(session, ymd, secret) {
  return createHmac('sha256', secret).update(`presence:${session}:${ymd}`).digest('hex').slice(0, 32);
}

export function verifierJetonPresence(session, ymd, token, secret) {
  const attendu = signerPresence(session, ymd, secret);
  const a = Buffer.from(String(token || ''), 'utf8');
  const b = Buffer.from(attendu, 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function urlPresence(siteUrl, session, token) {
  const base = String(siteUrl || '').replace(/\/+$/, '');
  return `${base}/presence?s=${encodeURIComponent(session)}&t=${encodeURIComponent(token)}`;
}

export function identifiantPointage(numero, mail) {
  const n = String(numero || '').trim().toUpperCase();
  if (n) return n;
  return String(mail || '').trim().toLowerCase();
}

export function clePointage(ymd, session, numero, mail) {
  return `${ymd}|${session}|${identifiantPointage(numero, mail)}`;
}

export function lignesDepuisValeurs(values, headersAttendus = PRESENCES_HEADERS) {
  const rows = Array.isArray(values) ? values : [];
  if (!rows.length) return { headers: headersAttendus, lignes: [] };
  const headers = (rows[0] || []).map((h) => String(h || '').trim());
  const use = headers.some(Boolean) ? headers : headersAttendus;
  const lignes = [];
  for (let i = 1; i < rows.length; i += 1) {
    const raw = rows[i] || [];
    if (raw.every((c) => c === undefined || c === null || String(c).trim() === '')) continue;
    const obj = { _row: i + 1 };
    use.forEach((h, idx) => {
      if (h) obj[h] = raw[idx] !== undefined && raw[idx] !== null ? String(raw[idx]).trim() : '';
    });
    lignes.push(obj);
  }
  return { headers: use, lignes };
}

export function dejaPointe(lignes, ymd, session, numero, mail) {
  const n = String(numero || '').trim().toUpperCase();
  const m = String(mail || '').trim().toLowerCase();
  if (!n && !m) return false;
  return (lignes || []).some((l) => {
    if (String(l.DATE || '').trim() !== ymd || String(l.SESSION || '').trim() !== session) return false;
    const ln = String(l.NUMERO || '').trim().toUpperCase();
    const lm = String(l.MAIL || '').trim().toLowerCase();
    if (n && ln && n === ln) return true;
    if (m && lm && m === lm) return true;
    return false;
  });
}

function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function sessionsDuJour(planning, ymd) {
  const jour = fold(jourDeYmd(ymd));
  return (planning || [])
    .filter((p) => fold(p.day || p.jour) === jour && (p.course || p.cours))
    .map((p) => {
      const cours = String(p.course || p.cours || '').trim();
      const horaire = String(p.time || p.horaire || '').trim();
      const jourLib = String(p.day || p.jour || '').trim();
      return {
        id: sessionId(jourLib, horaire, cours),
        jour: jourLib,
        horaire,
        cours,
        lieu: String(p.location || p.lieu || '').trim(),
      };
    });
}

export function statsPresences(lignes, { from = '', to = '' } = {}) {
  const parSession = new Map();
  const parCours = new Map();
  for (const l of lignes || []) {
    const d = String(l.DATE || '').trim();
    if (from && d < from) continue;
    if (to && d > to) continue;
    const session = String(l.SESSION || '').trim();
    const cours = String(l.COURS || '').trim() || session;
    const horaire = String(l.HORAIRE || '').trim();
    const s = parSession.get(session) || { session, cours, horaire, total: 0, jours: new Set() };
    s.total += 1;
    if (d) s.jours.add(d);
    parSession.set(session, s);
    const c = parCours.get(cours) || { cours, total: 0 };
    c.total += 1;
    parCours.set(cours, c);
  }
  return {
    sessions: [...parSession.values()]
      .map((s) => ({ session: s.session, cours: s.cours, horaire: s.horaire, total: s.total, seances: s.jours.size }))
      .sort((a, b) => b.total - a.total || a.cours.localeCompare(b.cours, 'fr')),
    cours: [...parCours.values()].sort((a, b) => b.total - a.total || a.cours.localeCompare(b.cours, 'fr')),
    total: (lignes || []).length,
  };
}

function estTest(prenom, nom) {
  const f = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return f(prenom) === 'test' || f(nom) === 'test';
}

/**
 * Adhérents à jour sans pointage depuis `semaines` semaines (ou jamais).
 * `adherents` : { prenom, nom, mail, numero, statut }[]
 */
export function inactifs(adherents, presences, { semaines = SEMAINES_INACTIF_DEFAUT, aujourdHui = parisYmd() } = {}) {
  const n = Math.max(1, Math.min(20, Number(semaines) || SEMAINES_INACTIF_DEFAUT));
  const seuil = ajouterJoursYmd(aujourdHui, -n * 7);
  const last = new Map();
  for (const p of presences || []) {
    const id = identifiantPointage(p.NUMERO, p.MAIL);
    if (!id) continue;
    const d = String(p.DATE || '').trim();
    if (!d) continue;
    const prev = last.get(id);
    if (!prev || d > prev) last.set(id, d);
  }
  const out = [];
  for (const a of adherents || []) {
    const statut = fold(a.statut || a.STATUT);
    if (statut && statut !== 'a jour') continue;
    if (estTest(a.prenom || a.PRENOM, a.nom || a.NOM)) continue;
    const numero = String(a.numero || a.NUMERO || '').trim();
    const mail = String(a.mail || a.MAIL || '').trim();
    const id = identifiantPointage(numero, mail);
    if (!id) continue;
    const derniere = last.get(id) || '';
    if (derniere && derniere >= seuil) continue;
    out.push({
      prenom: String(a.prenom || a.PRENOM || '').trim(),
      nom: String(a.nom || a.NOM || '').trim(),
      mail,
      numero,
      derniere: derniere || '',
      semaines: derniere ? Math.floor((Date.parse(`${aujourdHui}T12:00:00Z`) - Date.parse(`${derniere}T12:00:00Z`)) / 604_800_000) : null,
    });
  }
  out.sort((a, b) => (a.derniere || '').localeCompare(b.derniere || '') || a.nom.localeCompare(b.nom, 'fr'));
  return out;
}

export function texteRelance(asso, personne, semaines) {
  const nomAsso = asso?.nomCourt || asso?.nom || 'l’association';
  const prenom = personne.prenom || 'Bonjour';
  const n = personne.semaines ?? semaines;
  const duree = n == null ? 'depuis un moment' : n <= 1 ? 'depuis une semaine' : `depuis ${n} semaines`;
  return {
    subject: `${nomAsso} — on a pensé à vous`,
    text: `${prenom},\n\nNous n’avons pas eu de vos nouvelles ${duree} aux cours de ${nomAsso}.\nSi un créneau ne convient plus, ou si vous avez une question, répondez à ce message : le bureau est là.\n\nÀ bientôt,\n${nomAsso}\n`,
  };
}
