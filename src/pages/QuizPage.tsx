import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ASSO, MODULES, NB_ESSAIS } from '../data/asso';
import { ESSAI_CTA_UNTIL } from '../data/CONFIG';
import { ACTIVITY_PAGES } from '../data/activityPages';
import { QUIZ_QUESTIONS, recommanderCours, type QuizReponses } from '../lib/quizCours';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

const ESSAI_OUVERT = MODULES.essais && NB_ESSAIS > 0 && Date.now() < ESSAI_CTA_UNTIL;

export default function QuizPage() {
  const [etape, setEtape] = useState(0);
  const [reponses, setReponses] = useState<QuizReponses>({});

  usePageMeta({
    title: `Quel cours pour moi ? — ${ASSO.nom}`,
    description: `Six questions pour trouver le cours de ${ASSO.nom} à ${ASSO.ville} qui vous convient.`,
    path: '/quiz',
  });

  const question = QUIZ_QUESTIONS[etape];
  const termine = etape >= QUIZ_QUESTIONS.length;
  const resultats = useMemo(() => (termine ? recommanderCours(reponses) : []), [termine, reponses]);
  const cta = (nom: string) => (ESSAI_OUVERT ? `/essai?cours=${encodeURIComponent(nom)}` : '/inscription');
  const ctaLabel = ESSAI_OUVERT ? 'Venir essayer' : 'S’inscrire';

  if (!MODULES.quiz) return <NotFoundPage />;

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
            <li className="text-brand-black font-medium">Quel cours pour moi ?</li>
          </ol>
        </div>
      </nav>

      <main id="main-content" className="content-max-width py-10 sm:py-14">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">6 questions</p>
        <h1 className="font-display font-black text-brand-black text-[clamp(1.8rem,5vw,2.8rem)] leading-tight mb-4">
          Quel cours pour moi ?
        </h1>
        <p className="font-body text-[17px] text-brand-gray max-w-[36rem] mb-8">
          Répondez sans réfléchir trop longtemps. On vous propose ensuite les cours qui correspondent, à {ASSO.ville}.
        </p>

        {!termine && question ? (
          <div className="max-w-xl">
            <p className="font-body text-[14px] text-brand-gray mb-2">
              Question {etape + 1} sur {QUIZ_QUESTIONS.length}
            </p>
            <h2 className="font-display font-bold text-[24px] text-brand-black mb-2">{question.titre}</h2>
            {question.aide ? <p className="font-body text-[15px] text-brand-gray mb-4">{question.aide}</p> : null}
            <div className="space-y-3">
              {question.choix.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setReponses((r) => ({ ...r, [question.id]: c.id }));
                    setEtape((n) => n + 1);
                  }}
                  className="w-full min-h-[48px] text-left px-4 py-3 rounded-2xl bg-white ring-1 ring-black/10 hover:ring-orange-primary font-body text-[17px] text-brand-black"
                >
                  {c.label}
                </button>
              ))}
            </div>
            {etape > 0 ? (
              <button
                type="button"
                onClick={() => setEtape((n) => Math.max(0, n - 1))}
                className="mt-6 min-h-[44px] font-semibold text-brand-olive"
              >
                Question précédente
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5 max-w-2xl">
            <p className="font-body text-[17px] text-brand-gray">Voici ce qui vous correspond le mieux.</p>
            {resultats.map((r, i) => {
              const slug = ACTIVITY_PAGES.find((p) => p.name === r.nom)?.slug;
              return (
                <article key={r.nom} className="rounded-2xl bg-white ring-1 ring-black/10 p-5 sm:p-6">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-orange-primary mb-1">
                    {i === 0 ? 'Le plus proche' : `Aussi ${i + 1}`}
                  </p>
                  <h2 className="font-display font-bold text-[22px] text-brand-black">{r.nom}</h2>
                  <p className="font-body text-[15px] text-brand-gray mt-1">{r.resume}</p>
                  {r.raisons.length ? (
                    <p className="font-body text-[15px] text-brand-black mt-3">{r.raisons.join(' · ')}</p>
                  ) : null}
                  {r.creneaux.length ? (
                    <ul className="mt-3 space-y-1 font-body text-[15px] text-brand-gray">
                      {r.creneaux.map((c) => (
                        <li key={`${c.jour}${c.horaire}`}>
                          {c.jour} {c.horaire}
                          {c.lieu ? ` — ${c.lieu}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-wrap gap-3 mt-5">
                    <Link
                      to={cta(r.nom)}
                      className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold"
                    >
                      {ctaLabel}
                    </Link>
                    {slug ? (
                      <Link to={`/${slug}`} className="inline-flex items-center justify-center min-h-[44px] px-5 font-semibold text-brand-olive">
                        Voir le cours
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setEtape(0);
                setReponses({});
              }}
              className="min-h-[44px] font-semibold text-brand-olive"
            >
              Recommencer
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
