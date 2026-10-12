import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import BureauAuthGate, { BureauSeanceReserve } from '../components/BureauAuthGate';
import { EnTete } from '../components/bureau/ui';
import { bouton, carte } from '../components/bureau/styles';
import { bureauFetch } from '../lib/bureauApi';
import { useScheduleFromSheet } from '../hooks/useSheetData';

const TYPES_ALERTE = ['annulation', 'changement', 'autre'] as const;

function libelleType(type: string) {
  if (type === 'annulation') return 'Cours annulé';
  if (type === 'changement') return 'Horaire ou salle modifié';
  return 'Information';
}

function parisYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type Alerte = {
  id: string;
  date: string;
  cours: string;
  type: string;
  libelle: string;
  message: string;
  active?: boolean;
};

export default function BureauAlertesPage() {
  return (
    <BureauAuthGate>
      <BureauSeanceReserve>
        <Contenu />
      </BureauSeanceReserve>
    </BureauAuthGate>
  );
}

function Contenu() {
  const { schedule } = useScheduleFromSheet();
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [abonnes, setAbonnes] = useState(0);
  const [date, setDate] = useState(parisYmd());
  const [cours, setCours] = useState('');
  const [type, setType] = useState('annulation');
  const [message, setMessage] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const r = await bureauFetch<{ alertes: Alerte[]; abonnes: number }>('/api/alertes?action=toutes');
    setAlertes(r.alertes || []);
    setAbonnes(r.abonnes || 0);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      charger().catch((e) => setMsg(e instanceof Error ? e.message : 'Chargement impossible.'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [charger]);

  const coursUniques = [...new Set(schedule.map((s) => s.course).filter(Boolean))];

  async function creer(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const r = await bureauFetch<{ notification?: { mails: number; abonnes: number } }>('/api/alertes', {
        method: 'POST',
        body: JSON.stringify({ action: 'creer', date, cours, type, message }),
      });
      setMessage('');
      await charger();
      const n = r.notification;
      setMsg(n ? `Alerte publiée. ${n.mails} mail${n.mails > 1 ? 's' : ''} pour ${n.abonnes} inscrit${n.abonnes > 1 ? 's' : ''}.` : 'Alerte publiée.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Publication impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function retirer(id: string) {
    await bureauFetch(`/api/alertes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await charger();
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <EnTete
          titre="Alertes cours"
          aide="Un bandeau s’affiche sur le site. Un mail part aux personnes qui se sont inscrites. Notification sur le téléphone si elles l’ont acceptée."
        />
        <p>
          <Link to="/bureau" className="font-semibold text-brand-olive min-h-[44px] inline-flex items-center">
            ← Bureau
          </Link>
        </p>
        <p className="text-sm text-slate-500">{abonnes} personne{abonnes > 1 ? 's' : ''} inscrite{abonnes > 1 ? 's' : ''} aux alertes.</p>

        <form onSubmit={(e) => void creer(e)} className={`${carte} p-4 space-y-3`}>
          <label className="block font-semibold">
            Date du cours
            <input type="date" required className="mt-1 block min-h-[44px] rounded-xl border border-black/15 px-3" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block font-semibold">
            Cours
            <select required className="mt-1 block w-full min-h-[44px] rounded-xl border border-black/15 px-3" value={cours} onChange={(e) => setCours(e.target.value)}>
              <option value="">Choisir</option>
              {coursUniques.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            Type
            <select className="mt-1 block w-full min-h-[44px] rounded-xl border border-black/15 px-3" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES_ALERTE.map((t) => (
                <option key={t} value={t}>
                  {libelleType(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            Message
            <textarea
              required
              maxLength={400}
              className="mt-1 block w-full min-h-[88px] rounded-xl border border-black/15 px-3 py-2 text-[16px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="ex. Le gymnase est fermé. Cours reporté à jeudi."
            />
          </label>
          <button type="submit" disabled={busy} className={bouton.principal}>
            Publier l’alerte
          </button>
          {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}
        </form>

        <ul className="space-y-3">
          {alertes.map((a) => (
            <li key={a.id} className={`${carte} p-4`}>
              <p className="text-xs font-semibold uppercase text-slate-500">{a.libelle}</p>
              <p className="font-semibold text-brand-black">
                {a.cours} — {a.date}
              </p>
              <p className="text-sm text-slate-600 mt-1">{a.message}</p>
              <button type="button" className={bouton.discret} onClick={() => void retirer(a.id)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
