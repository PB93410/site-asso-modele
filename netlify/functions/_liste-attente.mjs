/**
 * File d’attente : lecture, inscription, notification, réclamation.
 */

import { ASSO, MODULES, SITE_URL } from '../../asso.derive.js';
import {
  capaciteDefaut,
  claimEncoreValable,
  delaiHeures,
  expireLe,
  filePour,
  nouvelId,
  occupesAdhesion,
  occupesEssai,
  secretListe,
  signerClaim,
  texteNotif,
  urlClaim,
  verifierClaim,
  waHref,
  LISTE_ATTENTE_HEADERS,
  ONGLET_LISTE_ATTENTE,
} from '../../src/lib/listeAttente.js';
import { envoyerMail, modeEnvoi } from './_envoi.mjs';
import { ajouterLigneSite, lireOngletSite, remplacerOngletSite } from './_onglet.mjs';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  getEssaisSheetId,
  getEssaisTab,
  pickRow,
  readSheetAsObjects,
} from './_bureau-lib.mjs';

export async function lireFile() {
  return lireOngletSite(ONGLET_LISTE_ATTENTE, LISTE_ATTENTE_HEADERS);
}

async function ecrireFile(lignes) {
  return remplacerOngletSite(ONGLET_LISTE_ATTENTE, LISTE_ATTENTE_HEADERS, lignes);
}

function basePublique(event) {
  if (process.env.DEMO === '1') {
    const origin = String(event?.headers?.origin || '').replace(/\/+$/, '');
    if (origin && /^https?:\/\//i.test(origin)) return origin;
    const host = String(event?.headers?.host || '').split(',')[0].trim();
    if (host) return `http://${host}`;
  }
  return SITE_URL;
}

export async function etatPlace({ type = 'essai', cours, creneau }) {
  const { lignes } = await lireFile();
  const file = filePour(lignes, type, cours, creneau);
  const capacite = capaciteDefaut(ASSO);
  if (type === 'adhesion') {
    const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
    const occupes = occupesAdhesion(rows, cours);
    return { capacite, occupes: occupes.length, file: file.length, complet: occupes.length + file.length >= capacite };
  }
  const { rows } = await readSheetAsObjects(getEssaisSheetId(), `'${getEssaisTab()}'!A:Z`);
  const occupes = occupesEssai(rows, cours, creneau);
  return { capacite, occupes: occupes.length, file: file.length, complet: occupes.length + file.length >= capacite };
}

export async function inscrireFile(fiche, event) {
  const { lignes } = await lireFile();
  const type = fiche.type || 'essai';
  const deja = filePour(lignes, type, fiche.cours, fiche.creneau);
  const id = nouvelId();
  const secret = secretListe();
  const token = signerClaim(id, secret);
  const rang = deja.length + 1;
  const row = {
    ID: id,
    DATE: new Date().toISOString(),
    TYPE: type,
    CRENEAU: fiche.creneau || '',
    COURS: fiche.cours || '',
    PRENOM: fiche.prenom || '',
    NOM: fiche.nom || '',
    TEL: fiche.tel || '',
    MAIL: fiche.mail || '',
    RANG: String(rang),
    STATUT: 'attente',
    TOKEN: token,
    NOTIFIE_LE: '',
    EXPIRE_LE: '',
    NOTES: fiche.notes || '',
  };
  await ajouterLigneSite(ONGLET_LISTE_ATTENTE, LISTE_ATTENTE_HEADERS, row);
  return { ...row, rang, url: urlClaim(basePublique(event), token) };
}

export async function notifierSuivant({ type = 'essai', cours, creneau }, event) {
  if (!MODULES.listeAttente) return { ok: false, raison: 'off' };
  const { lignes } = await lireFile();
  const file = filePour(lignes, type, cours, creneau);
  const cible = file.find((l) => String(l.STATUT) === 'attente') || file[0];
  if (!cible) return { ok: false, raison: 'vide' };
  const secret = secretListe();
  const token = cible.TOKEN || signerClaim(cible.ID, secret);
  const heures = delaiHeures(ASSO);
  const url = urlClaim(basePublique(event), token);
  const msg = texteNotif(ASSO, { prenom: cible.PRENOM, cours: cible.COURS || cours }, url, heures);
  const wa = waHref(cible.TEL, msg.text);
  let mailOk = false;
  const mode = modeEnvoi();
  if (cible.MAIL && mode) {
    try {
      await envoyerMail({ to: cible.MAIL, subject: msg.subject, text: msg.text });
      mailOk = true;
    } catch {
      mailOk = false;
    }
  } else if (cible.MAIL && process.env.DEMO === '1') {
    mailOk = true;
  }
  const maj = lignes.map((l) =>
    l.ID === cible.ID
      ? {
          ...l,
          STATUT: 'notifie',
          TOKEN: token,
          NOTIFIE_LE: new Date().toISOString(),
          EXPIRE_LE: expireLe(heures),
        }
      : l,
  );
  await ecrireFile(maj);
  return { ok: true, prenom: cible.PRENOM, mail: cible.MAIL, mailOk, whatsapp: wa, url, heures };
}

export async function apercuClaim(token) {
  const { lignes } = await lireFile();
  const secret = secretListe();
  const ligne = lignes.find((l) => l.TOKEN === token || verifierClaim(l.ID, token, secret));
  if (!ligne) return { ok: false, error: 'Lien invalide.', status: 404 };
  if (String(ligne.STATUT) === 'accepte') return { ok: true, deja: true, prenom: ligne.PRENOM, cours: ligne.COURS };
  if (String(ligne.STATUT) === 'expire' || (String(ligne.STATUT) === 'notifie' && !claimEncoreValable(ligne))) {
    return { ok: false, error: 'Le délai est passé.', status: 410, expire: true };
  }
  return {
    ok: true,
    prenom: ligne.PRENOM,
    cours: ligne.COURS,
    type: ligne.TYPE,
    expireLe: ligne.EXPIRE_LE,
    statut: ligne.STATUT,
  };
}

export async function reclamer(token, event) {
  const { lignes } = await lireFile();
  const secret = secretListe();
  const ligne = lignes.find((l) => l.TOKEN === token || verifierClaim(l.ID, token, secret));
  if (!ligne) return { ok: false, error: 'Lien invalide ou déjà utilisé.', status: 404 };
  if (String(ligne.STATUT) === 'accepte') return { ok: true, deja: true, prenom: ligne.PRENOM, cours: ligne.COURS };
  if (String(ligne.STATUT) === 'expire' || (String(ligne.STATUT) === 'notifie' && !claimEncoreValable(ligne))) {
    const maj = lignes.map((l) => (l.ID === ligne.ID ? { ...l, STATUT: 'expire' } : l));
    await ecrireFile(maj);
    await notifierSuivant({ type: ligne.TYPE, cours: ligne.COURS, creneau: ligne.CRENEAU }, event);
    return { ok: false, error: 'Le délai est passé. La place est proposée à la personne suivante.', status: 410 };
  }
  const maj = lignes.map((l) => (l.ID === ligne.ID ? { ...l, STATUT: 'accepte' } : l));
  await ecrireFile(maj);
  return { ok: true, ligne, prenom: ligne.PRENOM, cours: ligne.COURS, type: ligne.TYPE };
}

export { basePublique };
