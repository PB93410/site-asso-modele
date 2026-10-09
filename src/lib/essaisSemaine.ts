import { essaiYmdFromCreneau } from './essaiDates';
import { foldStatut, isStatutAPointer } from './essaiStatuts';

export { isStatutAPointer };

function addDaysYmd(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function essaisAPointer<T extends { creneau?: string; statut?: string }>(
  pool: T[],
  todayYmd: string,
): T[] {
  return pool
    .filter((item) => {
      const ymd = essaiYmdFromCreneau(String(item.creneau || ''));
      return Boolean(ymd && ymd < todayYmd && isStatutAPointer(String(item.statut || '')));
    })
    .sort((a, b) =>
      essaiYmdFromCreneau(String(a.creneau || '')).localeCompare(
        essaiYmdFromCreneau(String(b.creneau || '')),
      ),
    );
}

/**
 * Badge : À venir / Confirmé encore à venir (ou sans date)
 * + À pointer dont l’essai a moins de 30 jours.
 */
export function countEssaisATraiter<T extends { creneau?: string; statut?: string }>(
  pool: T[],
  todayYmd: string,
): number {
  const cutoff = addDaysYmd(todayYmd, -30);
  let n = 0;
  for (const item of pool) {
    const s = foldStatut(String(item.statut || ''));
    const ymd = essaiYmdFromCreneau(String(item.creneau || ''));
    const encoreFutur = (s === 'a venir' || s === 'confirme') && (!ymd || ymd >= todayYmd);
    const aPointerRecent =
      isStatutAPointer(String(item.statut || '')) && Boolean(ymd && ymd < todayYmd && ymd >= cutoff);
    if (encoreFutur || aPointerRecent) n += 1;
  }
  return n;
}

/** « essai du lundi 13 oct. » */
export function formatEssaiDu(ymd: string) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const label = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return `essai du ${label}`;
}
