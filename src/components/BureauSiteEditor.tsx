import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ASSO } from '../data/asso';
import { ACTIVITIES } from '../data/siteData';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
/** Cours et lieux proposés : src/data/siteData.ts (ACTIVITIES) et asso.config.js (lieux). */
const COURSES = ACTIVITIES.map((a) => a.name);
const LOCATIONS = ASSO.lieux.map((l) => l.nom);
const MONTHS = [
  'JAN',
  'FÉV',
  'MARS',
  'AVR',
  'MAI',
  'JUIN',
  'JUIL',
  'AOÛT',
  'SEPT',
  'OCT',
  'NOV',
  'DÉC',
] as const;

type ScheduleRow = {
  day: string;
  time: string;
  course: string;
  location: string;
  note: string;
};
type EventRow = {
  date: string;
  month: string;
  year: string;
  title: string;
  description: string;
  time: string;
  location: string;
  highlight: boolean;
  image?: string;
  type: string;
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[40px] px-3 rounded-xl text-sm font-medium border ${
        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function BureauSiteEditor({
  kind,
  token,
  onToast,
}: {
  kind: 'planning' | 'events';
  token: string;
  onToast: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/site-content', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Chargement impossible');
        if (cancelled) return;
        setSchedule(data.planning || []);
        setEvents(data.evenements || []);
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Chargement impossible');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function save() {
    if (!window.confirm('Enregistrer ? Ça apparaîtra sur le site public (quelques minutes).')) return;
    setSaving(true);
    try {
      const body =
        kind === 'planning' ? { planning: schedule } : { evenements: events };
      const res = await fetch('/api/site-content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible');
      onToast(data.message || 'Enregistré. Le site se met à jour tout seul.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 py-8">Chargement…</p>;
  }

  if (kind === 'planning') {
    return (
      <div className="space-y-4">
        <h2 className="font-display font-bold text-lg">Horaires des cours</h2>
        <p className="text-sm text-slate-600">
          Choisissez jour, cours et salle. Écrivez l’heure comme 13h30 – 14h30. Puis
          Enregistrer — pas besoin d’appeler le référent.
        </p>
        {schedule.map((row, i) => (
          <div key={i} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
            <div className="flex justify-between gap-2">
              <p className="font-semibold text-slate-900">Créneau {i + 1}</p>
              <button
                type="button"
                onClick={() => setSchedule((s) => s.filter((_, j) => j !== i))}
                className="text-sm text-red-700"
              >
                Retirer
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <Chip key={d} active={row.day === d} onClick={() => {
                  setSchedule((s) => s.map((r, j) => (j === i ? { ...r, day: d } : r)));
                }}>
                  {d}
                </Chip>
              ))}
            </div>
            <input
              value={row.time}
              onChange={(e) =>
                setSchedule((s) => s.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))
              }
              placeholder="13h30 – 14h30"
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
            />
            <div className="flex flex-wrap gap-1.5">
              {COURSES.map((c) => (
                <Chip key={c} active={row.course === c} onClick={() => {
                  setSchedule((s) => s.map((r, j) => (j === i ? { ...r, course: c } : r)));
                }}>
                  {c}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LOCATIONS.map((l) => (
                <Chip key={l} active={row.location === l} onClick={() => {
                  setSchedule((s) => s.map((r, j) => (j === i ? { ...r, location: l } : r)));
                }}>
                  {l}
                </Chip>
              ))}
            </div>
            <input
              value={row.note}
              onChange={(e) =>
                setSchedule((s) => s.map((r, j) => (j === i ? { ...r, note: e.target.value } : r)))
              }
              placeholder="Note (facultatif) — ex. dès le 19 sept."
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSchedule((s) => [
              ...s,
              { day: 'Lundi', time: '', course: COURSES[0] ?? '', location: LOCATIONS[0] ?? '', note: '' },
            ])
          }
          className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-700 inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter un créneau
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="w-full rounded-xl bg-emerald-600 text-white font-semibold py-3.5 min-h-[48px]"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer — ça ira sur le site'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-lg">Événements à afficher</h2>
      <p className="text-sm text-slate-600">
        Portes ouvertes, reprise, repas… Un titre, un jour, un mois. Puis Enregistrer.
      </p>
      {events.map((ev, i) => (
        <div key={i} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
          <div className="flex justify-between gap-2">
            <p className="font-semibold">{ev.title || `Date ${i + 1}`}</p>
            <button type="button" onClick={() => setEvents((s) => s.filter((_, j) => j !== i))} className="text-sm text-red-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <input
            value={ev.title}
            onChange={(e) => setEvents((s) => s.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))}
            placeholder="Titre (ex. Séance portes ouvertes)"
            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={ev.date}
              onChange={(e) => setEvents((s) => s.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))}
              placeholder="Jour (6 ou 4-5)"
              className="rounded-xl border border-slate-300 px-3 py-3 text-base"
            />
            <input
              value={ev.year}
              onChange={(e) => setEvents((s) => s.map((r, j) => (j === i ? { ...r, year: e.target.value } : r)))}
              placeholder="Année"
              className="rounded-xl border border-slate-300 px-3 py-3 text-base"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MONTHS.map((m) => (
              <Chip key={m} active={ev.month === m} onClick={() => {
                setEvents((s) => s.map((r, j) => (j === i ? { ...r, month: m } : r)));
              }}>
                {m}
              </Chip>
            ))}
          </div>
          <input
            value={ev.time}
            onChange={(e) => setEvents((s) => s.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))}
            placeholder="Horaire (10h00 – 18h00)"
            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          />
          <div className="flex flex-wrap gap-1.5">
            {LOCATIONS.map((l) => (
              <Chip key={l} active={ev.location === l} onClick={() => {
                setEvents((s) => s.map((r, j) => (j === i ? { ...r, location: l } : r)));
              }}>
                {l}
              </Chip>
            ))}
          </div>
          <textarea
            value={ev.description}
            onChange={(e) =>
              setEvents((s) => s.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))
            }
            placeholder="Deux phrases pour le site"
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ev.highlight}
              onChange={(e) =>
                setEvents((s) => s.map((r, j) => (j === i ? { ...r, highlight: e.target.checked } : r)))
              }
              className="w-5 h-5"
            />
            Mettre en avant
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setEvents((s) => [
            ...s,
            {
              date: '',
              month: 'SEPT',
              year: '2026',
              title: '',
              description: '',
              time: '',
              location: LOCATIONS[0] ?? '',
              highlight: false,
              type: 'administratif',
            },
          ])
        }
        className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium"
      >
        Ajouter une date
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="w-full rounded-xl bg-emerald-600 text-white font-semibold py-3.5 min-h-[48px]"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer — ça ira sur le site'}
      </button>
    </div>
  );
}
