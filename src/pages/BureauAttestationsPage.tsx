import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BureauAuthGate from '../components/BureauAuthGate';
import { getBureauToken } from '../lib/bureauSession';
import { EnTete } from '../components/bureau/ui';
import { bouton, carte } from '../components/bureau/styles';
import { bureauFetch } from '../lib/bureauApi';

type Doc = { id: string; label: string };
type Pers = { numero: string; prenom: string; nom: string; mail: string };

export default function BureauAttestationsPage() {
  return (
    <BureauAuthGate>
      <Contenu />
    </BureauAuthGate>
  );
}

function Contenu() {
  const [liste, setListe] = useState<Pers[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    const r = await bureauFetch<{ adherents: Pers[]; docs: Doc[] }>('/api/attestations?action=adherents');
    setListe(r.adherents || []);
    setDocs(r.docs || []);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      charger().catch((e) => setMsg(e instanceof Error ? e.message : 'Chargement impossible.'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [charger]);

  function telecharger(numero: string, type: string) {
    const token = getBureauToken();
    fetch(`/api/attestations?action=pdf&type=${encodeURIComponent(type)}&numero=${encodeURIComponent(numero)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Téléchargement impossible.');
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${numero}-${type}.pdf`;
        a.click();
      })
      .catch(() => setMsg('Téléchargement impossible.'));
  }

  async function envoyer(p: Pers) {
    setMsg('');
    try {
      const r = await bureauFetch<{ mailOk?: boolean; url?: string }>('/api/attestations', {
        method: 'POST',
        body: JSON.stringify({ action: 'lien', numero: p.numero, mail: p.mail }),
      });
      setMsg(r.mailOk ? `Lien préparé pour ${p.prenom}.` : `Lien prêt${r.url ? ' (mail non envoyé).' : '.'}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Envoi impossible.');
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <EnTete titre="Attestations" aide="PDF d’adhésion, reçu fiscal si l’asso est éligible, papier comité d’entreprise. L’adhérent peut aussi les prendre sur /attestations." />
        <p>
          <Link to="/bureau" className="font-semibold text-brand-olive min-h-[44px] inline-flex items-center">
            ← Bureau
          </Link>
        </p>
        {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}
        {liste.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun adhérent à jour avec un numéro.</p>
        ) : (
          <ul className={`${carte} divide-y divide-black/[0.06]`}>
            {liste.map((p) => (
              <li key={p.numero} className="p-4 space-y-3">
                <p className="font-semibold">
                  {p.prenom} {p.nom} <span className="font-normal text-slate-500">· {p.numero}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {docs.map((d) => (
                    <button key={d.id} type="button" className={bouton.secondaire} onClick={() => telecharger(p.numero, d.id)}>
                      {d.label}
                    </button>
                  ))}
                  <button type="button" className={bouton.principal} onClick={() => void envoyer(p)}>
                    Envoyer le lien
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
