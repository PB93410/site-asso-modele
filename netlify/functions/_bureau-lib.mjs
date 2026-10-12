/**
 * Shared helpers for /bureau Netlify Functions
 * Mini back-office de l’association
 * LOT-3 : pas de secrets de repli, CORS restreint, no-store
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { google } from 'googleapis';
import { ASSO, MODULES, PAYMENT_MODES, SITE_URL } from '../../asso.derive.js';
import { DEMO, demoSheets, parseCsv, readProjectFile } from './_demo.mjs';
import { blobSheets, CLASSEURS, surNetlify } from './_stockage.mjs';

export { SEASON_PREFIX, nextAdherentNumero } from './_cartes-store.mjs';

// ---------------------------------------------------------------------------
// Config — pas d’ID Sheet en dur (LOT A)
// Alias GOOGLE_SUIVI_SHEET_* conservé le temps d’aligner Netlify.
// ---------------------------------------------------------------------------

export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

/**
 * Feuille Adhérents (Google Drive) — en-têtes A→R, ne pas renommer.
 * Colonnes vides après DATE_DEMANDE : ignorées à la lecture, sauf NUMERO (S)
 * et CARTE (T) si présentes (cartes adhérent). Ne jamais les insérer avant DATE_DEMANDE.
 * STATUT : En attente | À jour | Essai | Arrêt
 * MODE : modes du formulaire (asso.derive.js → PAYMENT_MODES) | autres déjà présents
 * Mail « Marquer à jour » et Bureau « J’ai reçu l’argent » → STATUT = « À jour »
 * À traiter / À payer = uniquement STATUT « En attente »
 */
export const ADHERENTS_HEADERS = [
  'NOM',
  'PRENOM',
  'TEL',
  'MAIL',
  'DATE_NAISSANCE',
  'ADRESSE',
  'CP',
  'VILLE',
  'MODE',
  'STATUT',
  'MONTANT',
  'DETAIL',
  'DATE_PAIEMENT',
  'DROIT_IMAGE',
  'QS_SPORT',
  'SOURCE',
  'NOTES',
  'DATE_DEMANDE',
];
export const ADHERENTS_STATUTS = ['En attente', 'À jour', 'Essai', 'Arrêt'];
/** Modes acceptés à la validation : ceux du formulaire + saisie bureau. */
export const ADHERENTS_MODES = [...new Set([...PAYMENT_MODES, 'Bureau'])];

/** Feuille Essais — en-têtes A→J, ne pas renommer. */
export const ESSAIS_HEADERS = [
  'DATE_DEMANDE',
  'NOM',
  'PRENOM',
  'TEL',
  'CRENEAU',
  'COURS',
  'STATUT',
  'N_ESSAI',
  'SOURCE',
  'NOTES',
];
export const ESSAIS_STATUTS = ['À venir', 'Confirmé', 'Venu', 'Absent', 'Annulé', 'Adhérent', 'Relancé'];

export function getAdherentsSheetId() {
  if (surNetlify()) return CLASSEURS.adherents;
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID manquante');
  return id;
}

export function getAdherentsTab() {
  return process.env.GOOGLE_SHEET_NAME || `Saison ${ASSO.saison.label}`;
}

export function getEssaisSheetId() {
  if (surNetlify()) return CLASSEURS.essais;
  const id = process.env.GOOGLE_SHEET_ESSAIS_ID || process.env.GOOGLE_SUIVI_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ESSAIS_ID manquante');
  return id;
}

export function getEssaisTab() {
  return process.env.GOOGLE_SHEET_ESSAIS_NAME || process.env.GOOGLE_SUIVI_SHEET_NAME || 'Essais';
}

/** Lien d’édition Google Sheets — uniquement renvoyé après auth bureau. Vide hors Google. */
export function googleSheetEditUrl(spreadsheetId) {
  const id = String(spreadsheetId || '').trim();
  if (!id || surNetlify() || DEMO) return '';
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
}

export function getSiteSheetId() {
  if (surNetlify()) return CLASSEURS.site;
  const id =
    process.env.GOOGLE_SITE_SHEET_ID ||
    process.env.GOOGLE_SHEET_ESSAIS_ID ||
    process.env.GOOGLE_SUIVI_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SITE_SHEET_ID manquante');
  return id;
}

export function getPlanningTab() {
  return process.env.GOOGLE_SITE_TAB_PLANNING || 'PLANNING';
}

export function getEventsTab() {
  return process.env.GOOGLE_SITE_TAB_EVENTS || 'EVENEMENTS';
}

const SITE_ORIGIN = process.env.SITE_ORIGIN || SITE_URL;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getSecret() {
  const secret = process.env.BUREAU_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error(
      'BUREAU_SECRET manquante ou trop courte — configuration serveur invalide. ' +
        'Définir une valeur aléatoire de 32+ caractères dans les variables Netlify.',
    );
  }
  return secret;
}

const BUREAU_ROLES = new Set(['admin', 'seance']);

function signaturesMatch(sig, expected) {
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Jeton signé (HMAC) valable TOKEN_TTL_MS. Rôle admin ou seance.
 */
export function createBureauToken(role = 'admin') {
  const r = BUREAU_ROLES.has(role) ? role : 'admin';
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `bureau:${r}:${exp}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${r}.${exp}.${sig}`;
}

/**
 * Vérifie le jeton role.exp.sig. L’ancien format exp.sig (sans rôle) n’est plus accepté.
 */
export function verifyBureauToken(token) {
  const refused = { ok: false, role: null };
  if (!token || typeof token !== 'string') return refused;
  const parts = token.split('.');

  if (parts.length === 3) {
    const [role, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!BUREAU_ROLES.has(role) || !sig || !Number.isFinite(exp) || Date.now() > exp) return refused;
    let expected;
    try {
      expected = createHmac('sha256', getSecret()).update(`bureau:${role}:${exp}`).digest('hex');
    } catch {
      return refused;
    }
    if (!signaturesMatch(sig, expected)) return refused;
    return { ok: true, role };
  }

  return refused;
}

/**
 * Extract token from Authorization: Bearer … or x-bureau-token header
 */
export function extractToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return event.headers?.['x-bureau-token'] || event.headers?.['X-Bureau-Token'] || '';
}

/**
 * Jeton valide et rôle autorisé. Défaut : admin seulement.
 * Renvoie { ok: true, role } ou { ok: false, response }.
 */
const MODULE_NOMS = {
  essais: 'Le formulaire d’essai',
  adhesion: 'L’inscription en ligne',
  bureau: 'L’espace bureau',
  mail: 'Le mail du bureau',
  presences: 'Le pointage par QR',
  quiz: 'Le quiz « Quel cours pour moi ? »',
  alertes: 'Les alertes de dernière minute',
  attestations: 'Les attestations PDF',
};

/** Réponse 404 si la fonction est désactivée dans asso.config.js → modules, sinon null. */
export function moduleOff(name) {
  if (MODULES[name]) return null;
  return json(404, { error: `${MODULE_NOMS[name] || 'Cette fonction'} n’est pas activé sur ce site.` });
}

export function requireAuth(event, { roles = ['admin'] } = {}) {
  const off = moduleOff('bureau');
  if (off) return { ok: false, response: off };
  const verified = verifyBureauToken(extractToken(event));
  if (!verified.ok) {
    return {
      ok: false,
      response: json(401, { error: 'Non autorisé. Reconnectez-vous.' }),
    };
  }
  const allowed = Array.isArray(roles) && roles.length ? roles : ['admin'];
  if (!allowed.includes(verified.role)) {
    return {
      ok: false,
      response: json(403, { error: 'Accès réservé au bureau.' }),
    };
  }
  return { ok: true, role: verified.role };
}

function passwordsEqual(password, expected) {
  const a = Buffer.from(typeof password === 'string' ? password : '', 'utf8');
  const b = Buffer.from(String(expected || ''), 'utf8');
  // Comparaison à temps constant ; la longueur reste une fuite acceptable ici.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** 'admin' | 'seance' | null. Les deux mots de passe sont comparés quand les deux existent. */
export function checkPassword(password) {
  const admin = process.env.BUREAU_PASSWORD;
  if (!admin) {
    throw new Error('BUREAU_PASSWORD manquante — configuration serveur invalide.');
  }
  const seance = process.env.BUREAU_PASSWORD_SEANCE;
  const hasSeance = typeof seance === 'string' && seance.length > 0;
  const adminOk = passwordsEqual(password, admin);
  const seanceOk = hasSeance ? passwordsEqual(password, seance) : false;
  if (adminOk) return 'admin';
  if (seanceOk) return 'seance';
  return null;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

export function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'Access-Control-Allow-Origin': SITE_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bureau-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      Vary: 'Origin',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function handleOptions() {
  return json(204, {});
}

const PUBLIC_ORIGINS = new Set([
  SITE_ORIGIN,
  'http://localhost:5173',
  'http://localhost:8888',
]);

function isProductionRuntime() {
  return process.env.CONTEXT === 'production';
}

/** IP visiteur (Netlify) — pour quota anti-spam. */
export function clientIp(event) {
  const h = event.headers || {};
  const raw =
    h['x-nf-client-connection-ip'] ||
    h['x-forwarded-for'] ||
    h['client-ip'] ||
    '';
  return String(raw).split(',')[0].trim() || 'unknown';
}

/**
 * Origine navigateur. En production : Origin obligatoire et = SITE_ORIGIN.
 * En local : Origin optionnelle, mais refusée si hors liste.
 */
export function assertBrowserOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  // Démo : données fictives, le site de démo peut avoir une autre adresse que siteUrl.
  if (DEMO) return { ok: true };
  if (isProductionRuntime()) {
    if (origin !== SITE_ORIGIN) {
      return { ok: false, status: 403, error: 'Origine non autorisée' };
    }
    return { ok: true };
  }
  if (origin && !PUBLIC_ORIGINS.has(origin)) {
    return { ok: false, status: 403, error: 'Origine non autorisée' };
  }
  return { ok: true };
}

/** Compteurs en mémoire (instance Function). Suffisant contre le spam opportuniste. */
const rateBuckets = new Map();

export function consumeRateLimit(key, max, windowMs) {
  const now = Date.now();
  if (rateBuckets.size > 2500) {
    for (const [k, v] of rateBuckets) {
      if (now > v.reset) rateBuckets.delete(k);
    }
  }
  let b = rateBuckets.get(key);
  if (!b || now > b.reset) {
    rateBuckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > max) return { ok: false };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Google Sheets
// ---------------------------------------------------------------------------

let _sheetsClient = null;

/** Stockage Netlify : contenu d'un onglet jamais écrit (en-têtes, ou planning et événements du site). */
export function ongletVierge(id, tab) {
  if (id === CLASSEURS.adherents) return [[...ADHERENTS_HEADERS, 'NUMERO', 'CARTE']];
  if (id === CLASSEURS.essais) return [ESSAIS_HEADERS];
  if (id === CLASSEURS.site) {
    const fichier = tab === getPlanningTab() ? 'planning' : tab === getEventsTab() ? 'evenements' : '';
    if (fichier) return parseCsv(readProjectFile(`public/data/${fichier}.csv`));
    if (tab === 'PRESENCES') return [['DATE', 'SESSION', 'COURS', 'HORAIRE', 'NUMERO', 'PRENOM', 'NOM', 'MAIL', 'HEURE']];
    if (tab === 'ALERTES') return [['ID', 'DATE', 'SESSION', 'COURS', 'TYPE', 'MESSAGE', 'CREEE_LE', 'EXPIRE_LE']];
    if (tab === 'ALERTES_ABOS') return [['MAIL', 'CONSENT', 'DATE', 'TOKEN', 'PUSH', 'ACTIF']];
    if (tab === 'LISTE_ATTENTE') return [['ID', 'DATE', 'TYPE', 'CRENEAU', 'COURS', 'PRENOM', 'NOM', 'TEL', 'MAIL', 'RANG', 'STATUT', 'TOKEN', 'NOTIFIE_LE', 'EXPIRE_LE', 'NOTES']];
    return [];
  }
  return [];
}

export async function getSheets() {
  if (_sheetsClient) return _sheetsClient;
  if (DEMO) {
    _sheetsClient = demoSheets();
    return _sheetsClient;
  }
  if (surNetlify()) {
    _sheetsClient = blobSheets({ seed: ongletVierge });
    return _sheetsClient;
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON manquant');
  }

  let credentials;
  try {
    credentials = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON invalide (JSON)');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

/**
 * Read a range and return { headers, rows } where rows are objects keyed by header.
 * Empty cells become "".
 */
/**
 * Adhérents : DATE_DEMANDE borne A→R. On ne garde ensuite que NUMERO et CARTE,
 * avec leur vrai index de colonne (pour écrire en T, pas dans A→R).
 * Essais : DATE_DEMANDE en tête (index 0) — on ne coupe rien.
 */
export function adherentReadColumns(headers) {
  const list = headers || [];
  const dateDemandeAt = list.findIndex((h) => String(h || '').replace(/\s+/g, '_').toUpperCase() === 'DATE_DEMANDE');
  if (dateDemandeAt <= 0) {
    return { headers: list, colIndices: list.map((_, i) => i) };
  }
  const keep = [];
  const keepIdx = [];
  for (let i = 0; i <= dateDemandeAt; i++) {
    keep.push(list[i]);
    keepIdx.push(i);
  }
  for (let i = dateDemandeAt + 1; i < list.length; i++) {
    const n = String(list[i] || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .trim();
    if (n === 'numero' || n === 'carte') {
      keep.push(list[i] || (n === 'numero' ? 'NUMERO' : 'CARTE'));
      keepIdx.push(i);
    }
  }
  return { headers: keep, colIndices: keepIdx };
}

export async function readSheetAsObjects(spreadsheetId, range) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const values = res.data.values || [];
  if (values.length === 0) return { headers: [], rows: [] };

  function looksLikeHeader(row) {
    const n = (row || []).map((c) =>
      String(c || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    );
    const hasName = n.some((c) => c.includes('prenom') || c === 'nom');
    const hasTel = n.some((c) => c.includes('tel') || c.includes('telephone'));
    return hasName && hasTel;
  }

  let headerIdx = 0;
  for (let i = 0; i < Math.min(values.length, 12); i++) {
    if (looksLikeHeader(values[i])) {
      headerIdx = i;
      break;
    }
  }

  const picked = adherentReadColumns((values[headerIdx] || []).map((h) => String(h || '').trim()));
  const headers = picked.headers;
  const colIndices = picked.colIndices;
  const rows = [];

  for (let i = headerIdx + 1; i < values.length; i++) {
    const raw = values[i];
    if (!raw || raw.every((c) => c === undefined || c === null || String(c).trim() === '')) {
      continue;
    }
    const obj = { _row: i + 1 };
    headers.forEach((h, idx) => {
      if (!h) return;
      const col = colIndices[idx];
      obj[h] = raw[col] !== undefined && raw[col] !== null ? String(raw[col]).trim() : '';
    });
    rows.push(obj);
  }

  return { headers, rows, colIndices };
}

/**
 * Append a row. Returns 1-based sheet row number when available.
 */
/** Empêche Sheets d’interpréter une saisie publique comme formule. */
export function sheetSafeCell(value) {
  const s = String(value ?? '');
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

export async function appendRow(spreadsheetId, sheetName, values) {
  const sheets = await getSheets();
  const range = `'${sheetName}'!A:Z`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values.map(sheetSafeCell)] },
  });
  const updatedRange = res.data?.updates?.updatedRange || '';
  const m = String(updatedRange).match(/![A-Z]+(\d+)/);
  return m ? Number(m[1]) : null;
}

export async function readSheetValues(spreadsheetId, sheetName) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:Z`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.values || [];
}

export async function replaceSheetValues(spreadsheetId, sheetName, values) {
  const sheets = await getSheets();
  const rows = Array.isArray(values) ? values : [];
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
  }
  const next = rows.length + 1;
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetName}'!A${next}:Z`,
  });
}

export function rowsToCsv(values) {
  return (values || [])
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(','),
    )
    .join('\n');
}

export async function updateRowByHeaders(spreadsheetId, sheetName, rowNumber, updates, headers, colIndices) {
  const sheets = await getSheets();

  const colIndex = {};
  headers.forEach((h, i) => {
    colIndex[h] = Array.isArray(colIndices) ? colIndices[i] : i;
  });

  const data = [];
  for (const [header, value] of Object.entries(updates)) {
    const idx = colIndex[header];
    if (idx === undefined) continue;
    const colLetter = columnToLetter(idx + 1);
    data.push({
      colLetter,
      rowNumber,
      values: [[value]],
    });
  }

  if (data.length === 0) return;

  const safeSheet = String(sheetName || '').replace(/'/g, "''");
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: data.map((d) => ({
        range: `'${safeSheet}'!${d.colLetter}${d.rowNumber}`,
        values: d.values,
      })),
    },
  });
}

function columnToLetter(col) {
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

export const PENDING_STATUTS = new Set(['En attente']);

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function rowFromHeaders(headers, fields) {
  const map = {};
  for (const [k, v] of Object.entries(fields || {})) {
    map[normKey(k)] = v == null ? '' : String(v);
  }
  return (headers || []).map((h) => {
    const v = map[normKey(h)];
    return v !== undefined ? v : '';
  });
}

/** Valeur dans un objet JSON (body formulaire). */
export function pickValue(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

/** Valeur dans une ligne Sheet, clés normalisées (NOM = Nom = nom). */
export function pickRow(row, ...keys) {
  const map = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (k === '_row') continue;
    map[normKey(k)] = v;
  }
  for (const k of keys) {
    const v = map[normKey(k)];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function isValidFrPhone(telephone) {
  const digits = String(telephone || '').replace(/\D/g, '');
  return digits.length >= 10;
}

/** Même clé que adherentEssaiKey côté front : 9 chiffres + prénom plié. */
export function adherentAJourKey(tel, prenom) {
  const telKey = telPersonKey(tel);
  if (!telKey) return '';
  return `${telKey}|${foldStatut(prenom)}`;
}

/** Clé personne : 9 chiffres nationaux (06… / 336… / +33). */
export function telPersonKey(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  while (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('33') && d.length >= 11) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length > 9) d = d.slice(-9);
  return d.length === 9 ? d : '';
}

export function foldStatut(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lignes qui comptent pour N_ESSAI / pastille N/3 : À venir | Confirmé | Venu | Relancé. */
export function isEssaiCountableStatut(statut) {
  const s = foldStatut(statut);
  if (!s) return true;
  if (s === 'annule' || s === 'absent' || s === 'adherent') return false;
  return (
    s === 'a venir' ||
    s === 'venu' ||
    s === 'a faire' ||
    s === 'relance' ||
    s.includes('relanc') ||
    s.includes('confirme')
  );
}

/** Badge / Accueil = encore à suivre : À venir | Relancé (+ anciens À faire). Pas Venu/Absent/Annulé/Adhérent. */
export function isEssaiAVenir(statut) {
  const s = foldStatut(statut);
  if (!s) return true;
  if (
    s === 'venu' ||
    s === 'absent' ||
    s === 'annule' ||
    s === 'adherent' ||
    s.includes('adhere') ||
    s.includes('pas interesse') ||
    s.includes('sans suite') ||
    s.includes('dispatch') ||
    s.includes('archiv')
  ) {
    return false;
  }
  return (
    s === 'a venir' ||
    s === 'a faire' ||
    s === 'relance' ||
    s.includes('relanc') ||
    s.includes('contact') ||
    s.includes('confirme')
  );
}

export function nowParisIso() {
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date())
    .replace(' ', 'T');
  return local;
}

export function parisYmdFromValue(raw) {
  const s = String(raw || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (fr) {
    const y = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
    return `${y}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
  }
  return '';
}

export function creneauLabel(cours, dateEssai, explicit) {
  const given = String(explicit || '').trim();
  if (given) return given;
  const slot = String(dateEssai || '').trim();
  const c = String(cours || '').trim();
  if (!slot && !c) return '';
  if (!slot) return c;
  const m = slot.match(/^(\S+)\s+(.+)$/);
  if (!m) return c ? `${slot} · ${c}` : slot;
  const day = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return c ? `${day} ${m[2]} · ${c}` : `${day} ${m[2]}`;
}

export function headerName(headers, wanted) {
  const n = normKey(wanted);
  return (headers || []).find((h) => normKey(h) === n) || wanted;
}

/** Chiffres FR comparables (06…, pas +33). */
export function digitsPhone(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('33') && d.length >= 11) d = `0${d.slice(2)}`;
  return d;
}

/** Fiche essai encore dans la file (pas adhérent / archivé / sans suite). */
export function isOpenEssaiLead(row) {
  const adhesion = pickRow(row, 'Adhésion', 'Adhesion');
  if (/^oui$/i.test(adhesion.trim())) return false;
  const s = String(pickRow(row, 'Statut', 'Relance'))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!s) return true;
  if (s.includes('dispatch') || s.includes('archiv')) return false;
  if (s.includes('adhere') || s.includes('pas interesse') || s.includes('sans suite')) {
    return false;
  }
  return true;
}

/** Date de naissance jj/mm/aaaa, calendrier réel, 16–120 ans. */
export function parseFrBirthDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { ok: false, error: 'Date de naissance requise (jj/mm/aaaa).' };
  }
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) {
    return { ok: false, error: 'Date de naissance : format jj/mm/aaaa (ex. 14/03/1958).' };
  }
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return { ok: false, error: 'Cette date de naissance n’existe pas. Utilisez jj/mm/aaaa.' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dt > today) {
    return { ok: false, error: 'La date de naissance ne peut pas être dans le futur.' };
  }
  let age = today.getFullYear() - year;
  const hadBirthday =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < 16) {
    return { ok: false, error: 'L’association accueille à partir de 16 ans.' };
  }
  if (age > 120) {
    return { ok: false, error: 'Vérifiez l’année de naissance (jj/mm/aaaa).' };
  }
  return { ok: true, value: raw, age };
}

export function isPendingAdhesion(row) {
  const s = pickRow(row, 'STATUT', 'Statut');
  return PENDING_STATUTS.has(s);
}

export function isTestPrenom(prenom, nom = '') {
  const fold = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const p = fold(prenom);
  const n = fold(nom);
  return p === 'test' || n === 'test';
}