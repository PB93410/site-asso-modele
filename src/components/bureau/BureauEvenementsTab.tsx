import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useEventsFromSheet } from '../../hooks/useSheetData';
import { bureauFetch } from '../../lib/bureauApi';
import {
  dateLisible,
  resumeCovoiturage,
  slugEvenement,
  telAffiche,
  type InscritEvenement,
} from '../../lib/evenements';
import { phoneToWa } from '../../data/bureauRelances';

type Config = Record<string, { titre: string; places: number; covoiturage: boolean; ouvert: boolean }>;
type Donnees = { config: Config; inscriptions: Record<string, InscritEvenement[]> };

/** Bureau : ouvrir les inscriptions d'un événement, voir les inscrits et le covoiturage, puis tout effacer après. */
export default function BureauEvenementsTab() {
  const { events } = useEventsFromSheet();
  const [donnees, setDonnees] = useState<Donnees>({ config: {}, inscriptions: {} });
  const [places, setPlaces] = useState<Record<string, string>>({});
  const [covoit, setCovoit] = useState<Record<string, boolean>>({});
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  /** Relit les événements ouverts et leurs inscrits (au premier affichage, puis après chaque changement). */
  const charger = useCallback(() => {
    return bureauFetch<Donnees>('/api/evenements-bureau')
      .then((d) => setDonnees(d))
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : 'Lecture impossible.'));
  }, []);

  useEffect(() => {
    let stop = false;
    bureauFetch<Donnees>('/api/evenements-bureau')
      .then((d) => {
        if (!stop) setDonnees(d);
      })
      .catch((e: unknown) => {
        if (!stop) setErreur(e instanceof Error ? e.message : 'Lecture impossible.');
      });
    return () => {
      stop = true;
    };
  }, []);

  async function agir(corps: Record<string, unknown>) {
    setOccupe(true);
    setErreur('');
    try {
      await bureauFetch('/api/evenements-bureau', { method: 'POST', body: JSON.stringify(corps) });
      await charger();
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : 'Ça n’a pas marché. Réessayez.');
    } finally {
      setOccupe(false);
    }
  }

  const slugsAVenir = new Set(events.map((e) => slugEvenement(e)));
  const passes = Object.keys(donnees.config).filter((s) => !slugsAVenir.has(s));

  const inscrits = (slug: string) => {
    const liste = donnees.inscriptions[slug] || [];
    const total = liste.reduce((s, i) => s + (Number(i.personnes) || 0), 0);
    const cov = resumeCovoiturage(liste);
    if (!liste.length) return <p className="text-sm text-brand-gray">Personne d’inscrit pour l’instant.</p>;
    return (
      <div className="space-y-2">
        <p className="text-base text-brand-black">
          <strong>{total}</strong> personne{total > 1 ? 's' : ''} ({liste.length} inscription{liste.length > 1 ? 's' : ''})
          {donnees.config[slug]?.covoiturage ? ` · covoiturage : ${cov.proposees} place${cov.proposees > 1 ? 's' : ''} proposée${cov.proposees > 1 ? 's' : ''}, ${cov.cherchent} personne${cov.cherchent > 1 ? 's' : ''} en cherche${cov.cherchent > 1 ? 'nt' : ''}` : ''}
        </p>
        <ul className="divide-y divide-black/5">
          {liste.map((i) => (
            <li key={i.id} className="py-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-base text-brand-black">
                  {i.prenom} {i.nom} · {i.personnes} pers.
                </p>
                <p className="text-sm text-brand-gray">
                  <a href={phoneToWa(i.tel) ? `https://wa.me/${phoneToWa(i.tel)}` : undefined} target="_blank" rel="noopener noreferrer" className="underline">
                    {telAffiche(i.tel)}
                  </a>
                  {i.covoiturage?.mode === 'propose' ? ` · propose ${i.covoiturage.places} place(s)` : ''}
                  {i.covoiturage?.mode === 'cherche' ? ' · cherche une place' : ''}
                  {i.covoiturage?.depart ? ` · depuis ${i.covoiturage.depart}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={occupe}
                onClick={() => {
                  if (window.confirm(`Retirer ${i.prenom} ${i.nom} de la liste ?`)) void agir({ action: 'retirer', slug, id: i.id });
                }}
                className="shrink-0 min-h-[44px] px-3 text-sm font-semibold text-red-800"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const clore = (slug: string, titre: string) => {
    if (window.confirm(`Clore « ${titre} » ? La liste des inscrits est effacée définitivement.`)) void agir({ action: 'effacer', slug });
  };

  return (
    <div className="space-y-3">
      <h2 className="font-display font-bold text-lg flex items-center gap-2">
        <CalendarCheck className="w-5 h-5 text-brand-olive" aria-hidden="true" />
        Inscriptions aux événements
      </h2>
      <p className="text-base text-brand-gray">
        Ouvrez les inscriptions d’un événement : il apparaît sur la page Événements du site, avec les places restantes.
        Après l’événement, « Clore et effacer » supprime la liste (noms et téléphones).
      </p>
      {erreur ? (
        <p role="alert" className="text-base text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {erreur}
        </p>
      ) : null}

      {events.length === 0 ? <p className="text-base text-brand-gray">Aucun événement à venir. Ajoutez-en dans Autre → Événements.</p> : null}
      {events.map((e) => {
        const slug = slugEvenement(e);
        const c = donnees.config[slug];
        return (
          <section key={slug} className="rounded-2xl bg-white border border-black/10 px-4 py-3 space-y-2">
            <p className="font-semibold text-base text-brand-black">{e.title}</p>
            <p className="text-sm text-brand-gray">{dateLisible(e)}</p>
            {!c ? (
              <div className="space-y-2">
                <label className="block text-sm text-brand-black">
                  Nombre de places (0 = illimité)
                  <input
                    type="number"
                    min={0}
                    max={500}
                    inputMode="numeric"
                    value={places[slug] ?? '0'}
                    onChange={(ev) => setPlaces((p) => ({ ...p, [slug]: ev.target.value }))}
                    className="mt-1 w-full min-h-[48px] rounded-xl border border-black/10 px-3 text-base"
                  />
                </label>
                <label className="flex items-center gap-3 min-h-[44px] text-base text-brand-black">
                  <input
                    type="checkbox"
                    checked={Boolean(covoit[slug])}
                    onChange={(ev) => setCovoit((p) => ({ ...p, [slug]: ev.target.checked }))}
                    className="h-5 w-5 accent-brand-olive"
                  />
                  Proposer le covoiturage
                </label>
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => void agir({ action: 'ouvrir', slug, titre: e.title, places: Number(places[slug] ?? 0), covoiturage: Boolean(covoit[slug]) })}
                  className="w-full min-h-[48px] rounded-xl bg-orange-primary text-white font-semibold text-base disabled:opacity-60"
                >
                  Ouvrir les inscriptions
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-brand-olive">
                  {c.ouvert ? 'Inscriptions ouvertes' : 'Inscriptions fermées'} · {c.places ? `${c.places} places` : 'places illimitées'}
                  {c.covoiturage ? ' · covoiturage' : ''}
                </p>
                {inscrits(slug)}
                <div className="flex flex-wrap gap-2">
                  {c.ouvert ? (
                    <button type="button" disabled={occupe} onClick={() => void agir({ action: 'fermer', slug })} className="min-h-[44px] px-4 rounded-xl border border-black/15 text-base font-semibold">
                      Fermer les inscriptions
                    </button>
                  ) : null}
                  <button type="button" disabled={occupe} onClick={() => clore(slug, c.titre)} className="min-h-[44px] px-4 rounded-xl border border-red-300 text-red-800 text-base font-semibold">
                    Clore et effacer
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      {passes.length ? (
        <section className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 space-y-2">
          <p className="font-semibold text-base text-brand-black">Événements passés : listes à effacer</p>
          {passes.map((slug) => (
            <div key={slug} className="space-y-1">
              <p className="text-base text-brand-black">{donnees.config[slug].titre}</p>
              {inscrits(slug)}
              <button type="button" disabled={occupe} onClick={() => clore(slug, donnees.config[slug].titre)} className="min-h-[44px] px-4 rounded-xl border border-red-300 text-red-800 text-base font-semibold">
                Clore et effacer
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
