/**
 * Mode démo (DEMO=1) : tout le site et le bureau fonctionnent sans compte Google.
 * Les fonctions Netlify gardent leur vrai code ; seuls les clients Google sont remplacés
 * par des faux qui travaillent sur un classeur, une boîte mail et un agenda fictifs,
 * en mémoire. Rien n’est envoyé, rien n’est enregistré durablement.
 *
 * Mot de passe du bureau en démo : « demo » (porte admin) ou « seance ».
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ASSO, SEASON_PREFIX } from '../../asso.derive.js';
import { parseA1, tableurValues } from './_tableur.mjs';

export const DEMO = /^(1|true|oui)$/i.test(String(process.env.DEMO || '').trim());

export const DEMO_IDS = {
  adherents: 'demo-adherents',
  essais: 'demo-essais',
  site: 'demo-site',
};

/** Réglages par défaut du bureau en démo (sans écraser ceux déjà définis). */
export function applyDemoEnv(env = process.env) {
  const defaults = {
    BUREAU_PASSWORD: 'demo',
    BUREAU_PASSWORD_SEANCE: 'seance',
    BUREAU_SECRET: 'demo-secret-non-confidentiel-0123456789abcdef',
    // Jamais utilisée : getSheets() renvoie le faux classeur. Présente pour les contrôles « configuré ? ».
    GOOGLE_SERVICE_ACCOUNT_JSON: '{"type":"demo"}',
    GOOGLE_SHEET_ID: DEMO_IDS.adherents,
    GOOGLE_SHEET_ESSAIS_ID: DEMO_IDS.essais,
    GOOGLE_SITE_SHEET_ID: DEMO_IDS.site,
    GOOGLE_REFRESH_TOKEN: 'demo',
    GOOGLE_CLIENT_ID: 'demo',
    GOOGLE_CLIENT_SECRET: 'demo',
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!env[k]) env[k] = v;
  }
}

if (DEMO) applyDemoEnv();

// ---------------------------------------------------------------------------
// Dates (heure de Paris)
// ---------------------------------------------------------------------------

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function parisToday() {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date, n) {
  return new Date(date.getTime() + n * 86_400_000);
}

const fr = (date) =>
  `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
const iso = (date, time = '10:00:00') => `${date.toISOString().slice(0, 10)}T${time}`;

/** Prochain (ou dernier, si décalage négatif) jour de cours à partir d’aujourd’hui. */
function dayFor(jour, weeksOffset = 0) {
  const target = JOURS.findIndex((j) => j.toLowerCase() === String(jour).toLowerCase());
  const today = parisToday();
  let d = today;
  for (let i = 0; i < 7 && d.getUTCDay() !== target; i += 1) d = addDays(d, 1);
  return addDays(d, weeksOffset * 7);
}

// ---------------------------------------------------------------------------
// Données fictives
// ---------------------------------------------------------------------------

/** Fichier du projet (inclus dans le bundle de la fonction), ou « » s’il manque. */
export function readProjectFile(rel) {
  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT].filter(Boolean);
  for (const root of roots) {
    try {
      return readFileSync(path.join(root, rel), 'utf8');
    } catch {
      // absent à cet emplacement
    }
  }
  return '';
}

/** CSV simple (guillemets doubles) → tableau de lignes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const PERSONNES = [
  ['MARTIN', 'Camille'],
  ['BERNARD', 'Lucas'],
  ['PETIT', 'Inès'],
  ['ROBERT', 'Hugo'],
  ['RICHARD', 'Léa'],
  ['DURAND', 'Nathan'],
  ['MOREAU', 'Chloé'],
  ['SIMON', 'Paul'],
  ['LAURENT', 'Emma'],
  ['LEFEBVRE', 'Jules'],
  ['GARCIA', 'Sarah'],
  ['ROUX', 'Louis'],
];
const tel = (i) => `06000000${String(i + 10).padStart(2, '0')}`;
const mail = (prenom, nom) =>
  `${prenom}.${nom}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') + '@example.fr';

function planningRows() {
  const rows = parseCsv(readProjectFile('public/data/planning.csv'));
  if (rows.length > 1) return rows;
  return [
    ['day', 'time', 'course', 'location', 'note'],
    ['Lundi', '13h30 – 14h30', 'Gym Douce', ASSO.lieux[0]?.nom || 'Gymnase', ''],
    ['Mercredi', '19h00 – 20h00', 'Pilates', ASSO.lieux[0]?.nom || 'Gymnase', ''],
  ];
}

function essaisSeed() {
  const cours = planningRows()
    .slice(1)
    .map(([day, time, course]) => ({ day, time: String(time).split(/[–-]/)[0].trim(), course }))
    .filter((c) => c.day && c.course);
  const slot = (k, weeks) => {
    const c = cours[k % cours.length];
    const d = dayFor(c.day, weeks);
    return { creneau: `${fr(d)} · ${c.day} ${c.time} · ${c.course}`, course: c.course };
  };
  const today = parisToday();
  // [personne, cours, semaines (+ à venir / − passé), statut, jours depuis la demande, n° essai, source]
  const plan = [
    [0, 0, 0, 'À venir', 0, 1, 'Site'],
    [1, 1, 0, 'À venir', 1, 1, 'Instagram'],
    [2, 2, 1, 'À venir', 2, 1, 'Bouche-à-oreille'],
    [3, 3, 0, 'Confirmé', 3, 1, 'Site'],
    [4, 4, 0, 'Confirmé', 4, 2, 'Forum'],
    [5, 0, -1, 'Venu', 9, 1, 'Site'],
    [6, 1, -1, 'Venu', 10, 2, 'Facebook'],
    [7, 2, -1, 'Absent', 8, 1, 'Site'],
    [8, 3, -2, 'Adhérent', 16, 3, 'Site'],
  ];
  const rows = [
    ['DATE_DEMANDE', 'NOM', 'PRENOM', 'TEL', 'CRENEAU', 'COURS', 'STATUT', 'N_ESSAI', 'SOURCE', 'NOTES'],
  ];
  for (const [p, k, weeks, statut, ago, n, source] of plan) {
    const [nom, prenom] = PERSONNES[p];
    const s = slot(k, weeks);
    rows.push([iso(addDays(today, -ago)), nom, prenom, tel(p), s.creneau, s.course, statut, String(n), source, '']);
  }
  return rows;
}

function adherentsSeed() {
  const today = parisToday();
  const head = [
    'NOM', 'PRENOM', 'TEL', 'MAIL', 'DATE_NAISSANCE', 'ADRESSE', 'CP', 'VILLE', 'MODE', 'STATUT',
    'MONTANT', 'DETAIL', 'DATE_PAIEMENT', 'DROIT_IMAGE', 'QS_SPORT', 'SOURCE', 'NOTES', 'DATE_DEMANDE',
    'NUMERO', 'CARTE',
  ];
  const tarif = String(ASSO.adhesion.tarif);
  const modeEnLigne = ASSO.adhesion.paiementUrl ? `Carte (${ASSO.adhesion.paiementNom || 'en ligne'})` : 'Virement';
  const cheque = ASSO.adhesion.autresPaiements[0] ? ASSO.adhesion.autresPaiements[0][0].toUpperCase() + ASSO.adhesion.autresPaiements[0].slice(1) : 'Chèque';
  // [personne, mode, statut, jours depuis la demande, numéro, carte envoyée il y a n jours (ou null)]
  const plan = [
    [8, cheque, 'À jour', 20, 1, 12],
    [9, modeEnLigne, 'À jour', 18, 2, 10],
    [10, cheque, 'À jour', 6, 3, null],
    [11, modeEnLigne, 'À jour', 4, 4, null],
    [5, cheque, 'En attente', 2, null, null],
    [6, modeEnLigne, 'En attente', 1, null, null],
    [3, cheque, 'En attente', 0, null, null],
  ];
  const rows = [head];
  for (const [p, mode, statut, ago, num, carte] of plan) {
    const [nom, prenom] = PERSONNES[p];
    const demande = addDays(today, -ago);
    rows.push([
      nom, prenom, tel(p), mail(prenom, nom), '01/01/1970', '1 rue de l’Exemple', ASSO.codePostal, ASSO.ville,
      mode, statut, tarif, '', statut === 'À jour' ? fr(addDays(demande, 1)) : '', 'Oui', 'Oui', 'Site', '',
      iso(demande), num ? `${SEASON_PREFIX}${String(num).padStart(3, '0')}` : '', carte === null ? '' : fr(addDays(today, -carte)),
    ]);
  }
  return rows;
}

function siteSeed() {
  const ev = parseCsv(readProjectFile('public/data/evenements.csv'));
  return new Map([
    ['PLANNING', planningRows()],
    ['EVENEMENTS', ev.length ? ev : [['date', 'month', 'year', 'title', 'description', 'time', 'location', 'highlight', 'image', 'type']]],
  ]);
}

// ---------------------------------------------------------------------------
// Faux Google Sheets (spreadsheets.values.*)
// ---------------------------------------------------------------------------

let book = null;

function workbook() {
  if (!book) {
    book = new Map([
      [DEMO_IDS.adherents, new Map([[process.env.GOOGLE_SHEET_NAME || `Saison ${ASSO.saison.label}`, adherentsSeed()]])],
      [DEMO_IDS.essais, new Map([[process.env.GOOGLE_SHEET_ESSAIS_NAME || 'Essais', essaisSeed()]])],
      [DEMO_IDS.site, siteSeed()],
    ]);
  }
  return book;
}

/** Remet les données fictives à zéro (tests). */
export function resetDemo() {
  book = null;
  mails = null;
  events = null;
}

function tabOf(spreadsheetId, tab) {
  const sheet = workbook().get(spreadsheetId);
  if (!sheet) throw Object.assign(new Error('Requested entity was not found.'), { code: 404 });
  if (!sheet.has(tab)) throw Object.assign(new Error(`Unable to parse range: ${tab}`), { code: 400 });
  return sheet.get(tab);
}

export { parseA1 };

export function demoSheets() {
  return tableurValues({
    lire: async (id, tab) => tabOf(id, tab),
    modifier: async (id, tab, fn) => fn(tabOf(id, tab)),
  });
}

// ---------------------------------------------------------------------------
// Faux Gmail (boîte de réception fictive ; les envois sont gardés, jamais expédiés)
// ---------------------------------------------------------------------------

let mails = null;
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64url');

function mailSeed() {
  const now = Date.now();
  const list = [
    ['Marie Exemple <marie.exemple@example.fr>', 'Question sur les cours', 'Bonjour, je voudrais savoir si le cours du lundi convient à une débutante de 68 ans. Merci !', 2],
    [`${ASSO.adhesion.paiementNom || 'Plateforme de paiement'} <ne-pas-repondre@example.fr>`, 'Nouveau paiement reçu', `Un paiement de ${ASSO.adhesion.tarif} € a été reçu pour une adhésion (démo).`, 20],
    ['Service des sports <sports@example.fr>', 'Gymnase fermé pendant les vacances', 'Bonjour, le gymnase sera fermé la première semaine des vacances scolaires.', 46],
    ['Jean Exemple <jean.exemple@example.fr>', 'Certificat médical', 'Bonjour, faut-il un certificat médical pour s’inscrire ? Cordialement.', 70],
  ];
  return list.map(([from, subject, text, hoursAgo], i) => ({
    id: `demo-${i + 1}`,
    threadId: `demo-t${i + 1}`,
    labelIds: ['INBOX', ...(i < 2 ? ['UNREAD'] : [])],
    snippet: text.slice(0, 90),
    internalDate: String(now - hoursAgo * 3_600_000),
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: from },
        { name: 'To', value: ASSO.email },
        { name: 'Subject', value: subject },
        { name: 'Date', value: new Date(now - hoursAgo * 3_600_000).toUTCString() },
        { name: 'Message-ID', value: `<demo-${i + 1}@example.fr>` },
      ],
      body: { data: b64url(text) },
    },
  }));
}

function mailbox() {
  if (!mails) mails = mailSeed();
  return mails;
}

export function demoGmail() {
  return {
    users: {
      messages: {
        async list({ q = '', labelIds = [] } = {}) {
          const inbox = /in:inbox/.test(q) || labelIds.includes('INBOX');
          const items = mailbox().filter((m) => !inbox || m.labelIds.includes('INBOX'));
          return { data: { messages: items.map(({ id, threadId }) => ({ id, threadId })) } };
        },
        async get({ id }) {
          const m = mailbox().find((x) => x.id === id);
          if (!m) throw Object.assign(new Error('Not Found'), { code: 404 });
          return { data: m };
        },
        async send({ requestBody }) {
          const id = `demo-sent-${mailbox().length + 1}`;
          mailbox().push({ id, threadId: id, labelIds: ['SENT'], snippet: '', payload: { headers: [] }, raw: requestBody?.raw });
          return { data: { id } };
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Faux Agenda
// ---------------------------------------------------------------------------

let events = null;
let nextEventId = 1;

function eventSeed() {
  const today = parisToday();
  const at = (days, h1, h2, summary, location, description = '') => {
    const d = addDays(today, days).toISOString().slice(0, 10);
    return {
      id: `demo-ev-${nextEventId++}`,
      summary,
      location,
      description,
      start: { dateTime: `${d}T${h1}:00+01:00`, timeZone: 'Europe/Paris' },
      end: { dateTime: `${d}T${h2}:00+01:00`, timeZone: 'Europe/Paris' },
    };
  };
  const lieu = ASSO.lieux[0]?.nom || 'Gymnase';
  return [
    at(3, '18:30', '20:00', 'Réunion du bureau', 'Salle de réunion'),
    at(10, '10:00', '12:00', 'Séance portes ouvertes', lieu, 'Venez avec un ami.'),
    at(24, '19:00', '21:00', 'Assemblée générale', lieu),
  ];
}

function agenda() {
  if (!events) events = eventSeed();
  return events;
}

export function demoCalendar() {
  const find = (id) => {
    const ev = agenda().find((e) => e.id === id);
    if (!ev) throw Object.assign(new Error('Not Found'), { code: 404 });
    return ev;
  };
  return {
    events: {
      async list({ timeMin, timeMax } = {}) {
        const items = agenda()
          .filter((e) => (!timeMin || e.end.dateTime >= timeMin.slice(0, 10)) && (!timeMax || e.start.dateTime <= timeMax))
          .sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime));
        return { data: { items } };
      },
      async get({ eventId }) {
        return { data: find(eventId) };
      },
      async insert({ requestBody }) {
        const ev = { id: `demo-ev-${nextEventId++}`, ...requestBody };
        agenda().push(ev);
        return { data: ev };
      },
      async patch({ eventId, requestBody }) {
        const ev = Object.assign(find(eventId), requestBody);
        return { data: ev };
      },
      async delete({ eventId }) {
        events = agenda().filter((e) => e.id !== find(eventId).id);
        return { data: {} };
      },
    },
  };
}
