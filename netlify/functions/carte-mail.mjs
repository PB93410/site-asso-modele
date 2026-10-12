/**
 * POST /api/carte-mail
 * Envoie UNE carte adhérent par mail (SMTP, Brevo ou Gmail : _envoi.mjs), avec le PNG joint.
 * Destinataire = MAIL de la fiche, jamais une adresse choisie par le navigateur.
 * Pas d’envoi groupé. Ne touche pas adhesion.mjs ni les colonnes A→R.
 * Body: { row, tel, renvoyer? }. Le recto est fabriqué à l’instant à partir de la même fiche
 * que le destinataire : il ne peut pas partir chez quelqu’un d’autre.
 * Carte déjà notée (CARTE) : refus, sauf renvoyer: true. Chaque envoi est noté au journal.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { noteCarteDate } from './carte-marquer.mjs';
import { carteFiche } from './carte-image.mjs';
import { renderRecto } from './_carte-recto.mjs';
import { journalEntry, masquerMail, noteEnvoi } from './_cartes-journal.mjs';
import { SEASON_PREFIX } from './_cartes-store.mjs';
import { envoyerMail } from './_envoi.mjs';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  handleOptions,
  json,
  pickRow,
  readSheetAsObjects,
  requireAuth,
  telPersonKey,
} from './_bureau-lib.mjs';
import { ASSO, SAISON_COURTE } from '../../asso.derive.js';
import { brancherStockage } from './_stockage.mjs';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCarteMailAddress(raw) {
  return EMAIL_RE.test(String(raw || '').trim());
}

function mailBody(prenom, numero) {
  return `Bonjour ${prenom || ''},
Voici ta carte d’adhérent ${ASSO.nom}, saison ${ASSO.saison.label} (${numero}).
Tu peux l’enregistrer dans le téléphone. Le QR au verso ouvre le site du club.
${ASSO.federation.sigle ? `Ce n’est pas la licence ${ASSO.federation.sigle}, c’est ta carte du club.` : 'C’est ta carte du club.'}
À bientôt en cours,
Le bureau`;
}

const VERSO_REL = `public/assets/carte-verso-${SAISON_COURTE}.png`;

export function versoFileName(prefix = SEASON_PREFIX) {
  return `${String(prefix || '').replace(/-$/, '')}-verso.png`;
}

/** Verso commun, inclus dans le bundle. null si le fichier manque. */
export function readVersoPng() {
  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT].filter(Boolean);
  for (const root of roots) {
    try {
      const buf = readFileSync(path.join(root, VERSO_REL));
      if (buf.length) return buf;
    } catch {
      // fichier absent à cet emplacement
    }
  }
  return null;
}

/** Le mail de la carte : texte, recto puis verso en pièces jointes. */
export function messageCarte({ to, numero, prenom, png, verso }) {
  const attachments = [{ filename: `${numero}-recto.png`, content: png, contentType: 'image/png' }];
  if (verso && verso.length) attachments.push({ filename: versoFileName(), content: verso, contentType: 'image/png' });
  return { to, subject: `Votre carte d’adhérent ${ASSO.nom}`, text: mailBody(prenom, numero), attachments };
}

function readBody(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded && raw) raw = Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(raw || '{}');
}

export async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = readBody(event);
  } catch {
    return json(400, { error: 'JSON invalide' });
  }

  const row = Number(body.row);
  if (!Number.isInteger(row) || row < 2) {
    return json(400, { error: 'Numéro de ligne invalide' });
  }

  let numero = '';
  let to = '';
  let deja = '';
  try {
    const tab = getAdherentsTab();
    const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${tab}'!A:Z`);
    const target = rows.find((r) => r._row === row);
    if (!target) {
      return json(404, { error: 'Cette fiche n’a pas été trouvée. Appuyez sur Actualiser.' });
    }
    const sentTel = body.tel;
    if (sentTel !== undefined && sentTel !== null && String(sentTel).trim() !== '') {
      const rowTel = pickRow(target, 'TEL', 'Téléphone', 'Telephone', 'Tel');
      if (telPersonKey(sentTel) !== telPersonKey(rowTel)) {
        return json(409, { error: 'Cette fiche a changé. Appuyez sur Actualiser.' });
      }
    }
    const fiche = carteFiche(target, '');
    if (fiche.error) return fiche.error;
    numero = fiche.numero;
    deja = pickRow(target, 'CARTE');
    if (deja && body.renvoyer !== true) {
      return json(409, { error: `Carte déjà partie le ${deja}. Rien n’a été envoyé.`, deja });
    }
    to = pickRow(target, 'MAIL');
    if (!isCarteMailAddress(to)) {
      return json(400, { error: 'E-mail manquant ou invalide. Rien n’a été envoyé.' });
    }
    const png = await renderRecto(fiche);
    const verso = readVersoPng();
    if (!verso) console.error('carte-mail verso introuvable, envoi du recto seul');

    await envoyerMail(messageCarte({ to, numero, prenom: fiche.prenom, png, verso }));
  } catch (err) {
    console.error('carte-mail send', err?.cause?.code || err?.cause?.message || err?.message || 'failed');
    return json(500, { error: err?.lisible ? err.message : 'L’envoi a échoué. Réessayez dans quelques minutes.' });
  }

  await noteEnvoi(event, journalEntry({ numero, row, canal: 'mail', dest: masquerMail(to), renvoi: Boolean(deja) }));

  try {
    const noted = await noteCarteDate(row, body.tel);
    return json(200, {
      ok: true,
      sent: true,
      suivi: noted.status === 200,
      carte: noted.body.carte || '',
    });
  } catch (err) {
    console.error('carte-mail suivi', err?.message || 'failed');
    return json(200, { ok: true, sent: true, suivi: false, carte: '' });
  }
}
