/**
 * File relances bureau — calculée depuis Essais × Adhérents (pas de liste figée).
 * Une carte par telDedupeKey : signaux agrégés sur TOUTES les lignes du tél.
 */
import {
  adhesionNeedsMoney,
  formatTelFr,
  isTestPrenom,
  telDedupeKey,
} from './bureauSearch';
import { essaiYmdFromCreneau } from './essaiDates';
import { foldStatut, isTerminalEssai } from './essaiStatuts';

export type RelanceMsg = 'A' | 'B' | 'C';
export type LivePrio = 'P1' | 'P2' | 'SKIP';
export type ParsedRelance = { msg: 'A' | 'B' | 'C'; ymd: string };

export type EssaiInput = {
  prenom?: string;
  nom?: string;
  tel?: string;
  cours?: string;
  creneau?: string;
  statut?: string;
  nEssai?: number;
  dateDemande?: string;
  present?: string;
  dateRelance?: string;
  notes?: string;
  row?: number;
  source?: string;
  /** Jeton du lien « Adhérer en 1 minute » (essais-list), vide sans BUREAU_SECRET. */
  lienAdhesion?: string;
};

export type AdherentInput = {
  prenom?: string;
  nom?: string;
  tel?: string;
  statut?: string;
  mode?: string;
};

export type LiveRelanceCard = {
  prio: LivePrio;
  prenom: string;
  nom: string;
  tel: string;
  telKey: string;
  cours: string;
  statutEssais: string;
  present: string;
  nEssai: number;
  dateDemande: string;
  dateRelance: string;
  message: RelanceMsg;
  row: number;
  /** Skip / registre */
  statutAdherents: string;
  modeAdherents: string;
  skipReason: string;
  dateLabel: string;
  lastRelanceYmd: string;
  lastRelanceMsg: RelanceMsg | '';
  relanceCount: number;
  /** Jours depuis la dernière relance, sinon depuis l’essai. Sert au tri. */
  daysSince: number;
  /** Jours depuis la date de l’essai, sans tenir compte des relances. */
  daysSinceEssai: number;
  lienAdhesion: string;
};

export type RelancesQueue = {
  p1: LiveRelanceCard[];
  p2: LiveRelanceCard[];
  skip: LiveRelanceCard[];
  now: number;
};

function fold(s: string) {
  return foldStatut(s);
}

/** Même texte que l’API : « Relance B 07/10/2026 », ajouté aux NOTES. */
export function appendRelanceNote(notes: string | undefined, msg: string) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '';
  const bit = `Relance ${msg} ${get('day')}/${get('month')}/${get('year')}`;
  const existing = String(notes || '').trim();
  return existing ? `${existing} | ${bit}` : bit;
}

function parisYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Parse DATE_DEMANDE / Date essai → YMD Paris-ish (jour calendaire). */
export function dateDemandeYmd(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!fr) return '';
  const y = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
  return `${y}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
}

/** Extrait chaque « Relance A|B|C jj/mm/aaaa », du plus ancien au plus récent. */
export function parseRelances(notes?: string): ParsedRelance[] {
  const out: ParsedRelance[] = [];
  const re = /Relance\s+([ABCabc])\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  for (const m of String(notes || '').matchAll(re)) {
    const msg = m[1].toUpperCase() as ParsedRelance['msg'];
    out.push({
      msg,
      ymd: `${m[4]}-${m[3].padStart(2, '0')}-${m[2].padStart(2, '0')}`,
    });
  }
  out.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
  return out;
}

function daysBetweenYmd(earlier: string, later: string) {
  if (!earlier || !later) return null;
  const [y1, m1, d1] = earlier.split('-').map(Number);
  const [y2, m2, d2] = later.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((b - a) / 86_400_000);
}

function formatDateLabel(raw: string, todayYmd: string) {
  const ymd = dateDemandeYmd(raw);
  if (!ymd) return '';
  if (ymd === todayYmd) return 'aujourd’hui';
  const [y, m, d] = todayYmd.split('-').map(Number);
  const yest = new Date(Date.UTC(y, m - 1, d - 1));
  const yestYmd = yest.toISOString().slice(0, 10);
  if (ymd === yestYmd) return 'hier';
  const [yy, mm, dd] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(new Date(Date.UTC(yy, mm - 1, dd)));
}

function rowNum(e: EssaiInput) {
  return Number(e.row) || 0;
}

function coursOf(e: EssaiInput) {
  return String(e.cours || e.creneau || '').trim();
}

export function isVenuLike(statut: string, present: string) {
  const s = fold(statut);
  const p = fold(present);
  if (s === 'venu' || s.startsWith('venu ')) return true;
  if (p === 'oui' || p === 'ok') return true;
  if (s.includes('present')) return true;
  return false;
}

function isRelanceStatut(statut: string) {
  return fold(statut).includes('relanc');
}

function isAbsentStatut(statut: string) {
  return fold(statut) === 'absent';
}

function isAVenirStatut(statut: string) {
  const s = fold(statut);
  return s === 'a venir' || s === 'confirme';
}

type AdhIndex = {
  aJour: boolean;
  needsMoney: boolean;
  statut: string;
  mode: string;
  prenom: string;
  nom: string;
};

type TelAgg = {
  lines: EssaiInput[];
  identity: EssaiInput;
  anyVenu: boolean;
  anyTerminalEssai: boolean;
  bestVenu: EssaiInput | null;
  statutAffiche: string;
  presentAffiche: string;
  relances: ParsedRelance[];
  lastRelanceYmd: string;
  lastRelanceMsg: RelanceMsg | '';
  relanceCount: number;
};

function buildAdhIndex(adherentsAll: AdherentInput[]): Map<string, AdhIndex> {
  const map = new Map<string, AdhIndex>();
  for (const a of adherentsAll) {
    if (isTestPrenom(a.prenom || '', a.nom || '')) continue;
    const key = telDedupeKey(a.tel || '');
    if (!key) continue;
    const statut = String(a.statut || '');
    const mode = String(a.mode || '');
    const prev = map.get(key);
    const aJour = fold(statut).includes('a jour');
    const needsMoney = adhesionNeedsMoney(statut);
    if (!prev) {
      map.set(key, {
        aJour,
        needsMoney,
        statut,
        mode,
        prenom: a.prenom || '',
        nom: a.nom || '',
      });
      continue;
    }
    map.set(key, {
      aJour: prev.aJour || aJour,
      needsMoney: prev.needsMoney || needsMoney,
      statut: aJour || needsMoney ? statut : prev.statut || statut,
      mode: mode || prev.mode,
      prenom: prev.prenom || a.prenom || '',
      nom: prev.nom || a.nom || '',
    });
  }
  return map;
}

/** Agrège toutes les lignes Essais d’un même téléphone. */
export function aggregateEssaisByTel(essais: EssaiInput[]): Map<string, TelAgg> {
  const groups = new Map<string, EssaiInput[]>();
  for (const e of essais || []) {
    if (isTestPrenom(e.prenom || '', e.nom || '')) continue;
    const key = telDedupeKey(e.tel || '');
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  const out = new Map<string, TelAgg>();
  for (const [telKey, lines] of groups) {
    let identity = lines[0];
    for (const e of lines) {
      if (rowNum(e) >= rowNum(identity)) identity = e;
    }

    let anyVenu = false;
    let anyTerminalEssai = false;
    let bestVenu: EssaiInput | null = null;
    const relances: ParsedRelance[] = [];

    for (const e of lines) {
      const statut = String(e.statut || '');
      const present = String(e.present || '');
      if (isTerminalEssai(statut)) anyTerminalEssai = true;
      if (isVenuLike(statut, present)) {
        anyVenu = true;
        if (!bestVenu || rowNum(e) >= rowNum(bestVenu)) bestVenu = e;
      }
      const parsed = parseRelances(e.notes);
      if (parsed.length > 0) {
        relances.push(...parsed);
      } else if (isRelanceStatut(statut)) {
        const ymd = dateDemandeYmd(String(e.dateDemande || ''));
        if (ymd) relances.push({ msg: 'C', ymd });
      }
    }
    relances.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
    const lastRelance = relances[relances.length - 1];

    let statutAffiche = String(identity.statut || '').trim();
    let presentAffiche = String(identity.present || '').trim();
    if (anyVenu && bestVenu) {
      const vs = String(bestVenu.statut || '').trim();
      const vp = String(bestVenu.present || '').trim();
      if (fold(vs).includes('venu') || fold(vs) === 'venu') {
        statutAffiche = vs || 'Venu';
      } else if (fold(vs).includes('present')) {
        statutAffiche = vs;
      } else {
        statutAffiche = 'Venu';
      }
      presentAffiche = vp || presentAffiche;
    }

    out.set(telKey, {
      lines,
      identity,
      anyVenu,
      anyTerminalEssai,
      bestVenu,
      statutAffiche,
      presentAffiche,
      relances,
      lastRelanceYmd: lastRelance?.ymd || '',
      lastRelanceMsg: lastRelance?.msg || '',
      relanceCount: relances.length,
    });
  }
  return out;
}

function cardFromAgg(
  agg: TelAgg,
  prio: LivePrio,
  message: RelanceMsg,
  adh: AdhIndex | undefined,
  todayYmd: string,
  opts: { cours: string; dateRaw: string; skipReason?: string },
): LiveRelanceCard {
  const e = agg.identity;
  const tel = formatTelFr(e.tel || '') || String(e.tel || '').trim();
  return {
    prio,
    prenom: String(e.prenom || '').trim(),
    nom: String(e.nom || '').trim(),
    tel,
    telKey: telDedupeKey(e.tel || ''),
    cours: opts.cours,
    statutEssais: agg.statutAffiche,
    present: agg.presentAffiche,
    nEssai: Number(e.nEssai) || 1,
    dateDemande: String(e.dateDemande || '').trim(),
    dateRelance: String(e.dateRelance || '').trim(),
    message,
    row: rowNum(e),
    statutAdherents: adh?.statut || '',
    modeAdherents: adh?.mode || '',
    skipReason: opts.skipReason || '',
    dateLabel: formatDateLabel(opts.dateRaw, todayYmd),
    lastRelanceYmd: agg.lastRelanceYmd,
    lastRelanceMsg: agg.lastRelanceMsg,
    relanceCount: agg.relanceCount,
    daysSince: daysSinceOf(agg, opts.dateRaw, todayYmd),
    daysSinceEssai: daysFromEssai(opts.dateRaw, todayYmd),
    lienAdhesion: String(e.lienAdhesion || ''),
  };
}

function daysFromEssai(dateRaw: string, todayYmd: string) {
  const ymd = dateDemandeYmd(dateRaw);
  if (!ymd) return 0;
  return daysBetweenYmd(ymd, todayYmd) ?? 0;
}

function daysSinceOf(agg: TelAgg, dateRaw: string, todayYmd: string) {
  const anchor = agg.lastRelanceYmd || dateDemandeYmd(dateRaw);
  if (!anchor) return 0;
  return daysBetweenYmd(anchor, todayYmd) ?? 0;
}

/** Venue : seules les relances B comptent. Jamais venue : toutes, y compris C. */
function relancesForSkip(agg: TelAgg) {
  return agg.anyVenu ? agg.relances.filter((r) => r.msg === 'B') : agg.relances;
}

function skipForTwoRelances(agg: TelAgg) {
  const counted = relancesForSkip(agg);
  if (counted.length < 2) return false;
  if (!agg.anyVenu || !agg.bestVenu) return true;
  const last = counted[counted.length - 1];
  const venuYmd = dateDemandeYmd(String(agg.bestVenu.dateDemande || ''));
  return !(venuYmd && last && venuYmd > last.ymd);
}

function ageDays(ymd: string, todayYmd: string) {
  if (!ymd) return null;
  return daysBetweenYmd(ymd, todayYmd);
}

/** Date réelle de l’essai si CRENEAU est daté, sinon la date de demande. */
function lineWhenYmd(line: EssaiInput) {
  return essaiYmdFromCreneau(String(line.creneau || '')) || dateDemandeYmd(String(line.dateDemande || ''));
}

/**
 * Skip > P1 > P2.
 * Une carte par téléphone ; signaux = toutes les lignes Essais du tél.
 */
export function classifyRelances(
  essais: EssaiInput[],
  adherentsAll: AdherentInput[],
  adherentsAJour: string[],
  now = Date.now(),
): RelancesQueue {
  const todayYmd = parisYmd(new Date(now));
  const aJourSet = new Set(
    (adherentsAJour || []).map((k) => String(k || '').replace(/\D/g, '').slice(-9)).filter(Boolean),
  );
  const adhIndex = buildAdhIndex(adherentsAll || []);
  const byTel = aggregateEssaisByTel(essais || []);

  const p1: LiveRelanceCard[] = [];
  const p2: LiveRelanceCard[] = [];
  const skip: LiveRelanceCard[] = [];

  for (const [telKey, agg] of byTel) {
    const adh = adhIndex.get(telKey);
    const id = agg.identity;

    let skipReason = '';
    if (aJourSet.has(telKey) || adh?.aJour) {
      skipReason = 'Adhérent À jour';
    } else if (adh?.needsMoney) {
      skipReason = `En attente${adh.mode ? ` · ${adh.mode}` : ''}`;
    } else if (agg.anyTerminalEssai) {
      const terminal = agg.lines.find((l) => isTerminalEssai(String(l.statut || '')));
      skipReason = String(terminal?.statut || id.statut || 'Essai terminé').trim();
    } else if (skipForTwoRelances(agg)) {
      skipReason = '2 relances sans réponse';
    }

    if (skipReason) {
      skip.push(
        cardFromAgg(agg, 'SKIP', 'B', adh, todayYmd, {
          cours: coursOf(id),
          dateRaw: String(id.dateDemande || ''),
          skipReason,
        }),
      );
      continue;
    }

    if (agg.anyVenu) {
      const lastB = [...agg.relances].reverse().find((r) => r.msg === 'B');
      const daysB = lastB ? ageDays(lastB.ymd, todayYmd) : null;
      if (lastB && daysB !== null && daysB < 7) continue;
      const venuLine = agg.bestVenu || id;
      p1.push(
        cardFromAgg(agg, 'P1', 'B', adh, todayYmd, {
          cours: coursOf(venuLine),
          dateRaw: lineWhenYmd(venuLine),
        }),
      );
      continue;
    }

    const sinceRelance = ageDays(agg.lastRelanceYmd, todayYmd);
    if (agg.lastRelanceYmd && sinceRelance !== null && sinceRelance < 7) continue;

    const absent = agg.lines.some((l) => isAbsentStatut(String(l.statut || '')));
    const aVenirOld = agg.lines.some((l) => {
      if (!isAVenirStatut(String(l.statut || ''))) return false;
      const essaiYmd = essaiYmdFromCreneau(String(l.creneau || ''));
      if (essaiYmd) {
        const age = ageDays(essaiYmd, todayYmd);
        return age !== null && age >= 2;
      }
      const age = ageDays(dateDemandeYmd(String(l.dateDemande || '')), todayYmd);
      return age !== null && age >= 3;
    });
    const relanceOld = agg.lines.some((l) => isRelanceStatut(String(l.statut || '')))
      && sinceRelance !== null
      && sinceRelance >= 7;
    if (!absent && !aVenirOld && !relanceOld) continue;

    const datedEssai = agg.lines
      .map((l) => essaiYmdFromCreneau(String(l.creneau || '')))
      .filter(Boolean)
      .sort();
    const demandes = agg.lines
      .map((l) => dateDemandeYmd(String(l.dateDemande || '')))
      .filter(Boolean)
      .sort();
    const essaiYmd = datedEssai[0] || demandes[0] || '';
    p2.push(
      cardFromAgg(agg, 'P2', 'C', adh, todayYmd, {
        cours: coursOf(id),
        dateRaw: essaiYmd,
      }),
    );
  }

  const byAgeThenName = (a: LiveRelanceCard, b: LiveRelanceCard) => {
    if (b.daysSince !== a.daysSince) return b.daysSince - a.daysSince;
    return fold(`${a.prenom} ${a.nom}`).localeCompare(fold(`${b.prenom} ${b.nom}`), 'fr');
  };

  p1.sort(byAgeThenName);
  p2.sort(byAgeThenName);
  skip.sort(byAgeThenName);

  return { p1, p2, skip, now };
}
