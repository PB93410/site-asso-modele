/**
 * Agenda du bureau, où qu'il soit rangé :
 *
 *   netlify : avec les données du site (Netlify Blobs). Rien à brancher.
 *   google  : Google Agenda du compte de l'asso (GOOGLE_REFRESH_TOKEN), comme avant.
 *
 * Choix : AGENDA=netlify|google, sinon google si GOOGLE_REFRESH_TOKEN est présent, sinon netlify.
 * En démo : faux agenda en mémoire. Même API que Google Agenda (events.list/get/insert/patch/delete).
 *
 * Abonnement : flux .ics à lien secret (agenda-ics.mjs), à ajouter dans l'agenda du téléphone
 * (Apple, Google, Outlook, Thunderbird…). Voir docs/DOC-AGENDA.md.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { ASSO, SITE_URL } from '../../asso.derive.js';
import { DEMO, demoCalendar } from './_demo.mjs';
import { modifierBlob, storeDonnees } from './_stockage.mjs';

export const CLE_AGENDA = 'agenda/evenements';
export const MODES_AGENDA = ['netlify', 'google'];
const TZ = 'Europe/Paris';

export function modeAgenda(env = process.env, demo = DEMO) {
  if (demo) return 'demo';
  const choix = String(env.AGENDA || '').trim().toLowerCase();
  if (MODES_AGENDA.includes(choix)) return choix;
  return String(env.GOOGLE_REFRESH_TOKEN || '').trim() ? 'google' : 'netlify';
}

const introuvable = () => Object.assign(new Error('Événement introuvable.'), { code: 404, lisible: true });
const jour = (dt) => String(dt || '').slice(0, 10);

/** Agenda sur Netlify Blobs, avec la même API que Google Agenda. */
export function blobCalendar({ store = storeDonnees } = {}) {
  const lireTout = async () => {
    const data = await store().get(CLE_AGENDA, { type: 'json' });
    return Array.isArray(data?.evenements) ? data.evenements : [];
  };
  const modifier = (fn) =>
    modifierBlob(store(), CLE_AGENDA, (data) => {
      const evenements = Array.isArray(data?.evenements) ? data.evenements : [];
      const res = fn(evenements);
      return { valeur: { evenements, maj: new Date().toISOString() }, res };
    });
  return {
    events: {
      async list({ timeMin, timeMax } = {}) {
        const items = (await lireTout())
          .filter((e) => (!timeMin || jour(e.end?.dateTime) >= jour(timeMin)) && (!timeMax || jour(e.start?.dateTime) <= jour(timeMax)))
          .sort((a, b) => String(a.start?.dateTime).localeCompare(String(b.start?.dateTime)));
        return { data: { items } };
      },
      async get({ eventId }) {
        const ev = (await lireTout()).find((e) => e.id === eventId);
        if (!ev) throw introuvable();
        return { data: ev };
      },
      async insert({ requestBody }) {
        const ev = { ...requestBody, id: `ev${Date.now().toString(36)}${randomBytes(4).toString('hex')}` };
        await modifier((liste) => liste.push(ev));
        return { data: ev };
      },
      async patch({ eventId, requestBody }) {
        const ev = await modifier((liste) => {
          const e = liste.find((x) => x.id === eventId);
          if (!e) throw introuvable();
          return Object.assign(e, requestBody, { id: eventId });
        });
        return { data: ev };
      },
      async delete({ eventId }) {
        await modifier((liste) => {
          const i = liste.findIndex((x) => x.id === eventId);
          if (i < 0) throw introuvable();
          liste.splice(i, 1);
        });
        return { data: {} };
      },
    },
  };
}

export async function agendaApi(env = process.env) {
  const mode = modeAgenda(env);
  if (mode === 'demo') return demoCalendar();
  if (mode === 'google') return (await import('./_google-user.mjs')).calendarApi();
  return blobCalendar();
}

/** Message d'erreur pour le bureau. */
export async function messageAgenda(err, env = process.env) {
  if (err?.lisible) return err.message;
  if (err?.code === 409) return 'Agenda occupé : réessayez dans un instant.';
  if (modeAgenda(env) === 'google') return (await import('./_google-user.mjs')).googleErrorMessage(err);
  return 'L’agenda n’a pas répondu. Réessayez dans quelques minutes.';
}

// ---------------------------------------------------------------------------
// Abonnement (.ics)
// ---------------------------------------------------------------------------

/** Clé du lien d'abonnement : AGENDA_ICS_CLE, sinon dérivée de BUREAU_SECRET. Vide si aucun secret. */
export function cleAbonnement(env = process.env) {
  const propre = String(env.AGENDA_ICS_CLE || '').trim();
  if (propre) return propre;
  const secret = String(env.BUREAU_SECRET || '');
  if (secret.length < 24) return '';
  return createHmac('sha256', secret).update('agenda-ics').digest('hex').slice(0, 32);
}

/** Lien à donner aux bénévoles (https) ; webcal:// ouvre directement l'agenda du téléphone. */
export function lienAbonnement(env = process.env, origin = env.SITE_ORIGIN || SITE_URL) {
  const cle = cleAbonnement(env);
  if (!cle) return '';
  return `${String(origin).replace(/\/$/, '')}/api/agenda.ics?cle=${cle}`;
}

function decalageParis(ms) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
}

/** « 2026-07-14T10:00:00 » (heure de Paris) ou avec décalage / Z → Date. */
export function versDate(dateTime) {
  const s = String(dateTime || '');
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return new Date(s);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return new Date(NaN);
  const local = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  let t = local - decalageParis(local);
  t = local - decalageParis(t);
  return new Date(t);
}

const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Texte ICS : \ ; , et retours à la ligne protégés. */
export const texteIcs = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/** Lignes de 75 octets au plus (RFC 5545), coupées entre deux caractères. */
export function plier(ligne) {
  const out = [];
  let cur = '';
  let octets = 0;
  for (const ch of ligne) {
    const n = Buffer.byteLength(ch);
    if (octets + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      octets = 0;
    }
    cur += ch;
    octets += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * @param {{ id: string, summary?: string, location?: string, description?: string,
 *   start: { dateTime: string }, end: { dateTime: string } }[]} evenements
 */
export function calendrierIcs(evenements, { nom = `Bureau ${ASSO.nomCourt || ASSO.nom}`, maintenant = new Date(), domaine } = {}) {
  const hote = domaine || new URL(SITE_URL).hostname;
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${texteIcs(ASSO.nom)}//Agenda du bureau//FR`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${texteIcs(nom)}`,
    `X-WR-TIMEZONE:${TZ}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of evenements) {
    const debut = versDate(e.start?.dateTime);
    const fin = versDate(e.end?.dateTime);
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) continue;
    lignes.push(
      'BEGIN:VEVENT',
      `UID:${texteIcs(e.id)}@${hote}`,
      `DTSTAMP:${utc(maintenant)}`,
      `DTSTART:${utc(debut)}`,
      `DTEND:${utc(fin)}`,
      `SUMMARY:${texteIcs(e.summary || '(sans titre)')}`,
    );
    if (e.location) lignes.push(`LOCATION:${texteIcs(e.location)}`);
    if (e.description) lignes.push(`DESCRIPTION:${texteIcs(e.description)}`);
    lignes.push('END:VEVENT');
  }
  lignes.push('END:VCALENDAR');
  return `${lignes.map(plier).join('\r\n')}\r\n`;
}
