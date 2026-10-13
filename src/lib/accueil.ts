/**
 * Accueil contextuel : prochaine séance du planning (vacances, jours fériés et fin de saison compris)
 * et bouton principal selon la saison.
 */

export type CreneauPlanning = { day: string; time: string; course: string; location: string; note?: string };

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

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

/** Date (AAAA-MM-JJ) et minutes depuis minuit, heure de Paris. */
export function parisMaintenant(now: Date): { ymd: string; minutes: number } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value || '';
  return { ymd: `${g('year')}-${g('month')}-${g('day')}`, minutes: (Number(g('hour')) % 24) * 60 + Number(g('minute')) };
}

/** Jour décalé d'une date AAAA-MM-JJ (calcul en UTC, sans heure d'été). */
function decaler(ymd: string, jours: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

const jourSemaine = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

/** « 2026-11-02 » → « lundi 2 novembre ». */
export function libelleDate(ymd: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${ymd}T12:00:00Z`),
  );
}

/** Jours fériés de métropole d'une année (AAAA-MM-JJ), Pâques et Pentecôte comprises. */
export function joursFeries(annee: number): string[] {
  // Dimanche de Pâques (algorithme de Meeus / Jones / Butcher).
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((8 * b + 13) / 25)) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
  const fixes = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map((j) => `${annee}-${j}`);
  return [...fixes, decaler(paques, 1), decaler(paques, 39), decaler(paques, 50)].sort();
}

/** Vacances sans cours : `du` = premier jour sans cours, `reprise` = jour où les cours reprennent. */
export type Pause = { libelle: string; du: string; reprise: string };

/** Calendrier de la saison (asso.config.js → saison). Tout est facultatif. */
export type CalendrierSaison = {
  reprise?: string;
  /** Premier jour sans cours de l'été (AAAA-MM-JJ). */
  fin?: string;
  pauses?: Pause[];
  /** Jours fériés où les cours ont lieu quand même. */
  feriesAvecCours?: string[];
};

export type SansCours =
  | { raison: 'avant-reprise'; reprise: string }
  | { raison: 'vacances'; libelle: string; reprise: string }
  | { raison: 'ferie' }
  | { raison: 'fin' };

/** Raison pour laquelle il n'y a pas cours ce jour-là (AAAA-MM-JJ), ou null si le planning s'applique. */
export function sansCoursLe(ymd: string, saison: CalendrierSaison = {}): SansCours | null {
  const { reprise = '', fin = '', pauses = [], feriesAvecCours = [] } = saison;
  if (reprise && ymd < reprise) return { raison: 'avant-reprise', reprise };
  if (fin && ymd >= fin) return { raison: 'fin' };
  const p = pauses.find((x) => ymd >= x.du && ymd < x.reprise);
  if (p) return { raison: 'vacances', libelle: p.libelle, reprise: p.reprise };
  if (joursFeries(Number(ymd.slice(0, 4))).includes(ymd) && !feriesAvecCours.includes(ymd)) return { raison: 'ferie' };
  return null;
}

export type ProchaineSeance = {
  type: 'cours';
  creneau: CreneauPlanning;
  /** Date de la séance (AAAA-MM-JJ). */
  ymd: string;
  /** Minutes avant le début. */
  dans: number;
  debut: number;
  /** « aujourd’hui », « demain », le jour (« lundi ») ou la date (« lundi 7 septembre »). */
  quand: string;
};

/** Vacances en cours, ou à venir avant la prochaine séance. */
export type PauseCours = { type: 'pause'; libelle: string; du: string; reprise: string; enCours: boolean };

/**
 * Prochaine séance du planning hebdomadaire (heure de Paris), ou les vacances qui viennent avant.
 * Avant la reprise, on part de la reprise. Saute les jours fériés et les créneaux annulés (note).
 * Après la fin de saison : null.
 */
export function prochaineSeance(
  planning: CreneauPlanning[],
  now: Date,
  saison: CalendrierSaison = {},
): ProchaineSeance | PauseCours | null {
  const { pauses = [] } = saison;
  const { ymd: aujourdhui, minutes } = parisMaintenant(now);
  const enCours = pauses.find((p) => aujourdhui >= p.du && aujourdhui < p.reprise);
  if (enCours) return { type: 'pause', ...enCours, enCours: true };

  const creneaux = planning
    .map((c) => ({ c, jour: indexJour(c.day), debut: debutMinutes(c.time) }))
    .filter((x) => x.jour !== null && x.debut !== null && x.c.course && !/annul/i.test(x.c.note || ''));
  if (!creneaux.length) return null;

  let ymd = saison.reprise && saison.reprise > aujourdhui ? saison.reprise : aujourdhui;
  for (let i = 0; i < 42; i += 1, ymd = decaler(ymd, 1)) {
    const sans = sansCoursLe(ymd, saison);
    if (sans?.raison === 'fin') return null;
    // Plus de cours d'ici les vacances : on annonce les vacances et la reprise.
    if (sans?.raison === 'vacances') {
      const p = pauses.find((x) => ymd >= x.du && ymd < x.reprise)!;
      return { type: 'pause', ...p, enCours: false };
    }
    if (sans) continue;
    const jour = jourSemaine(ymd);
    const premier = creneaux
      .filter((x) => x.jour === jour && (ymd !== aujourdhui || (x.debut as number) > minutes))
      .sort((a, b) => (a.debut as number) - (b.debut as number))[0];
    if (!premier) continue;
    const ecart = Math.round((Date.parse(`${ymd}T12:00:00Z`) - Date.parse(`${aujourdhui}T12:00:00Z`)) / 86400000);
    const debut = premier.debut as number;
    return {
      type: 'cours',
      creneau: premier.c,
      ymd,
      debut,
      dans: ecart * 1440 + debut - minutes,
      quand: ecart === 0 ? 'aujourd’hui' : ecart === 1 ? 'demain' : ecart < 7 ? JOURS[jour] : libelleDate(ymd),
    };
  }
  return null;
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
