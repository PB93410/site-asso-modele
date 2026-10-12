import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import BureauAuthGate from '../components/BureauAuthGate';
import { EnTete } from '../components/bureau/ui';
import { bouton, carte } from '../components/bureau/styles';
import { bureauFetch } from '../lib/bureauApi';

function parisYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type Seance = { id: string; cours: string; horaire: string; lieu: string; url: string; svg?: string };
type Stats = { sessions: { session: string; cours: string; horaire: string; total: number; seances: number }[]; cours: { cours: string; total: number }[]; total: number };
type Inactif = { prenom: string; nom: string; mail: string; numero: string; derniere: string; semaines: number | null };

export default function BureauPresencesPage() {
  return (
    <BureauAuthGate>
      <Contenu />
    </BureauAuthGate>
  );
}

function Contenu() {
  const [date, setDate] = useState(parisYmd());
  const [sessions, setSessions] = useState<Seance[]>([]);
  const [qr, setQr] = useState<Seance | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [inactifs, setInactifs] = useState<Inactif[]>([]);
  const [semaines, setSemaines] = useState(3);
  const [choix, setChoix] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const s = await bureauFetch<{ sessions: Seance[] }>(`/api/presence?action=sessions&date=${date}`);
    setSessions(s.sessions || []);
    setStats(await bureauFetch<Stats>('/api/presence?action=stats'));
    const ina = await bureauFetch<{ personnes: Inactif[] }>(`/api/presence?action=inactifs&semaines=${semaines}`);
    setInactifs(ina.personnes || []);
  }, [date, semaines]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      charger().catch((e) => setMsg(e instanceof Error ? e.message : 'Chargement impossible.'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [charger]);

  async function voirQr(id: string) {
    const data = await bureauFetch<Seance>(`/api/presence?action=qr&session=${encodeURIComponent(id)}&date=${date}`);
    setQr(data);
  }

  async function relancer() {
    const personnes = inactifs.filter((p) => choix[p.numero || p.mail]);
    if (!personnes.length) {
      setMsg('Cochez au moins une personne.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const r = await bureauFetch<{ envois: { mail: string; ok: boolean; error?: string }[] }>('/api/presence', {
        method: 'POST',
        body: JSON.stringify({ action: 'relance', personnes }),
      });
      const ok = r.envois.filter((e) => e.ok).length;
      const ko = r.envois.length - ok;
      setMsg(ok ? `${ok} message${ok > 1 ? 's' : ''} préparé${ok > 1 ? 's' : ''}${ko ? ` — ${ko} sans e-mail` : ''}.` : 'Aucun message envoyé (e-mail non configuré, ou adresses manquantes).');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Relance impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <EnTete
          titre="Présences"
          aide="Affichez le QR du cours. Les adhérents scannent et pointent. Un seul passage par séance et par jour."
        />
        <p>
          <Link to="/bureau" className="font-semibold text-brand-olive min-h-[44px] inline-flex items-center">
            ← Bureau
          </Link>
        </p>

        <section className={`${carte} p-4 space-y-3`}>
          <label className="block font-semibold text-brand-black">
            Date
            <input
              type="date"
              className="mt-1 block min-h-[44px] rounded-xl border border-black/15 px-3"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">Pas de cours ce jour-là dans le planning.</p>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {sessions.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-black">{s.cours}</p>
                    <p className="text-sm text-slate-500">
                      {s.horaire}
                      {s.lieu ? ` · ${s.lieu}` : ''}
                    </p>
                  </div>
                  <button type="button" className={bouton.principal} onClick={() => void voirQr(s.id)}>
                    <QrCode className="w-4 h-4" aria-hidden="true" />
                    QR
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {qr ? (
          <section className={`${carte} p-6 text-center space-y-3`}>
            <p className="font-display font-bold text-xl">{qr.cours}</p>
            <p className="text-sm text-slate-500">{qr.horaire}</p>
            {qr.svg ? (
              <div className="mx-auto w-[260px] h-[260px]" dangerouslySetInnerHTML={{ __html: qr.svg }} />
            ) : (
              <p className="text-sm break-all">{qr.url}</p>
            )}
            <p className="text-sm text-slate-500">Valable uniquement le {date}.</p>
            <button type="button" className={bouton.secondaire} onClick={() => setQr(null)}>
              Fermer
            </button>
          </section>
        ) : null}

        <section className="space-y-3">
          <h3 className="font-display font-bold text-xl text-brand-black">Par cours</h3>
          {stats?.cours?.length ? (
            <ul className={`${carte} divide-y divide-black/[0.06]`}>
              {stats.cours.map((c) => (
                <li key={c.cours} className="px-4 py-3 flex justify-between">
                  <span>{c.cours}</span>
                  <span className="font-semibold text-brand-olive">{c.total}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aucun pointage pour l’instant.</p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-display font-bold text-xl text-brand-black">Sans nouvelles</h3>
          <label className="flex items-center gap-2 text-sm">
            Depuis
            <input
              type="number"
              min={1}
              max={20}
              className="w-16 min-h-[44px] rounded-xl border border-black/15 px-2"
              value={semaines}
              onChange={(e) => setSemaines(Number(e.target.value) || 3)}
            />
            semaines
          </label>
          {inactifs.length ? (
            <ul className={`${carte} divide-y divide-black/[0.06]`}>
              {inactifs.map((p) => {
                const key = p.numero || p.mail;
                return (
                  <li key={key} className="px-4 py-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-5 h-5"
                      checked={Boolean(choix[key])}
                      onChange={(e) => setChoix((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">
                        {p.prenom} {p.nom}
                      </p>
                      <p className="text-sm text-slate-500">{p.derniere ? `Dernier cours le ${p.derniere}` : 'Jamais pointé'}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Tout le monde est venu récemment.</p>
          )}
          <button type="button" className={bouton.principal} disabled={busy} onClick={() => void relancer()}>
            Envoyer un mot
          </button>
          {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}
        </section>
      </div>
    </div>
  );
}
