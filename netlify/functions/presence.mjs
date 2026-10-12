/**
 * Pointage par QR (modules.presences).
 * GET  action=info|sessions|qr|stats|inactifs
 * POST action=checkin|relance
 */

import { ASSO, MODULES, SITE_URL } from '../../asso.derive.js';
import {
  dejaPointe,
  identifiantPointage,
  inactifs,
  parisYmd,
  PRESENCES_HEADERS,
  SEMAINES_INACTIF_DEFAUT,
  secretPresence,
  sessionsDuJour,
  signerPresence,
  statsPresences,
  texteRelance,
  urlPresence,
  verifierJetonPresence,
  ONGLET_PRESENCES,
} from '../../src/lib/presence.js';
import {
  assertBrowserOrigin,
  clientIp,
  consumeRateLimit,
  getAdherentsSheetId,
  getAdherentsTab,
  getPlanningTab,
  getSiteSheetId,
  handleOptions,
  isTestPrenom,
  json,
  moduleOff,
  nowParisIso,
  pickRow,
  pickValue,
  readSheetAsObjects,
  readSheetValues,
  requireAuth,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { ajouterLigneSite, lireOngletSite } from './_onglet.mjs';
import { envoyerMail, modeEnvoi } from './_envoi.mjs';
import { readProjectFile, parseCsv } from './_demo.mjs';

async function svgQr(texte) {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toString(texte, { type: 'svg', margin: 1, width: 320, errorCorrectionLevel: 'M' });
}

function planningDepuisValeurs(values) {
  const rows = Array.isArray(values) ? values : [];
  const start = rows[0] && /day|jour/i.test(String(rows[0][0] || '')) ? 1 : 0;
  return rows.slice(start).map((r) => ({
    day: String(r[0] || '').trim(),
    time: String(r[1] || '').trim(),
    course: String(r[2] || '').trim(),
    location: String(r[3] || '').trim(),
  })).filter((p) => p.day && p.course);
}

async function lirePlanning() {
  try {
    const values = await readSheetValues(getSiteSheetId(), getPlanningTab());
    const p = planningDepuisValeurs(values);
    if (p.length) return p;
  } catch {
    // CSV du projet
  }
  return planningDepuisValeurs(parseCsv(readProjectFile('public/data/planning.csv')));
}

async function ficheAdherent({ numero, mail }) {
  const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
  const n = String(numero || '').trim().toUpperCase();
  const m = String(mail || '').trim().toLowerCase();
  return (
    rows.find((r) => {
      const num = String(pickRow(r, 'NUMERO', 'Numero') || '').trim().toUpperCase();
      const email = String(pickRow(r, 'MAIL', 'Mail', 'EMAIL') || '').trim().toLowerCase();
      if (n && num && num === n) return true;
      if (m && email && email === m) return true;
      return false;
    }) || null
  );
}

function publicJson(status, body) {
  return json(status, body);
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('presences');
  if (off) return off;

  const q = event.queryStringParameters || {};
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { error: 'Requête illisible.' });
    }
  }
  const action = String(q.action || body.action || (event.httpMethod === 'POST' ? 'checkin' : 'info')).trim();

  if (action === 'info') {
    const session = String(q.s || q.session || '').trim();
    const token = String(q.t || q.token || '').trim();
    const ymd = parisYmd();
    if (!session || !token) return json(400, { error: 'Lien incomplet.' });
    let secret;
    try {
      secret = secretPresence();
    } catch {
      return json(500, { error: 'Configuration serveur manquante.' });
    }
    if (!verifierJetonPresence(session, ymd, token, secret)) {
      return json(400, { error: 'Ce QR n’est plus valable. Demandez le code du jour au bureau.' });
    }
    const planning = await lirePlanning();
    const seance = sessionsDuJour(planning, ymd).find((s) => s.id === session);
    return json(200, {
      session,
      date: ymd,
      cours: seance?.cours || '',
      horaire: seance?.horaire || '',
      lieu: seance?.lieu || '',
      asso: ASSO.nomCourt,
    });
  }

  if (action === 'checkin') {
    const originCheck = assertBrowserOrigin(event);
    if (!originCheck.ok) return publicJson(originCheck.status, { error: originCheck.error });
    if (!consumeRateLimit(`presence:${clientIp(event)}`, 20, 10 * 60 * 1000).ok) {
      return json(429, { error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    }
    const session = pickValue(body, 'session', 's');
    const token = pickValue(body, 'token', 't');
    const numero = pickValue(body, 'numero', 'NUMERO');
    const mail = pickValue(body, 'mail', 'email');
    if (pickValue(body, 'bot-field')) return json(200, { ok: true });
    const ymd = parisYmd();
    let secret;
    try {
      secret = secretPresence();
    } catch {
      return json(500, { error: 'Configuration serveur manquante.' });
    }
    if (!session || !token || !verifierJetonPresence(session, ymd, token, secret)) {
      return json(400, { error: 'Ce QR n’est plus valable. Demandez le code du jour au bureau.' });
    }
    if (!identifiantPointage(numero, mail)) {
      return json(400, { error: 'Indiquez votre numéro d’adhérent ou votre e-mail.' });
    }
    const fiche = await ficheAdherent({ numero, mail });
    if (!fiche) {
      return json(404, { error: 'Numéro ou e-mail inconnu. Demandez au bureau.' });
    }
    const prenom = pickRow(fiche, 'PRENOM', 'Prenom');
    const nom = pickRow(fiche, 'NOM', 'Nom');
    if (isTestPrenom(prenom, nom)) {
      return json(400, { error: 'Fiche de test : rien n’a été enregistré.' });
    }
    const num = pickRow(fiche, 'NUMERO', 'Numero') || numero;
    const email = pickRow(fiche, 'MAIL', 'Mail', 'EMAIL') || mail;
    const { lignes } = await lireOngletSite(ONGLET_PRESENCES, PRESENCES_HEADERS);
    if (dejaPointe(lignes, ymd, session, num, email)) {
      return json(200, { ok: true, deja: true, prenom, cours: pickValue(body, 'cours') });
    }
    const planning = await lirePlanning();
    const seance = sessionsDuJour(planning, ymd).find((s) => s.id === session);
    await ajouterLigneSite(ONGLET_PRESENCES, PRESENCES_HEADERS, {
      DATE: ymd,
      SESSION: session,
      COURS: seance?.cours || pickValue(body, 'cours'),
      HORAIRE: seance?.horaire || '',
      NUMERO: num,
      PRENOM: prenom,
      NOM: nom,
      MAIL: email,
      HEURE: nowParisIso().slice(11, 19),
    });
    return json(200, { ok: true, deja: false, prenom, cours: seance?.cours || '' });
  }

  const auth = requireAuth(event, { roles: action === 'relance' || action === 'inactifs' || action === 'stats' ? ['admin'] : ['admin', 'seance'] });
  if (!auth.ok) return auth.response;

  if (action === 'sessions') {
    const ymd = String(q.date || parisYmd()).trim();
    const planning = await lirePlanning();
    const secret = secretPresence();
    const sessions = sessionsDuJour(planning, ymd).map((s) => {
      const token = signerPresence(s.id, ymd, secret);
      return { ...s, token, url: urlPresence(SITE_URL, s.id, token) };
    });
    return json(200, { date: ymd, sessions });
  }

  if (action === 'qr') {
    const ymd = String(q.date || parisYmd()).trim();
    const session = String(q.session || '').trim();
    if (!session) return json(400, { error: 'Séance manquante.' });
    const secret = secretPresence();
    const token = signerPresence(session, ymd, secret);
    const url = urlPresence(SITE_URL, session, token);
    const planning = await lirePlanning();
    const seance = sessionsDuJour(planning, ymd).find((s) => s.id === session) || { id: session, cours: '', horaire: '', lieu: '' };
    let svg = '';
    try {
      svg = await svgQr(url);
    } catch {
      svg = '';
    }
    return json(200, { ...seance, date: ymd, token, url, svg });
  }

  if (action === 'stats') {
    const { lignes } = await lireOngletSite(ONGLET_PRESENCES, PRESENCES_HEADERS);
    const from = String(q.from || '').trim();
    const to = String(q.to || '').trim();
    return json(200, statsPresences(lignes, { from, to }));
  }

  if (action === 'inactifs') {
    const semaines = Number(q.semaines) || SEMAINES_INACTIF_DEFAUT;
    const { lignes } = await lireOngletSite(ONGLET_PRESENCES, PRESENCES_HEADERS);
    const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
    const adherents = rows.map((r) => ({
      prenom: pickRow(r, 'PRENOM', 'Prenom'),
      nom: pickRow(r, 'NOM', 'Nom'),
      mail: pickRow(r, 'MAIL', 'Mail', 'EMAIL'),
      numero: pickRow(r, 'NUMERO', 'Numero'),
      statut: pickRow(r, 'STATUT', 'Statut'),
    }));
    return json(200, { semaines, personnes: inactifs(adherents, lignes, { semaines, aujourdHui: parisYmd() }) });
  }

  if (action === 'relance') {
    const personnes = Array.isArray(body.personnes) ? body.personnes : [];
    if (!personnes.length) return json(400, { error: 'Choisissez au moins une personne.' });
    const mode = modeEnvoi();
    const envois = [];
    for (const p of personnes.slice(0, 40)) {
      const mail = String(p.mail || '').trim();
      const msg = texteRelance(ASSO, p, p.semaines);
      if (!mail) {
        envois.push({ mail: '', ok: false, error: 'Pas d’e-mail' });
        continue;
      }
      if (!mode) {
        envois.push({ mail, ok: false, copie: msg });
        continue;
      }
      try {
        await envoyerMail({ to: mail, subject: msg.subject, text: msg.text });
        envois.push({ mail, ok: true, mode });
      } catch (err) {
        envois.push({ mail, ok: false, error: err?.lisible ? err.message : 'Envoi impossible' });
      }
    }
    return json(200, { ok: true, mailActif: Boolean(mode) && MODULES.mail !== undefined, envois });
  }

  return json(400, { error: 'Action inconnue.' });
}

export { handler as traiter };
export default versV2(handler);
