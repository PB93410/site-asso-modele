import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ASSO } from '../data/asso';

/**
 * Page 404 client — noindex pour éviter l'indexation des soft-404 SPA.
 * Netlify sert aussi 404.html (statut HTTP 404) pour les URL hors redirects connus.
 */
export default function NotFoundPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `Page introuvable — ${ASSO.nom}`;

    // Navigation SPA : recharger l’URL pour que Netlify réponde 404.html (HTTP 404).
    if (import.meta.env.PROD) {
      const path = window.location.pathname;
      const key = `asso-hard-404:${path}`;
      if (path !== '/404.html' && sessionStorage.getItem(key) !== '1') {
        sessionStorage.setItem(key, '1');
        window.location.replace(path);
      }
    }

    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, follow');

    return () => {
      // Restaurer indexation par défaut au démontage
      if (robots) robots.setAttribute('content', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center px-6 page-chrome-top pb-16">
      <div className="text-center max-w-md">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-4">
          Erreur 404
        </p>
        <h1 className="font-display font-black text-brand-black text-3xl sm:text-4xl mb-4">
          Page introuvable
        </h1>
        <p className="font-body text-[15px] text-brand-gray leading-relaxed mb-8">
          Cette adresse n&apos;existe pas sur le site de {ASSO.nom}.
          Vérifiez le lien ou revenez à l&apos;accueil.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center font-body font-semibold text-[14px] text-white px-6 py-3 rounded-full min-h-[44px] bg-orange-primary hover:bg-orange-hover"
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            to="/blog"
            className="inline-flex items-center justify-center font-body font-medium text-[14px] text-brand-black border border-black/15 hover:border-black/30 px-6 py-3 rounded-full min-h-[44px]"
          >
            Voir le blog
          </Link>
        </div>
      </div>
    </div>
  );
}
