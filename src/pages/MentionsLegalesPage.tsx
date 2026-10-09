import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import { MentionsLegalesContent } from '../sections/LegalSection';
import { ASSO } from '../data/asso';

export default function MentionsLegalesPage() {
  usePageMeta({
    title: `Mentions légales — ${ASSO.nom}`,
    description: `Mentions légales de ${ASSO.nom} (${ASSO.statut}) : éditeur, hébergeur, responsable de publication.`,
    path: '/mentions-legales',
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
              Mentions légales
            </li>
          </ol>
        </div>
      </nav>

      <main id="main-content">
        <MentionsLegalesContent heading="h1" />
      </main>
      <Footer />
    </div>
  );
}
