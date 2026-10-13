import { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BANDEAU_END, ESSAI_CTA_UNTIL } from '../data/CONFIG';
import { ASSO, MODULES, NB_ESSAIS } from '../data/asso';

/** Tant que le bandeau essais est actif : CTA = Essai. Ensuite = Adhérer. */
const SHOW_ESSAI_CTA = Date.now() < ESSAI_CTA_UNTIL;
const SHOW_CAMPAIGN = NB_ESSAIS > 0 && Date.now() < BANDEAU_END;

type NavLink = { label: string; href: string; isPage?: boolean };

/** Liens principaux (hash sur home, /#hash hors home) — même structure partout */
const navLinks: NavLink[] = [
  { label: 'Cours & horaires', href: '#horaires' },
  { label: 'Tarifs', href: '/tarifs', isPage: true },
  ...(MODULES.quiz ? [{ label: 'Quel cours ?', href: '/quiz', isPage: true } as NavLink] : []),
  { label: 'FAQ', href: '/faq', isPage: true },
  { label: 'Blog', href: '/blog', isPage: true },
];

/** Même liens principaux, version hors page d'accueil */
const offHomeLinks: NavLink[] = [
  { label: 'Cours & horaires', href: '/#horaires' },
  { label: 'Tarifs', href: '/tarifs', isPage: true },
  ...(MODULES.quiz ? [{ label: 'Quel cours ?', href: '/quiz', isPage: true } as NavLink] : []),
  { label: 'FAQ', href: '/faq', isPage: true },
  { label: 'Blog', href: '/blog', isPage: true },
];

/** Menu mobile : association, contact, pages secondaires */
const secondaryLinks: NavLink[] = [
  { label: "L'association", href: '/#a-propos' },
  { label: 'Contact', href: '/#contact' },
  { label: 'Mentions légales', href: '/mentions-legales', isPage: true },
];

const NAV_IDLE = 'text-[#EDEAE3] hover:text-white';
const NAV_ACTIVE = 'text-white';

export default function Navigation() {
  const navRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const location = useLocation();
  const path = location.pathname;
  const isHome = location.pathname === '/';

  useEffect(() => {
    document.documentElement.classList.toggle('has-campaign', SHOW_CAMPAIGN);
    return () => document.documentElement.classList.remove('has-campaign');
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0);
      setScrolled(window.scrollY > 32);

      if (!isHome) return;
      const ids = navLinks.map((l) => l.href.replace('#', '')).filter(Boolean);
      let current = '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 120) current = id;
      }
      setActiveSection(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const hash = href.includes('#') ? `#${href.split('#')[1]}` : '';
    if (!hash) {
      setMobileOpen(false);
      return;
    }
    if (!isHome) {
      setMobileOpen(false);
      return;
    }
    e.preventDefault();
    setMobileOpen(false);
    const target = document.querySelector(hash) as HTMLElement | null;
    if (!target) return;
    const header = document.querySelector('header');
    const headerH = header ? header.getBoundingClientRect().height : 80;
    const y = target.getBoundingClientRect().top + window.scrollY - headerH - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    window.history.replaceState(null, '', hash);
  };

  const onEssai = path.startsWith('/essai');
  const onInscription = path.startsWith('/inscription');
  const ctaIsHome = onEssai || onInscription;
  const ctaTo = ctaIsHome ? '/' : SHOW_ESSAI_CTA ? '/essai' : '/inscription';
  const ctaLabel = ctaIsHome ? 'Accueil' : SHOW_ESSAI_CTA ? 'Essai' : 'Adhérer';
  const ctaClass =
    'font-body text-sm font-medium rounded-full whitespace-nowrap inline-flex items-center justify-center min-h-[40px]';
  const ctaClassPrimary = `${ctaClass} text-white bg-orange-primary hover:bg-orange-hover px-4 sm:px-5 py-2`;
  const ctaClassHome = `${ctaClass} text-white border border-white/35 hover:border-white px-4 sm:px-5 py-2`;
  const overlayHero = isHome && !scrolled && !mobileOpen;

  return (
    <>
      <div
        className="fixed top-0 left-0 h-[2px] bg-orange-primary z-[60] transition-all duration-100"
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />
      <header className="fixed top-[2px] left-0 right-0 z-[60]">
        <nav
          ref={navRef}
          className={`h-[56px] sm:h-[72px] flex items-center transition-all duration-300 ${
            overlayHero
              ? 'bg-gradient-to-b from-black/70 to-transparent'
              : 'bg-[#111110]'
          }`}
        >
          <div className="content-max-width w-full h-full grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Link
              to="/"
              className="font-display font-black text-base sm:text-lg tracking-[2px] sm:tracking-[3px] text-white justify-self-start shrink-0"
              onClick={() => setMobileOpen(false)}
            >
              {ASSO.nomCourt}
            </Link>

            <div className="hidden lg:flex items-center justify-center gap-4 xl:gap-6 justify-self-center">
              {isHome ? (
                navLinks.map((link) => {
                  const active = link.isPage
                    ? location.pathname === link.href
                    : activeSection === link.href.slice(1);
                  if (link.isPage) {
                    return (
                      <Link
                        key={link.href}
                        to={link.href}
                        className={`font-body text-sm font-medium transition-colors duration-150 relative whitespace-nowrap ${
                          active ? NAV_ACTIVE : NAV_IDLE
                        }`}
                      >
                        {link.label}
                        <span
                          className="absolute -bottom-1 left-0 h-[2px] bg-orange-primary transition-all duration-200"
                          style={{ width: active ? '100%' : '0%' }}
                        />
                      </Link>
                    );
                  }
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`font-body text-sm font-medium transition-colors duration-150 relative whitespace-nowrap ${
                        active ? NAV_ACTIVE : NAV_IDLE
                      }`}
                    >
                      {link.label}
                      <span
                        className="absolute -bottom-1 left-0 h-[2px] bg-orange-primary transition-all duration-200"
                        style={{ width: active ? '100%' : '0%' }}
                      />
                    </a>
                  );
                })
              ) : (
                <>
                  {offHomeLinks.map((link) =>
                    link.isPage ? (
                      <Link
                        key={link.href}
                        to={link.href}
                        className={`font-body text-sm font-medium ${
                          location.pathname === link.href ? NAV_ACTIVE : NAV_IDLE
                        } transition-colors whitespace-nowrap`}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        key={link.href}
                        href={link.href}
                        className={`font-body text-sm font-medium ${NAV_IDLE} transition-colors whitespace-nowrap`}
                      >
                        {link.label}
                      </a>
                    )
                  )}
                </>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-3 justify-self-end shrink-0">
              <Link to={ctaTo} className={ctaIsHome ? ctaClassHome : ctaClassPrimary}>
                {ctaLabel}
              </Link>
            </div>

            <div className="flex lg:hidden items-center justify-self-end gap-1">
              <Link
                to={ctaTo}
                onClick={() => setMobileOpen(false)}
                className={`${ctaIsHome ? ctaClassHome : ctaClassPrimary} px-3.5`}
              >
                {ctaLabel}
              </Link>
              <button
                className="text-white p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </nav>
        {SHOW_CAMPAIGN && (
          <div className="bg-orange-primary text-center px-3 py-1.5">
            <p className="font-body text-[14px] sm:text-[15px] text-white font-semibold leading-snug">
              <a href="/essai" className="hover:underline underline-offset-2">
                Un essai reste possible — réservez un créneau
              </a>
            </p>
          </div>
        )}
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[55] bg-[#111110] flex flex-col items-center justify-center gap-6 lg:hidden overflow-y-auto pt-[7.5rem] pb-16 sm:pt-36"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          {isHome ? (
            navLinks.map((link) =>
              link.isPage ? (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="font-display font-bold text-2xl text-white hover:text-orange-primary transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="font-display font-bold text-2xl text-white hover:text-orange-primary transition-colors"
                >
                  {link.label}
                </a>
              )
            )
          ) : (
            <>
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="font-display font-bold text-2xl text-white hover:text-orange-primary transition-colors"
              >
                Accueil
              </Link>
              {offHomeLinks.map((link) =>
                link.isPage ? (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-display font-bold text-2xl text-white hover:text-orange-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-display font-bold text-2xl text-white hover:text-orange-primary transition-colors"
                  >
                    {link.label}
                  </a>
                )
              )}
            </>
          )}
          <div className="mt-2 pt-6 border-t border-white/10 w-[80%] max-w-[280px] flex flex-col items-center gap-4">
            <p className="font-mono text-[10px] tracking-[2px] uppercase text-[#C4C0B8]">Plus d&apos;infos</p>
            {secondaryLinks.map((link) =>
              link.isPage ? (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="font-body text-[15px] text-white/80 hover:text-brand-olive transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="font-body text-[15px] text-white/80 hover:text-brand-olive transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
          </div>
          <Link
            to={ctaTo}
            onClick={() => setMobileOpen(false)}
            className="font-body font-medium text-white bg-orange-primary px-8 py-3 rounded-full mt-2 min-h-[48px] inline-flex items-center justify-center"
          >
            {ctaLabel}
          </Link>
        </div>
      )}
    </>
  );
}
