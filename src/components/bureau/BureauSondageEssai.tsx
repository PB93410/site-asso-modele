import { useEffect, useState } from 'react';
import { bureauFetch } from '../../lib/bureauApi';
import { INTENTIONS, RAISONS, type ResumeSondage } from '../../lib/sondageEssai';

/** Bureau : ce que disent les personnes après l'essai. Réponses anonymes ; 12 mois de conservation. */
export default function BureauSondageEssai() {
  const [r, setR] = useState<ResumeSondage | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let stop = false;
    bureauFetch<ResumeSondage>('/api/sondage-essai')
      .then((d) => {
        if (!stop) setR(d);
      })
      .catch((e: unknown) => {
        if (!stop) setErreur(e instanceof Error ? e.message : 'Lecture impossible.');
      });
    return () => {
      stop = true;
    };
  }, []);

  const raisons = r ? RAISONS.filter((x) => (r.raisons[x.id] || 0) > 0).sort((a, b) => (r.raisons[b.id] || 0) - (r.raisons[a.id] || 0)) : [];

  return (
    <div className="rounded-2xl bg-white border border-black/10 px-4 py-3 space-y-2">
      <h3 className="font-semibold text-base text-brand-black">Après l’essai : leur avis</h3>
      {erreur ? <p className="text-sm text-red-700">{erreur}</p> : null}
      {!r && !erreur ? <p className="text-sm text-brand-gray">Chargement…</p> : null}
      {r && r.total === 0 ? (
        <p className="text-sm text-brand-gray">Aucune réponse pour l’instant. Le lien est dans le message « merci » envoyé après l’essai (Relances).</p>
      ) : null}
      {r && r.total > 0 ? (
        <>
          <ul className="space-y-1">
            {INTENTIONS.map((i) => (
              <li key={i.id} className="flex justify-between text-base">
                <span className="text-brand-black">{i.label}</span>
                <span className="font-semibold text-brand-black">{r.intentions[i.id]}</span>
              </li>
            ))}
          </ul>
          {raisons.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-brand-black pt-1">Ce qui retient</p>
              <ul className="space-y-1">
                {raisons.map((x) => (
                  <li key={x.id} className="flex justify-between text-base">
                    <span className="text-brand-black">{x.label}</span>
                    <span className="font-semibold text-brand-black">{r.raisons[x.id]}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {r.suggestions.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-brand-black pt-1">Leurs idées</p>
              <ul className="list-disc list-inside space-y-1 text-base text-brand-black">
                {r.suggestions.slice(0, 20).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
      <p className="text-sm text-brand-gray">Anonyme : aucun nom ni numéro. Les réponses de plus de 12 mois sont effacées.</p>
    </div>
  );
}
