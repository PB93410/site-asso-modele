/**
 * Lien « Adhérer en 1 minute » : /inscription?e=JETON préremplit prénom, nom et téléphone de la personne
 * qui a fait un essai (message « merci » du bureau). Le jeton ne contient aucune donnée personnelle :
 * une échéance et une signature HMAC (BUREAU_SECRET, 24 caractères ou plus) du téléphone. Il ne dépend
 * pas du numéro de ligne du tableau, qu'un tri peut changer.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { telPersonKey } from './_bureau-lib.mjs';

export const DUREE_LIEN_ADHESION_MS = 45 * 24 * 60 * 60 * 1000;

function signature(tel9, exp, secret) {
  return createHmac('sha256', secret).update(`lien-adhesion:${tel9}:${exp}`).digest('base64url').slice(0, 22);
}

/** Jeton pour ce téléphone, ou '' si le numéro est inutilisable ou le secret absent (≥ 24 caractères). */
export function signerLienAdhesion(tel, secret, maintenant = Date.now(), duree = DUREE_LIEN_ADHESION_MS) {
  const tel9 = telPersonKey(tel);
  if (!tel9 || String(secret || '').length < 24) return '';
  const exp = Math.floor((maintenant + duree) / 1000).toString(36);
  return `${exp}.${signature(tel9, exp, secret)}`;
}

/**
 * Parmi les téléphones connus, celui que ce jeton désigne (clé à 9 chiffres), ou '' si le jeton est
 * faux, modifié ou périmé.
 */
export function personneDuLien(jeton, tels, secret, maintenant = Date.now()) {
  if (String(secret || '').length < 24) return '';
  const [exp, sig] = String(jeton || '').split('.');
  if (!exp || !sig || sig.length !== 22 || !/^[0-9a-z]+$/.test(exp)) return '';
  if (parseInt(exp, 36) * 1000 < maintenant) return '';
  const recu = Buffer.from(sig);
  for (const tel of tels || []) {
    const tel9 = telPersonKey(tel);
    if (!tel9) continue;
    const attendu = Buffer.from(signature(tel9, exp, secret));
    if (attendu.length === recu.length && timingSafeEqual(attendu, recu)) return tel9;
  }
  return '';
}
