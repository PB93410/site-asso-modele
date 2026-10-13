/**
 * File d’attente (modules.listeAttente).
 * Jeton HMAC pour accepter une place. Logique partagée site / fonctions / tests.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const LISTE_ATTENTE_HEADERS = [
  'ID',
  'DATE',
  'TYPE',
  'CRENEAU',
  'COURS',
  'PRENOM',
  'NOM',
  'TEL',
  'MAIL',
  'RANG',
  'STATUT',
  'TOKEN',
  'NOTIFIE_LE',
  'EXPIRE_LE',
  'NOTES',
];
export const ONGLET_LISTE_ATTENTE = 'LISTE_ATTENTE';
export const STATUTS_OCCUPE_ESSAI = ['À venir', 'Confirmé', 'Venu'];
export const STATUTS_FILE = ['attente', 'notifie'];

export function slugFile(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cleFile(type, cours, creneau) {
  return `${type || 'essai'}:${slugFile(cours)}:${slugFile(creneau)}`;
}

export function capaciteDefaut(asso) {
  return Math.max(1, Number(asso?.listeAttente?.capaciteDefaut) || 20);
}

export function delaiHeures(asso) {
  return Math.max(1, Number(asso?.listeAttente?.delaiReponseHeures) || 48);
}

export function foldCreneau(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function memeCreneau(a, b) {
  const x = foldCreneau(a);
  const y = foldCreneau(b);
  if (!x || !y) return !x && !y;
  return x === y || x.includes(y) || y.includes(x);
}

function testNom(prenom, nom) {
  return /test/i.test(`${prenom || ''} ${nom || ''}`);
}

export function occupesEssai(essais, cours, creneau) {
  const c = String(cours || '').trim();
  return (essais || []).filter((e) => {
    if (testNom(e.PRENOM || e.prenom, e.NOM || e.nom)) return false;
    const statut = String(e.STATUT || e.statut || '').trim();
    if (!STATUTS_OCCUPE_ESSAI.includes(statut)) return false;
    if (c && String(e.COURS || e.cours || '').trim() !== c) return false;
    if (creneau && !memeCreneau(e.CRENEAU || e.creneau, creneau)) return false;
    return true;
  });
}

export function occupesAdhesion(adherents, cours) {
  const c = String(cours || '').trim().toLowerCase();
  return (adherents || []).filter((a) => {
    if (testNom(a.PRENOM || a.prenom, a.NOM || a.nom)) return false;
    if (String(a.STATUT || a.statut || '').trim() !== 'À jour') return false;
    if (!c) return true;
    const blob = `${a.NOTES || a.notes || ''} ${a.COURS || a.cours || ''}`.toLowerCase();
    return blob.includes(c);
  });
}

export function filePour(lignes, type, cours, creneau) {
  return (lignes || [])
    .filter((l) => {
      if (!STATUTS_FILE.includes(String(l.STATUT || l.statut || '').trim())) return false;
      if (String(l.TYPE || l.type || 'essai') !== (type || 'essai')) return false;
      if (String(l.COURS || l.cours || '').trim() !== String(cours || '').trim()) return false;
      if (type === 'essai' && creneau && !memeCreneau(l.CRENEAU || l.creneau, creneau)) return false;
      return true;
    })
    .sort((a, b) => Number(a.RANG || a.rang || 0) - Number(b.RANG || b.rang || 0) || String(a.DATE || '').localeCompare(String(b.DATE || '')));
}

export function secretListe(env = process.env) {
  const secret = String(env.BUREAU_SECRET || env.LISTE_ATTENTE_SECRET || '').trim();
  if (!secret || secret.length < 24) {
    throw new Error('BUREAU_SECRET manquante ou trop courte pour la liste d’attente.');
  }
  return secret;
}

export function nouvelId() {
  return `la-${randomBytes(6).toString('hex')}`;
}

export function signerClaim(id, secret) {
  return createHmac('sha256', secret).update(`liste:${id}`).digest('hex').slice(0, 32);
}

export function verifierClaim(id, token, secret) {
  const attendu = signerClaim(id, secret);
  const a = Buffer.from(String(token || ''), 'utf8');
  const b = Buffer.from(attendu, 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function urlClaim(siteUrl, token) {
  const base = String(siteUrl || '').replace(/\/+$/, '');
  return `${base}/liste-attente/place?t=${encodeURIComponent(token)}`;
}

export function expireLe(heures, maintenant = new Date()) {
  return new Date(maintenant.getTime() + Number(heures) * 3600 * 1000).toISOString();
}

export function claimEncoreValable(ligne, maintenant = new Date()) {
  if (String(ligne.STATUT || ligne.statut || '') !== 'notifie') return false;
  const exp = Date.parse(ligne.EXPIRE_LE || ligne.expireLe || '');
  if (!Number.isFinite(exp)) return false;
  return exp > maintenant.getTime();
}

export function texteNotif(asso, personne, url, heures) {
  const prenom = personne.prenom || personne.PRENOM || '';
  const cours = personne.cours || personne.COURS || 'un cours';
  const subject = `${asso.nomCourt || asso.nom} — une place s’est libérée`;
  const text = `Bonjour ${prenom},

Une place s’est libérée pour ${cours}.
Vous avez ${heures} heures pour l’accepter :

${url}

Si le délai est passé, la place passe à la personne suivante.
${asso.nom}`;
  return { subject, text };
}

export function waHref(tel, texte) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 10) d = `33${d.slice(1)}`;
  if (!(d.startsWith('33') && d.length >= 11)) return '';
  return `https://wa.me/${d}?text=${encodeURIComponent(texte)}`;
}

export function estComplet({ occupes, file, capacite }) {
  return Number(occupes) + Number(file) >= Number(capacite);
}
