import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Printer } from 'lucide-react';
import { ASSO, MODULES } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import { SCHEDULE } from '../data/siteData';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';
import { anciennete } from '../lib/clubEnChiffres';

type Chiffres = {
  ok: boolean;
  saison: string;
  adherentsPlusDe: number;
  parAge: { tranche: string; pct: number }[];
  communes: { nom: string; plusDe: number }[];
  nbCommunes: number;
};

function Tuile({ valeur, legende }: { valeur: string; legende: string }) {
  return (
    <div className="rounded-2xl bg-white border border-black/10 p-5">
      <p className="font-display font-black text-[36px] leading-none text-brand-black">{valeur}</p>
      <p className="font-body text-[15px] text-brand-gray mt-2">{legende}</p>
    </div>
  );
}

/** Page publique (modules.clubEnChiffres) : le club en quelques chiffres, anonymes (voir netlify/functions/_club-chiffres.mjs). */
export default function ClubEnChiffresPage() {
  if (!MODULES.clubEnChiffres) return <NotFoundPage />;
  return <ClubEnChiffres />;
}

function ClubEnChiffres() {
  const [chiffres, setChiffres] = useState<Chiffres | null>(null);
  const [indispo, setIndispo] = useState(false);
  const annees = anciennete(new Date());
  const noms = [...new Set(SCHEDULE.map((s) => s.course).filter(Boolean))];
  const cours = noms.length;
  const seances = SCHEDULE.length;
  const salles = ASSO.lieux.length;

  usePageMeta({
    title: `Le club en chiffres — ${ASSO.nom}`,
    description: `${ASSO.nom} : association${ASSO.anneeCreation ? ` depuis ${ASSO.anneeCreation}` : ''}, ${cours} cours, ${seances} séances par semaine. Chiffres anonymes de la saison.`,
    path: '/le-club-en-chiffres',
  });

  useEffect(() => {
    let vivant = true;
    fetch('/api/club-chiffres')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Chiffres | null) => {
        if (!vivant) return;
        if (d?.ok) setChiffres(d);
        else setIndispo(true);
      })
      .catch(() => {
        if (vivant) setIndispo(true);
      });
    return () => {
      vivant = false;
    };
  }, []);

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <nav aria-label="Fil d'Ariane" className="bg-white border-b border-black/[0.06] page-chrome-top print:hidden">
        <div className="content-max-width py-3">
          <ol className="flex items-center gap-2 font-body text-[13px]">
            <li>
              <Link to="/" className="text-brand-gray hover:text-brand-black transition-colors">
                Accueil
              </Link>
            </li>
            <li className="text-brand-gray" aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li className="text-brand-black font-medium" aria-current="page">
              Le club en chiffres
            </li>
          </ol>
        </div>
      </nav>

      <main id="main-content" className="content-max-width pt-8 pb-14 space-y-8">
        <header>
          <p className="font-mono text-[11px] tracking-[2px] uppercase text-orange-primary mb-2">
            {chiffres?.saison ? `Saison ${chiffres.saison.replace('-', '/')}` : 'Saison en cours'}
          </p>
          <h1 className="font-display font-black text-[28px] md:text-[40px] text-brand-black leading-tight mb-3">
            Le club en chiffres
          </h1>
          <p className="font-body text-[16px] text-brand-gray leading-relaxed max-w-[640px]">
            {ASSO.nom} est une association de bénévoles. Voici ce qu’elle représente aujourd’hui.
          </p>
        </header>

        <section aria-label="Le club" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {annees > 0 ? <Tuile valeur={`${annees} ans`} legende={`d’existence : l’association a été créée en ${ASSO.anneeCreation}`} /> : null}
          <Tuile valeur={String(cours)} legende={`cours : ${noms.slice(0, 4).join(', ')}${cours > 4 ? '…' : ''}`} />
          <Tuile
            valeur={String(seances)}
            legende={`séances par semaine${salles > 1 ? `, dans ${salles} lieux` : ''}`}
          />
          {chiffres && chiffres.adherentsPlusDe >= 10 ? (
            <Tuile valeur={`+${chiffres.adherentsPlusDe}`} legende="adhérents cette saison" />
          ) : (
            <Tuile valeur="—" legende="adhérents cette saison" />
          )}
        </section>

        {chiffres && chiffres.parAge.length ? (
          <section aria-label="Les âges" className="rounded-2xl bg-white border border-black/10 p-5 md:p-6">
            <h2 className="font-display font-bold text-[22px] text-brand-black mb-1">Tous les âges</h2>
            <p className="font-body text-[15px] text-brand-gray mb-4">Répartition des adhérents, arrondie à 5 %.</p>
            <ul className="space-y-3">
              {chiffres.parAge.map((a) => (
                <li key={a.tranche}>
                  <div className="flex justify-between font-body text-[16px] text-brand-black">
                    <span>{a.tranche}</span>
                    <span className="font-semibold">{a.pct} %</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/10 overflow-hidden" aria-hidden="true">
                    <div className="h-full rounded-full bg-orange-primary" style={{ width: `${a.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {chiffres && chiffres.communes.length ? (
          <section aria-label="Les communes" className="rounded-2xl bg-white border border-black/10 p-5 md:p-6">
            <h2 className="font-display font-bold text-[22px] text-brand-black mb-1">D’où viennent les adhérents</h2>
            <p className="font-body text-[15px] text-brand-gray mb-4">
              Des adhérents venus de {chiffres.nbCommunes} communes. Les principales :
            </p>
            <ul className="space-y-1">
              {chiffres.communes.map((c) => (
                <li key={c.nom} className="flex justify-between font-body text-[16px] text-brand-black">
                  <span>{c.nom}</span>
                  <span className="font-semibold">plus de {c.plusDe}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {indispo ? (
          <p role="status" className="font-body text-[15px] text-brand-gray">
            Les chiffres de la saison sont momentanément indisponibles. Les informations ci-dessus restent valables.
          </p>
        ) : null}

        <p className="font-body text-[14px] text-brand-gray leading-relaxed max-w-[640px]">
          Chiffres lus dans le registre des adhésions, arrondis et sans aucun nom. Une tranche d’âge ou une commune de
          moins de 10 personnes n’est pas affichée, pour que personne ne soit reconnaissable.
        </p>

        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-full border-2 border-orange-primary text-orange-primary font-semibold"
          >
            <Printer size={18} aria-hidden="true" />
            Imprimer cette page
          </button>
          <Link
            to={MODULES.adhesion ? '/inscription/' : '/tarifs/'}
            className="inline-flex items-center justify-center min-h-[48px] px-5 rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold"
          >
            Rejoindre le club
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
