import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Clock } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import { ASSO, AUTOUR_PATH, ESSAIS_LABEL, TARIF_LABEL, lieuAdresse, mapsUrl } from '../data/asso';
import { SCHEDULE } from '../data/siteData';

/** Page SEO locale : /autour-de-<ville>. Communes voisines et lieux : asso.config.js */
const VOISINES = ASSO.communesVoisines;
const VOISINES_TXT = VOISINES.join(', ');

function coursDuLieu(nom: string) {
  return SCHEDULE.filter((s) => s.location === nom).map(
    (s) => `${s.course} (${s.day.slice(0, 3).toLowerCase()}.)`,
  );
}

export default function AutourPage() {
  usePageMeta({
    title: `${ASSO.accroche} près de ${VOISINES_TXT} — ${ASSO.ville}`,
    description: `${ASSO.accroche} à ${ASSO.ville}, à quelques minutes de ${VOISINES_TXT}. ${TARIF_LABEL}/an${ESSAIS_LABEL ? `, ${ESSAIS_LABEL}` : ''}.`,
    path: AUTOUR_PATH,
  });

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
              Autour de {ASSO.ville}
            </li>
          </ol>
        </div>
      </nav>

      <main id="main-content" className="content-max-width py-12 md:py-16 max-w-[720px]">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">
          Communes voisines
        </p>
        <h1 className="font-display font-black text-[28px] md:text-[36px] text-brand-black leading-tight mb-4">
          Venir aux cours depuis {VOISINES_TXT}…
        </h1>
        <p className="font-body text-[17px] text-brand-gray leading-relaxed mb-8">
          Les cours sont à <strong className="text-brand-black">{ASSO.ville}</strong>. Beaucoup de
          personnes viennent pourtant des communes voisines : {VOISINES_TXT}. Un seul tarif :{' '}
          {TARIF_LABEL} l’année.
        </p>

        <div className="mb-10 space-y-4">
          <p className="font-mono text-[11px] tracking-[2px] uppercase text-orange-primary">
            {ASSO.lieux.length > 1 ? `${ASSO.lieux.length} lieux, un planning` : 'Le lieu'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ASSO.lieux.map((lieu) => {
              const cours = coursDuLieu(lieu.nom);
              return (
                <article
                  key={lieu.id}
                  className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden p-4"
                >
                  <p className="font-display font-bold text-[18px] text-brand-black leading-tight">
                    {lieu.nom}
                  </p>
                  <p className="font-body text-[14px] text-brand-gray mt-1">{lieuAdresse(lieu)}</p>
                  {lieu.acces ? (
                    <p className="font-body text-[13px] text-brand-gray mt-1">{lieu.acces}</p>
                  ) : null}
                  {cours.length ? (
                    <p className="font-body text-[13px] text-brand-gray mt-2 inline-flex gap-1.5">
                      <Clock size={14} className="text-orange-primary shrink-0 mt-0.5" />
                      {cours.join(', ')}
                    </p>
                  ) : null}
                  <a
                    href={mapsUrl(lieu)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 mt-2 font-body font-semibold text-[14px] text-orange-primary min-h-[44px]"
                  >
                    <MapPin size={14} />
                    Itinéraire
                  </a>
                </article>
              );
            })}
          </div>
          <p className="font-body text-[14px] text-brand-gray leading-relaxed">
            L’itinéraire s’ouvre dans Google Maps (hors du site) — pas de carte embarquée.
          </p>
        </div>

        <section className="mb-10" aria-labelledby="autres-communes">
          <h2
            id="autres-communes"
            className="font-display font-bold text-[18px] text-brand-black mb-3"
          >
            Depuis les communes voisines
          </h2>
          <p className="font-body text-[15px] text-brand-gray leading-relaxed mb-4">
            Tout se passe à {ASSO.ville}, au même tarif {TARIF_LABEL}.
            {ESSAIS_LABEL ? ` ${ESSAIS_LABEL} pour choisir votre créneau avant d’adhérer.` : ''}
          </p>
          <ul className="flex flex-wrap gap-2">
            {VOISINES.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 font-body text-[13px] text-brand-black"
              >
                <MapPin size={14} className="text-orange-primary shrink-0" />
                {name}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/essai"
            className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-full font-body font-semibold text-[15px] text-white bg-orange-primary hover:bg-orange-hover"
          >
            Réserver un essai
          </Link>
          <Link
            to="/#horaires"
            className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-full font-body font-semibold text-[15px] text-brand-black border border-black/15"
          >
            Voir le planning
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
