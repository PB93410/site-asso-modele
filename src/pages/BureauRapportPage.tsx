import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BureauAuthGate from '../components/BureauAuthGate';
import { EnTete } from '../components/bureau/ui';
import { bouton, carte } from '../components/bureau/styles';
import { bureauFetch } from '../lib/bureauApi';
import { getBureauToken } from '../lib/bureauSession';

type Rapport = {
  saison: string;
  adhérentsAJour: number;
  adhesionsEnAttente: number;
  essais: number;
  essaisDevenusAdherents: number;
  conversionEssaiPct: number;
  presences: number;
  parAge: Record<string, number>;
  parCommune: Record<string, number>;
  parCours: Record<string, number>;
};

export default function BureauRapportPage() {
  return (
    <BureauAuthGate>
      <Contenu />
    </BureauAuthGate>
  );
}

function Contenu() {
  const [r, setR] = useState<Rapport | null>(null);
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    setR(await bureauFetch<Rapport>('/api/rapport?action=json'));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      charger().catch((e) => setMsg(e instanceof Error ? e.message : 'Chargement impossible.'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [charger]);

  function telecharger(action: 'pdf' | 'csv') {
    const token = getBureauToken();
    const a = document.createElement('a');
    a.href = `/api/rapport?action=${action}`;
    a.setAttribute('download', '');
    fetch(`/api/rapport?action=${action}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        a.download = action === 'pdf' ? 'rapport.pdf' : 'rapport.csv';
        a.click();
      })
      .catch(() => setMsg('Téléchargement impossible.'));
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <EnTete titre="Rapport annuel" aide="Pour l’assemblée générale et les demandes de subvention. Aucun nom n’apparaît." />
        <p>
          <Link to="/bureau" className="font-semibold text-brand-olive min-h-[44px] inline-flex items-center">
            ← Bureau
          </Link>
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={bouton.principal} onClick={() => telecharger('pdf')}>
            Télécharger le PDF
          </button>
          <button type="button" className={bouton.secondaire} onClick={() => telecharger('csv')}>
            Télécharger le CSV
          </button>
        </div>
        {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}
        {r ? (
          <div className={`${carte} p-5 space-y-4`}>
            <p className="font-display font-bold text-xl">Saison {r.saison}</p>
            <ul className="space-y-1 font-body text-[16px]">
              <li>Adhérents à jour : <strong>{r.adhérentsAJour}</strong></li>
              <li>Adhésions en attente : {r.adhesionsEnAttente}</li>
              <li>Essais : {r.essais} · devenus adhérents : {r.essaisDevenusAdherents}</li>
              <li>Conversion essai → adhésion : <strong>{r.conversionEssaiPct} %</strong></li>
              <li>Pointages : {r.presences}</li>
            </ul>
            <div>
              <p className="font-semibold mb-1">Âges</p>
              <ul className="text-sm text-slate-600">
                {Object.entries(r.parAge).map(([k, v]) => (
                  <li key={k}>{k} : {v}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Communes</p>
              <ul className="text-sm text-slate-600">
                {Object.entries(r.parCommune).map(([k, v]) => (
                  <li key={k}>{k} : {v}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chargement…</p>
        )}
      </div>
    </div>
  );
}
