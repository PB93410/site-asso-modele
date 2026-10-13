import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BureauAuthGate from '../components/BureauAuthGate';
import { EnTete } from '../components/bureau/ui';
import { carte } from '../components/bureau/styles';
import { bureauFetch } from '../lib/bureauApi';

type Ligne = { nom: string; date: string; cours: string; mode: string };
type Reponse = { saison: string; ouverte: boolean; liste: Ligne[] };

/** Réinscriptions faites depuis l'espace adhérent, pour la saison suivante (lecture seule). */
export default function BureauReinscriptionsPage() {
  return (
    <BureauAuthGate>
      <Contenu />
    </BureauAuthGate>
  );
}

function Contenu() {
  const [data, setData] = useState<Reponse | null>(null);
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    setData(await bureauFetch<Reponse>('/api/espace?action=reinscriptions'));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      charger().catch((e) => setMsg(e instanceof Error ? e.message : 'Chargement impossible.'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [charger]);

  const saison = (data?.saison || '').replace('-', '/');
  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <EnTete
          titre={`Réinscriptions ${saison}`}
          aide="Faites par les adhérents depuis leur espace (juin à septembre). Ils paient à la rentrée : le paiement se confirme dans « À payer » après le changement de saison, et le numéro de carte vient à ce moment-là."
        />
        <p>
          <Link to="/bureau" className="font-semibold text-brand-olive min-h-[44px] inline-flex items-center">
            ← Bureau
          </Link>
        </p>
        {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}
        {data ? (
          <p className="text-[16px] text-brand-black">
            <strong>{data.liste.length}</strong> réinscription{data.liste.length > 1 ? 's' : ''}
            {data.ouverte ? ' · ouverte jusqu’au 30 septembre' : ' · fermée en ce moment (ouverte de juin à septembre)'}
          </p>
        ) : null}
        {data?.liste.length ? (
          <ul className={`${carte} divide-y divide-black/[0.06]`}>
            {data.liste.map((l, i) => (
              <li key={i} className="p-4 space-y-1">
                <p className="font-semibold">{l.nom}</p>
                <p className="text-sm text-slate-600">
                  {l.date} · {l.cours || 'cours non précisés'} · paiera par {l.mode || '—'}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
