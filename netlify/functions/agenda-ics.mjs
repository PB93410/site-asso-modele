/**
 * GET /api/agenda.ics?cle=… — l'agenda du bureau en abonnement (Apple, Google, Outlook, Thunderbird…).
 * Lien secret : cle = AGENDA_ICS_CLE, ou dérivée de BUREAU_SECRET (changer le secret change le lien).
 * Mauvaise clé : 404, sans rien dire de plus. Lecture seule ; on modifie l'agenda dans /bureau.
 */

import { timingSafeEqual } from 'node:crypto';
import { agendaApi, calendrierIcs, cleAbonnement } from './_agenda.mjs';
import { moduleOff } from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

function memeCle(recue, attendue) {
  const a = Buffer.from(String(recue || ''));
  const b = Buffer.from(String(attendue || ''));
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

const texte = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  body,
});

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') return texte(405, 'Méthode non autorisée');
  const off = moduleOff('bureau');
  if (off) return off;
  if (!memeCle(event.queryStringParameters?.cle, cleAbonnement())) return texte(404, 'Introuvable');

  try {
    const now = Date.now();
    const cal = await agendaApi();
    const res = await cal.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeMin: `${ymd(now - 90 * 86_400_000)}T00:00:00Z`,
      timeMax: `${ymd(now + 400 * 86_400_000)}T23:59:59Z`,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
      timeZone: 'Europe/Paris',
    });
    const items = (res.data.items || []).filter((e) => e.start?.dateTime && e.end?.dateTime);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="agenda-bureau.ics"',
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
      body: event.httpMethod === 'HEAD' ? '' : calendrierIcs(items),
    };
  } catch (err) {
    console.error('agenda-ics', err?.message || err);
    return texte(503, 'Agenda indisponible, réessayez plus tard.');
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
