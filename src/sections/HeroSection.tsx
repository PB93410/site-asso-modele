import { BANDEAU_END, ESSAI_CTA_UNTIL } from '../data/CONFIG';
import { ASSO, NB_ESSAIS } from '../data/asso';

export default function HeroSection() {
  const now = Date.now();
  const showBandeau = now < BANDEAU_END;
  const essaiCta = now < ESSAI_CTA_UNTIL;

  return (
    <section
      id="accueil"
      className="relative w-full min-h-[60vh] sm:min-h-[78vh] overflow-hidden flex items-center justify-center"
    >
      <div className="absolute inset-0">
        <img
          loading="eager"
          height={768}
          width={1344}
          src={ASSO.heroImage}
          alt={ASSO.heroAlt}
          className="w-full h-full object-cover object-[center_42%]"
          fetchPriority="high"
          decoding="sync"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(17,17,16,0.55) 0%, rgba(17,17,16,0.12) 28%, transparent 48%), radial-gradient(ellipse at 50% 45%, rgba(17,17,16,0.62) 0%, rgba(17,17,16,0.40) 50%, rgba(17,17,16,0.22) 100%)',
          }}
        />
      </div>

      <div
        className={`relative z-10 flex flex-col items-center justify-center px-5 pb-8 sm:pb-12 ${
          showBandeau ? 'pt-24 sm:pt-36' : 'pt-20 sm:pt-28'
        }`}
      >
        <div className="text-center max-w-[560px]">
          <p className="flex justify-center mb-3 sm:mb-5">
            <span
              className="inline-block font-display font-bold text-[15px] sm:text-[17px] tracking-[0.08em] uppercase text-white px-4 sm:px-5 py-2 rounded-full border border-white/50"
              style={{
                backgroundColor: 'rgba(17, 17, 16, 0.78)',
                textShadow: '0 1px 2px rgba(0,0,0,0.35)',
              }}
            >
              Saison {ASSO.saison.label.replace('-', '/')}
            </span>
          </p>

          <h1
            className="font-display font-black leading-[0.98] text-[clamp(1.9rem,7.2vw,4.25rem)]"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.45)' }}
          >
            <span className="text-white">{ASSO.slogan}</span>
          </h1>

          <p
            className="font-body text-[16px] md:text-[17px] text-white max-w-[480px] mx-auto mt-4 sm:mt-5 leading-relaxed font-medium"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.55)' }}
          >
            {NB_ESSAIS > 0
              ? `${NB_ESSAIS} essai${NB_ESSAIS > 1 ? 's' : ''} gratuit${NB_ESSAIS > 1 ? 's' : ''} pour découvrir le club`
              : `${ASSO.accroche} à ${ASSO.ville}`}
          </p>

          <div className="mt-5 sm:mt-8 flex flex-col items-center gap-3">
            <a
              href={essaiCta ? '/essai' : '/inscription'}
              data-analytics={essaiCta ? 'CTA-Hero-Essai-Gratuit' : 'CTA-Hero-Adherer'}
              className="font-body font-semibold text-[16px] sm:text-[15px] text-white px-8 py-4 rounded-full transition-all duration-250 inline-flex items-center justify-center min-h-[48px] bg-orange-primary hover:bg-orange-hover"
            >
              {essaiCta ? 'Venir essayer' : 'Adhérer au club'}
            </a>
            {essaiCta ? (
              <p
                className="font-body text-[14px] text-white"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}
              >
                <a
                  href="/tarifs"
                  data-analytics="CTA-Hero-Tarifs-Secondaire"
                  className="underline underline-offset-2 decoration-white/50 hover:decoration-white font-semibold text-white"
                >
                  Voir les tarifs
                </a>
              </p>
            ) : (
              <p
                className="font-body text-[14px] text-white"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}
              >
                <a
                  href="/essai"
                  data-analytics="CTA-Hero-Essai-Secondaire"
                  className="underline underline-offset-2 decoration-white/50 hover:decoration-white font-semibold text-white"
                >
                  D'abord un essai gratuit
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
