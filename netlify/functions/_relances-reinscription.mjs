/**
 * Relances de réinscription : un mail aux adhérents de la saison qui se termine et qui n'ont pas encore
 * gardé leur place pour la suivante. Trois mails au plus par adresse, à deux semaines d'écart, en juin
 * (jusqu'au 10 juillet) puis en septembre (jusqu'au 25). Jamais en été, jamais après une désinscription,
 * jamais à quelqu'un déjà réinscrit.
 *
 * État des envois : store « reinscription-relances », par saison, sous une clé qui est une empreinte de
 * l'adresse (HMAC) : aucune adresse n'y est écrite.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { estAJour } from '../../src/lib/attestations.js';
import { dejaReinscrit } from '../../src/lib/reinscription.js';

export const STORE = 'reinscription-relances';
export const MAX_ENVOIS = 3;
export const ECART_JOURS = 14;
export const MAX_PAR_PASSAGE = 40;

const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const foldMail = (m) => String(m || '').trim().toLowerCase();

/** Fenêtres d'envoi de la saison qui se termine (« 2026-2027 » → juin 2027, septembre 2027). */
export function fenetreEnvoi(label, ymd) {
  const fin = String(label || '').slice(5);
  if (!/^\d{4}$/.test(fin)) return false;
  return (ymd >= `${fin}-06-01` && ymd <= `${fin}-07-10`) || (ymd >= `${fin}-09-01` && ymd <= `${fin}-09-25`);
}

const joursEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Numéro du prochain mail (1 à 3), ou 0 s'il ne faut rien envoyer. */
export function numeroSuivant(etat, ymd) {
  if (etat?.stop) return 0;
  const n = Number(etat?.n) || 0;
  if (n >= MAX_ENVOIS) return 0;
  if (n > 0 && joursEntre(etat.dernier, ymd) < ECART_JOURS) return 0;
  return n + 1;
}

/** Empreinte de l'adresse : sert de clé d'état et de lien de désinscription. */
export function cleDestinataire(mail, secret) {
  return createHmac('sha256', secret).update(`relance-reinscription:${foldMail(mail)}`).digest('hex').slice(0, 24);
}

const signatureStop = (cle, label, secret) =>
  createHmac('sha256', secret).update(`relance-reinscription-stop:${cle}:${label}`).digest('base64url').slice(0, 22);

export function jetonStop(cle, label, secret) {
  return `${cle}.${signatureStop(cle, label, secret)}`;
}

/** La clé du destinataire que ce jeton désigne, ou '' si le jeton est faux ou modifié. */
export function cleDuJetonStop(jeton, label, secret) {
  const [cle, sig] = String(jeton || '').split('.');
  if (!/^[0-9a-f]{24}$/.test(cle || '') || !sig) return '';
  const attendu = Buffer.from(signatureStop(cle, label, secret));
  const recu = Buffer.from(sig);
  return attendu.length === recu.length && timingSafeEqual(attendu, recu) ? cle : '';
}

/**
 * Qui relancer : fiches « À jour » (statut posé par le bureau après le paiement), avec une adresse, pas déjà
 * réinscrits, pas désinscrits, au rythme prévu. Le formulaire public écrit toute demande « En attente », sans
 * vérification : n'importe qui peut y mettre l'adresse d'un tiers, ces fiches ne reçoivent donc rien.
 * Une adresse partagée par une famille ne reçoit qu'un mail, avec tous les prénoms.
 * @returns {{ mail: string, prenoms: string[], cle: string, numero: number }[]}
 */
export function choisirDestinataires({ fiches, suivante, etats, ymd, secret, max = MAX_PAR_PASSAGE }) {
  const parAdresse = new Map();
  for (const f of fiches || []) {
    const mail = foldMail(f.MAIL || f.Mail || f.EMAIL);
    if (!estAJour(f) || !MAIL_RE.test(mail)) continue;
    if (dejaReinscrit(suivante, f)) continue;
    const prenom = String(f.PRENOM || f.Prénom || f.Prenom || '').trim();
    const g = parAdresse.get(mail) || { mail, prenoms: [] };
    if (prenom && !g.prenoms.includes(prenom)) g.prenoms.push(prenom);
    parAdresse.set(mail, g);
  }
  const out = [];
  for (const g of parAdresse.values()) {
    const cle = cleDestinataire(g.mail, secret);
    const numero = numeroSuivant(etats?.[cle], ymd);
    if (numero) out.push({ ...g, cle, numero });
  }
  return out.sort((a, b) => a.cle.localeCompare(b.cle)).slice(0, max);
}

const liste = (prenoms) => (prenoms.length > 1 ? `${prenoms.slice(0, -1).join(', ')} et ${prenoms.at(-1)}` : prenoms[0] || '');

/** Texte du mail n° 1, 2 ou 3. `lien` = page espace adhérent ; `desabo` = lien de désinscription. */
export function messageRelance({ prenoms, numero, saison, lien, desabo, nom }) {
  const s = String(saison || '').replace('-', '/');
  const bonjour = prenoms.length ? `Bonjour ${liste(prenoms)},` : 'Bonjour,';
  const intro = {
    1: `La saison ${s} se prépare. Pour garder votre place, vous pouvez vous réinscrire en un clic.`,
    2: `Petit rappel : vous n’avez pas encore gardé votre place pour la saison ${s}. Cela prend une minute.`,
    3: `Dernier rappel avant la rentrée : votre place pour la saison ${s} n’est pas encore réservée.`,
  }[numero];
  const sujet = {
    1: `Réinscription ${s} : gardez votre place`,
    2: `Réinscription ${s} : un petit rappel`,
    3: `Réinscription ${s} : dernier rappel avant la rentrée`,
  }[numero];
  const texte = `${bonjour}

${intro}

1. Ouvrez votre espace adhérent : ${lien}
2. Entrez votre adresse e-mail : vous recevez un code, sans mot de passe.
3. Touchez « Me réinscrire » : votre fiche est reprise, il ne reste que quelques questions.

Une question ? Répondez à ce message.
À bientôt,
${nom}

—
Vous ne souhaitez plus recevoir ces rappels ? ${desabo}`;
  return { sujet, texte };
}
