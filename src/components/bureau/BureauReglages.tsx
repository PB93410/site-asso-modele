import { useEffect, useState, type FormEvent } from 'react';
import { bureauFetch } from '../../lib/bureauApi';
import { EnTete, Retour } from './ui';
import { bouton } from './styles';

type Reglages = { tarif: number; finEssais: string };
type Reponse = {
  reglages?: Reglages;
  source?: string;
  etat?: string;
  enLigne?: Reglages;
  message?: string;
  error?: string;
};

const champ =
  'w-full min-h-[48px] rounded-xl border border-black/10 bg-white px-3 font-body text-[16px] text-brand-black';

export default function BureauReglages({ onBack }: { onBack: () => void }) {
  const [tarif, setTarif] = useState('');
  const [finEssais, setFinEssais] = useState('');
  const [etat, setEtat] = useState('');
  const [source, setSource] = useState('');
  const [enLigne, setEnLigne] = useState<Reglages | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivant = true;
    bureauFetch<Reponse>('/api/reglages')
      .then((d) => {
        if (!vivant) return;
        const r = d.reglages;
        setTarif(r ? String(r.tarif) : '');
        setFinEssais(r?.finEssais || '');
        setEtat(d.etat || '');
        setSource(d.source || '');
        setEnLigne(d.enLigne || null);
      })
      .catch((e) => {
        if (vivant) setErr(e instanceof Error ? e.message : 'Chargement impossible.');
      });
    return () => {
      vivant = false;
    };
  }, []);

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const d = await bureauFetch<Reponse>('/api/reglages', {
        method: 'PUT',
        body: JSON.stringify({ tarif: Number(tarif), finEssais }),
      });
      if (d.reglages) {
        setTarif(String(d.reglages.tarif));
        setFinEssais(d.reglages.finEssais || '');
      }
      setSource('stockage');
      setEtat('ok');
      setMsg(d.message || 'Enregistré.');
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Retour onClick={onBack} />
      <EnTete
        titre="Tarif et fin des essais"
        aide="Les formulaires s’en servent tout de suite. L’accueil et les tarifs, au prochain déploiement."
      />
      {etat === 'incorrect' ? (
        <p role="status" className="rounded-xl bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 font-body text-[15px]">
          L’onglet des réglages est illisible (colonnes déplacées). On utilise encore{' '}
          {enLigne ? `${enLigne.tarif} €` : 'la config du site'}. Enregistrez pour le recréer.
        </p>
      ) : null}
      {etat === 'panne' ? (
        <p role="status" className="rounded-xl bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 font-body text-[15px]">
          Réglages injoignables. On utilise la config du site.
        </p>
      ) : null}
      <form onSubmit={(e) => void enregistrer(e)} className="space-y-4 rounded-2xl bg-white border border-black/10 p-4">
        <label className="block">
          <span className="block font-body font-medium text-[15px] text-brand-black mb-1.5">Cotisation annuelle (€)</span>
          <input
            type="number"
            min={1}
            max={9999}
            step={1}
            required
            value={tarif}
            onChange={(e) => setTarif(e.target.value)}
            className={champ}
          />
        </label>
        <label className="block">
          <span className="block font-body font-medium text-[15px] text-brand-black mb-1.5">
            Dernier jour des essais
          </span>
          <input type="date" value={finEssais} onChange={(e) => setFinEssais(e.target.value)} className={champ} />
          <span className="block font-body text-[14px] text-slate-500 mt-1">
            Vide = essais ouverts toute l’année. Après cette date, /essai mène à l’adhésion.
          </span>
        </label>
        {err ? (
          <p role="alert" className="font-body text-[15px] text-red-800">
            {err}
          </p>
        ) : null}
        {msg ? (
          <p role="status" className="font-body text-[15px] text-emerald-800">
            {msg}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={bouton.principal}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {source === 'config' ? (
          <p className="font-body text-[14px] text-slate-500">Valeurs actuelles : celles du fichier de config.</p>
        ) : null}
      </form>
    </div>
  );
}
