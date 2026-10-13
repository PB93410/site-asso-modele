import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BureauAuthGate from '../components/BureauAuthGate';
import { EnTete } from '../components/bureau/ui';
import { bouton, carte } from '../components/bureau/styles';
import { bureauFetch } from '../lib/bureauApi';

type Ligne = {
  ID: string;
  TYPE: string;
  COURS: string;
  CRENEAU: string;
  PRENOM: string;
  NOM: string;
  TEL: string;
  MAIL: string;
  RANG: string;
  STATUT: string;
  EXPIRE_LE: string;
};

export default function BureauListeAttentePage() {
  return (
    <BureauAuthGate>
      <Contenu />
    </BureauAuthGate>
  );
}

function Contenu() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    const r = await bureauFetch<{ files: Ligne[] }>('/api/liste-attente?action=files');
    setLignes(r.files || []);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      charger().catch((e) => setMsg(e instanceof Error ? e.message : 'Chargement impossible.'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [charger]);

  async function prevenir(l: Ligne) {
    setMsg('');
    try {
      const r = await bureauFetch<{ ok?: boolean; whatsapp?: string; mailOk?: boolean }>('/api/liste-attente', {
        method: 'POST',
        body: JSON.stringify({ action: 'notifier', type: l.TYPE, cours: l.COURS, creneau: l.CRENEAU }),
      });
      setMsg(r.ok ? `Message préparé${r.mailOk ? ' (mail)' : ''}.` : 'Personne à prévenir pour ce créneau.');
      if (r.whatsapp) window.open(r.whatsapp, '_blank', 'noopener');
      await charger();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Envoi impossible.');
    }
  }

  const actives = lignes.filter((l) => l.STATUT === 'attente' || l.STATUT === 'notifie');

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <EnTete titre="Liste d’attente" aide="Quand un cours est complet, les personnes attendent ici. Une place libre : prévenez la première." />
        <p>
          <Link to="/bureau" className="font-semibold text-brand-olive min-h-[44px] inline-flex items-center">
            ← Bureau
          </Link>
        </p>
        {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}
        {actives.length === 0 ? (
          <p className="text-sm text-slate-500">Personne en attente pour le moment.</p>
        ) : (
          <ul className={`${carte} divide-y divide-black/[0.06]`}>
            {actives.map((l) => (
              <li key={l.ID} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {l.PRENOM} {l.NOM}{' '}
                    <span className="font-normal text-slate-500">· n° {l.RANG}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    {l.TYPE === 'adhesion' ? 'Adhésion' : 'Essai'} · {l.COURS}
                    {l.CRENEAU ? ` · ${l.CRENEAU}` : ''} · {l.STATUT}
                  </p>
                </div>
                <button type="button" className={bouton.principal} onClick={() => void prevenir(l)}>
                  Prévenir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
