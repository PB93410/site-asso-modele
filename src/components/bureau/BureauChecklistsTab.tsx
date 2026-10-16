import { useEffect, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { CHECKLISTS } from '../../data/checklistsSaison';
import { SEASON_LABEL } from '../../data/CONFIG';
import { bureauFetch } from '../../lib/bureauApi';
import { avancement, cleCoche, jourCourt, type Coches } from '../../lib/checklistsSaison';


/** Bureau : les grandes étapes de la saison, cochées par tous. Aucune donnée personnelle. */
export default function BureauChecklistsTab() {
  const [coches, setCoches] = useState<Coches>({});
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState('');

  useEffect(() => {
    let stop = false;
    bureauFetch<{ coches?: Coches }>(`/api/checklists?saison=${SEASON_LABEL}`)
      .then((d) => {
        if (!stop) setCoches(d.coches || {});
      })
      .catch((e: unknown) => {
        if (!stop) setErreur(e instanceof Error ? e.message : 'Lecture impossible.');
      })
      .finally(() => {
        if (!stop) setCharge(true);
      });
    return () => {
      stop = true;
    };
  }, []);

  async function basculer(cle: string, fait: boolean) {
    const avant = coches;
    setErreur('');
    setOccupe(cle);
    // Tout de suite à l'écran ; on revient en arrière si le serveur refuse.
    const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    const suite = { ...coches };
    if (fait) suite[cle] = { le: aujourdhui };
    else delete suite[cle];
    setCoches(suite);
    try {
      const d = await bureauFetch<{ coches?: Coches }>('/api/checklists', {
        method: 'POST',
        body: JSON.stringify({ saison: SEASON_LABEL, cle, fait }),
      });
      setCoches(d.coches || suite);
    } catch (e: unknown) {
      setCoches(avant);
      setErreur(e instanceof Error ? e.message : 'Ça n’a pas marché. Réessayez.');
    } finally {
      setOccupe('');
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display font-bold text-lg flex items-center gap-2">
        <CheckSquare className="w-5 h-5 text-brand-olive" aria-hidden="true" />
        Checklists de la saison {SEASON_LABEL}
      </h2>
      <p className="text-base text-brand-gray">
        Les grandes étapes, à cocher au fur et à mesure. Tout le bureau voit les mêmes cases. Les étapes marquées
        « référent » sont techniques.
      </p>
      {erreur ? (
        <p role="alert" className="text-base text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {erreur}
        </p>
      ) : null}
      {!charge ? <p className="text-sm text-brand-gray">Chargement…</p> : null}

      {CHECKLISTS.map((liste) => {
        const a = avancement(liste, coches);
        return (
          <details
            key={liste.id}
            open={!a.fini && a.faites > 0}
            className="rounded-2xl bg-white border border-black/10 px-4 py-2 group"
          >
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-[56px] flex items-center justify-between gap-3">
              <span>
                <span className="block font-semibold text-base text-brand-black">{liste.titre}</span>
                <span className="block text-sm text-brand-gray">{liste.quand}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                  a.fini ? 'bg-brand-olive text-white' : 'bg-[#F3F1EC] text-brand-black'
                }`}
              >
                {a.faites}/{a.total}
              </span>
            </summary>
            <ul className="pb-2">
              {liste.etapes.map((e) => {
                const cle = cleCoche(liste, e.id);
                const fait = coches[cle];
                const id = `chk-${liste.id}-${e.id}`;
                return (
                  <li key={e.id} className="border-t border-black/5">
                    <label htmlFor={id} className="flex items-start gap-3 min-h-[56px] py-2 cursor-pointer">
                      <input
                        id={id}
                        type="checkbox"
                        checked={Boolean(fait)}
                        disabled={occupe === cle}
                        onChange={(ev) => void basculer(cle, ev.target.checked)}
                        className="mt-1 h-6 w-6 shrink-0 accent-brand-olive"
                      />
                      <span className="min-w-0">
                        <span className={`block text-base ${fait ? 'text-slate-500 line-through' : 'text-brand-black'}`}>
                          {e.texte}
                        </span>
                        <span className="block text-sm text-brand-gray">
                          {e.qui === 'référent' ? 'référent' : null}
                          {e.qui === 'référent' && (e.ou || fait) ? ' · ' : null}
                          {e.ou || null}
                          {e.ou && fait ? ' · ' : null}
                          {fait ? `fait le ${jourCourt(fait.le)}` : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
