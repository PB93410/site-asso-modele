/**
 * /bureau — Mini back-office V1.1
 * Espace bureau de l’association
 *
 * Login → Accueil + Adhésions + Essais + Relances
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  AlertCircle,
  Phone,
  Shield,
  Clock,
  CalendarDays,
  Search,
  Home,
  MoreHorizontal,
  Mail,
  Calendar,
  CreditCard,
  MessageCircle,
} from 'lucide-react';
import BureauAide from '../components/BureauAide';
import { clearBureauToken, getBureauRole, getBureauToken, setBureauRole, setBureauToken } from '../components/BureauAuthGate';
import BureauAdhesionsTab from '../components/bureau/BureauAdhesionsTab';
import BureauCartesTab, { isAJourCarte } from '../components/bureau/BureauCartesTab';
import BureauEssaisTab from '../components/bureau/BureauEssaisTab';
import BureauPersonSheet from '../components/bureau/BureauPersonSheet';
import BureauRelancesTab from '../components/bureau/BureauRelancesTab';
import BureauTodayTab from '../components/bureau/BureauTodayTab';
import BureauSheetLinks from '../components/BureauSheetLinks';
import BureauSiteEditor from '../components/BureauSiteEditor';
import { useScheduleFromSheet } from '../hooks/useSheetData';
import { adherentEssaiKey, adhesionNeedsMoney, isAdherentAJourForEssai, isTestPrenom, matchesPerson, nationalFrTel, telDedupeKey } from '../lib/bureauSearch';
import { appendRelanceNote, classifyRelances, type LiveRelanceCard } from '../lib/bureauRelancesQueue';
import { buildPersonSheet, personSheetKey } from '../lib/personSheet';
import { isAVenir, isCountableEssai, isStrictAVenir } from '../lib/essaiStatuts';
import { essaiYmdFromCreneau } from '../lib/essaiDates';
import { countEssaisATraiter, essaisAPointer } from '../lib/essaisSemaine';
import { ASSO, MODULES, PAIEMENTS_BUREAU, PAIEMENT_NOM } from '../data/asso';

type AdhesionItem = {
  row: number;
  nom: string;
  prenom: string;
  tel: string;
  mail: string;
  mode: string;
  statut: string;
  montant: string;
  detail: string;
  datePaiement: string;
  source: string;
  notes: string;
  dateDemande: string;
  numero?: string;
  carte?: string;
};

type EssaiItem = {
  source: 'forum' | 'essai';
  row: number;
  prenom: string;
  nom: string;
  tel: string;
  cours: string;
  creneau: string;
  statut: string;
  nEssai: number;
  dateDemande: string;
  notes?: string;
  sourceLead?: string;
  essaiPrevu?: string;
  adhesionStand?: string;
  dateEssai?: string;
  numEssai?: string;
  present?: string;
  dateRelance?: string;
  adhesion?: string;
  modePaiement?: string;
  remarque?: string;
};

type TabId = 'today' | 'adhesions' | 'relances' | 'essais' | 'more';
type MoreKind = 'menu' | 'cartes' | 'planning' | 'events' | 'aide';
type EssaisVue = 'nouveaux' | 'week' | 'person';
type PorteId = 'seance' | 'admin';

const PORTE_KEY = 'asso-bureau-porte';

function readPorte(): PorteId | null {
  try {
    const v = sessionStorage.getItem(PORTE_KEY);
    if (v === 'seance' || v === 'admin') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function writePorte(porte: PorteId | null) {
  try {
    if (!porte) sessionStorage.removeItem(PORTE_KEY);
    else sessionStorage.setItem(PORTE_KEY, porte);
  } catch {
    /* ignore */
  }
}

const WEEK_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

function parisYmdNow() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function mondayYmd(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function dateDemandeYmd(raw: string) {
  const s = String(raw || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!fr) return '';
  const y = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
  return `${y}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
}

function looksLikeDateOnly(raw: string) {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) return true;
  return false;
}

/** Retire un préfixe JJ/MM/AAAA ou ISO collé devant le créneau. */
function stripLeadingDateToken(raw: string) {
  let s = String(raw || '').trim();
  s = s.replace(/^\d{4}-\d{2}-\d{2}(?:[T ][\d:]+)?\s*[·•\-|—–]?\s*/i, '');
  s = s.replace(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*[·•\-|—–]?\s*/i, '');
  s = s.replace(/^[—–\-·•|]+\s*/, '').trim();
  return s;
}

function essaiSlotLabel(item: EssaiItem) {
  const fromCreneau = stripLeadingDateToken(item.creneau || '');
  if (fromCreneau && !looksLikeDateOnly(fromCreneau)) return fromCreneau;
  const fromCours = stripLeadingDateToken(item.cours || '');
  if (fromCours && !looksLikeDateOnly(fromCours)) return fromCours;
  return 'Sans créneau';
}

function creneauDayIndex(creneau: string): number | null {
  const f = foldPerson(creneau);
  const i = WEEK_DAYS.findIndex((day) => f.includes(day));
  return i >= 0 ? i : null;
}

function countEssaisForTel(pool: EssaiItem[], tel: string) {
  const key = telDedupeKey(tel);
  if (!key) return 1;
  return pool.filter((i) => telDedupeKey(i.tel) === key && isCountableEssai(i.statut)).length;
}

function essaiDupKey(item: EssaiItem) {
  return `${telDedupeKey(item.tel)}|${foldPerson(item.creneau || item.cours)}|${dateDemandeYmd(item.dateDemande)}`;
}

function collapseEssaiDupes(items: EssaiItem[]) {
  const map = new Map<string, EssaiItem>();
  for (const item of items) {
    const key = essaiDupKey(item);
    const prev = map.get(key);
    if (!prev || item.row > prev.row) map.set(key, item);
  }
  return [...map.values()];
}

function weekdayIndexFromYmd(ymd: string): number | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

function essaiGroupDay(item: EssaiItem) {
  const essaiYmd = essaiYmdFromCreneau(item.creneau || '');
  if (essaiYmd) {
    const fromEssai = weekdayIndexFromYmd(essaiYmd);
    if (fromEssai != null) return fromEssai;
  }
  const fromSlot = creneauDayIndex(essaiSlotLabel(item));
  if (fromSlot != null) return fromSlot;
  const fromDate = weekdayIndexFromYmd(dateDemandeYmd(item.dateDemande));
  return fromDate ?? 7;
}

function personGroupKey(item: EssaiItem) {
  return telDedupeKey(item.tel) || `row-${item.source}-${item.row}`;
}

function parisDateFr() {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}/${get('month')}/${get('year')}`;
}

function foldPerson(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Doublon collé seulement : même NOM + PRENOM + TEL. Carte en ligne + chèque = 2 cartes. */
function collapseExactDupes(items: AdhesionItem[]) {
  const map = new Map<string, AdhesionItem>();
  for (const item of items) {
    const key = `${foldPerson(item.nom)}|${foldPerson(item.prenom)}|${nationalFrTel(item.tel)}`;
    const prev = map.get(key);
    if (!prev || item.row > prev.row) map.set(key, item);
  }
  return [...map.values()];
}

function sheetRangeUrl(base: string, row: number) {
  if (!base || !row) return '';
  const clean = base.split('#')[0];
  return `${clean}#gid=0&range=A${row}`;
}

function formatDemandeShort(raw: string) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!m) return s;
  const d = new Date(Number(m[3].length === 2 ? `20${m[3]}` : m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  if (Number.isNaN(d.getTime())) return s;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
  if (day === today) return 'aujourd’hui';
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const ymdY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(yest);
  if (day === ymdY) return 'hier';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function friendlyError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('accès réservé') || m.includes('acces reserve')) return msg;
  if (m.includes('401') || m.includes('non autorisé') || m.includes('token')) {
    return 'La session est terminée. Entrez à nouveau le mot de passe.';
  }
  if (m.includes('trop de')) return msg;
  if (m.includes('déjà changé') || m.includes('plus en attente')) {
    return 'Cette fiche a déjà changé. Appuyez sur Actualiser.';
  }
  if (m.includes('json') || m.includes('method')) {
    return 'Ça n’a pas marché. Réessayez.';
  }
  if (
    m.includes('sheet') ||
    m.includes('lecture') ||
    m.includes('écriture') ||
    m.includes('google') ||
    m.includes('impossible de charger') ||
    m.includes('registre')
  ) {
    return 'Le registre Google ne répond pas. Vérifiez Internet, puis Actualiser.';
  }
  return msg;
}

function normalizeFrPhone(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length < 9) return null;
  if (d.startsWith('33') && d.length >= 11) return d;
  if (d.startsWith('0') && d.length >= 10) return '33' + d.slice(1);
  if (d.length === 9) return '33' + d;
  return d;
}

function waUrl(tel: string, text: string): string | null {
  const n = normalizeFrPhone(tel);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

function msgRelancePaiement(prenom: string) {
  return `Bonjour ${prenom || ''},
${ASSO.nom} — votre demande d’adhésion est bien reçue.
On finalise dès réception du règlement (${PAIEMENTS_BUREAU})${ASSO.adhesion.paiementUrl ? ` ou carte sur ${PAIEMENT_NOM}` : ''}.
Dites-nous ce qui vous arrange.
À bientôt !`;
}

async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...rest, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || `Erreur ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

function PeopleSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <span className="sr-only">Rechercher prénom, nom ou téléphone</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher prénom, nom ou téléphone"
        autoComplete="off"
        className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-3 text-base"
      />
    </label>
  );
}

export default function BureauPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(() => getBureauToken());
  const [bureauRole, setBureauRoleState] = useState<'admin' | 'seance' | null>(() => getBureauRole());
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [porte, setPorte] = useState<PorteId | null>(() => {
    if (getBureauRole() === 'seance') {
      writePorte('seance');
      return 'seance';
    }
    const q = searchParams.get('porte');
    if (q === 'seance' || q === 'admin') {
      writePorte(q);
      return q;
    }
    return readPorte();
  });

  const [tab, setTab] = useState<TabId>(() => {
    if (getBureauRole() === 'seance') return 'essais';
    const tabQ = searchParams.get('tab');
    if (tabQ === 'more') return 'more';
    if (tabQ === 'adhesions') return 'adhesions';
    if (tabQ === 'essais') return 'essais';
    const q = searchParams.get('porte');
    const initialPorte = q === 'seance' || q === 'admin' ? q : readPorte();
    if (initialPorte === 'seance') return 'essais';
    if (initialPorte === 'admin') return 'today';
    return 'today';
  });
  const [moreKind, setMoreKind] = useState<MoreKind>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [adhesions, setAdhesions] = useState<AdhesionItem[]>([]);
  const [adhesionsAll, setAdhesionsAll] = useState<AdhesionItem[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [essaisData, setEssaisData] = useState<{
    aTraiter: EssaiItem[];
    autres: EssaiItem[];
    forum: EssaiItem[];
    essais: EssaiItem[];
    counts: { aTraiter: number; forum: number; essais: number; aVenir?: number };
    adherentsAJour: string[];
    adherentsAJourKeys: string[];
  } | null>(null);
  const [essaisVue, setEssaisVue] = useState<EssaisVue>('nouveaux');
  const [ntfyUrl, setNtfyUrl] = useState('');
  const [essaisSheetUrl, setEssaisSheetUrl] = useState('');
  const [adherentsSheetUrl, setAdherentsSheetUrl] = useState('');

  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [confirmPayItem, setConfirmPayItem] = useState<AdhesionItem | null>(null);
  const [personKey, setPersonKey] = useState<string | null>(null);

  const { schedule } = useScheduleFromSheet();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  function copyMessage(id: string, body: string) {
    navigator.clipboard.writeText(body).then(
      () => {
        setCopiedId(id);
        showToast('Texte copié — collez-le dans WhatsApp');
        setTimeout(() => setCopiedId(null), 2500);
      },
      () => showToast('Copie impossible. Sélectionnez le texte à la main.'),
    );
  }

  const logout = (opts?: { silent?: boolean }) => {
    if (!opts?.silent && !window.confirm('Quitter l’espace bureau ?')) return;
    clearBureauToken();
    setBureauRoleState(null);
    writePorte(null);
    setPorte(null);
    setToken(null);
    setAdhesions([]);
    setAdhesionsAll([]);
    setEssaisData(null);
    setPeopleQuery('');
  };

  function enterPorte(next: PorteId) {
    writePorte(next);
    setPorte(next);
    setPeopleQuery('');
    setMoreKind('menu');
    if (next === 'seance') {
      setTab('essais');
      setEssaisVue('nouveaux');
    } else {
      setTab('today');
    }
  }

  function backToPortes() {
    writePorte(null);
    setPorte(null);
    setPeopleQuery('');
    setMoreKind('menu');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const data = await api<{ token: string; role?: string }>('/api/bureau-auth', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      const nextRole = data.role === 'seance' ? 'seance' : 'admin';
      setBureauToken(data.token);
      setBureauRole(nextRole);
      setBureauRoleState(nextRole);
      if (nextRole === 'seance') {
        writePorte('seance');
        setPorte('seance');
        setTab('essais');
      } else {
        writePorte(null);
        setPorte(null);
      }
      setToken(data.token);
      setPassword('');
    } catch (err: unknown) {
      setLoginError(
        friendlyError(err instanceof Error ? err.message : 'Mot de passe incorrect'),
      );
    } finally {
      setLoggingIn(false);
    }
  }

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    const seance = bureauRole === 'seance';
    type EssPayload = {
      aTraiter: EssaiItem[];
      autres?: EssaiItem[];
      forum: EssaiItem[];
      essais: EssaiItem[];
      counts: { aTraiter: number; forum: number; essais: number; aVenir?: number };
      adherentsAJour?: string[];
      adherentsAJourKeys?: string[];
      ntfyUrl?: string;
      essaisSheetUrl?: string;
      adherentsSheetUrl?: string;
    };
    type AdhPayload = {
      items: AdhesionItem[];
      all?: AdhesionItem[];
      count: number;
      adherentsSheetUrl?: string;
    };
    try {
      const essPromise = api<EssPayload>('/api/essais-list', { token });
      const adhPromise = seance
        ? Promise.resolve(null)
        : api<AdhPayload>('/api/adhesions-pending', { token });
      const [ess, adh] = await Promise.all([essPromise, adhPromise]);
      if (adh) {
        setAdhesions(adh.items || []);
        setAdhesionsAll(adh.all || adh.items || []);
      } else {
        setAdhesions([]);
        setAdhesionsAll([]);
      }
      setEssaisData({
        aTraiter: ess.aTraiter || [],
        autres: ess.autres || [],
        forum: ess.forum || [],
        essais: ess.essais || [],
        counts: ess.counts || { aTraiter: 0, forum: 0, essais: 0 },
        adherentsAJour: ess.adherentsAJour || [],
        adherentsAJourKeys: ess.adherentsAJourKeys || [],
      });
      if (typeof ess.ntfyUrl === 'string') setNtfyUrl(ess.ntfyUrl);
      if (seance) {
        setEssaisSheetUrl('');
        setAdherentsSheetUrl('');
      } else {
        if (typeof ess.essaisSheetUrl === 'string') setEssaisSheetUrl(ess.essaisSheetUrl);
        const adhUrl = ess.adherentsSheetUrl || adh?.adherentsSheetUrl;
        if (typeof adhUrl === 'string') setAdherentsSheetUrl(adhUrl);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement';
      if (msg.includes('Accès réservé')) {
        setError(msg);
      } else if (msg.includes('Non autorisé') || msg.includes('401')) {
        logout({ silent: true });
        setLoginError('La session est terminée. Entrez à nouveau le mot de passe.');
      } else {
        setError(friendlyError(msg));
      }
    } finally {
      setLoading(false);
    }
  }, [token, bureauRole]);

  useEffect(() => {
    if (token) loadAll();
  }, [token, loadAll]);

  useEffect(() => {
    const hidden: Array<[HTMLElement, string | null]> = [];
    const hide = (node: Element | null) => {
      if (!node || !(node instanceof HTMLElement)) return;
      if (node.closest('[data-bureau-root]')) return;
      hidden.push([node, node.getAttribute('style')]);
      node.style.setProperty('display', 'none', 'important');
    };
    document.querySelectorAll('header, nav').forEach(hide);
    document.documentElement.classList.remove('has-campaign');
    return () => {
      hidden.forEach(([el, style]) => {
        if (style === null) el.removeAttribute('style');
        else el.setAttribute('style', style);
      });
    };
  }, []);

  async function validateAdhesion(item: AdhesionItem) {
    if (!token) return;
    const key = `adh-${item.row}`;
    setBusyRow(key);
    try {
      const data = await api<{ numero?: string }>('/api/adhesion-validate', {
        method: 'POST',
        token,
        body: JSON.stringify({
          row: item.row,
          tel: item.tel,
          statut: 'À jour',
          expectedStatut: item.statut,
        }),
      });
      setConfirmPayItem(null);
      const who = `${item.prenom || ''} ${item.nom || ''}`.trim();
      const numero = String(data.numero || '').trim();
      const paid = (row: AdhesionItem): AdhesionItem =>
        row.row === item.row
          ? {
              ...row,
              statut: 'À jour',
              ...(numero ? { numero } : {}),
              datePaiement: row.datePaiement || parisDateFr(),
            }
          : row;
      setAdhesions((prev) => prev.map(paid));
      setAdhesionsAll((prev) => prev.map(paid));
      const essaiKey = adherentEssaiKey(item.tel, item.prenom);
      if (essaiKey) {
        setEssaisData((prev) => {
          if (!prev || prev.adherentsAJourKeys.includes(essaiKey)) return prev;
          return { ...prev, adherentsAJourKeys: [...prev.adherentsAJourKeys, essaiKey] };
        });
      }
      showToast(numero ? `${who} → À jour · ${numero}` : `${who} → À jour`);
    } catch (err: unknown) {
      showToast(friendlyError(err instanceof Error ? err.message : 'Ça n’a pas marché.'));
    } finally {
      setBusyRow(null);
    }
  }

  function patchEssaiLocal(item: EssaiItem, patch: Partial<EssaiItem>) {
    setEssaisData((prev) => {
      if (!prev) return prev;
      const apply = (list: EssaiItem[]) =>
        list.map((e) =>
          e.source === item.source && e.row === item.row ? { ...e, ...patch } : e,
        );
      return {
        ...prev,
        essais: apply(prev.essais),
        aTraiter: apply(prev.aTraiter),
        autres: apply(prev.autres),
        forum: apply(prev.forum),
      };
    });
  }

  async function updateEssai(item: EssaiItem, newStatut: string, notes?: string) {
    if (!token) return;
    const key = `${item.source}-${item.row}`;
    const prevStatut = item.statut;
    const prevNotes = item.notes;
    const nextNotes = notes
      ? item.notes
        ? `${item.notes} | ${notes}`
        : notes
      : item.notes;
    setBusyRow(key);
    patchEssaiLocal(item, { statut: newStatut, ...(notes ? { notes: nextNotes } : {}) });
    try {
      await api('/api/essai-update', {
        method: 'POST',
        token,
        body: JSON.stringify({
          source: item.source,
          row: item.row,
          tel: item.tel,
          statut: newStatut,
          ...(notes ? { notes } : {}),
        }),
      });
      showToast(`${item.prenom} : ${newStatut}`);
    } catch (err: unknown) {
      patchEssaiLocal(item, { statut: prevStatut, notes: prevNotes });
      showToast(friendlyError(err instanceof Error ? err.message : 'Ça n’a pas marché.'));
    } finally {
      setBusyRow(null);
    }
  }

  /** WA confirmation (Nouveaux) : Confirmé en optimiste, rollback si l’API échoue. */
  function patchEssaiStatutLocal(item: EssaiItem, statut: string) {
    setEssaisData((prev) => {
      if (!prev) return prev;
      const patch = (list: EssaiItem[]) =>
        list.map((e) =>
          e.source === item.source && e.row === item.row ? { ...e, statut } : e,
        );
      return {
        ...prev,
        essais: patch(prev.essais),
        aTraiter: patch(prev.aTraiter),
        autres: patch(prev.autres),
      };
    });
  }

  async function relanceEssaiViaWhatsApp(item: EssaiItem) {
    if (!token || !isStrictAVenir(item.statut)) return;
    const prevStatut = item.statut || 'À venir';
    patchEssaiStatutLocal(item, 'Confirmé');
    try {
      await api('/api/essai-update', {
        method: 'POST',
        token,
        body: JSON.stringify({
          source: 'essai',
          row: item.row,
          tel: item.tel,
          statut: 'Confirmé',
        }),
      });
    } catch (err: unknown) {
      patchEssaiStatutLocal({ ...item, statut: 'Confirmé' }, prevStatut);
      showToast(friendlyError(err instanceof Error ? err.message : 'Relance non enregistrée.'));
    }
  }

  function noteRelanceSent(card: LiveRelanceCard) {
    setEssaisData((prev) => {
      if (!prev) return prev;
      const apply = (list: EssaiItem[]) =>
        list.map((e) => {
          if (e.row !== card.row || e.source !== 'essai') return e;
          return {
            ...e,
            statut: e.statut === 'Venu' ? e.statut : 'Relancé',
            notes: appendRelanceNote(e.notes, card.message),
          };
        });
      return {
        ...prev,
        essais: apply(prev.essais),
        aTraiter: apply(prev.aTraiter),
        autres: apply(prev.autres),
        forum: apply(prev.forum),
      };
    });
  }

  function openPerson(tel: string, prenom: string) {
    const key = personSheetKey(tel, prenom);
    if (key) setPersonKey(key);
  }

  const relanceEssais = useMemo(() => essaisData?.essais ?? [], [essaisData?.essais]);
  const personSheet = useMemo(
    () => (personKey ? buildPersonSheet(personKey, essaisData?.essais || [], adhesionsAll) : null),
    [personKey, essaisData?.essais, adhesionsAll],
  );

  if (!token) {
    return (
      <div data-bureau-root className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-black/10 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-slate-900">Espace Bureau</h1>
              <p className="text-sm text-slate-500">{ASSO.nom}</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Espace réservé au bureau et aux bénévoles de séance. Tapez le mot de passe, puis
              choisissez Ce soir ou Bureau. Le mode d’emploi est dans Autre → Aide (côté bureau).
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Mot de passe du bureau
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Le mot de passe que vous a donné le bureau"
              />
            </div>
            {loginError && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loggingIn || !password}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3.5 text-base min-h-[48px]"
            >
              {loggingIn ? 'Ouverture…' : 'Entrer'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pendingList = collapseExactDupes(
    adhesions.filter((i) => adhesionNeedsMoney(i.statut) && !isTestPrenom(i.prenom, i.nom)),
  );
  const pendingCount = pendingList.length;
  const relanceQueue = classifyRelances(
    relanceEssais,
    adhesionsAll,
    essaisData?.adherentsAJour || [],
  );
  const relanceP1 = relanceQueue.p1.length;
  const relanceP2 = relanceQueue.p2.length;
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const showSearch =
    (porte === 'seance' && tab === 'essais') ||
    (porte === 'admin' &&
      (tab === 'today' ||
        tab === 'adhesions' ||
        tab === 'essais' ||
        (tab === 'more' && moreKind === 'cartes')));
  const qPeople = peopleQuery.trim();
  const pendingVisible = qPeople
    ? pendingList.filter((i) => matchesPerson(qPeople, i))
    : pendingList;
  const adhesionList = collapseExactDupes(
    (qPeople ? adhesionsAll.filter((i) => matchesPerson(qPeople, i)) : adhesionsAll).filter(
      (i) => !isTestPrenom(i.prenom, i.nom),
    ),
  );
  const cartesList = collapseExactDupes(
    adhesionsAll.filter((i) => {
      if (isTestPrenom(i.prenom, i.nom)) return false;
      if (!isAJourCarte(i.statut)) return false;
      if (qPeople && !matchesPerson(qPeople, i)) return false;
      return true;
    }),
  ).sort((a, b) => {
    const ac = String(a.carte || '').trim() ? 1 : 0;
    const bc = String(b.carte || '').trim() ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr', { sensitivity: 'base' });
  });
  const essaiPool = collapseEssaiDupes(essaisData?.essais || []);
  const adherentsAJour = new Set(essaisData?.adherentsAJour || []);
  const aJourEssaiKeys = new Set(essaisData?.adherentsAJourKeys || []);
  const suiviPool = essaiPool.filter((item) => !isAdherentAJourForEssai(item, aJourEssaiKeys));
  const todayYmd = parisYmdNow();
  const weekMonday = mondayYmd(todayYmd);
  const weekSunday = addDaysYmd(weekMonday, 6);
  const aPointer = essaisAPointer(suiviPool, todayYmd);
  const pointerKeys = new Set(aPointer.map((item) => `${item.source}-${item.row}`));
  // Badge : À venir / Confirmé encore à venir + À pointer (pas au-delà de 30 jours).
  const essaisATraiter = countEssaisATraiter(suiviPool, todayYmd);
  // Daté : visible si l’essai tombe cette semaine. Sans date : règle précédente.
  // « À pointer » est affiché à part, pas une seconde fois dans le jour.
  const weekEssais = suiviPool
    .filter((item) => {
      if (pointerKeys.has(`${item.source}-${item.row}`)) return false;
      const essaiYmd = essaiYmdFromCreneau(item.creneau || '');
      if (essaiYmd) return essaiYmd >= weekMonday && essaiYmd <= weekSunday;
      if (isAVenir(item.statut)) return true;
      const ymd = dateDemandeYmd(item.dateDemande);
      return Boolean(ymd && ymd >= weekMonday && ymd <= weekSunday);
    })
    .sort((a, b) => {
      const da = essaiGroupDay(a) - essaiGroupDay(b);
      if (da !== 0) return da;
      const ca = foldPerson(essaiSlotLabel(a)).localeCompare(foldPerson(essaiSlotLabel(b)), 'fr');
      if (ca !== 0) return ca;
      return foldPerson(`${a.prenom} ${a.nom}`).localeCompare(foldPerson(`${b.prenom} ${b.nom}`), 'fr');
    });
  const nouveauxEssais = suiviPool
    .filter((item) => isStrictAVenir(item.statut))
    .sort((a, b) => {
      const byDate = dateDemandeYmd(b.dateDemande).localeCompare(dateDemandeYmd(a.dateDemande));
      if (byDate !== 0) return byDate;
      return b.row - a.row;
    });
  const weekDayGroups: { day: number; label: string; slots: { slot: string; items: EssaiItem[] }[] }[] = [];
  for (const item of weekEssais) {
    const day = essaiGroupDay(item);
    const slot = essaiSlotLabel(item);
    let dayGroup = weekDayGroups.find((g) => g.day === day);
    if (!dayGroup) {
      dayGroup = {
        day,
        label: day === 7 ? 'Sans jour' : WEEK_DAYS[day].charAt(0).toUpperCase() + WEEK_DAYS[day].slice(1),
        slots: [],
      };
      weekDayGroups.push(dayGroup);
    }
    let slotGroup = dayGroup.slots.find((s) => foldPerson(s.slot) === foldPerson(slot));
    if (!slotGroup) {
      slotGroup = { slot, items: [] };
      dayGroup.slots.push(slotGroup);
    }
    slotGroup.items.push(item);
  }
  const personGroups = (() => {
    const map = new Map<string, EssaiItem[]>();
    for (const item of essaiPool) {
      const k = personGroupKey(item);
      const list = map.get(k) || [];
      list.push(item);
      map.set(k, list);
    }
    return [...map.entries()]
      .map(([key, items]) => {
        const sorted = [...items].sort((a, b) =>
          dateDemandeYmd(b.dateDemande).localeCompare(dateDemandeYmd(a.dateDemande)),
        );
        const head = sorted[0];
        const nCount = countEssaisForTel(essaiPool, head.tel);
        const telKey = telDedupeKey(head.tel);
        return {
          key,
          items: sorted,
          head,
          nMax: nCount,
          isAdherent: Boolean(telKey && adherentsAJour.has(telKey)),
        };
      })
      .sort((a, b) =>
        foldPerson(`${a.head.prenom} ${a.head.nom}`).localeCompare(
          foldPerson(`${b.head.prenom} ${b.head.nom}`),
          'fr',
        ),
      );
  })();
  const essaiSearchHits = qPeople ? essaiPool.filter((i) => matchesPerson(qPeople, i)) : [];
  const adhesionHitsOnEssai = qPeople
    ? adhesionsAll.filter((i) => matchesPerson(qPeople, i)).length
    : 0;

  if (!porte) {
    return (
      <div data-bureau-root className="min-h-screen bg-brand-cream pb-8">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/10">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
            <h1 className="font-display font-bold text-lg text-brand-black leading-tight">Bureau</h1>
            <button
              type="button"
              onClick={() => logout()}
              className="px-3 py-2 rounded-xl border border-black/10 text-slate-700 text-sm font-medium min-h-[48px]"
            >
              Quitter
            </button>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <div>
            <h2 className="font-display font-bold text-xl text-brand-black">Où travaillez-vous ?</h2>
            <p className="text-sm text-slate-600 mt-1">Deux portes. Choisissez une fois, vous pourrez revenir.</p>
          </div>
          {error ? (
            <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => enterPorte('seance')}
            className="w-full text-left rounded-2xl bg-brand-olive text-white p-5 min-h-[48px] shadow-sm"
          >
            <p className="font-display font-bold text-xl leading-tight">Ce soir — essais</p>
            <p className="text-base text-white/90 mt-2 leading-snug">
              Présents, WhatsApp, nouveaux essais.
            </p>
            {essaisATraiter > 0 ? (
              <p className="text-sm text-white/80 mt-3">{essaisATraiter} à suivre</p>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => enterPorte('admin')}
            className="w-full text-left rounded-2xl bg-white border border-black/10 p-5 min-h-[48px]"
          >
            <p className="font-display font-bold text-xl text-brand-black leading-tight">Bureau — admin</p>
            <p className="text-base text-slate-600 mt-2 leading-snug">
              À encaisser, adhérents, mails.
            </p>
            {pendingCount > 0 ? (
              <p className="text-sm text-brand-olive mt-3 font-medium">{pendingCount} à encaisser</p>
            ) : null}
          </button>
        </main>
      </div>
    );
  }

  const navItems =
    porte === 'seance'
      ? [{ id: 'essais' as const, label: 'Essais', icon: Phone, count: essaisATraiter }]
      : [
          { id: 'today' as const, label: 'Accueil', icon: Home, count: 0 },
          { id: 'adhesions' as const, label: 'À payer', icon: Users, count: pendingCount },
          { id: 'relances' as const, label: 'Relances', icon: MessageCircle, count: relanceP1 + relanceP2 },
          { id: 'more' as const, label: 'Autre', icon: MoreHorizontal, count: 0 },
        ];

  return (
    <div data-bureau-root className="min-h-screen bg-brand-cream pb-24">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/10">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg text-brand-black leading-tight truncate">
              {porte === 'seance' ? 'Ce soir — essais' : 'Bureau — admin'}
            </h1>
            {bureauRole !== 'seance' ? (
            <button
              type="button"
              onClick={backToPortes}
              className="text-xs font-medium text-brand-olive underline underline-offset-2 mt-0.5"
            >
              Changer de porte
            </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {porte === 'admin' && MODULES.mail ? (
              <Link
                to="/bureau/mail?filter=adhesions"
                className="px-3 py-2 rounded-xl border border-black/10 text-slate-700 text-sm font-medium min-h-[40px] inline-flex items-center gap-1"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Mail
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => loadAll()}
              disabled={loading}
              className="px-3 py-2 rounded-xl border border-black/10 text-slate-700 text-sm font-medium min-h-[40px]"
            >
              {loading ? '…' : 'Actualiser'}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="px-3 py-2 rounded-xl border border-black/10 text-slate-700 text-sm font-medium min-h-[40px]"
            >
              Quitter
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-2 flex gap-1 pb-2">
          {navItems.map(({ id, label, icon: Icon, count }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  if (id === 'more') setMoreKind('menu');
                }}
                className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[12px] font-semibold leading-tight min-h-[48px] ${
                  active ? 'bg-brand-olive text-white' : 'text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
                {count > 0 ? (
                  <span
                    className={`absolute top-0.5 right-0.5 min-w-[1.15rem] h-4 px-1 rounded-full text-[10px] leading-4 ${
                      active ? 'bg-white text-brand-olive' : 'bg-orange-primary text-white'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {showSearch ? (
          <div className="max-w-3xl mx-auto px-4 pb-2">
            <PeopleSearch value={peopleQuery} onChange={setPeopleQuery} />
          </div>
        ) : null}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        {error && (
          <div className="mb-4 flex items-start gap-2 text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ---- ACCUEIL (admin) ---- */}
        {tab === 'today' && porte === 'admin' && (
          <BureauTodayTab
            todayLabel={todayLabel}
            qPeople={qPeople}
            loading={loading}
            adhesionList={adhesionList}
            aPointer={aPointer.length}
            aConfirmer={nouveauxEssais.length}
            aEncaisser={pendingCount}
            relanceP1={relanceP1}
            relanceP2={relanceP2}
            onPointer={() => {
              setEssaisVue('week');
              setTab('essais');
            }}
            onConfirmer={() => {
              setEssaisVue('nouveaux');
              setTab('essais');
            }}
            onEncaisser={() => setTab('adhesions')}
            onRelances={() => setTab('relances')}
            onOpenPerson={openPerson}
          />
        )}

        {tab === 'relances' && porte === 'admin' && (
          <BureauRelancesTab
            essais={relanceEssais}
            adhesions={adhesionsAll}
            adherentsAJour={essaisData?.adherentsAJour || []}
            essaisSheetUrl={essaisSheetUrl}
            loading={loading}
            ready={Boolean(essaisData)}
            reload={() => loadAll()}
            onMarked={noteRelanceSent}
            onOpenPerson={openPerson}
            embedded
          />
        )}

        {/* ---- ADHÉSIONS ---- */}
        {tab === 'adhesions' && porte === 'admin' && (
          <BureauAdhesionsTab
            pendingVisible={pendingVisible}
            loading={loading}
            qPeople={qPeople}
            busyRow={busyRow}
            adherentsSheetUrl={adherentsSheetUrl}
            onAskPay={(item) => {
              setError('');
              setConfirmPayItem(item);
            }}
            waUrl={waUrl}
            msgRelancePaiement={msgRelancePaiement}
            sheetRangeUrl={sheetRangeUrl}
            formatDemandeShort={formatDemandeShort}
            onOpenPerson={openPerson}
          />
        )}

        {/* ---- ESSAIS ---- */}
        {tab === 'essais' && (porte === 'seance' || porte === 'admin') && (
          <BureauEssaisTab
            porte={porte}
            essaisVue={essaisVue}
            setEssaisVue={setEssaisVue}
            onBackAutre={() => {
              setTab('more');
              setMoreKind('menu');
            }}
            onOpenAdhesions={() => setTab('adhesions')}
            qPeople={qPeople}
            loading={loading}
            busyRow={busyRow}
            adhesionHitsOnEssai={adhesionHitsOnEssai}
            essaiSearchHits={essaiSearchHits}
            nouveauxEssais={nouveauxEssais}
            aPointer={aPointer}
            weekDayGroups={weekDayGroups}
            personGroups={personGroups}
            essaiPool={essaiPool}
            adherentsAJour={adherentsAJour}
            schedule={schedule}
            updateEssai={updateEssai}
            relanceEssaiViaWhatsApp={relanceEssaiViaWhatsApp}
            hideCloreAdherent={bureauRole === 'seance'}
            onOpenPerson={openPerson}
          />
        )}

        {tab === 'more' && moreKind === 'menu' && porte === 'admin' && (
          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg">Autre</h2>
            <p className="text-sm text-slate-600">
              Horaires du site, événements, mode d’emploi, tableaux, mail et agenda.
            </p>
            <BureauSheetLinks
              essaisUrl={essaisSheetUrl}
              adherentsUrl={adherentsSheetUrl}
              variant="card"
            />
            <button
              type="button"
              onClick={() => {
                setTab('essais');
                setEssaisVue('nouveaux');
              }}
              className="w-full flex items-center gap-3 rounded-2xl bg-white border border-black/10 p-4 text-left min-h-[56px]"
            >
              <Phone className="w-5 h-5 text-brand-olive shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-semibold text-brand-black">Essais</span>
                <span className="block text-sm text-slate-500">Nouveaux, semaine, par personne</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMoreKind('cartes')}
              className="w-full flex items-center gap-3 rounded-2xl bg-white border border-black/10 p-4 text-left min-h-[56px]"
            >
              <CreditCard className="w-5 h-5 text-brand-olive shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-semibold text-brand-black">Cartes adhérents</span>
                <span className="block text-sm text-slate-500">
                  Envoyer la carte WhatsApp, une personne à la fois
                  {cartesList.length > 0
                    ? ` · ${cartesList.filter((i) => !String(i.carte || '').trim()).length} à préparer`
                    : ''}
                </span>
              </span>
            </button>
            <Link
              to="/bureau/agenda"
              className="w-full flex items-center gap-3 rounded-2xl bg-white border border-black/10 p-4 text-left min-h-[56px]"
            >
              <Calendar className="w-5 h-5 text-orange-primary shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-semibold text-brand-black">Agenda</span>
                <span className="block text-sm text-slate-500">
                  Agenda unique du bureau, aussi sur les téléphones
                </span>
              </span>
            </Link>
            {MODULES.mail ? (
              <>
              <Link
                to="/bureau/mail?filter=adhesions"
                className="w-full flex items-center gap-3 rounded-2xl bg-white border border-black/10 p-4 text-left min-h-[56px]"
              >
                <Mail className="w-5 h-5 text-orange-primary shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-brand-black">Mail</span>
                  <span className="block text-sm text-slate-500">
                    Adhésions et paiements en ligne (pas les relevés d’essai)
                  </span>
                </span>
              </Link>
              <Link
                to="/bureau/connexion-google"
                className="w-full flex items-center gap-3 rounded-2xl bg-white border border-dashed border-black/15 p-4 text-left min-h-[56px]"
              >
                <Shield className="w-5 h-5 text-brand-gray shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-brand-black">Connecter Google</span>
                  <span className="block text-sm text-slate-500">
                    Référent — une fois, seulement si la boîte est Gmail
                  </span>
                </span>
              </Link>
              </>
            ) : null}
            {[
              { id: 'planning' as const, label: 'Horaires', hint: 'Ce que voit le site', icon: Clock },
              { id: 'events' as const, label: 'Événements', hint: 'Affichés sur le site', icon: CalendarDays },
              { id: 'aide' as const, label: 'Aide', hint: 'Mode d’emploi, QR, textes', icon: Shield },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMoreKind(item.id);
                }}
                className="w-full flex items-center gap-3 rounded-2xl bg-white border border-black/10 p-4 text-left min-h-[56px]"
              >
                <item.icon className="w-5 h-5 text-brand-olive shrink-0" />
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="block text-sm text-slate-500">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === 'more' && moreKind === 'cartes' && porte === 'admin' && (
          <BureauCartesTab
            items={cartesList.map((i) => ({
              row: i.row,
              nom: i.nom,
              prenom: i.prenom,
              tel: i.tel,
              numero: String(i.numero || '').trim(),
              mail: String(i.mail || '').trim(),
              statut: i.statut,
              carte: String(i.carte || '').trim(),
            }))}
            loading={loading}
            qPeople={qPeople}
            onBack={() => setMoreKind('menu')}
            token={token}
            onMarquer={async (row) => {
              const tel = cartesList.find((i) => i.row === row)?.tel || '';
              const data = await api<{ carte?: string }>('/api/carte-marquer', {
                method: 'POST',
                token,
                body: JSON.stringify({ row, tel }),
              });
              const carte = String(data.carte || '').trim();
              if (carte) {
                setAdhesionsAll((prev) => prev.map((i) => (i.row === row ? { ...i, carte } : i)));
              }
              return carte;
            }}
            onEnvoyerMail={async (row, renvoyer) => {
              const tel = cartesList.find((i) => i.row === row)?.tel || '';
              const data = await api<{ carte?: string; suivi?: boolean }>('/api/carte-mail', {
                method: 'POST',
                token,
                body: JSON.stringify({ row, tel, renvoyer }),
              });
              const carte = String(data.carte || '').trim();
              if (carte) {
                setAdhesionsAll((prev) => prev.map((i) => (i.row === row ? { ...i, carte } : i)));
              }
              return { carte, suivi: data.suivi === true };
            }}
          />
        )}

        {tab === 'more' && moreKind === 'planning' && token && porte === 'admin' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMoreKind('menu')}
              className="text-sm font-semibold text-brand-olive"
            >
              ← Autre
            </button>
            <BureauSiteEditor kind="planning" token={token} onToast={showToast} />
          </div>
        )}

        {tab === 'more' && moreKind === 'events' && token && porte === 'admin' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMoreKind('menu')}
              className="text-sm font-semibold text-brand-olive"
            >
              ← Autre
            </button>
            <BureauSiteEditor kind="events" token={token} onToast={showToast} />
          </div>
        )}

        {tab === 'more' && moreKind === 'aide' && token && porte === 'admin' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMoreKind('menu')}
              className="text-sm font-semibold text-brand-olive"
            >
              ← Autre
            </button>
            <BureauAide
              ntfyUrl={ntfyUrl}
              essaisSheetUrl={essaisSheetUrl}
              adherentsSheetUrl={adherentsSheetUrl}
              copiedId={copiedId}
              copyMessage={copyMessage}
            />
          </div>
        )}
      </main>

      {personSheet ? (
        <BureauPersonSheet
          sheet={personSheet}
          seance={porte === 'seance'}
          busy={
            personSheet.essais.some((essai) => busyRow === `${essai.source}-${essai.row}`) ||
            busyRow === `adh-${personSheet.adherent?.row}`
          }
          schedule={schedule}
          essaisSheetUrl={essaisSheetUrl}
          adherentsSheetUrl={adherentsSheetUrl}
          onClose={() => setPersonKey(null)}
          onVenu={(essai) => void updateEssai(essai, 'Venu')}
          onAbsent={(essai) => void updateEssai(essai, 'Absent')}
          onClore={(essai, statut, notes) => void updateEssai(essai, statut, notes)}
          onPaid={(item) => {
            setError('');
            setConfirmPayItem(item);
          }}
          onWhatsAppConfirm={relanceEssaiViaWhatsApp}
        />
      ) : null}

      {confirmPayItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-mark-title"
            className="w-full max-w-sm rounded-2xl bg-white border border-[#E8E6E1] p-4 space-y-4"
          >
            <p id="pay-mark-title" className="font-semibold text-base text-brand-black leading-snug">
              Passer {confirmPayItem.nom} {confirmPayItem.prenom} à jour sur la feuille Adhérents ?
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busyRow === `adh-${confirmPayItem.row}`}
                onClick={() => setConfirmPayItem(null)}
                className="flex-1 h-11 min-h-[44px] px-3 rounded-xl border border-[#E8E6E1] bg-white font-semibold text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busyRow === `adh-${confirmPayItem.row}`}
                onClick={() => void validateAdhesion(confirmPayItem)}
                className="flex-1 h-11 min-h-[44px] px-3 rounded-xl bg-orange-primary text-white font-semibold text-sm disabled:opacity-60"
              >
                {busyRow === `adh-${confirmPayItem.row}` ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-3 text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
