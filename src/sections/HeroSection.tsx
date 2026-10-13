import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { BANDEAU_END } from '../data/CONFIG';
import { ASSO, MODULES, NB_ESSAIS } from '../data/asso';
import { useScheduleFromSheet } from '../hooks/useSheetData';
import { useAlertes } from '../hooks/useAlertes';
import { compteARebours, ctaSaison, libelleHeure, prochaineSeance } from '../lib/accueil';

/** Saison suivante : « 2026-2027 » → « 2027-2028 ». */
function saisonSuivante(label: string) {
  const m = label.match(/^(\d{4})\D(\d{4})$/);
  return m ? `${Number(m[1]) + 1}/${Number(m[2]) + 1}` : 'la saison prochaine';
}

const CTA = {
  essai: { href: '/essai', label: 'Venir essayer', analytics: 'CTA-Hero-Essai-Gratuit' },
  reinscription: {
    href: '/inscription',
    label: `Me réinscrire pour ${saisonSuivante(ASSO.saison.label)}`,
    analytics: 'CTA-Hero-Reinscription',
  },
  adhesion: { href: '/inscription', label: 'Adhérer au club', analytics: 'CTA-Hero-Adherer' },
} as const;

/** Heure courante, rafraîchie chaque minute ; null au premier rendu (pré-rendu stable). */
function useMaintenant() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const premier = window.setTimeout(tick, 0);
    const t = window.setInterval(tick, 60 * 1000);
    return () => {
      window.clearTimeout(premier);
      window.clearInterval(t);
    };
  }, []);
  return now;
}

export default function HeroSection() {
  const maintenant = useMaintenant();
  const [rendu] = useState(() => Date.now());
  const now = maintenant ? maintenant.getTime() : rendu;
  const showBandeau = now < BANDEAU_END;
  const choix = ctaSaison(new Date(now), ASSO.saison, NB_ESSAIS);
  const essaiCta = choix === 'essai';
  const cta = CTA[choix];
  const { schedule } = useScheduleFromSheet();
  const prochaine = maintenant ? prochaineSeance(schedule, maintenant, ASSO.saison.reprise) : null;
  const rebours = prochaine ? compteARebours(prochaine.dans) : null;
  const alerte = useAlertes()[0];

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

          {alerte ? (
            <p
              role="status"
              className="mt-4 mx-auto max-w-[480px] flex items-start gap-2 text-left rounded-2xl bg-amber-50 text-amber-950 border border-amber-200 px-4 py-3 font-body text-[15px] leading-snug"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-800" aria-hidden="true" />
              <span>
                <strong>{alerte.libelle}.</strong> {alerte.cours}
                {alerte.date ? ` (${alerte.date})` : ''}. {alerte.message}
              </span>
            </p>
          ) : null}

          {prochaine ? (
            <p
              className="mt-4 mx-auto inline-flex items-start gap-2 text-left rounded-2xl px-4 py-2.5 font-body text-[15px] sm:text-[16px] text-white leading-snug border border-white/40"
              style={{ backgroundColor: 'rgba(17, 17, 16, 0.72)' }}
              data-testid="prochain-cours"
            >
              <CalendarClock className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <span className="font-semibold">Prochain cours :</span> {prochaine.creneau.course} à{' '}
                {libelleHeure(prochaine.debut)}
                {prochaine.creneau.location ? `, ${prochaine.creneau.location}` : ''}
                <span className="block text-white/90 text-[14px]">
                  {prochaine.quand.charAt(0).toUpperCase() + prochaine.quand.slice(1)}
                  {rebours ? <> · <strong className="font-semibold text-white">{rebours}</strong></> : null}
                </span>
              </span>
            </p>
          ) : null}

          <div className="mt-5 sm:mt-8 flex flex-col items-center gap-3">
            <a
              href={cta.href}
              data-analytics={cta.analytics}
              className="font-body font-semibold text-[16px] sm:text-[15px] text-white px-8 py-4 rounded-full transition-all duration-250 inline-flex items-center justify-center min-h-[48px] bg-orange-primary hover:bg-orange-hover"
            >
              {cta.label}
            </a>
            {essaiCta ? (
              <p
                className="font-body text-[14px] text-white"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}
              >
                {MODULES.quiz ? (
                  <a
                    href="/quiz"
                    className="underline underline-offset-2 decoration-white/50 hover:decoration-white font-semibold text-white"
                  >
                    Quel cours pour moi ?
                  </a>
                ) : (
                  <a
                    href="/tarifs"
                    data-analytics="CTA-Hero-Tarifs-Secondaire"
                    className="underline underline-offset-2 decoration-white/50 hover:decoration-white font-semibold text-white"
                  >
                    Voir les tarifs
                  </a>
                )}
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
                  {choix === 'reinscription' ? 'Nouveau ? Un essai gratuit d’abord' : 'D’abord un essai gratuit'}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
