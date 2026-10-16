import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { ASSO, MODULES } from '../data/asso';
import { useEventsFromSheet } from '../hooks/useSheetData';
import { usePageMeta } from '../hooks/usePageMeta';
import { dateLisible, libellePlaces, slugEvenement, type EvenementOuvert } from '../lib/evenements';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

const champ =
  'w-full min-h-[48px] rounded-xl border border-black/10 bg-[#FDF8F1] px-3 py-2.5 font-body text-[16px] text-brand-black focus:outline-none focus:ring-2 focus:ring-orange-primary/35 focus:border-orange-primary/50 focus:bg-white';
const etiquette = 'block font-body text-sm font-medium text-brand-black mb-1.5';

function useOuvertes() {
  const [ouvertes, setOuvertes] = useState<Record<string, EvenementOuvert>>({});
  useEffect(() => {
    let vivant = true;
    fetch('/api/evenement-inscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; ouvertes?: Record<string, EvenementOuvert> } | null) => {
        if (vivant && d?.ok && d.ouvertes) setOuvertes(d.ouvertes);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);
  return ouvertes;
}

/** Formulaire d'inscription d'un événement : coordonnées, nombre de personnes, covoiturage facultatif. */
function Inscription({ slug, info, onFait }: { slug: string; info: EvenementOuvert; onFait: (personnes: number) => void }) {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [personnes, setPersonnes] = useState(1);
  const [covoiturage, setCovoiturage] = useState<'' | 'propose' | 'cherche'>('');
  const [places, setPlaces] = useState(2);
  const [depart, setDepart] = useState('');
  const [bot, setBot] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [fait, setFait] = useState(false);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/evenement-inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          prenom,
          nom,
          telephone,
          personnes,
          covoiturage,
          places_covoiturage: covoiturage === 'propose' ? places : 0,
          depart: covoiturage ? depart : '',
          'bot-field': bot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Inscription impossible.');
      setFait(true);
      onFait(personnes);
    } catch (x) {
      setErreur(x instanceof Error ? x.message : 'Inscription impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) {
    return (
      <div role="status" className="rounded-2xl border border-brand-olive/30 bg-white p-5 text-center">
        <CheckCircle2 className="mx-auto text-brand-olive mb-2" size={32} aria-hidden="true" />
        <p className="font-display font-bold text-[20px] text-brand-black">Merci {prenom.trim()} !</p>
        <p className="font-body text-[15px] text-brand-gray mt-1">
          Votre inscription est enregistrée{personnes > 1 ? ` pour ${personnes} personnes` : ''}. Un bénévole vous
          contacte seulement si quelque chose change.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void envoyer(e)} className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
      <p className="hidden" aria-hidden="true">
        <label>
          Ne pas remplir
          <input value={bot} onChange={(e) => setBot(e.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={etiquette} htmlFor={`p-${slug}`}>Prénom</label>
          <input id={`p-${slug}`} className={champ} value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" required />
        </div>
        <div>
          <label className={etiquette} htmlFor={`n-${slug}`}>Nom</label>
          <input id={`n-${slug}`} className={champ} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="family-name" required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={etiquette} htmlFor={`t-${slug}`}>Téléphone</label>
          <input id={`t-${slug}`} className={champ} type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" placeholder="06 ou 07…" required />
        </div>
        <div>
          <label className={etiquette} htmlFor={`k-${slug}`}>Nombre de personnes</label>
          <select id={`k-${slug}`} className={champ} value={personnes} onChange={(e) => setPersonnes(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n} disabled={info.restantes !== null && n > info.restantes}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {info.covoiturage ? (
        <fieldset className="space-y-2">
          <legend className={etiquette}>Covoiturage (facultatif)</legend>
          {(
            [
              ['', 'Je n’en ai pas besoin'],
              ['propose', 'Je propose des places'],
              ['cherche', 'Je cherche une place'],
            ] as const
          ).map(([valeur, texte]) => (
            <label key={valeur} className="flex items-center gap-3 min-h-[44px] font-body text-[16px] text-brand-black">
              <input type="radio" name={`c-${slug}`} checked={covoiturage === valeur} onChange={() => setCovoiturage(valeur)} className="h-5 w-5 accent-orange-primary" />
              {texte}
            </label>
          ))}
          {covoiturage ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {covoiturage === 'propose' ? (
                <div>
                  <label className={etiquette} htmlFor={`cp-${slug}`}>Places proposées</label>
                  <select id={`cp-${slug}`} className={champ} value={places} onChange={(e) => setPlaces(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className={etiquette} htmlFor={`cd-${slug}`}>Commune de départ</label>
                <input id={`cd-${slug}`} className={champ} value={depart} onChange={(e) => setDepart(e.target.value)} placeholder={ASSO.ville} maxLength={60} />
              </div>
            </div>
          ) : null}
          {covoiturage ? (
            <p className="font-body text-[14px] text-brand-gray">
              Le bureau vous met en relation avec les autres inscrits : votre téléphone n’est jamais affiché sur le site.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {erreur ? (
        <p role="alert" className="font-body text-[15px] text-red-800 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {erreur}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={envoi}
        className="w-full min-h-[52px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[16px] disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {envoi ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Envoi…
          </>
        ) : (
          'Je m’inscris'
        )}
      </button>
      <p className="font-body text-[13px] text-brand-gray leading-relaxed">
        Vos coordonnées servent à organiser cet événement et sont effacées ensuite.{' '}
        <Link to="/confidentialite/" className="underline">
          Confidentialité
        </Link>
        .
      </p>
    </form>
  );
}

/** Agenda public des événements (modules.inscriptionsEvenements), avec l'inscription quand le bureau l'a ouverte. */
export default function EvenementsPage() {
  if (!MODULES.inscriptionsEvenements) return <NotFoundPage />;
  return <Evenements />;
}

function Evenements() {
  const { events } = useEventsFromSheet();
  const [ouvertes, setOuvertes] = useState<Record<string, EvenementOuvert>>({});
  const initiales = useOuvertes();
  const [ouvert, setOuvert] = useState('');

  usePageMeta({
    title: `Événements — ${ASSO.nom}`,
    description: `Les prochains événements de ${ASSO.nom}, avec inscription et covoiturage.`,
    path: '/evenements',
  });

  const liste = { ...initiales, ...ouvertes };

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <nav aria-label="Fil d'Ariane" className="bg-white border-b border-black/[0.06] page-chrome-top">
        <div className="content-max-width py-3">
          <ol className="flex items-center gap-2 font-body text-[13px]">
            <li>
              <Link to="/" className="text-brand-gray hover:text-brand-black">
                Accueil
              </Link>
            </li>
            <li className="text-brand-gray" aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li className="text-brand-black font-medium" aria-current="page">
              Événements
            </li>
          </ol>
        </div>
      </nav>

      <main id="main-content" className="content-max-width py-12 md:py-16 max-w-[720px]">
        <h1 className="font-display font-black text-[28px] md:text-[36px] text-brand-black leading-tight mb-3">
          Les événements
        </h1>
        <p className="font-body text-[16px] text-brand-gray leading-relaxed mb-8">
          L’association se retrouve aussi en dehors des cours. Quand l’inscription est ouverte, vous la faites ici, en
          une minute.
        </p>

        {events.length === 0 ? (
          <p className="font-body text-[16px] text-brand-gray">Aucun événement à venir pour le moment.</p>
        ) : (
          <ul className="space-y-5">
            {events.map((e) => {
              const slug = slugEvenement(e);
              const info = liste[slug];
              return (
                <li key={slug || e.id}>
                  <article className="rounded-2xl bg-white border border-black/[0.06] p-5 space-y-3">
                    <p className="font-mono text-[12px] tracking-[2px] uppercase text-orange-primary flex items-center gap-2">
                      <CalendarDays size={15} aria-hidden="true" />
                      {dateLisible(e)}
                      {e.time ? ` · ${e.time}` : ''}
                    </p>
                    <h2 className="font-display font-black text-[22px] text-brand-black leading-tight">{e.title}</h2>
                    {e.description ? <p className="font-body text-[15px] text-brand-gray leading-relaxed">{e.description}</p> : null}
                    {e.location ? (
                      <p className="font-body text-[14px] text-brand-gray flex items-center gap-1.5">
                        <MapPin size={14} className="text-orange-primary shrink-0" aria-hidden="true" />
                        {e.location}
                      </p>
                    ) : null}
                    {info ? (
                      <div className="pt-1 space-y-3">
                        <p className={`font-body font-semibold text-[15px] ${info.complet ? 'text-red-800' : 'text-brand-olive'}`}>
                          {libellePlaces(info)}
                        </p>
                        {!info.complet && ouvert !== slug ? (
                          <button
                            type="button"
                            onClick={() => setOuvert(slug)}
                            className="min-h-[48px] px-6 rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[15px]"
                          >
                            S’inscrire
                          </button>
                        ) : null}
                        {!info.complet && ouvert === slug ? (
                          <Inscription
                            slug={slug}
                            info={info}
                            onFait={(n) =>
                              setOuvertes((o) => ({
                                ...o,
                                [slug]: { ...info, restantes: info.restantes === null ? null : Math.max(0, info.restantes - n) },
                              }))
                            }
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
