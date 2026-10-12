/**
 * POST /api/adhesion — Adhérents → Google Sheet (registre unique)
 * puis e-mail bureau (fiche texte via Netlify Forms, à archiver).
 */

import {
  appendRow,
  assertBrowserOrigin,
  clientIp,
  consumeRateLimit,
  getAdherentsSheetId,
  getAdherentsTab,
  isValidFrPhone,
  parseFrBirthDate,
  pickValue,
  moduleOff,
} from './_bureau-lib.mjs';
import { sendAdhesionNotification } from './_adhesion-mail.mjs';
import { ASSO, PAYMENT_MODES, SITE_URL } from '../../asso.derive.js';
import { brancherStockage, modeStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const CORS = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/** Modes acceptés = ceux du formulaire (asso.derive.js → PAYMENT_MODES). */
const MODES = new Set(PAYMENT_MODES);

function publicJson(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}

function extractFields(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};

  const deja = String(d.deja_adherent || '').trim();
  const cours = String(d.cours || '').trim();
  const message = String(d.message || '').trim();

  const notesParts = [];
  if (deja) notesParts.push(`Déjà adhérent: ${deja}`);
  if (cours) notesParts.push(`Cours: ${cours}`);
  if (message) notesParts.push(`Message: ${message}`);

  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const dateDemande = `${get('day')}/${get('month')}/${get('year')}`;

  const modePaiement = pickValue(d, 'mode_paiement');
  const numeroCheque = pickValue(d, 'numero_cheque', 'numeroCheque', 'n_cheque').trim().slice(0, 20);
  const isCheque = String(modePaiement || '').startsWith('Chèque');
  const detail = isCheque && numeroCheque ? `Chèque n° ${numeroCheque}` : '';

  return {
    nom: pickValue(d, 'nom'),
    prenom: pickValue(d, 'prenom'),
    telephone: pickValue(d, 'telephone', 'tel'),
    email: pickValue(d, 'email'),
    date_naissance: pickValue(d, 'date_naissance'),
    adresse: pickValue(d, 'adresse'),
    code_postal: pickValue(d, 'code_postal'),
    ville: pickValue(d, 'ville'),
    mode_paiement: modePaiement,
    numero_cheque: isCheque ? numeroCheque : '',
    detail,
    droit_image: pickValue(d, 'droit_image'),
    qs_sport: pickValue(d, 'qs_sport'),
    connu: pickValue(d, 'connu'),
    bot: pickValue(d, 'bot-field', 'bot_field'),
    deja_adherent: deja,
    cours,
    message,
    notes: notesParts.join(' | '),
    date_demande: dateDemande,
  };
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  const off = moduleOff('adhesion');
  if (off) return off;

  if (event.httpMethod !== 'POST') {
    return publicJson(405, { ok: false, error: 'Method Not Allowed' });
  }

  if (modeStockage() === 'google' && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error('Missing env: GOOGLE_SERVICE_ACCOUNT_JSON');
    return publicJson(500, { ok: false, error: 'Configuration serveur manquante' });
  }

  try {
    if ((event.body || '').length > 50_000) {
      return publicJson(413, { ok: false, error: 'Requête trop volumineuse' });
    }

    let raw = {};
    try {
      raw = JSON.parse(event.body || '{}');
    } catch {
      return publicJson(400, { ok: false, error: 'Body JSON invalide' });
    }

    const originCheck = assertBrowserOrigin(event);
    if (!originCheck.ok) {
      return publicJson(originCheck.status, { ok: false, error: originCheck.error });
    }
    if (!consumeRateLimit(`adhesion:${clientIp(event)}`, 6, 15 * 60 * 1000).ok) {
      return publicJson(429, { ok: false, error: 'Trop de demandes. Réessayez dans quelques minutes.' });
    }

    const f = extractFields(raw);

    if (f.bot) {
      return publicJson(200, { ok: true, message: 'Ligne ajoutée' });
    }

    if (!f.prenom || !f.nom || !f.telephone) {
      return publicJson(400, { ok: false, error: 'Prénom, nom et téléphone requis' });
    }
    if (f.prenom.length < 2 || f.nom.length < 2) {
      return publicJson(400, { ok: false, error: 'Prénom et nom trop courts' });
    }
    if (!isValidFrPhone(f.telephone)) {
      return publicJson(400, { ok: false, error: 'Téléphone invalide (10 chiffres)' });
    }
    if (f.email && !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(f.email)) {
      return publicJson(400, { ok: false, error: 'Email invalide' });
    }
    const birth = parseFrBirthDate(f.date_naissance);
    if (!birth.ok) {
      return publicJson(400, { ok: false, error: birth.error });
    }
    if (!MODES.has(f.mode_paiement)) {
      return publicJson(400, { ok: false, error: 'Choisissez un mode de règlement' });
    }
    if (f.mode_paiement.startsWith('Chèque') && !f.numero_cheque) {
      return publicJson(400, { ok: false, error: 'Indiquez le n° de chèque, ou un autre mode' });
    }
    if (f.code_postal && !/^\d{5}$/.test(f.code_postal.replace(/\s/g, ''))) {
      return publicJson(400, { ok: false, error: 'Code postal : 5 chiffres' });
    }
    if (!f.droit_image || !f.qs_sport) {
      return publicJson(400, { ok: false, error: 'Photos de cours et QS-SPORT sont requis' });
    }

    const row = [
      f.nom,
      f.prenom,
      f.telephone,
      f.email,
      f.date_naissance,
      f.adresse,
      f.code_postal,
      f.ville,
      f.mode_paiement,
      'En attente',
      String(ASSO.adhesion.tarif),
      f.detail || '',
      '',
      f.droit_image,
      f.qs_sport,
      f.connu || 'Formulaire',
      f.notes,
      f.date_demande,
    ];

    await appendRow(getAdherentsSheetId(), getAdherentsTab(), row);

    try {
      await sendAdhesionNotification({
        prenom: f.prenom,
        nom: f.nom,
        telephone: f.telephone,
        email: f.email,
        date_naissance: f.date_naissance,
        adresse: f.adresse,
        code_postal: f.code_postal,
        ville: f.ville,
        mode_paiement: f.mode_paiement,
        numero_cheque: f.numero_cheque,
        detail: f.detail,
        droit_image: f.droit_image,
        qs_sport: f.qs_sport,
        deja_adherent: f.deja_adherent,
        connu: f.connu,
        cours: f.cours,
        message: f.message,
      });
    } catch (mailErr) {
      console.error('adhesion mail:', mailErr?.message || mailErr);
    }

    return publicJson(200, { ok: true, message: 'Ligne ajoutée' });
  } catch (err) {
    console.error('adhesion error:', err?.message || err);
    return publicJson(500, { ok: false, error: 'Erreur serveur' });
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
