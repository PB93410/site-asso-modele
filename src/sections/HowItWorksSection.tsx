import { HAS_PAIEMENT_EN_LIGNE, INCLUS_LABEL, TARIF_LABEL } from '../data/asso';

const STEPS: {
  n: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  primary?: boolean;
}[] = [
  {
    n: '1',
    title: 'Vous choisissez un créneau',
    desc: 'Le jour, l’heure et la salle s’affichent tout de suite. Le bureau confirme seulement si besoin.',
    href: '/essai',
    cta: 'Venir essayer',
    primary: true,
  },
  {
    n: '2',
    title: 'Vous venez une fois',
    desc: 'Sans engagement, tous niveaux. Le coach adapte si besoin.',
    href: '#horaires',
    cta: 'Voir les horaires',
  },
  {
    n: '3',
    title: 'Vous adhérez si ça convient',
    desc: `${TARIF_LABEL} l’année, ${INCLUS_LABEL}. Formulaire d’abord, puis paiement au bureau${HAS_PAIEMENT_EN_LIGNE ? ' ou par carte' : ''}.`,
    href: '/inscription',
    cta: 'S’inscrire',
  },
];

export default function HowItWorksSection() {
  return (
    <section id="comment-ca-se-passe" className="bg-brand-cream section-padding !py-10 md:!py-14">
      <div className="content-max-width">
        <h2 className="font-display font-black text-brand-black leading-[1.05] mb-10 text-title text-center">
          Comment ça se passe&nbsp;?
        </h2>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {STEPS.map(({ n, title, desc, href, cta, primary }) => {
            const external = href.startsWith('http');
            return (
              <li
                key={n}
                className="flex flex-col items-center text-center px-6 py-8 sm:px-7 sm:py-9 bg-white rounded-2xl ring-1 ring-black/10 min-h-[292px]"
              >
                <span
                  className="font-display font-black text-[18px] text-white w-11 h-11 rounded-full bg-brand-olive flex items-center justify-center mb-4"
                  aria-hidden="true"
                >
                  {n}
                </span>
                <h3 className="font-display font-bold text-[20px] sm:text-[22px] text-brand-black mb-2 leading-tight">
                  {title}
                </h3>
                <p className="font-body text-[15px] text-brand-gray leading-relaxed mb-6 max-w-[280px]">
                  {desc}
                </p>
                <a
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  onClick={(e) => {
                    if (href.startsWith('#')) {
                      e.preventDefault();
                      const el = document.getElementById(href.slice(1));
                      if (el) {
                        const top = el.getBoundingClientRect().top + window.scrollY - 80;
                        window.scrollTo({ top, behavior: 'smooth' });
                      }
                    }
                  }}
                    className={
                      primary
                        ? 'mt-auto inline-flex items-center justify-center min-h-[48px] px-6 rounded-full bg-orange-primary hover:bg-orange-hover text-white font-body font-semibold text-[15px]'
                        : 'mt-auto inline-flex items-center justify-center min-h-[48px] px-6 rounded-full border border-brand-olive text-brand-olive font-body font-semibold text-[15px] hover:bg-brand-olive-soft'
                    }
                  >
                    {cta}
                  </a>
                </li>
              );
            })}
          </ol>
      </div>
    </section>
  );
}
