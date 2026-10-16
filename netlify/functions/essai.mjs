/**
 * POST /api/essai — 1 envoi = 1 ligne Essais (STATUT À venir).
 * N_ESSAI = lignes À venir|Venu du même TEL + 1. Pas de blocage au 4e.
 */

import {
  appendRow,
  assertBrowserOrigin,
  clientIp,
  consumeRateLimit,
  creneauLabel,
  getEssaisSheetId,
  getEssaisTab,
  headerName,
  isEssaiCountableStatut,
  isValidFrPhone,
  nowParisIso,
  parisYmdFromValue,
  pickRow,
  pickValue,
  readSheetAsObjects,
  rowFromHeaders,
  telPersonKey,
  moduleOff,
} from './_bureau-lib.mjs';
import { buildDateEssaiCell, formatEssaiDateLabel } from './_essai-dates.mjs';
import { notifyBureauNewLead } from './_notify-bureau.mjs';
import { ecrireMail } from './_essai-mails.mjs';
import { sendEssaiNotification } from './_essai-mail.mjs';
import { MODULES, SITE_URL, essaisOuverts } from '../../asso.derive.js';
import { brancherStockage, modeStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { etatPlace, inscrireFile } from './_liste-attente.mjs';

const CORS = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const COURSES = new Set([
  'Gym Douce',
  'Renforcement Musculaire',
  'Cardio & Gym',
  'Stretching',
  'Zumba',
  'Pilates',
]);

const DATE_PREFIX = /^\d{2}\/\d{2}\/\d{4}/;

/** CRENEAU Sheet : date réelle quand le cours et le créneau sont connus. */
export function buildEssaiCreneau(cours, dateEssai, explicit) {
  const c = String(cours || '').trim();
  const slot = String(dateEssai || '').trim();
  if (COURSES.has(c) && slot) {
    const dated = String(buildDateEssaiCell(c, slot) || '').trim();
    if (DATE_PREFIX.test(dated)) return `${dated} · ${c}`;
  }
  return creneauLabel(cours, dateEssai, explicit);
}

function publicDateLabel(creneau) {
  const slot = String(creneau || '').trim();
  if (DATE_PREFIX.test(slot)) return formatEssaiDateLabel(slot);
  return slot || 'sans créneau';
}

function foldCreneau(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function publicJson(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  const off = moduleOff('essais');
  if (off) return off;
  if (event.httpMethod !== 'POST') {
    return publicJson(405, { ok: false });
  }
  if (modeStockage() === 'google' && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error('essai: missing GOOGLE_SERVICE_ACCOUNT_JSON');
    return publicJson(500, { ok: false, error: 'Configuration serveur manquante' });
  }

  if (event.body && event.body.length > 20_000) {
    return publicJson(413, { ok: false });
  }

  const originCheck = assertBrowserOrigin(event);
  if (!originCheck.ok) {
    return publicJson(originCheck.status, { ok: false, error: originCheck.error });
  }
  // Fin des essais (saison.finEssais dans asso.config.js) : plus de nouvelle demande.
  if (!essaisOuverts()) {
    return publicJson(410, { ok: false, error: 'Les essais sont terminés pour cette saison. Vous pouvez adhérer sur le site.' });
  }
  if (!consumeRateLimit(`essai:${clientIp(event)}`, 8, 10 * 60 * 1000).ok) {
    return publicJson(429, { ok: false, error: 'Trop de demandes. Réessayez dans quelques minutes.' });
  }

  let raw = {};
  try {
    raw = JSON.parse(event.body || '{}');
  } catch {
    return publicJson(400, { ok: false });
  }

  if (pickValue(raw, 'bot-field')) {
    return publicJson(200, { ok: true });
  }

  const prenom = pickValue(raw, 'prenom', 'Prenom');
  const nom = pickValue(raw, 'nom', 'Nom');
  const telephone = pickValue(raw, 'telephone', 'tel');
  let cours = pickValue(raw, 'cours', 'Cours');
  const dateEssai = pickValue(raw, 'date_essai', 'date');
  const sourceBrute = pickValue(raw, 'source').toLowerCase();
  // Provenance : forum (QR du stand), parrainage (lien commun de l'espace adhérent, sans nom), sinon le formulaire.
  const leadSource = sourceBrute === 'forum' ? 'Forum' : sourceBrute === 'parrainage' && MODULES.parrainage ? 'Parrainage' : 'Formulaire';
  const creneau = buildEssaiCreneau(cours, dateEssai, pickValue(raw, 'creneau'));
  const email = pickValue(raw, 'email', 'mail');

  if (!prenom || !nom || !telephone) {
    return publicJson(400, { ok: false, error: 'Prénom, nom et téléphone requis' });
  }
  if (cours && !COURSES.has(cours)) cours = '';
  if (!isValidFrPhone(telephone)) {
    return publicJson(400, { ok: false, error: 'Téléphone invalide' });
  }

  const dateDemande = nowParisIso();
  const todayYmd = parisYmdFromValue(dateDemande);
  const dateLabel = publicDateLabel(creneau);

  try {
    const sheetId = getEssaisSheetId();
    const tab = getEssaisTab();
    const { headers, rows } = await readSheetAsObjects(sheetId, `'${tab}'!A:Z`);
    const phoneKey = telPersonKey(telephone);

    if (phoneKey && creneau) {
      const twice = rows.find((r) => {
        const sameTel = telPersonKey(pickRow(r, 'TEL', 'Téléphone', 'Telephone', 'Tel')) === phoneKey;
        const sameSlot = foldCreneau(pickRow(r, 'CRENEAU', 'Cours')) === foldCreneau(creneau)
          || foldCreneau(pickRow(r, 'CRENEAU')) === foldCreneau(creneau);
        const day = parisYmdFromValue(pickRow(r, 'DATE_DEMANDE', 'Date essai'));
        return sameTel && sameSlot && day === todayYmd;
      });
      if (twice) {
        return publicJson(200, { ok: true, duplicate: true, dateLabel, nEssai: pickRow(twice, 'N_ESSAI', 'N° essai', 'N essai') });
      }
    }

    let nEssai = 1;
    if (phoneKey) {
      const counted = rows.filter((r) => {
        if (telPersonKey(pickRow(r, 'TEL', 'Téléphone', 'Telephone', 'Tel')) !== phoneKey) return false;
        return isEssaiCountableStatut(pickRow(r, 'STATUT', 'Statut'));
      });
      nEssai = counted.length + 1;
    }

    if (MODULES.listeAttente && cours) {
      const place = await etatPlace({ type: 'essai', cours, creneau });
      if (place.complet) {
        const file = await inscrireFile(
          { type: 'essai', cours, creneau, prenom, nom, tel: telephone, mail: email },
          event,
        );
        return publicJson(200, {
          ok: true,
          listeAttente: true,
          rang: file.rang,
          dateLabel,
          message: 'Ce créneau est complet. Vous êtes sur la liste d’attente.',
        });
      }
    }

    const fields = {
      DATE_DEMANDE: dateDemande,
      NOM: nom,
      PRENOM: prenom,
      TEL: telephone,
      CRENEAU: creneau,
      COURS: cours,
      STATUT: 'À venir',
      N_ESSAI: String(nEssai),
      SOURCE: leadSource,
      NOTES: '',
      Nom: nom,
      'Prénom': prenom,
      Prenom: prenom,
      Téléphone: telephone,
      Telephone: telephone,
      Tel: telephone,
      Cours: cours,
      'Date essai': creneau,
      Statut: 'À venir',
      'N° essai': String(nEssai),
      'N essai': String(nEssai),
      Remarque: leadSource,
    };

    const row =
      headers.length >= 3
        ? rowFromHeaders(headers, fields)
        : [dateDemande, nom, prenom, telephone, creneau, cours, 'À venir', String(nEssai), leadSource, ''];

    // STATUT vide (décalage d’en-tête) → toujours « À venir » pour Accueil / Essais.
    if (headers.length >= 3) {
      const statutHeader = headerName(headers, 'STATUT');
      const statutIdx = headers.findIndex((h) => h === statutHeader);
      if (statutIdx >= 0 && !String(row[statutIdx] || '').trim()) {
        row[statutIdx] = 'À venir';
      }
    }

    await appendRow(sheetId, tab, row);

    // E-mail facultatif (modules.essaiMail) : rangé à part, seulement pour le rappel de la veille et le mot après l'essai.
    // Lié à CETTE demande (téléphone + minute de la demande, comme la ligne écrite) : saisir le numéro d'un tiers ne
    // détourne jamais ses rappels.
    if (MODULES.essaiMail && email) {
      try {
        await ecrireMail({ tel: telephone, demandeLe: dateDemande }, email, todayYmd, process.env.BUREAU_SECRET);
      } catch (mailErr) {
        console.error('essai: adresse de rappel', mailErr?.message || 'failed');
      }
    }
    try {
      await sendEssaiNotification({
        prenom,
        nom,
        telephone,
        cours,
        creneau: DATE_PREFIX.test(creneau) ? dateLabel : (creneau || ''),
        nEssai,
        email,
      });
    } catch (mailErr) {
      console.error('essai: mail bureau', mailErr?.message || mailErr);
    }
    try {
      await notifyBureauNewLead({
        source: leadSource === 'Forum' ? 'forum' : 'site',
        prenom,
        cours: cours || '',
        when: dateLabel,
      });
    } catch (alertErr) {
      console.error('essai: alerte bureau', alertErr?.message || alertErr);
    }
    return publicJson(200, { ok: true, dateLabel, nEssai });
  } catch (err) {
    console.error('essai: append failed', err?.code || err?.message || 'error');
    return publicJson(500, { ok: false, error: 'Envoi impossible pour le moment' });
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
