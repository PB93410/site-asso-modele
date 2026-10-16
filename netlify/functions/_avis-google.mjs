/**
 * Demande d'avis Google (modules.demandeAvis) : un seul mail, environ un mois après l'adhésion, avec le lien direct pour écrire l'avis.
 * Une adresse ne reçoit la demande qu'une fois par saison, jamais après une désinscription.
 *
 * Qui : seulement les fiches « À jour » (statut posé par le bureau : le formulaire public n'est pas vérifié, on ne
 * demande rien à une adresse saisie par un tiers). Quand : de 30 à 60 jours après le paiement (sinon la date de
 * demande), pour qu'une première activation ne réveille pas tout l'historique.
 * État : store « avis-google », une entrée par saison, sous une empreinte de l'adresse (aucune adresse écrite).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ASSO } from '../../asso.derive.js';
import { estAJour } from '../../src/lib/attestations.js';
import { cleDestinataire } from './_relances-reinscription.mjs';

export const STORE = 'avis-google';
export const DEPUIS_JOURS = 30;
export const JUSQU_A_JOURS = 60;
export const MAX_PAR_PASSAGE = 20;

/** Lien d'avis de la fiche Google de l'association (asso.config.js → reseaux.avisGoogle, aussi en pied de page). */
export const AVIS_URL = String(ASSO.reseaux?.avisGoogle || '').trim();

const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const foldMail = (m) => String(m || '').trim().toLowerCase();

/** « 08/10/2026 », « 2026-10-08 12:34 » → « 2026-10-08 », sinon ''. */
export function versYmd(brut) {
  const s = String(brut || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  return fr ? `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}` : '';
}

const joursEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Date d'adhésion de la fiche : le paiement, à défaut la demande. */
export const dateAdhesion = (f) => versYmd(f.DATE_PAIEMENT || f.Date_paiement) || versYmd(f.DATE_DEMANDE || f.Date_demande);

/**
 * @returns {{ mail: string, prenoms: string[], cle: string }[]}  une entrée par adresse
 */
export function choisirDemandes({ fiches, etats, ymd, secret, max = MAX_PAR_PASSAGE }) {
  const parAdresse = new Map();
  for (const f of fiches || []) {
    const mail = foldMail(f.MAIL || f.Mail || f.EMAIL);
    if (!estAJour(f) || !MAIL_RE.test(mail)) continue;
    const date = dateAdhesion(f);
    if (!date) continue;
    const age = joursEntre(date, ymd);
    if (age < DEPUIS_JOURS || age > JUSQU_A_JOURS) continue;
    const prenom = String(f.PRENOM || f.Prénom || f.Prenom || '').trim();
    const g = parAdresse.get(mail) || { mail, prenoms: [] };
    if (prenom && !g.prenoms.includes(prenom)) g.prenoms.push(prenom);
    parAdresse.set(mail, g);
  }
  const out = [];
  for (const g of parAdresse.values()) {
    const cle = cleDestinataire(g.mail, secret);
    const e = etats?.[cle];
    if (e?.stop || e?.envoye) continue;
    out.push({ ...g, cle });
  }
  return out.sort((a, b) => a.cle.localeCompare(b.cle)).slice(0, max);
}

const signatureStop = (cle, label, secret) =>
  createHmac('sha256', secret).update(`avis-google-stop:${cle}:${label}`).digest('base64url').slice(0, 22);

export const jetonStop = (cle, label, secret) => `${cle}.${signatureStop(cle, label, secret)}`;

/** La clé du destinataire que ce jeton désigne, ou '' si le jeton est faux. */
export function cleDuJetonStop(jeton, label, secret) {
  const [cle, sig] = String(jeton || '').split('.');
  if (!/^[0-9a-f]{24}$/.test(cle || '') || !sig) return '';
  const attendu = Buffer.from(signatureStop(cle, label, secret));
  const recu = Buffer.from(sig);
  return attendu.length === recu.length && timingSafeEqual(attendu, recu) ? cle : '';
}

const liste = (prenoms) => (prenoms.length > 1 ? `${prenoms.slice(0, -1).join(', ')} et ${prenoms.at(-1)}` : prenoms[0] || '');

export function messageAvis({ prenoms, lien = AVIS_URL, desabo, nom = ASSO.nom }) {
  const bonjour = prenoms.length ? `Bonjour ${liste(prenoms)},` : 'Bonjour,';
  return {
    sujet: `Votre avis sur ${nom}`,
    texte: `${bonjour}

Cela fait environ un mois que vous nous avez rejoints : nous espérons que les cours vous plaisent.

Si c’est le cas, un petit avis sur Google nous aide beaucoup : il permet à d’autres personnes de nous trouver, et à une association de bénévoles de continuer à vivre. Une minute suffit, directement ici :
${lien}

Aucune obligation, bien sûr. Et si quelque chose ne vous convient pas, dites-le-nous plutôt en répondant à ce message : nous lisons tout et nous essayons d’améliorer ce qui peut l’être.

Merci, et bons cours !
${nom}

—
Vous ne souhaitez pas recevoir ce type de message ? ${desabo}`,
  };
}
