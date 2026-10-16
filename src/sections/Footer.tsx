import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { ACTIVITIES, SITE_CONFIG, WHATSAPP_TEMPLATES, waUrl } from '../data/siteData';
import { ACTIVITY_PAGES } from '../data/activityPages';
import { ASSO, AUTOUR_PATH, HAS_FEDERATION, MODULES } from '../data/asso';

const footerLinks: { label: string; href: string; isPage?: boolean }[] = [
  { label: 'Cours & horaires', href: '/#horaires' },
  { label: 'Tarifs', href: '/tarifs', isPage: true },
  { label: 'FAQ', href: '/faq', isPage: true },
  { label: 'Blog', href: '/blog', isPage: true },
  { label: "L'association", href: '/#a-propos' },
  { label: 'Contact', href: '/#contact' },
];

const discoverLinks: { label: string; href: string; isPage?: boolean }[] = [
  MODULES.inscriptionsEvenements
    ? { label: 'Événements et inscriptions', href: '/evenements', isPage: true }
    : { label: 'Événements de la saison', href: '/#evenements' },
  { label: `Autour de ${ASSO.ville}`, href: AUTOUR_PATH, isPage: true },
  ...(MODULES.quiz ? [{ label: 'Quel cours pour moi ?', href: '/quiz', isPage: true }] : []),
  ...(MODULES.clubEnChiffres ? [{ label: 'Le club en chiffres', href: '/le-club-en-chiffres', isPage: true }] : []),
  ...(MODULES.alertes ? [{ label: 'Alertes cours', href: '/alertes', isPage: true }] : []),
  ...(MODULES.espace ? [{ label: 'Mon espace adhérent', href: '/espace', isPage: true }] : []),
  ...(MODULES.attestations && !MODULES.espace ? [{ label: 'Attestations', href: '/attestations', isPage: true }] : []),
  { label: 'Mentions légales', href: '/mentions-legales', isPage: true },
  { label: 'Confidentialité', href: '/confidentialite', isPage: true },
];

const courseLinks = ACTIVITIES.map((a) => ({
  label: a.name,
  href: `/${ACTIVITY_PAGES.find((p) => p.name === a.name)?.slug ?? ''}`,
}));

export default function Footer() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  const handleHomeHash = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const hash = href.includes('#') ? `#${href.split('#')[1]}` : '';
    if (!hash || !isHome) return;
    e.preventDefault();
    const target = document.querySelector(hash);
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.scrollY - (document.querySelector('header')?.getBoundingClientRect().height || 80) - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };

  return (
    <footer className="bg-brand-black" style={{ padding: '64px 1.5rem 32px' }}>
      <div className="content-max-width">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
          <div>
            <Link
              to="/"
              className="font-display font-black text-[20px] tracking-[3px] text-white"
            >
              {ASSO.nomCourt}
            </Link>
            <p className="font-body text-[13px] text-brand-gray mt-2 max-w-[280px]">
              {ASSO.nom} — {ASSO.statut}. {ASSO.accroche} à {ASSO.ville} ({ASSO.codePostal})
            </p>
            {ASSO.whatsapp ? (
              <a
                href={waUrl(WHATSAPP_TEMPLATES.question)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center min-h-[44px] font-body text-[13px] text-brand-olive hover:text-white hover:underline mt-1"
              >
                WhatsApp — {ASSO.telephone}
              </a>
            ) : null}
            {SITE_CONFIG.instagramUrl ? (
              <a
                href={SITE_CONFIG.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-h-[44px] font-body text-[13px] text-brand-olive hover:text-white hover:underline"
              >
                Instagram {SITE_CONFIG.instagramHandle}
              </a>
            ) : null}
          </div>
          <div className="flex flex-col sm:flex-row gap-8">
            <div>
              <p className="font-mono text-[10px] tracking-[2px] uppercase text-brand-gray mb-3">Menu</p>
              <div className="flex flex-col gap-2">
                {footerLinks.map((link) =>
                  link.isPage ? (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="font-body text-[13px] text-brand-gray hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleHomeHash(e, link.href)}
                      className="font-body text-[13px] text-brand-gray hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  )
                )}
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-[2px] uppercase text-brand-gray mb-3">Nos cours</p>
              <div className="flex flex-col gap-2">
                {courseLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="font-body text-[13px] text-brand-gray hover:text-white transition-colors duration-150"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-[2px] uppercase text-brand-gray mb-3">À découvrir</p>
              <div className="flex flex-col gap-2">
                {discoverLinks.map((link) =>
                  link.isPage ? (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="font-body text-[13px] text-brand-gray hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleHomeHash(e, link.href)}
                      className="font-body text-[13px] text-brand-gray hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {ASSO.reseaux.avisGoogle ? (
        <div className="mt-8 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg key={s} className="w-5 h-5 text-orange-primary fill-orange-primary" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <p className="font-body text-[14px] text-white font-medium">
              Vous aimez {ASSO.nomCourt} ?
            </p>
          </div>
          <a
            href={ASSO.reseaux.avisGoogle}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body font-medium text-[13px] text-brand-olive border border-brand-olive/35 hover:bg-brand-olive/10 px-4 py-2 rounded-xl transition-all"
          >
            Laisser un avis Google
          </a>
        </div>
        ) : null}

        <div className="w-full h-px bg-white/[0.06] my-10" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-body text-[13px] text-brand-gray">
            &copy; {new Date().getFullYear()} {ASSO.nom}. Tous droits réservés.
          </p>
          <p className="font-body text-[13px] text-brand-gray">
            {ASSO.statut} — {ASSO.ville} ({ASSO.codePostal})
          </p>
          {HAS_FEDERATION ? (
            <a
              href={ASSO.federation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity"
              title={ASSO.federation.nom}
            >
              <img
                src={ASSO.federation.logo}
                alt={ASSO.federation.nom}
                width="240"
                height="96"
                className="h-10 w-auto max-w-[200px] object-contain"
                loading="lazy"
                decoding="async"
              />
            </a>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="font-body text-[12px] text-brand-gray">
            <Link to="/mentions-legales" className="hover:text-white transition-colors">
              Mentions légales
            </Link>
            {' · '}
            <Link to="/confidentialite" className="hover:text-white transition-colors">
              Politique de confidentialité
            </Link>
            {' · '}
            <Link to="/confidentialite#cookies" className="hover:text-white transition-colors">
              Cookies
            </Link>
          </p>
          <ThemeToggle variant="text" />
        </div>
      </div>
    </footer>
  );
}
