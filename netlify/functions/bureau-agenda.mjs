/**
 * Agenda bureau — rangé sur Netlify ou dans Google Agenda (_agenda.mjs), un seul agenda asso
 * GET renvoie aussi le lien d'abonnement .ics (agenda-ics.mjs).
 * GET    /api/bureau/agenda?from=&to=
 * POST   /api/bureau/agenda
 * PATCH  /api/bureau/agenda/:id
 * DELETE /api/bureau/agenda/:id
 */

import { agendaApi, lienAbonnement, messageAgenda } from './_agenda.mjs';
import { handleOptions, json, requireAuth } from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';

const getCalendarId = () => (process.env.GOOGLE_CALENDAR_ID || 'primary').trim() || 'primary';

const TZ = 'Europe/Paris';

function parseAgendaPath(event) {
  const candidates = [
    event.path,
    event.rawPath,
    event.rawUrl,
    event.headers?.['x-forwarded-uri'],
    event.headers?.['x-original-path'],
  ]
    .filter(Boolean)
    .map(String);
  let rest = '';
  for (const raw of candidates) {
    for (const m of ['/api/bureau/agenda', '/.netlify/functions/bureau-agenda']) {
      const i = raw.indexOf(m);
      if (i >= 0) {
        rest = raw.slice(i + m.length).split('?')[0];
        break;
      }
    }
    if (rest) break;
  }
  const parts = rest.split('/').filter(Boolean);
  const q = event.queryStringParameters || {};
  return { id: parts[0] || q.id || '', q };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

function isYmd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

function isHm(s) {
  return /^\d{2}:\d{2}$/.test(String(s || ''));
}

function toRfc3339Local(date, time) {
  return `${date}T${time}:00`;
}

function mapEvent(ev) {
  const start = ev.start?.dateTime || '';
  const end = ev.end?.dateTime || '';
  // dateTime often "2026-09-08T10:00:00+02:00"
  const startDate = start.slice(0, 10);
  const startTime = start.length >= 16 ? start.slice(11, 16) : '';
  const endTime = end.length >= 16 ? end.slice(11, 16) : '';
  return {
    id: ev.id,
    title: ev.summary || '(sans titre)',
    date: startDate,
    startTime,
    endTime,
    start,
    end,
    location: ev.location || '',
    notes: ev.description || '',
  };
}

function validateEventBody(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') {
    return { error: 'JSON invalide' };
  }
  const title = body.title != null ? String(body.title).trim() : undefined;
  const date = body.date != null ? String(body.date).trim() : undefined;
  const startTime = body.startTime != null ? String(body.startTime).trim() : undefined;
  const endTime = body.endTime != null ? String(body.endTime).trim() : undefined;
  const location =
    body.location != null ? String(body.location).trim().slice(0, 200) : undefined;
  const notes = body.notes != null ? String(body.notes).trim().slice(0, 4000) : undefined;

  if (!partial) {
    if (!title) return { error: 'Le titre est obligatoire.' };
    if (!date || !isYmd(date)) return { error: 'Indiquez une date (AAAA-MM-JJ).' };
    if (!startTime || !isHm(startTime)) return { error: 'Indiquez l’heure de début (HH:MM).' };
    if (!endTime || !isHm(endTime)) return { error: 'Indiquez l’heure de fin (HH:MM).' };
    if (endTime <= startTime) {
      return { error: 'L’heure de fin doit être après l’heure de début.' };
    }
  } else {
    if (title !== undefined && !title) return { error: 'Le titre est obligatoire.' };
    if (date !== undefined && !isYmd(date)) return { error: 'Date invalide.' };
    if (startTime !== undefined && !isHm(startTime)) return { error: 'Heure de début invalide.' };
    if (endTime !== undefined && !isHm(endTime)) return { error: 'Heure de fin invalide.' };
  }

  return { title, date, startTime, endTime, location, notes };
}

async function calendarClient() {
  return agendaApi();
}

async function handleList(q) {
  const from = q.from;
  const to = q.to;
  if (!from || !to || !isYmd(from) || !isYmd(to)) {
    return json(400, { error: 'Paramètres from et to requis (AAAA-MM-JJ).' });
  }
  const cal = await calendarClient();
  const res = await cal.events.list({
    calendarId: getCalendarId(),
    timeMin: `${from}T00:00:00Z`,
    timeMax: `${to}T23:59:59Z`,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
    timeZone: TZ,
  });
  const events = (res.data.items || [])
    .filter((ev) => ev.start?.dateTime && ev.end?.dateTime)
    .map(mapEvent);
  return json(200, { events, abonnement: lienAbonnement() });
}

async function handleCreate(body) {
  const v = validateEventBody(body, { partial: false });
  if (v.error) return json(400, { error: v.error });
  const cal = await calendarClient();
  const created = await cal.events.insert({
    calendarId: getCalendarId(),
    requestBody: {
      summary: v.title,
      location: v.location || undefined,
      description: v.notes || undefined,
      start: { dateTime: toRfc3339Local(v.date, v.startTime), timeZone: TZ },
      end: { dateTime: toRfc3339Local(v.date, v.endTime), timeZone: TZ },
    },
  });
  return json(201, { event: mapEvent(created.data) });
}

async function handlePatch(id, body) {
  if (!id) return json(400, { error: 'Identifiant manquant.' });
  const v = validateEventBody(body, { partial: true });
  if (v.error) return json(400, { error: v.error });

  const cal = await calendarClient();
  const existing = await cal.events.get({ calendarId: getCalendarId(), eventId: id });
  const mapped = mapEvent(existing.data);
  const title = v.title !== undefined ? v.title : mapped.title;
  const date = v.date !== undefined ? v.date : mapped.date;
  const startTime = v.startTime !== undefined ? v.startTime : mapped.startTime;
  const endTime = v.endTime !== undefined ? v.endTime : mapped.endTime;
  if (!title || !date || !startTime || !endTime) {
    return json(400, { error: 'Titre, date et heures sont obligatoires.' });
  }
  if (endTime <= startTime) {
    return json(400, { error: 'L’heure de fin doit être après l’heure de début.' });
  }
  const location = v.location !== undefined ? v.location : mapped.location;
  const notes = v.notes !== undefined ? v.notes : mapped.notes;

  const updated = await cal.events.patch({
    calendarId: getCalendarId(),
    eventId: id,
    requestBody: {
      summary: title,
      location: location || '',
      description: notes || '',
      start: { dateTime: toRfc3339Local(date, startTime), timeZone: TZ },
      end: { dateTime: toRfc3339Local(date, endTime), timeZone: TZ },
    },
  });
  return json(200, { event: mapEvent(updated.data) });
}

async function handleDelete(id) {
  if (!id) return json(400, { error: 'Identifiant manquant.' });
  const cal = await calendarClient();
  await cal.events.delete({ calendarId: getCalendarId(), eventId: id });
  return json(200, { ok: true });
}

export async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  const { id, q } = parseAgendaPath(event);

  try {
    if (event.httpMethod === 'GET') return await handleList(q);
    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      if (!body) return json(400, { error: 'JSON invalide' });
      return await handleCreate(body);
    }
    if (event.httpMethod === 'PATCH') {
      const body = parseBody(event);
      if (!body) return json(400, { error: 'JSON invalide' });
      return await handlePatch(id, body);
    }
    if (event.httpMethod === 'DELETE') return await handleDelete(id);
    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('bureau-agenda', err?.message || err);
    return json(err?.code === 404 ? 404 : 502, { error: await messageAgenda(err) });
  }
}
