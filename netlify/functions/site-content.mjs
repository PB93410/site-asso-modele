/**
 * GET/PUT /api/site-content — planning & événements du site (espace bureau)
 */
import {
  clientIp,
  consumeRateLimit,
  getEventsTab,
  getPlanningTab,
  getSiteSheetId,
  handleOptions,
  json,
  readSheetValues,
  replaceSheetValues,
  requireAuth,
} from './_bureau-lib.mjs';
import { ASSO } from '../../asso.derive.js';

const DAYS = new Set(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']);
/**
 * Cours acceptés depuis l'éditeur /bureau : SITE_COURSES (Netlify, séparés par « ; »),
 * sinon tout nom non vide. Lieux : asso.config.js → lieux.
 */
const COURSES = new Set(
  String(process.env.SITE_COURSES || '')
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean),
);
const LOCATIONS = new Set(ASSO.lieux.map((l) => l.nom));
const MONTHS = new Set([
  'JAN',
  'FÉV',
  'MARS',
  'AVR',
  'MAI',
  'JUIN',
  'JUIL',
  'AOÛT',
  'SEPT',
  'OCT',
  'NOV',
  'DÉC',
]);
const TYPES = new Set(['administratif', 'festif', 'sportif', 'caritatif', 'sortie']);

function parsePlanning(values) {
  const rows = [];
  for (let i = 1; i < (values || []).length; i++) {
    const r = values[i] || [];
    const day = String(r[0] || '').trim();
    const time = String(r[1] || '').trim();
    const course = String(r[2] || '').trim();
    const location = String(r[3] || '').trim();
    const note = String(r[4] || '').trim();
    if (!day && !course) continue;
    rows.push({ day, time, course, location, note });
  }
  return rows;
}

function parseEvents(values) {
  const rows = [];
  for (let i = 1; i < (values || []).length; i++) {
    const r = values[i] || [];
    const title = String(r[3] || '').trim();
    if (!title && !r[0]) continue;
    rows.push({
      date: String(r[0] || '').trim(),
      month: String(r[1] || '').trim(),
      year: String(r[2] || '').trim(),
      title,
      description: String(r[4] || '').trim(),
      time: String(r[5] || '').trim(),
      location: String(r[6] || '').trim(),
      highlight: String(r[7] || '').toLowerCase() === 'true',
      image: String(r[8] || '').trim(),
      type: String(r[9] || 'administratif').trim(),
    });
  }
  return rows;
}

function validatePlanning(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 'Indiquez au moins un créneau.';
  }
  if (rows.length > 20) return 'Trop de créneaux (20 max).';
  for (const r of rows) {
    if (!DAYS.has(String(r.day || '').trim())) return 'Jour non reconnu. Choisissez dans la liste.';
    if (!String(r.time || '').trim()) return 'Indiquez l’horaire (ex. 13h30 – 14h30).';
    const course = String(r.course || '').trim();
    if (COURSES.size ? !COURSES.has(course) : !course || course.length > 60) {
      return 'Cours non reconnu. Choisissez dans la liste.';
    }
    if (!LOCATIONS.has(String(r.location || '').trim())) return 'Lieu non reconnu. Choisissez dans la liste.';
  }
  return null;
}

function validateEvents(rows) {
  if (!Array.isArray(rows)) return 'Liste d’événements invalide.';
  if (rows.length > 24) return 'Trop d’événements (24 max).';
  for (const r of rows) {
    if (!String(r.title || '').trim()) return 'Chaque date a besoin d’un titre.';
    if (!String(r.date || '').trim()) return 'Indiquez le jour (ex. 6 ou 4-5).';
    if (!MONTHS.has(String(r.month || '').trim())) return 'Mois non reconnu.';
    const y = String(r.year || '').trim();
    if (!/^\d{4}$/.test(y)) return 'Année : 4 chiffres.';
    const t = String(r.type || 'administratif').trim();
    if (t && !TYPES.has(t)) return 'Type d’événement non reconnu.';
  }
  return null;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  try {
    const sheetId = getSiteSheetId();
    const planTab = getPlanningTab();
    const evTab = getEventsTab();

    if (event.httpMethod === 'GET') {
      const [planVals, evVals] = await Promise.all([
        readSheetValues(sheetId, planTab),
        readSheetValues(sheetId, evTab),
      ]);
      return json(200, {
        planning: parsePlanning(planVals),
        evenements: parseEvents(evVals),
      });
    }

    if (event.httpMethod !== 'PUT') {
      return json(405, { error: 'Méthode non autorisée' });
    }

    if (!consumeRateLimit(`site-content:${clientIp(event)}`, 20, 15 * 60 * 1000).ok) {
      return json(429, { error: 'Trop d’enregistrements. Réessayez dans quelques minutes.' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Ça n’a pas marché. Réessayez.' });
    }

    const tasks = [];
    if (body.planning) {
      const err = validatePlanning(body.planning);
      if (err) return json(400, { error: err });
      const values = [
        ['day', 'time', 'course', 'location', 'note'],
        ...body.planning.map((r) => [
          String(r.day || '').trim(),
          String(r.time || '').trim(),
          String(r.course || '').trim(),
          String(r.location || '').trim(),
          String(r.note || '').trim(),
        ]),
      ];
      tasks.push(replaceSheetValues(sheetId, planTab, values));
    }
    if (body.evenements) {
      const err = validateEvents(body.evenements);
      if (err) return json(400, { error: err });
      const values = [
        ['date', 'month', 'year', 'title', 'description', 'time', 'location', 'highlight', 'image', 'type'],
        ...body.evenements.map((r) => [
          String(r.date || '').trim(),
          String(r.month || '').trim(),
          String(r.year || '').trim(),
          String(r.title || '').trim(),
          String(r.description || '').trim(),
          String(r.time || '').trim(),
          String(r.location || '').trim(),
          r.highlight ? 'true' : '',
          String(r.image || '').trim(),
          String(r.type || 'administratif').trim(),
        ]),
      ];
      tasks.push(replaceSheetValues(sheetId, evTab, values));
    }
    if (tasks.length === 0) {
      return json(400, { error: 'Rien à enregistrer.' });
    }
    await Promise.all(tasks);
    return json(200, { ok: true, message: 'Enregistré. Le site se met à jour tout seul.' });
  } catch (err) {
    console.error('site-content', err?.message || err);
    return json(500, {
      error: 'Impossible d’enregistrer. Réessayez, ou contactez le référent.',
    });
  }
}
