/**
 * POST /api/carte-mail
 * Envoie UNE carte adhérent par mail (Gmail asso), avec le PNG joint.
 * Destinataire = MAIL de la fiche, jamais une adresse choisie par le navigateur.
 * Pas d’envoi groupé. Ne touche pas adhesion.mjs ni les colonnes A→R.
 * Body: { row, imageBase64 }
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { connectLambda, getStore } from '@netlify/blobs';
import { google } from 'googleapis';
import { noteCarteDate } from './carte-marquer.mjs';
import { CARTES_STORE, CARTE_NUMERO_RE, SEASON_PREFIX } from './_cartes-store.mjs';
import { ASSO_GMAIL, getUserGoogleAuth, googleErrorMessage, mimeName, toBase64Url } from './_google-user.mjs';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  handleOptions,
  isTestPrenom,
  json,
  pickRow,
  readSheetAsObjects,
  requireAuth,
  telPersonKey,
} from './_bureau-lib.mjs';
import { ASSO } from '../../asso.derive.js';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCarteMailAddress(raw) {
  return EMAIL_RE.test(String(raw || '').trim());
}

/** PNG réel, taille d’une carte (~125 Ko). Refuse le reste. */
export function pngFromBase64(raw) {
  const clean = String(raw || '')
    .replace(/^data:image\/png;base64,/i, '')
    .replace(/\s/g, '');
  if (!clean || !/^[A-Za-z0-9+/]+=*$/.test(clean)) return null;
  const buf = Buffer.from(clean, 'base64');
  if (buf.length < 1000 || buf.length > 400_000) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return buf;
}

function encodeMimeSubject(raw) {
  const s = String(raw || '').trim();
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function wrap76(b64) {
  return b64.replace(/.{1,76}/g, '$&\r\n').trim();
}

function mailBody(prenom, numero) {
  return `Bonjour ${prenom || ''},
Voici ta carte d’adhérent ${ASSO.nom}, saison ${ASSO.saison.label} (${numero}).
Tu peux l’enregistrer dans le téléphone. Le QR au verso ouvre le site du club.
${ASSO.federation.sigle ? `Ce n’est pas la licence ${ASSO.federation.sigle}, c’est ta carte du club.` : 'C’est ta carte du club.'}
À bientôt en cours,
Le bureau`;
}

const VERSO_REL = 'public/assets/carte-verso-2627.png';

export function versoFileName(prefix = SEASON_PREFIX) {
  return `${String(prefix || '').replace(/-$/, '')}-verso.png`;
}

function pngPart(boundary, filename, png) {
  return [
    `--${boundary}`,
    `Content-Type: image/png; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    wrap76(png.toString('base64')),
    '',
  ];
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

export function buildMime({ to, numero, prenom, png, verso }) {
  const boundary = `asso-carte-${numero}`;
  const subject = encodeMimeSubject(`Votre carte d’adhérent ${ASSO.nom}`);
  const lines = [
    `From: ${mimeName(ASSO.nom)} <${ASSO_GMAIL}>`,
    `To: ${to}`,
    `Reply-To: ${ASSO_GMAIL}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    mailBody(prenom, numero),
    '',
    ...pngPart(boundary, `${numero}-recto.png`, png),
  ];
  if (verso && verso.length) lines.push(...pngPart(boundary, versoFileName(), verso));
  lines.push(`--${boundary}--`, '');
  return lines.join('\r\n');
}

function blobsStore(event) {
  const headers = {};
  for (const [key, value] of Object.entries(event.headers || {})) {
    headers[String(key).toLowerCase()] = value;
  }
  connectLambda({ ...event, headers });
  return getStore(CARTES_STORE);
}

/** PNG du coffre, sinon le fichier envoyé s’il porte le bon nom — puis rangé dans le coffre. */
async function pngForCarte(event, body, numero) {
  let store = null;
  try {
    store = blobsStore(event);
    const data = await store.get(numero, { type: 'arrayBuffer' });
    if (data && data.byteLength) return { png: Buffer.from(data) };
  } catch (err) {
    console.error('carte-mail coffre', err?.message || 'failed');
    store = null;
  }

  const fileName = String(body.fileName || '').trim();
  if (fileName !== `${numero}.png`) {
    return {
      error: json(400, {
        error: `Carte introuvable dans le coffre. Ajoutez le fichier ${numero}.png.`,
      }),
    };
  }
  const png = pngFromBase64(body.imageBase64);
  if (!png) return { error: json(400, { error: 'Image de la carte introuvable' }) };

  try {
    if (!store) store = blobsStore(event);
    await store.set(numero, new Blob([png], { type: 'image/png' }), {
      metadata: { contentType: 'image/png' },
    });
  } catch (err) {
    console.error('carte-mail coffre', err?.message || 'failed');
    return { error: json(500, { error: 'Impossible d’enregistrer la carte. Réessayez dans un instant.' }) };
  }
  return { png };
}

function readBody(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded && raw) raw = Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(raw || '{}');
}

export async function handler(event) {
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

  let png;
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
    if (isTestPrenom(pickRow(target, 'PRENOM'), pickRow(target, 'NOM'))) {
      return json(400, { error: 'Fiche de test. Rien n’a été envoyé.' });
    }
    if (pickRow(target, 'STATUT') !== 'À jour') {
      return json(400, { error: 'Cette fiche n’est pas à jour. Rien n’a été envoyé.' });
    }
    const numero = pickRow(target, 'NUMERO');
    if (!CARTE_NUMERO_RE.test(numero)) {
      return json(400, { error: 'Numéro manquant. Rien n’a été envoyé.' });
    }
    const to = pickRow(target, 'MAIL');
    if (!isCarteMailAddress(to)) {
      return json(400, { error: 'E-mail manquant ou invalide. Rien n’a été envoyé.' });
    }
    const loaded = await pngForCarte(event, body, numero);
    if (loaded.error) return loaded.error;
    png = loaded.png;
    const verso = readVersoPng();
    if (!verso) console.error('carte-mail verso introuvable, envoi du recto seul');

    const gmail = google.gmail({ version: 'v1', auth: getUserGoogleAuth() });
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: toBase64Url(buildMime({ to, numero, prenom: pickRow(target, 'PRENOM'), png, verso })) },
    });
  } catch (err) {
    const googleCode = err?.response?.data?.error || err?.message || 'failed';
    console.error('carte-mail send', googleCode);
    return json(500, { error: googleErrorMessage(err) });
  }

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
