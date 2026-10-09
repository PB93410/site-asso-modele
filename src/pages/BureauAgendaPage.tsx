/**
 * /bureau/agenda — un agenda asso (Calendar API via Netlify)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import BureauAuthGate, { BureauSeanceReserve, getBureauToken } from '../components/BureauAuthGate';
import { bureauFetch } from '../lib/bureauApi';
import { ASSO } from '../data/asso';

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

type FormState = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

type AgendaFilter = 'ponctuel' | 'cours' | 'tout';
type EventBadge = 'Cours' | 'Bureau' | 'Club';

const TZ = 'Europe/Paris';
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const BUREAU_RE =
  /\b(ag|a\.g\.|assemblée|assemblee|réunion|reunion|bureau|conseil|ca)\b/i;
/** Ligne « Planning <nom> » écrite par scripts/sync-gmail-calendar.mjs. */
const PLANNING_LINE_RE = new RegExp(`planning\\s+${escRe(ASSO.nom).replace(/\s+/g, '\\s+')}`, 'i');

const emptyForm = (date: string): FormState => ({
  title: '',
  date,
  startTime: '10:00',
  endTime: '11:00',
  location: '',
  notes: '',
});

function parisParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    y: Number(get('year')),
    m: Number(get('month')) - 1,
    d: Number(get('day')),
  };
}

function ymdFromParts(y: number, monthIndex: number, day: number) {
  return `${y}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function ymdParis(d = new Date()) {
  const p = parisParts(d);
  return ymdFromParts(p.y, p.m, p.d);
}

function monthBounds(year: number, monthIndex: number) {
  const from = ymdFromParts(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const to = ymdFromParts(year, monthIndex, last);
  return { from, to };
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function maxYmd(a: string, b: string) {
  return a >= b ? a : b;
}

function formatDayLong(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatLocation(loc: string) {
  return String(loc || '')
    .replace(new RegExp(`,?\\s*${escRe(ASSO.ville)}\\s*$`, 'i'), '')
    .replace(/\s*,\s*,/g, ',')
    .trim();
}

function formatHm(t: string) {
  if (!/^\d{2}:\d{2}$/.test(t)) return t;
  const [h, m] = t.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

function displayTitle(title: string) {
  return String(title || '')
    .replace(/^cours\s*[·•\-–—]\s*/i, '')
    .trim();
}

function isCourseEvent(ev: AgendaEvent) {
  const title = ev.title || '';
  const notes = ev.notes || '';
  return (
    /^cours\b/i.test(title) ||
    (/^cours/i.test(title) && title.includes('·')) ||
    PLANNING_LINE_RE.test(notes)
  );
}

function eventBadge(ev: AgendaEvent): EventBadge {
  if (isCourseEvent(ev)) return 'Cours';
  const hay = `${ev.title} ${ev.notes}`;
  if (BUREAU_RE.test(hay)) return 'Bureau';
  return 'Club';
}

function visibleNotes(notes: string) {
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !PLANNING_LINE_RE.test(line))
    .join('\n')
    .trim();
}

function matchesFilter(ev: AgendaEvent, filter: AgendaFilter) {
  const course = isCourseEvent(ev);
  if (filter === 'cours') return course;
  if (filter === 'ponctuel') return !course;
  return true;
}

export default function BureauAgendaPage() {
  const [today, setToday] = useState(() => ymdParis());
  const [cursor, setCursor] = useState(() => {
    const n = parisParts();
    return { y: n.y, m: n.m };
  });
  const [selectedDate, setSelectedDate] = useState(() => ymdParis());
  const [filter, setFilter] = useState<AgendaFilter>('ponctuel');
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(today));
  const [saving, setSaving] = useState(false);
  const initDone = useRef(false);

  const load = useCallback(async () => {
    const { from, to: monthTo } = monthBounds(cursor.y, cursor.m);
    const horizon = addDaysYmd(today, 120);
    const to = maxYmd(monthTo, horizon);
    const data = await bureauFetch<{ events: AgendaEvent[] }>(
      `/api/bureau/agenda?from=${from}&to=${to}`,
    );
    setEvents(data.events || []);
  }, [cursor.y, cursor.m, today]);

  useEffect(() => {
    const t = ymdParis();
    const p = parisParts();
    setToday(t);
    setSelectedDate(t);
    setFilter('ponctuel');
    setCursor({ y: p.y, m: p.m });
  }, []);

  useEffect(() => {
    if (initDone.current || loading) return;
    const t = ymdParis();
    setToday(t);
    setFilter('ponctuel');
    setSelectedDate(t);
    initDone.current = true;
  }, [loading]);

  useEffect(() => {
    if (!getBureauToken()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const daysInMonth = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const count = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= count; d++) {
      cells.push(ymdFromParts(cursor.y, cursor.m, d));
    }
    return cells;
  }, [cursor.y, cursor.m]);

  const filteredEvents = useMemo(
    () => events.filter((ev) => matchesFilter(ev, filter)),
    [events, filter],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [filteredEvents]);

  const dotsByDate = useMemo(() => {
    const map = new Map<string, { ponctuel: boolean; cours: boolean }>();
    const source = filter === 'tout' ? events : filteredEvents;
    for (const ev of source) {
      const cur = map.get(ev.date) || { ponctuel: false, cours: false };
      if (isCourseEvent(ev)) cur.cours = true;
      else cur.ponctuel = true;
      map.set(ev.date, cur);
    }
    if (filter === 'ponctuel') {
      for (const [date, flags] of map) {
        map.set(date, { ponctuel: flags.ponctuel, cours: false });
      }
    } else if (filter === 'cours') {
      for (const [date, flags] of map) {
        map.set(date, { ponctuel: false, cours: flags.cours });
      }
    }
    return map;
  }, [events, filteredEvents, filter]);

  const dayEvents = eventsByDate.get(selectedDate) || [];

  const upcomingPonctuel = useMemo(() => {
    if (filter !== 'ponctuel') return [];
    return events
      .filter((ev) => !isCourseEvent(ev) && ev.date >= today && ev.date !== selectedDate)
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
      .slice(0, 3);
  }, [events, filter, today, selectedDate]);

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(selectedDate));
    setFormOpen(true);
  }

  function openEdit(ev: AgendaEvent) {
    setEditing(ev);
    setForm({
      title: ev.title,
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: ev.location || '',
      notes: ev.notes || '',
    });
    setFormOpen(true);
  }

  async function saveForm() {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await bureauFetch(`/api/bureau/agenda/${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
      } else {
        await bureauFetch('/api/bureau/agenda', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(ev: AgendaEvent) {
    if (!window.confirm('Supprimer cet événement ?')) return;
    setError('');
    try {
      await bureauFetch(`/api/bureau/agenda/${encodeURIComponent(ev.id)}`, {
        method: 'DELETE',
      });
      if (editing?.id === ev.id) {
        setFormOpen(false);
        setEditing(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  }

  const fieldClass =
    'w-full rounded-xl border border-brand-gray-light bg-white px-4 py-3 text-base min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange-primary';

  const filters: { id: AgendaFilter; label: string }[] = [
    { id: 'ponctuel', label: 'Ponctuel' },
    { id: 'cours', label: 'Cours' },
    { id: 'tout', label: 'Tout' },
  ];

  return (
    <BureauAuthGate title="Bureau" subtitle="Agenda unique du bureau">
      <BureauSeanceReserve>
      <div className="min-h-screen bg-brand-cream text-brand-black">
        <header className="sticky top-0 z-10 border-b border-brand-gray-light bg-brand-cream/95">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Link
              to="/bureau?tab=more"
              className="text-sm font-semibold text-orange-primary min-h-[44px] inline-flex items-center"
            >
              ← Autre
            </Link>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-orange-primary text-white font-semibold text-sm"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Nouvel événement
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl">Agenda</h1>
              <p className="text-sm text-brand-gray">Cours et dates du club · heure de Paris</p>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 space-y-2" role="alert">
              <p>{error}</p>
              {/GOOGLE_REFRESH_TOKEN|connecter|expir/i.test(error) ? (
                <Link to="/bureau/connexion-google" className="font-semibold underline text-orange-primary">
                  Connecter le compte asso
                </Link>
              ) : null}
            </div>
          ) : null}

          <div
            role="tablist"
            aria-label="Filtrer l’agenda"
            className="flex gap-2"
          >
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.id)}
                  className={`h-10 min-h-[40px] flex-1 basis-0 min-w-0 rounded-full text-sm font-semibold border ${
                    active
                      ? 'bg-orange-primary text-white border-orange-primary'
                      : 'bg-white text-brand-gray border-brand-gray-light'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <section className="rounded-2xl bg-white border border-brand-gray-light p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-brand-gray-light"
                aria-label="Mois précédent"
                onClick={() =>
                  setCursor((c) => {
                    const d = new Date(c.y, c.m - 1, 1);
                    return { y: d.getFullYear(), m: d.getMonth() };
                  })
                }
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="font-display font-bold text-lg capitalize">{monthLabel}</h2>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-brand-gray-light"
                aria-label="Mois suivant"
                onClick={() =>
                  setCursor((c) => {
                    const d = new Date(c.y, c.m + 1, 1);
                    return { y: d.getFullYear(), m: d.getMonth() };
                  })
                }
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-brand-gray mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: Math.ceil(daysInMonth.length / 7) }, (_, week) => {
                const slice = daysInMonth.slice(week * 7, week * 7 + 7);
                const isCurrentWeek = slice.includes(today);
                return (
                  <div
                    key={`w-${week}`}
                    className={`grid grid-cols-7 gap-0.5 rounded-xl px-1 py-1 ${
                      isCurrentWeek ? 'bg-[#F3EEE6]' : ''
                    }`}
                  >
                    {slice.map((day, i) => {
                      const idx = week * 7 + i;
                      if (!day) return <div key={`e-${idx}`} className="min-h-[44px]" />;
                      const selected = day === selectedDate;
                      const isToday = day === today;
                      const dots = dotsByDate.get(day);
                      const showPonctuel = Boolean(dots?.ponctuel);
                      const showCours = Boolean(dots?.cours);
                      let cell =
                        'min-h-[44px] min-w-0 w-full rounded-xl text-sm font-semibold border-2 px-0.5 py-1 flex flex-col items-center justify-center';
                      if (selected) {
                        cell += ' bg-orange-primary text-white border-orange-primary';
                      } else if (isToday) {
                        cell += ' bg-orange-light text-orange-primary border-transparent';
                      } else if (showCours) {
                        cell += ' bg-[rgba(92,107,74,0.12)] text-brand-black border-transparent';
                      } else {
                        cell += ' border-transparent bg-transparent text-brand-black hover:bg-brand-cream';
                      }
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDate(day)}
                          aria-current={isToday ? 'date' : undefined}
                          aria-pressed={selected}
                          className={cell}
                        >
                          <span className="block leading-none">{Number(day.slice(8))}</span>
                          {isToday ? (
                            <span
                              className={`block text-[10px] font-bold leading-tight mt-0.5 ${
                                selected ? 'text-white' : 'text-orange-primary'
                              }`}
                            >
                              Auj.
                            </span>
                          ) : null}
                          {showPonctuel || showCours ? (
                            <span className="mt-0.5 flex items-center justify-center gap-0.5" aria-hidden="true">
                              {showPonctuel ? (
                                <span
                                  className={`block w-1.5 h-1.5 rounded-full ${
                                    selected ? 'bg-white' : 'bg-orange-primary'
                                  }`}
                                />
                              ) : null}
                              {showCours ? (
                                <span
                                  className={`block w-1.5 h-1.5 rounded-full ${
                                    selected ? 'bg-white' : 'bg-brand-olive'
                                  }`}
                                />
                              ) : null}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {filter === 'tout' ? (
              <p className="mt-3 flex flex-wrap gap-3 text-xs text-brand-gray">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-primary" aria-hidden="true" />
                  Ponctuel
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-olive" aria-hidden="true" />
                  Cours
                </span>
              </p>
            ) : null}
          </section>

          {filter === 'ponctuel' && upcomingPonctuel.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display font-bold text-lg">Prochaines dates</h2>
              <ul className="space-y-2">
                {upcomingPonctuel.map((ev) => (
                  <AgendaCard
                    key={ev.id}
                    ev={ev}
                    showDate
                    today={today}
                    onEdit={openEdit}
                    onRemove={removeEvent}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="font-display font-bold text-lg flex flex-wrap items-center gap-2">
              {formatDayLong(selectedDate)}
              {selectedDate === today ? (
                <span className="inline-flex items-center rounded-full bg-orange-primary text-white text-[11px] font-bold px-2 py-0.5 normal-case">
                  Auj.
                </span>
              ) : null}
            </h2>
            {loading ? (
              <p className="text-brand-gray">Chargement…</p>
            ) : dayEvents.length === 0 ? (
              <p className="text-brand-gray">Aucun événement ce jour.</p>
            ) : (
              <ul className="space-y-2">
                {dayEvents.map((ev) => (
                  <AgendaCard
                    key={ev.id}
                    ev={ev}
                    showDate={false}
                    today={today}
                    onEdit={openEdit}
                    onRemove={removeEvent}
                  />
                ))}
              </ul>
            )}
          </section>

          {formOpen ? (
            <section className="rounded-2xl bg-white border border-brand-gray-light p-4 space-y-3">
              <h2 className="font-display font-bold text-lg">
                {editing ? 'Modifier l’événement' : 'Nouvel événement'}
              </h2>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Titre *</span>
                <input
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Date *</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Début *</span>
                  <input
                    type="time"
                    className={fieldClass}
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Fin *</span>
                  <input
                    type="time"
                    className={fieldClass}
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Lieu</span>
                <input
                  className={fieldClass}
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Notes</span>
                <textarea
                  className={`${fieldClass} min-h-[96px]`}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveForm()}
                  className="min-h-[48px] px-5 rounded-xl bg-orange-primary text-white font-semibold disabled:opacity-50"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setEditing(null);
                  }}
                  className="min-h-[48px] px-5 rounded-xl border border-brand-gray-light font-semibold"
                >
                  Annuler
                </button>
              </div>
            </section>
          ) : null}
        </main>
      </div>
      </BureauSeanceReserve>
    </BureauAuthGate>
  );
}

function AgendaCard({
  ev,
  showDate,
  today,
  onEdit,
  onRemove,
}: {
  ev: AgendaEvent;
  showDate: boolean;
  today: string;
  onEdit: (ev: AgendaEvent) => void;
  onRemove: (ev: AgendaEvent) => void;
}) {
  const course = isCourseEvent(ev);
  const badge = eventBadge(ev);
  const notes = visibleNotes(ev.notes || '');
  const past = !course && ev.date < today;
  const badgeClass =
    badge === 'Cours'
      ? 'bg-brand-olive-soft text-brand-olive'
      : badge === 'Bureau'
        ? 'bg-orange-primary/10 text-orange-primary'
        : 'bg-brand-cream text-brand-gray border border-brand-gray-light';
  const lieu = formatLocation(ev.location);
  const bar = past
    ? 'border-l-brand-gray-light'
    : course
      ? 'border-l-brand-olive'
      : 'border-l-orange-primary';
  const shell = past
    ? 'rounded-2xl bg-brand-cream border border-brand-gray-light border-l-[4px]'
    : 'rounded-2xl bg-white border border-brand-gray-light border-l-[4px]';

  return (
    <li className={`${shell} ${bar} p-4 space-y-2 list-none`}>
      <div className="flex flex-wrap items-center gap-2">
        {showDate ? (
          <p className="text-sm text-brand-gray">{formatDayLong(ev.date)}</p>
        ) : null}
        <span className={`inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 ${badgeClass}`}>
          {badge}
        </span>
        {past ? (
          <span className="inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 bg-white text-brand-gray border border-brand-gray-light">
            Passé
          </span>
        ) : null}
      </div>
      <p className="font-semibold text-base">{displayTitle(ev.title)}</p>
      <p className="text-sm text-brand-gray">
        {formatHm(ev.startTime)} – {formatHm(ev.endTime)}
      </p>
      {lieu ? <p className="text-sm text-brand-gray">{lieu}</p> : null}
      {notes ? <p className="text-sm text-brand-gray whitespace-pre-wrap">{notes}</p> : null}
      {course ? (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => onEdit(ev)}
            className="min-h-[44px] px-4 rounded-xl border border-brand-gray-light text-brand-olive font-semibold text-sm"
          >
            Modifier la série
          </button>
          <button
            type="button"
            onClick={() => void onRemove(ev)}
            className="min-h-[44px] text-sm text-brand-gray underline-offset-2 hover:underline px-1"
          >
            Supprimer
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onEdit(ev)}
            className="min-h-[44px] px-4 rounded-xl border border-brand-gray-light font-semibold text-sm"
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={() => void onRemove(ev)}
            className="min-h-[44px] text-sm text-brand-gray underline-offset-2 hover:underline px-1"
          >
            Supprimer
          </button>
        </div>
      )}
    </li>
  );
}
