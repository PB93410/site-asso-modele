/**
 * Publie les événements et le planning du site (public/data/*.csv) dans Google Agenda
 * (compte de l’association : GOOGLE_CALENDAR_ID, sinon asso.config.js → email).
 *
 * L’agenda doit être partagé avec le compte de service en « Modifier les événements ».
 * Calendar API activée sur le projet Google Cloud.
 *
 * Usage : node scripts/sync-gmail-calendar.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { ASSO, SITE_URL } from '../asso.derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TZ = 'Europe/Paris';
/** Fin de saison : 30 juin de la 2e année de la saison. */
const SEASON_UNTIL = `${ASSO.saison.label.split('-')[1] || new Date().getFullYear() + 1}0630`;
const PREFIX = ASSO.sigle.toLowerCase();
const CAL_ID = process.env.GOOGLE_CALENDAR_ID || ASSO.email;

const DOW = {
  Lundi: 'MO',
  Mardi: 'TU',
  Mercredi: 'WE',
  Jeudi: 'TH',
  Vendredi: 'FR',
  Samedi: 'SA',
  Dimanche: 'SU',
};

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function netlifyEnv(name) {
  const r = spawnSync('npx', ['--yes', 'netlify-cli', 'env:get', name], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    timeout: 120_000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.status !== 0 && !out) return '';
  if (name.endsWith('_JSON')) {
    const i = out.indexOf('{');
    const j = out.lastIndexOf('}');
    if (i >= 0 && j > i) return out.slice(i, j + 1);
  }
  const lines = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('npm ') && !l.toLowerCase().includes('warn'));
  return lines[lines.length - 1] || '';
}

function loadEnv() {
  parseDotEnv(path.join(ROOT, '.env'));
  parseDotEnv(path.join(ROOT, '.env.local'));
  for (const key of ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_CALENDAR_ID']) {
    if (process.env[key] && !/no value set/i.test(process.env[key])) continue;
    const val = netlifyEnv(key);
    if (!val || /no value set|no project|not linked/i.test(val)) continue;
    process.env[key] = val;
  }
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function ymd(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function firstWeekdayOnOrAfter(year, month, day, weekdayJs) {
  const dt = new Date(Date.UTC(year, month - 1, day));
  while (dt.getUTCDay() !== weekdayJs) {
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return dt;
}

const JS_DOW = {
  Dimanche: 0,
  Lundi: 1,
  Mardi: 2,
  Mercredi: 3,
  Jeudi: 4,
  Vendredi: 5,
  Samedi: 6,
};

/** Lecture CSV minimale (guillemets doubles, virgules). */
function parseCsv(text) {
  const rows = [];
  for (const line of String(text || '').replace(/\r/g, '').split('\n')) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        cols.push(cur);
        cur = '';
      } else cur += ch;
    }
    cols.push(cur);
    rows.push(cols.map((c) => c.trim()));
  }
  return rows.slice(1);
}

function readCsv(name) {
  const file = path.join(ROOT, 'public', 'data', `${name}.csv`);
  return fs.existsSync(file) ? parseCsv(fs.readFileSync(file, 'utf8')) : [];
}

/** « 13h30 – 14h30 » → ['13:30:00', '14:30:00'] */
function hours(range) {
  const parts = String(range || '').split(/\s*[–—-]\s*/);
  const one = (h) => {
    const m = String(h || '').match(/(\d{1,2})\s*h\s*(\d{2})?/i);
    return m ? `${pad(Number(m[1]))}:${m[2] || '00'}:00` : '';
  };
  return [one(parts[0]), one(parts[1] || parts[0])];
}

const MONTHS = { JAN: 1, FEV: 2, MARS: 3, MAR: 3, AVR: 4, MAI: 5, JUIN: 6, JUIL: 7, AOUT: 8, SEPT: 9, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

function eventsFromSite() {
  const out = [];
  const domain = new URL(SITE_URL).hostname;
  const lieuComplet = (nom) => (nom ? `${nom}, ${ASSO.ville}` : ASSO.ville);
  const [ry, rm, rd] = ASSO.saison.reprise.split('-').map(Number);

  out.push({
    iCalUID: `${PREFIX}-reprise-${ASSO.saison.reprise}@${domain}`,
    summary: 'Reprise des cours',
    description: `Saison ${ASSO.saison.label}. Planning habituel.`,
    location: ASSO.ville,
    start: { date: ASSO.saison.reprise },
    end: { date: ymd(new Date(Date.UTC(ry, rm - 1, rd + 1))) },
  });

  for (const [date, month, year, title, description, time, location] of readCsv('evenements')) {
    const m = MONTHS[String(month || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    const day = parseInt(String(date || '').split('-')[0], 10);
    if (!m || !day || !year || !title) continue;
    const start = new Date(Date.UTC(Number(year), m - 1, day));
    const [h1, h2] = hours(time);
    const ev = {
      iCalUID: `${PREFIX}-evt-${ymd(start)}-${slug(title)}@${domain}`,
      summary: title,
      description,
      location: lieuComplet(location),
    };
    if (h1) {
      ev.start = { dateTime: `${ymd(start)}T${h1}`, timeZone: TZ };
      ev.end = { dateTime: `${ymd(start)}T${h2 === h1 ? h1.replace(/^(\d{2})/, (x) => pad(Number(x) + 1)) : h2}`, timeZone: TZ };
    } else {
      ev.start = { date: ymd(start) };
      ev.end = { date: ymd(new Date(start.getTime() + 864e5)) };
    }
    out.push(ev);
  }

  for (const [day, time, course, location] of readCsv('planning')) {
    if (!DOW[day] || !course) continue;
    const [start, end] = hours(time);
    if (!start) continue;
    const first = firstWeekdayOnOrAfter(ry, rm, rd, JS_DOW[day]);
    const d = ymd(first);
    out.push({
      iCalUID: `${PREFIX}-cours-${slug(day)}-${slug(course)}@${domain}`,
      summary: `Cours · ${course}`,
      description: `Planning ${ASSO.nom} — ${day} ${start.slice(0, 5).replace(':', 'h')}–${end.slice(0, 5).replace(':', 'h')}`,
      location: lieuComplet(location),
      start: { dateTime: `${d}T${start}`, timeZone: TZ },
      end: { dateTime: `${d}T${end}`, timeZone: TZ },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${DOW[day]};UNTIL=${SEASON_UNTIL}T220000Z`],
    });
  }

  return out;
}

function icsEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toIcs(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${ASSO.nom}//Agenda ${ASSO.saison.label}//FR`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${ASSO.nom}`,
    'X-WR-TIMEZONE:Europe/Paris',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.iCalUID}`);
    lines.push(`SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.start.date) {
      lines.push(`DTSTART;VALUE=DATE:${e.start.date.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${e.end.date.replace(/-/g, '')}`);
    } else {
      const s = e.start.dateTime.replace(/[-:]/g, '').replace('T', 'T');
      const t = e.end.dateTime.replace(/[-:]/g, '').replace('T', 'T');
      lines.push(`DTSTART;TZID=${TZ}:${s}`);
      lines.push(`DTEND;TZID=${TZ}:${t}`);
    }
    if (e.recurrence?.[0]) lines.push(e.recurrence[0]);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

async function upsert(calendar, event) {
  const found = await calendar.events.list({
    calendarId: CAL_ID,
    iCalUID: event.iCalUID,
    maxResults: 1,
    showDeleted: true,
  });
  const existing = found.data.items?.[0];
  const body = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    recurrence: event.recurrence,
  };
  if (existing?.id) {
    await calendar.events.patch({
      calendarId: CAL_ID,
      eventId: existing.id,
      requestBody: body,
    });
    return 'updated';
  }
  await calendar.events.insert({
    calendarId: CAL_ID,
    requestBody: { ...body, iCalUID: event.iCalUID },
  });
  return 'created';
}

async function main() {
  loadEnv();
  const events = eventsFromSite();
  const ics = toIcs(events);
  const icsPaths = [path.join(ROOT, 'public', 'agenda.ics')];
  for (const icsPath of icsPaths) {
    fs.writeFileSync(icsPath, ics, 'utf8');
    console.log(`ICS → ${icsPath} (${events.length} événements)`);
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.log('Pas de compte de service : importez le fichier ICS dans Google Agenda.');
    return;
  }
  const credentials = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  const calendar = google.calendar({ version: 'v3', auth });
  const email = credentials.client_email;
  try {
    for (const ev of events) {
      const action = await upsert(calendar, ev);
      console.log(`${action} · ${ev.summary}`);
    }
    console.log(`OK agenda ${CAL_ID}`);
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('Agenda API :', msg);
    if (email) {
      console.error(
        `Partagez l’agenda de ${CAL_ID} avec ${email} (autorisation « Modifier les événements »), et activez l’API Calendar sur le projet Google Cloud.`,
      );
    }
    console.error('En attendant, importez public/agenda.ics dans Google Agenda.');
    process.exitCode = 1;
  }
}

main();
