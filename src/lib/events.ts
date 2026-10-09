/**
 * Dates des événements (colonnes date / month / year / time du planning d'événements).
 * Utilisé par le site (masquage des événements passés) et le SEO (JSON-LD Event).
 */
import type { Event } from '../data/siteData';

const EVENT_MONTHS: Record<string, number> = {
  JAN: 1, FEV: 2, MARS: 3, MAR: 3, AVR: 4, MAI: 5, JUIN: 6,
  JUIL: 7, AOUT: 8, SEPT: 9, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

type EventDateFields = Pick<Event, 'date' | 'month' | 'year'>;

/** Clé de dédoublonnage : « Repas de fin d’année » = « repas de fin d'annee ». */
export function eventKey(title: string) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jours de l'événement : « 4-5 DÉC 2026 » → { year: 2026, month: 12, first: 4, last: 5 }. */
export function eventDays(e: EventDateFields) {
  const month =
    EVENT_MONTHS[
      String(e.month || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\.$/, '')
    ];
  const days = String(e.date || '').match(/\d+/g);
  const year = Number(e.year);
  if (!month || !days || !year) return null;
  return { year, month, first: Number(days[0]), last: Number(days[days.length - 1]) };
}

/**
 * Événement terminé : masqué à partir du lendemain de son dernier jour
 * (« 4-5 DÉC » → masqué le 6). Date illisible → on garde l'événement.
 */
export function isPastEvent(e: EventDateFields, now: Date = new Date()): boolean {
  const d = eventDays(e);
  if (!d) return false;
  const end = new Date(d.year, d.month - 1, d.last + 1);
  return now.getTime() >= end.getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Décalage horaire de Paris à cette date : « +01:00 » / « +02:00 ». */
function parisOffset(year: number, month: number, day: number) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(new Date(Date.UTC(year, month - 1, day, 12)))
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = String(name || '').match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? `${m[1]}${pad(Number(m[2]))}:${m[3] || '00'}` : '+01:00';
}

/** « 10h00 – 12h30 » → ['10:00', '12:30'] ; vide si pas d'heure lisible. */
function eventHours(time: string) {
  return String(time || '')
    .split(/\s*[–—-]\s*/)
    .map((part) => part.match(/(\d{1,2})\s*h\s*(\d{2})?/i))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => `${pad(Number(m[1]))}:${m[2] || '00'}`);
}

/** Dates ISO 8601 pour schema.org : avec heure + fuseau si l'heure est connue, sinon jour seul. */
export function eventIsoDates(e: EventDateFields & Pick<Event, 'time'>) {
  const d = eventDays(e);
  if (!d) return null;
  const day = (n: number) => `${d.year}-${pad(d.month)}-${pad(n)}`;
  const [h1, h2] = eventHours(e.time);
  if (!h1) return { startDate: day(d.first), endDate: day(d.last) };
  const startOff = parisOffset(d.year, d.month, d.first);
  const endOff = parisOffset(d.year, d.month, d.last);
  return {
    startDate: `${day(d.first)}T${h1}:00${startOff}`,
    endDate: h2 ? `${day(d.last)}T${h2}:00${endOff}` : undefined,
  };
}
