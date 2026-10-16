import type { ScheduleRow } from '../data/siteData';
import { ASSO, MODULES, NB_ESSAIS, PAIEMENTS_BUREAU, SITE_URL, TARIF_LABEL, lieuAdresse } from '../data/asso';
import { formatEssaiDateLabel, slotHintFromCell } from './essaiDates';
import { LIEN_SONDAGE } from './sondageEssai';

export function slotValue(day: string, time: string) {
  const start = (time || '').split(/[–-]/)[0].trim();
  return `${(day || '').toLowerCase()} ${start}`.trim();
}

export function slotLabel(day: string, time: string, course: string) {
  const start = (time || '').split(/[–-]/)[0].trim();
  return `${day} ${start} · ${course}`;
}

/** Retrouve le(s) lieu(x) de asso.config.js cités dans la colonne « location » du planning. */
export function salleFromLocation(location: string) {
  const loc = (location || '').toLowerCase();
  const hits = ASSO.lieux.filter(
    (l) => loc.includes(l.nom.toLowerCase()) || (l.id && loc.includes(l.id.toLowerCase())),
  );
  if (hits.length === 0) {
    return { salle: location || '', adresseCourte: '', adresse: '', kind: 'unknown' as const };
  }
  return {
    salle: hits.map((l) => l.nom).join(' et '),
    adresseCourte: hits.map((l) => l.rue).join(' · '),
    adresse: hits.map((l) => lieuAdresse(l)).join(' · '),
    kind: hits.length > 1 ? ('multiple' as const) : ('lieu' as const),
  };
}

function normSlot(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchScheduleRow(
  schedule: ScheduleRow[],
  course?: string,
  dateEssai?: string,
): ScheduleRow | null {
  const c = (course || '').trim();
  const d = normSlot(slotHintFromCell(dateEssai || ''));
  if (c && d) {
    const hit = schedule.find((r) => {
      if (r.course !== c) return false;
      const v = normSlot(slotValue(r.day, r.time));
      return v === d || d.includes(v) || v.includes(d);
    });
    if (hit) return hit;
  }
  if (d && !c) {
    const hit = schedule.find((r) => {
      const v = normSlot(slotValue(r.day, r.time));
      return v === d || d.includes(v);
    });
    if (hit) return hit;
  }
  return null;
}

export type CreneauInfo = {
  hasSlot: boolean;
  course: string;
  dayTime: string;
  salle: string;
  adresseCourte: string;
  adresse: string;
  kind: 'lieu' | 'multiple' | 'unknown';
};

export function resolveCreneau(
  schedule: ScheduleRow[],
  course?: string,
  dateEssai?: string,
  opts?: { inferFromCourse?: boolean },
): CreneauInfo {
  const date = (dateEssai || '').trim();
  let row = matchScheduleRow(schedule, course, date);
  if (!row && opts?.inferFromCourse && (course || '').trim()) {
    const rows = schedule.filter((r) => r.course === (course || '').trim());
    if (rows.length === 1) row = rows[0];
  }
  const salle = salleFromLocation(row?.location || '');
  const start = row ? (row.time || '').split(/[–-]/)[0].trim() : '';
  const fromRow = row ? `${row.day} ${start}` : '';
  const dated = /\d{2}\/\d{2}\/\d{4}/.test(date) ? formatEssaiDateLabel(date) : '';
  const dayTime = dated || fromRow || date;
  const hasSlot = Boolean(date) || Boolean(opts?.inferFromCourse && row);
  return {
    hasSlot,
    course: (course || row?.course || '').trim(),
    dayTime,
    ...salle,
  };
}

/** WhatsApp bureau → la personne */
export function msgBureauEssai(prenom: string, info: CreneauInfo) {
  const name = prenom || '';
  if (info.hasSlot && info.dayTime) {
    const cours = info.course ? ` ${info.course}` : '';
    const lieu = info.salle
      ? info.adresseCourte
        ? `${info.salle} (${info.adresseCourte})`
        : info.salle
      : '';
    const lieuLine = lieu ? `, ${lieu}` : '';
    return `Bonjour ${name},
C’est ${ASSO.nom}.
On vous attend pour l’essai${cours} : ${info.dayTime}${lieuLine}.
Tenue souple, baskets, une bouteille d’eau.
Un empêchement ? Répondez ici.
À bientôt !`;
  }
  const cours = info.course ? ` (${info.course})` : '';
  return `Bonjour ${name},
C’est ${ASSO.nom}.
Votre demande d’essai${cours} est bien reçue.
Quel jour vous arrange ?
À très bientôt !`;
}

function slotBits(info: CreneauInfo) {
  const cours = info.course ? ` ${info.course}` : '';
  const when = info.dayTime || 'l’horaire convenu';
  const lieu = info.salle
    ? info.adresseCourte
      ? `${info.salle} (${info.adresseCourte})`
      : info.salle
    : '';
  return { cours, when, lieu };
}

/** La veille du cours — la bénévole appuie le soir d’avant */
export function msgRappelVeille(prenom: string, info: CreneauInfo) {
  const name = prenom || '';
  const { cours, when, lieu } = slotBits(info);
  const lieuLine = lieu ? ` — ${lieu}` : '';
  return `Bonjour ${name},
Petit rappel : essai${cours} demain à ${when}${lieuLine}.
Tenue souple, baskets, une bouteille d’eau.
À bientôt,
${ASSO.nom}`;
}

/**
 * Après le cours : 2e/3e essai ou adhésion, sans pression. `lienAdhesion` = jeton du lien « Adhérer en 1 minute »
 * (formulaire prérempli) ; sans lui, rien de plus.
 */
export function msgApresCours(prenom: string, info: CreneauInfo, numEssai = 1, lienAdhesion = '') {
  const name = prenom || '';
  const cours = info.course ? ` de ${info.course}` : '';
  const restants = Math.max(0, NB_ESSAIS - numEssai);
  const suite =
    restants > 0
      ? `Il vous reste ${restants === 1 ? 'un essai' : `${restants} essais`} : même créneau ou un autre cours, comme vous voulez.`
      : `Les essais sont faits. Si ça vous a convenu, l’adhésion est à ${TARIF_LABEL} l’année (${ASSO.adhesion.inclus}).`;
  return `Bonjour ${name},
Merci d’être venu(e) au cours${cours}.
${suite}
Adhésion ${TARIF_LABEL}/an si vous le souhaitez : ${ASSO.adhesion.paiementUrl ? 'carte en ligne, ou ' : ''}${PAIEMENTS_BUREAU} au bureau.
${lienAdhesion ? `Pour adhérer en ligne, en 1 minute (vos coordonnées sont déjà remplies) : ${SITE_URL}/inscription?e=${encodeURIComponent(lienAdhesion)}
` : ''}${MODULES.sondageEssai ? `Votre avis en 30 secondes, sans donner votre nom : ${LIEN_SONDAGE}
` : ''}Sans pression — répondez ici.`;
}

export function msgDeuxiemeEssai(prenom: string, info: CreneauInfo, prochain: number) {
  const name = prenom || '';
  const cours = info.course ? ` (${info.course})` : '';
  const n = prochain <= NB_ESSAIS ? `${prochain}e` : 'prochain';
  return `Bonjour ${name},
On vous propose un ${n} essai${cours} : même horaire, ou un autre cours si vous préférez.
Dites-nous le jour qui vous arrange.
À bientôt !`;
}

/** WhatsApp la personne → le club (après le formulaire) */
export function msgContactEssai(prenom: string, info: CreneauInfo) {
  const name = prenom.trim() || '';
  const who = name ? `C’est ${name}. ` : '';
  if (info.hasSlot && info.dayTime) {
    const bits = [info.course, info.dayTime, info.salle].filter(Boolean);
    return `Bonjour,
${who}J’ai demandé un essai : ${bits.join(', ')}.
Merci`;
  }
  const cours = info.course ? ` (${info.course})` : '';
  return `Bonjour,
${who}J’ai demandé un essai${cours}, je n’ai pas encore choisi de créneau.
Merci`;
}
