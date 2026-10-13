/**
 * « Mes cours » de l'espace adhérent : les créneaux du planning pour les cours choisis, et leurs
 * prochaines séances (vacances, jours fériés, fin de saison et créneaux annulés compris).
 * Sert à la page /espace et à l'agenda en abonnement (.ics) : mêmes règles des deux côtés.
 */

import { debutMinutes, sansCoursLe, type CalendrierSaison, type CreneauPlanning } from './accueil';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const fold = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

/** « 13h30 – 14h30 » → 870 (fin), sinon début + 60 min. */
export function finMinutes(horaire: string): number | null {
  const parts = String(horaire || '').split(/\s*[–—-]\s*|\s+à\s+/);
  const fin = parts.length > 1 ? debutMinutes(parts[1]) : null;
  const debut = debutMinutes(horaire);
  if (fin !== null && debut !== null && fin > debut) return fin;
  return debut === null ? null : debut + 60;
}

/** Créneaux du planning pour ces cours (créneaux annulés exclus). */
export function creneauxDe(planning: CreneauPlanning[], cours: string[]): CreneauPlanning[] {
  const voulus = new Set(cours.map(fold));
  return planning.filter((c) => voulus.has(fold(c.course)) && !/annul/i.test(c.note || '') && debutMinutes(c.time) !== null);
}

const decaler = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export type Seance = { ymd: string; debut: number; fin: number; creneau: CreneauPlanning };

/**
 * Séances à venir, du jour `du` (AAAA-MM-JJ) pendant `jours` jours, triées.
 * Avant la reprise, on part de la reprise. S'arrête à la fin de saison.
 */
export function seances(
  planning: CreneauPlanning[],
  cours: string[],
  { du, jours = 14, saison = {} }: { du: string; jours?: number; saison?: CalendrierSaison },
): Seance[] {
  const creneaux = creneauxDe(planning, cours);
  if (!creneaux.length) return [];
  const out: Seance[] = [];
  let ymd = saison.reprise && saison.reprise > du ? saison.reprise : du;
  for (let i = 0; i < jours; i += 1, ymd = decaler(ymd, 1)) {
    const sans = sansCoursLe(ymd, saison);
    if (sans?.raison === 'fin') break;
    if (sans) continue;
    const jour = new Date(`${ymd}T12:00:00Z`).getUTCDay();
    for (const c of creneaux) {
      if (fold(c.day) !== JOURS[jour]) continue;
      const debut = debutMinutes(c.time) as number;
      out.push({ ymd, debut, fin: finMinutes(c.time) as number, creneau: c });
    }
  }
  return out.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.debut - b.debut);
}

/** Décalage de Paris ce jour-là : « +02:00 » ou « +01:00 ». */
function decalageParis(ymd: string): string {
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(`${ymd}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')?.value;
  const h = Number(String(nom || 'GMT+1').replace('GMT', '')) || 1;
  return `${h >= 0 ? '+' : '-'}${String(Math.abs(h)).padStart(2, '0')}:00`;
}

/** « 2026-10-19 », 870 → « 2026-10-19T14:30:00+02:00 » (heure de Paris). */
export function heureParis(ymd: string, minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${ymd}T${h}:${m}:00${decalageParis(ymd)}`;
}

/** Cours notés à l'inscription (« Cours: Pilates, Yoga » dans NOTES). */
export function coursDeNotes(notes: string): string[] {
  return (String(notes || '').match(/Cours: ([^|]+)/)?.[1] || '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c && c !== 'Non précisé');
}
