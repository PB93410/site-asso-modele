/**
 * Aligné sur netlify/functions/_essai-dates.mjs
 * Reprise 7 sept. 2026 · Pilates 19 sept. 2026 · Europe/Paris.
 */

const TZ = 'Europe/Paris';
const REPRISE_YMD = '2026-09-07';
const PILATES_YMD = '2026-09-19';

const DOW: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

const COURSE_DOW: Record<string, number> = {
  'Gym Douce': 1,
  'Renforcement Musculaire': 1,
  'Cardio & Gym': 3,
  Stretching: 4,
  Zumba: 4,
  Pilates: 6,
};

const COURSE_TIME: Record<string, string> = {
  'Gym Douce': '13h30',
  'Renforcement Musculaire': '20h00',
  'Cardio & Gym': '20h45',
  Stretching: '15h30',
  Zumba: '19h30',
  Pilates: '10h00',
};

function parisTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function weekdayOfYmd(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDaysYmd(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function ymdToFr(ymd: string) {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function formatFrLong(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

function fold(s: string) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseSlotHint(hint: string) {
  const n = fold(hint);
  for (const [name, dow] of Object.entries(DOW)) {
    if (n.includes(name)) {
      const time = (String(hint).match(/(\d{1,2}h\d{0,2})/i) || [])[1] || '';
      return { day: name, dow, time };
    }
  }
  return null;
}

function minYmd(course: string) {
  return /pilates/i.test(course || '') ? PILATES_YMD : REPRISE_YMD;
}

function parisMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return pick('hour') * 60 + pick('minute');
}

function slotMinutes(time: string) {
  const m = String(time || '').match(/(\d{1,2})h(\d{0,2})/i);
  if (!m) return null;
  return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
}

function nextYmd(targetDow: number, min: string, time: string) {
  const today = parisTodayYmd();
  let ymd = today;
  if (ymd < min) ymd = min;
  for (let i = 0; i < 28; i += 1) {
    if (weekdayOfYmd(ymd) === targetDow) {
      const start = slotMinutes(time);
      if (ymd === today && start !== null && parisMinutesNow() > start) {
        ymd = addDaysYmd(ymd, 7);
        continue;
      }
      return ymd;
    }
    ymd = addDaysYmd(ymd, 1);
  }
  return ymd;
}

function capDay(day: string) {
  if (!day) return '';
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function buildDateEssaiCell(course: string, slotHint: string) {
  const parsed = parseSlotHint(slotHint);
  const dow = parsed?.dow ?? COURSE_DOW[course];
  if (dow === undefined) return (slotHint || '').trim();
  const time = parsed?.time || COURSE_TIME[course] || '';
  const dayName = parsed?.day || Object.keys(DOW).find((k) => DOW[k] === dow) || '';
  const ymd = nextYmd(dow, minYmd(course), time);
  const left = ymdToFr(ymd);
  const right = [capDay(dayName), time].filter(Boolean).join(' ');
  return right ? `${left} · ${right}` : left;
}

export function formatEssaiDateLabel(raw: string) {
  const s = String(raw || '').trim();
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return s;
  const ymd = `${m[3]}-${m[2]}-${m[1]}`;
  const long = formatFrLong(ymd);
  const rest = s.replace(m[0], '').replace(/^[·\s\-–—]+/, '').trim();
  const time = (rest.match(/(\d{1,2}h\d{0,2})/i) || [])[1] || '';
  return time ? `${long} à ${time}` : long;
}

/** AAAA-MM-JJ si CRENEAU commence par jj/mm/aaaa, sinon chaîne vide. */
export function essaiYmdFromCreneau(raw: string): string {
  const m = String(raw || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function slotHintFromCell(raw: string) {
  return String(raw || '')
    .replace(/\d{2}\/\d{2}\/\d{4}\s*[·\-–—]?\s*/g, '')
    .trim();
}
