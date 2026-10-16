import { dateDemandeYmd, parseRelances, type ParsedRelance } from './bureauRelancesQueue';
import { adhesionNeedsMoney, telDedupeKey } from './bureauSearch';
import { essaiYmdFromCreneau } from './essaiDates';
import { foldStatut, isCountableEssai, isStrictAVenir, isTerminalEssai } from './essaiStatuts';

export type PersonEssai = {
  prenom?: string;
  nom?: string;
  tel?: string;
  cours?: string;
  creneau?: string;
  statut?: string;
  nEssai?: number;
  dateDemande?: string;
  notes?: string;
  row?: number;
  source?: string;
  lienAdhesion?: string;
};

export type PersonAdherent = {
  prenom?: string;
  nom?: string;
  tel?: string;
  mail?: string;
  statut?: string;
  mode?: string;
  montant?: string;
  datePaiement?: string;
  numero?: string;
  carte?: string;
  notes?: string;
  row?: number;
};

export type PersonWhatsapp = 'confirmation' | 'B' | 'C';

export type PersonSheet<E extends PersonEssai = PersonEssai, A extends PersonAdherent = PersonAdherent> = {
  key: string;
  prenom: string;
  nom: string;
  tel: string;
  mail: string;
  adherent: A | null;
  essais: E[];
  relances: ParsedRelance[];
  notesEssais: string[];
  notesAdherents: string[];
  nCountable: number;
  actionEssai: E | null;
  whatsapp: PersonWhatsapp;
};

/** Téléphone + prénom. Prénom vide : le téléphone seul. */
export function personSheetKey(tel: string, prenom: string) {
  const telKey = telDedupeKey(tel);
  if (!telKey) return '';
  const p = foldStatut(prenom);
  if (!p) return telKey;
  return `${telKey}|${p}`;
}

export function personWhatsappKind(statut: string): PersonWhatsapp {
  if (isStrictAVenir(statut)) return 'confirmation';
  const s = foldStatut(statut);
  if (s === 'venu' || s.startsWith('venu ')) return 'B';
  return 'C';
}

function samePerson(tel: string | undefined, prenom: string | undefined, key: string) {
  return personSheetKey(tel || '', prenom || '') === key;
}

function ymdOf(essai: PersonEssai) {
  return essaiYmdFromCreneau(String(essai.creneau || '')) || dateDemandeYmd(String(essai.dateDemande || ''));
}

/** Plus récent d’abord : date réelle, sinon date de demande, sinon numéro de ligne. */
function compareRecent(a: PersonEssai, b: PersonEssai) {
  const ya = ymdOf(a);
  const yb = ymdOf(b);
  if (ya && yb && ya !== yb) return ya < yb ? 1 : -1;
  if (ya && !yb) return -1;
  if (!ya && yb) return 1;
  return (Number(b.row) || 0) - (Number(a.row) || 0);
}

function pickAdherent<A extends PersonAdherent>(rows: A[]): A | null {
  if (!rows.length) return null;
  const pending = rows.filter((row) => adhesionNeedsMoney(String(row.statut || '')));
  const pool = pending.length ? pending : rows;
  return pool.reduce((best, row) => ((Number(row.row) || 0) >= (Number(best.row) || 0) ? row : best));
}

function firstText(...values: Array<string | undefined>) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

/** Note source seule : on ne l’affiche pas. Une note plus longue reste entière. */
function visibleEssaiNote(note: string | undefined) {
  const text = String(note || '').trim();
  if (!text) return '';
  const folded = foldStatut(text);
  if (folded === 'formulaire' || folded === 'forum') return '';
  return text;
}

export function buildPersonSheet<E extends PersonEssai, A extends PersonAdherent>(
  key: string,
  essais: E[],
  adherents: A[],
): PersonSheet<E, A> | null {
  const id = String(key || '').trim();
  if (!id) return null;
  const essaiRows = (essais || []).filter((row) => samePerson(row.tel, row.prenom, id)).sort(compareRecent);
  const adherentRows = (adherents || []).filter((row) => samePerson(row.tel, row.prenom, id));
  const adherent = pickAdherent(adherentRows);
  const actionEssai = essaiRows.find((row) => !isTerminalEssai(String(row.statut || ''))) || null;
  const head = adherent || essaiRows[0];
  const relances = essaiRows
    .flatMap((row) => parseRelances(row.notes))
    .sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
  return {
    key: id,
    prenom: firstText(head?.prenom),
    nom: firstText(head?.nom),
    tel: firstText(head?.tel, essaiRows[0]?.tel, adherentRows[0]?.tel),
    mail: firstText(adherent?.mail),
    adherent,
    essais: essaiRows,
    relances,
    notesEssais: essaiRows.map((row) => visibleEssaiNote(row.notes)).filter(Boolean),
    notesAdherents: adherentRows.map((row) => String(row.notes || '').trim()).filter(Boolean),
    nCountable: essaiRows.filter((row) => isCountableEssai(String(row.statut || ''))).length,
    actionEssai,
    whatsapp: personWhatsappKind(String((actionEssai || essaiRows[0])?.statut || '')),
  };
}
