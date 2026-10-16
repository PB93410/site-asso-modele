/**
 * Qui rappeler la veille d'un essai, qui remercier après (mails de l'essai, modules.essaiMail).
 * Un rappel ou un merci déjà noté dans les notes de l'essai (« Rappel veille essai jj/mm/aaaa »,
 * « Merci après essai jj/mm/aaaa ») n'est jamais proposé deux fois.
 */
import { essaiYmdFromCreneau } from './essaiDates';
import { foldStatut, isAVenir } from './essaiStatuts';

type EssaiRappel = { creneau?: string; statut?: string; tel?: string; notes?: string };

const RAPPEL_RE = /Rappel veille essai (\d{2}\/\d{2}\/\d{4})/g;

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 2026-10-22 → 22/10/2026 */
export function ymdToFr(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/** Dates d'essai (jj/mm/aaaa) pour lesquelles un rappel a déjà été envoyé. */
export function rappelsEnvoyes(notes?: string): string[] {
  return [...String(notes || '').matchAll(RAPPEL_RE)].map((m) => m[1]);
}

/** Texte à ajouter aux notes quand le rappel pour l'essai du `essaiYmd` est parti. */
export function noteRappel(essaiYmd: string): string {
  return `Rappel veille essai ${ymdToFr(essaiYmd)}`;
}

/**
 * Essais de demain à rappeler ce soir : encore à venir, avec un téléphone, pas déjà rappelés.
 * `todayYmd` = aujourd'hui à Paris (AAAA-MM-JJ).
 */
export function rappelsDeCeSoir<T extends EssaiRappel>(pool: T[], todayYmd: string): T[] {
  const demain = addDaysYmd(todayYmd, 1);
  const demainFr = ymdToFr(demain);
  return pool.filter(
    (item) =>
      essaiYmdFromCreneau(String(item.creneau || '')) === demain &&
      isAVenir(String(item.statut || '')) &&
      Boolean(String(item.tel || '').replace(/\D/g, '')) &&
      !rappelsEnvoyes(item.notes).includes(demainFr),
  );
}

const MERCI_RE = /Merci après essai (\d{2}\/\d{2}\/\d{4})/g;

/** Dates d'essai (jj/mm/aaaa) pour lesquelles le message de remerciement est déjà parti. */
export function mercisEnvoyes(notes?: string): string[] {
  return [...String(notes || '').matchAll(MERCI_RE)].map((m) => m[1]);
}

/** Texte à ajouter aux notes quand le « merci d'être venu » de l'essai du `essaiYmd` est parti. */
export function noteMerci(essaiYmd: string): string {
  return `Merci après essai ${ymdToFr(essaiYmd)}`;
}

/**
 * Essais des 3 derniers jours (week-end compris) où la personne est venue, pas encore remerciée :
 * c'est le bon moment pour lui proposer un autre essai ou l'adhésion.
 */
export function mercisDuJour<T extends EssaiRappel>(pool: T[], todayYmd: string): T[] {
  const depuis = addDaysYmd(todayYmd, -3);
  return pool.filter((item) => {
    const ymd = essaiYmdFromCreneau(String(item.creneau || ''));
    return (
      Boolean(ymd) &&
      ymd >= depuis &&
      ymd <= todayYmd &&
      foldStatut(String(item.statut || '')) === 'venu' &&
      Boolean(String(item.tel || '').replace(/\D/g, '')) &&
      !mercisEnvoyes(item.notes).includes(ymdToFr(ymd))
    );
  });
}
