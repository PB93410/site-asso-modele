import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import MembershipSection from '../sections/MembershipSection';
import { usePageMeta } from '../hooks/usePageMeta';
import { ASSO, ESSAIS_LABEL, PAYMENT_MODES, TARIF_LABEL } from '../data/asso';
import { SEASON_LABEL } from '../data/CONFIG';

export default function TarifsPage() {
  usePageMeta({
    title: `Tarifs et adhésion — ${ASSO.nom} ${TARIF_LABEL}/an`,
    description: `Cotisation ${TARIF_LABEL}/an à ${ASSO.ville} (${ASSO.codePostal}), ${ASSO.adhesion.inclus}.${ESSAIS_LABEL ? ` ${ESSAIS_LABEL}.` : ''} Paiement : ${PAYMENT_MODES.join(', ')}.`,
    path: '/tarifs',
  });

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <nav aria-label="Fil d'Ariane" className="bg-white border-b border-black/[0.06] page-chrome-top">
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
              Tarifs
            </li>
          </ol>
        </div>
      </nav>
      <main id="main-content">
        <div className="content-max-width pt-8 pb-2">
          <p className="font-mono text-[11px] tracking-[2px] uppercase text-orange-primary mb-2">
            Saison {SEASON_LABEL}
          </p>
          <h1 className="font-display font-black text-[28px] md:text-[40px] text-brand-black leading-tight mb-3">
            Tarifs et adhésion à {ASSO.ville}
          </h1>
          <p className="font-body text-[16px] text-brand-gray leading-relaxed max-w-[640px]">
            Un seul tarif : <strong className="text-brand-black">{TARIF_LABEL} l&apos;année</strong>,{' '}
            {ASSO.adhesion.inclus}. Valable pour tous les cours, dès le premier jour comme en cours de saison.
          </p>
        </div>
        <MembershipSection />
        <div className="content-max-width pb-12 -mt-4">
          <p className="font-body text-[15px] text-brand-gray leading-relaxed max-w-[640px]">
            Pour adhérer, utilisez le{' '}
            <Link to="/inscription" className="text-orange-primary underline underline-offset-2">
              formulaire d&apos;inscription
            </Link>{' '}
            ({PAYMENT_MODES.join(', ').toLowerCase()}). Vous pouvez d&apos;abord{' '}
            <Link to="/essai" className="text-orange-primary underline underline-offset-2">
              réserver un essai gratuit
            </Link>
            . Article :{' '}
            <Link to="/blog/combien-coute-l-adhesion" className="text-orange-primary underline underline-offset-2">
              ce que comprend la cotisation
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
