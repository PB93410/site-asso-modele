import { useEffect, useState } from 'react';
import { bureauFetch } from '../../lib/bureauApi';
import { EnTete, Retour } from './ui';

type Ligne = { libelle: string; clics: number; impressions: number; position: number };
type Releve = {
  ok: boolean;
  periode: { debut: string; fin: string };
  clics: number;
  impressions: number;
  position: number;
  recherches: Ligne[];
  pages: Ligne[];
  error?: string;
};

function fmt(n: number) {
  return Number(n || 0).toLocaleString('fr-FR');
}

export default function BureauRecherches({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Releve | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let vivant = true;
    bureauFetch<Releve>('/api/bureau-recherches')
      .then((d) => {
        if (vivant) setData(d);
      })
      .catch((e) => {
        if (vivant) setErr(e instanceof Error ? e.message : 'Search Console injoignable.');
      })
      .finally(() => {
        if (vivant) setBusy(false);
      });
    return () => {
      vivant = false;
    };
  }, []);

  return (
    <div className="space-y-3">
      <Retour onClick={onBack} />
      <EnTete
        titre="Recherches Google"
        aide="Les 4 dernières semaines, sans aucun nom. Un mail part aussi le lundi matin."
      />
      {busy ? <p className="font-body text-[16px] text-slate-600">Chargement…</p> : null}
      {err ? (
        <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 font-body text-[15px]">
          {err} Branchez le compte Google de l’asso (Search Console) si ce n’est pas déjà fait.
        </p>
      ) : null}
      {data?.ok ? (
        <div className="space-y-4">
          <p className="font-body text-[15px] text-slate-600">
            Du {data.periode.debut} au {data.periode.fin}. Google met 2 à 3 jours à compléter.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Tuile valeur={fmt(data.clics)} legende="visites depuis Google" />
            <Tuile valeur={fmt(data.impressions)} legende="fois où Google a montré le site" />
            <Tuile
              valeur={data.position ? data.position.toFixed(1).replace('.', ',') : '—'}
              legende="place moyenne"
            />
          </div>
          <Liste titre="Ce que les gens tapent" lignes={data.recherches} />
          <Liste titre="Pages ouvertes depuis Google" lignes={data.pages} />
        </div>
      ) : null}
    </div>
  );
}

function Tuile({ valeur, legende }: { valeur: string; legende: string }) {
  return (
    <div className="rounded-2xl bg-white border border-black/10 p-4">
      <p className="font-display font-black text-[28px] leading-none text-brand-black">{valeur}</p>
      <p className="font-body text-[15px] text-slate-600 mt-2">{legende}</p>
    </div>
  );
}

function Liste({ titre, lignes }: { titre: string; lignes: Ligne[] }) {
  return (
    <section className="rounded-2xl bg-white border border-black/10 p-4">
      <h2 className="font-display font-bold text-[20px] text-brand-black mb-3">{titre}</h2>
      {lignes?.length ? (
        <ul className="space-y-2">
          {lignes.map((l) => (
            <li key={l.libelle} className="flex justify-between gap-3 font-body text-[16px] text-brand-black">
              <span className="min-w-0 break-words">{l.libelle}</span>
              <span className="shrink-0 font-semibold">{fmt(l.clics)} visite{l.clics > 1 ? 's' : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-[15px] text-slate-500">Rien sur cette période.</p>
      )}
    </section>
  );
}
