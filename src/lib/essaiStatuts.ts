export function foldStatut(s: string) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Encore à suivre : À venir, Confirmé, Relancé, À faire. Pas Venu / Absent / Annulé / Adhérent. */
export function isAVenir(statut: string) {
  const s = foldStatut(statut);
  if (!s) return true;
  if (
    s === 'venu' ||
    s === 'absent' ||
    s === 'annule' ||
    s === 'adherent' ||
    s.includes('adhere') ||
    s.includes('pas interesse') ||
    s.includes('sans suite')
  ) {
    return false;
  }
  return (
    s === 'a venir' ||
    s === 'a faire' ||
    s === 'relance' ||
    s.includes('relanc') ||
    s.includes('contact') ||
    s.includes('confirme')
  );
}

/** Vue « Nouveaux » : seulement À venir (pas Relancé / Venu…). */
export function isStrictAVenir(statut: string) {
  const s = foldStatut(statut);
  if (!s) return true;
  return s === 'a venir' || s === 'a faire';
}

/** Pastille N/3 : À venir | Confirmé | Venu | Relancé (pas Annulé / Absent / Adhérent). */
export function isCountableEssai(statut: string) {
  const s = foldStatut(statut);
  if (!s) return true;
  if (s === 'annule' || s === 'absent' || s === 'adherent') return false;
  return (
    s === 'a venir' ||
    s === 'venu' ||
    s === 'a faire' ||
    s === 'relance' ||
    s.includes('relanc') ||
    s.includes('confirme')
  );
}

/** À venir, Confirmé ou Relancé — les seuls statuts à pointer. */
export function isStatutAPointer(statut: string) {
  const s = foldStatut(statut);
  return s === 'a venir' || s === 'confirme' || s === 'relance';
}

/** Essai clos : Adhérent, Annulé, Pas intéressé, Sans suite. */
export function isTerminalEssai(statut: string) {
  const s = foldStatut(statut);
  return (
    s.includes('adhere') ||
    s.includes('pas interesse') ||
    s.includes('annule') ||
    s.includes('sans suite')
  );
}
