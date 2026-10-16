/** Agenda des événements du club : adresse d'un événement et dates lisibles. */

export type EvenementAgenda = { title: string; date: string; month: string; year: string };

/** Ce que le public voit d'un événement ouvert aux inscriptions (voir netlify/functions/_evenements.mjs). */
export type EvenementOuvert = {
  titre: string;
  places: number | null;
  restantes: number | null;
  complet: boolean;
  covoiturage: boolean;
};

const plie = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Identifiant stable d'un événement : « marche-solidaire-octobre-rose-2026-oct ». */
export function slugEvenement(e: EvenementAgenda): string {
  return [plie(e.title), plie(e.year), plie(e.month)].filter(Boolean).join('-').slice(0, 80);
}

const MOIS: Record<string, string> = {
  JAN: 'janvier', FEV: 'février', MARS: 'mars', MAR: 'mars', AVR: 'avril', MAI: 'mai', JUIN: 'juin',
  JUIL: 'juillet', AOUT: 'août', SEPT: 'septembre', SEP: 'septembre', OCT: 'octobre', NOV: 'novembre', DEC: 'décembre',
};

/** « 18 », « OCT », « 2026 » → « 18 octobre 2026 » ; « 4-5 », « DÉC » → « 4-5 décembre 2026 ». */
export function dateLisible(e: EvenementAgenda): string {
  const cle = plie(e.month).toUpperCase().replace(/-/g, '');
  const mois = MOIS[cle] || e.month.toLowerCase();
  return [e.date, mois, e.year].filter((x) => String(x || '').trim()).join(' ');
}

/** « Il reste 12 places », « Complet », « 20 places », ou rien si les places sont illimitées. */
export function libellePlaces(o: EvenementOuvert): string {
  if (o.complet) return 'Complet';
  if (o.restantes === null) return 'Inscriptions ouvertes';
  return `Il reste ${o.restantes} place${o.restantes > 1 ? 's' : ''}`;
}

/** Une inscription telle que la voit le bureau. */
export type InscritEvenement = {
  id: string;
  prenom: string;
  nom: string;
  tel: string;
  personnes: number;
  covoiturage: { mode: '' | 'propose' | 'cherche'; places: number; depart: string };
  le: string;
};

/** Covoiturage : places proposées par les conducteurs, personnes qui cherchent une place. */
export function resumeCovoiturage(inscrits: InscritEvenement[]): { proposees: number; cherchent: number } {
  let proposees = 0;
  let cherchent = 0;
  for (const i of inscrits) {
    if (i.covoiturage?.mode === 'propose') proposees += Number(i.covoiturage.places) || 0;
    if (i.covoiturage?.mode === 'cherche') cherchent += Number(i.personnes) || 0;
  }
  return { proposees, cherchent };
}

/** « 06 12 34 56 78 ». */
export const telAffiche = (t: string) => String(t || '').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
