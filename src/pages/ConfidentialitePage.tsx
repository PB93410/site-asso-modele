import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import { ConfidentialiteContent } from '../sections/LegalSection';
import { ASSO } from '../data/asso';

export default function ConfidentialitePage() {
  usePageMeta({
    title: `Politique de confidentialité — ${ASSO.nom}`,
    description: `Politique de confidentialité RGPD de ${ASSO.nom} : essais et inscription, durées de conservation et exercice des droits.`,
    path: '/confidentialite',
    scrollToTop: typeof window === 'undefined' ? true : !window.location.hash,
  });

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

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
              Confidentialité
            </li>
          </ol>
        </div>
      </nav>

      <main id="main-content">
        <ConfidentialiteContent heading="h1" />
      </main>
      <Footer />
    </div>
  );
}
