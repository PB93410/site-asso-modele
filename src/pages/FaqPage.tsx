import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { ASSO, ESSAIS_LABEL, TARIF_LABEL } from '../data/asso';
import Footer from '../sections/Footer';
import FAQSection from '../sections/FAQSection';

export default function FaqPage() {
  usePageMeta({
    title: `FAQ ${ASSO.nom} — tarif, essais, certificat`,
    description: `FAQ ${ASSO.nom} (${ASSO.ville}) : tarif ${TARIF_LABEL}/an${ESSAIS_LABEL ? `, ${ESSAIS_LABEL}` : ''}, certificat médical, planning.`,
    path: '/faq',
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
              FAQ
            </li>
          </ol>
        </div>
      </nav>
      <main id="main-content">
        <FAQSection />
      </main>
      <Footer />
    </div>
  );
}
