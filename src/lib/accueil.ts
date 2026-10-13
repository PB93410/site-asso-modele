/** Accueil contextuel : prochaine séance du planning et bouton principal selon la saison. */

export type CreneauPlanning = { day: string; time: string; course: string; location: string; note?: string };

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fold(s: string) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** « Lundi » → 1, « dimanche » → 0, sinon null. */
export function indexJour(jour: string): number | null {
  const i = JOURS.indexOf(fold(jour));
  return i >= 0 ? i : null;
}

/** Heure de début d'un horaire « 18h30 – 19h30 », « 9h », « 18:30 » → minutes depuis minuit. */
export function debutMinutes(horaire: string): number | null {
  const m = String(horaire || '').match(/(\d{1,2})\s*[hH:]\s*(\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 1110 → « 18 h 30 », 540 → « 9 h ». */
export function libelleHeure(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Jour (0-6) et minutes depuis minuit, heure de Paris. */
export function maintenantParis(now: Date): { jour: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return {
    jour: Math.max(0, JOURS_EN.indexOf(get('weekday'))),
    minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')),
  };
}

export type ProchaineSeance = {
  creneau: CreneauPlanning;
  /** Minutes avant le début. */
  dans: number;
  debut: number;
  /** « aujourd’hui », « demain » ou le jour (« lundi »). */
  quand: string;
};

/**
 * Prochaine séance à venir dans le planning hebdomadaire (heure de Paris).
 * Avant la reprise, on compte à partir de la reprise. Créneaux annulés (note) ignorés.
 */
export function prochaineSeance(
  planning: CreneauPlanning[],
  now: Date,
  reprise?: string,
): ProchaineSeance | null {
  let ref = now;
  if (reprise) {
    const r = new Date(`${reprise}T00:00:00+02:00`);
    if (!Number.isNaN(r.getTime()) && r > now) ref = r;
  }
  const decalage = Math.round((ref.getTime() - now.getTime()) / 60000);
  const { jour, minutes } = maintenantParis(ref);
  let best: ProchaineSeance | null = null;
  for (const c of planning) {
    const j = indexJour(c.day);
    const d = debutMinutes(c.time);
    if (j === null || d === null || !c.course) continue;
    if (/annul/i.test(c.note || '')) continue;
    let delta = ((j - jour + 7) % 7) * 1440 + d - minutes;
    if (delta < 0) delta += 7 * 1440;
    const dans = delta + decalage;
    if (!best || dans < best.dans) {
      const jours = Math.floor((minutes + delta) / 1440);
      const quand = decalage === 0 && jours === 0 ? 'aujourd’hui' : decalage === 0 && jours === 1 ? 'demain' : JOURS[j];
      best = { creneau: c, dans, debut: d, quand };
    }
  }
  return best;
}

/** Compte à rebours lisible, seulement sous 24 h : « dans 2 h 15 », « dans 25 min ». */
export function compteARebours(minutes: number): string | null {
  if (minutes < 0 || minutes >= 24 * 60) return null;
  if (minutes < 1) return 'maintenant';
  if (minutes < 60) return `dans ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `dans ${h} h ${String(m).padStart(2, '0')}` : `dans ${h} h`;
}

export type CtaSaison = 'essai' | 'reinscription' | 'adhesion';

/**
 * Bouton principal du hero :
 * - juin à août (fin de saison, hors saison tout juste reprise) : réinscription ;
 * - jusqu'à `finCampagneEssai` (si l'asso propose des essais) : essai gratuit ;
 * - sinon : adhésion.
 */
export function ctaSaison(
  now: Date,
  saison: { reprise: string; finCampagneEssai: string },
  nbEssais: number,
): CtaSaison {
  const mois = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', month: 'numeric' }).format(now),
  );
  const reprise = new Date(`${saison.reprise}T00:00:00+02:00`).getTime();
  const finEssai = new Date(`${saison.finCampagneEssai}T23:59:59+01:00`).getTime();
  const t = now.getTime();
  // Saison tout juste reprise (moins de 90 jours) : pas de réinscription.
  const saisonEnCours = !Number.isNaN(reprise) && t >= reprise && t < reprise + 90 * 86400000;
  if (mois >= 6 && mois <= 8 && !saisonEnCours) return 'reinscription';
  if (nbEssais > 0 && !Number.isNaN(finEssai) && t <= finEssai) return 'essai';
  return 'adhesion';
}
