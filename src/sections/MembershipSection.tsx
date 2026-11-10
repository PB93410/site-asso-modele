import {
  COURS_ESSAI_LABEL,
  ESSAIS_LABEL,
  HAS_PAIEMENT_EN_LIGNE,
  INCLUS_LABEL,
  NB_ESSAIS,
  PAIEMENT_NOM,
  TARIF_LABEL,
  essaisProposes,
} from '../data/asso';

export default function MembershipSection({ variant = 'tarifs' }: { variant?: 'home' | 'tarifs' }) {
  const isHome = variant === 'home';
  const essais = essaisProposes();

  return (
    <section id="adhesion" className="bg-brand-cream section-padding !py-12 md:!py-14">
      <div className="content-max-width">
        <h2 className="font-display font-black text-[28px] md:text-[36px] text-brand-black leading-tight mb-3">
          Rejoindre l&apos;association
        </h2>
        <p className="font-body text-[16px] md:text-[17px] text-brand-gray leading-relaxed max-w-[640px] mb-8">
          {isHome ? (
            <>
              {essais
                ? 'Un essai d’abord, l’adhésion ensuite si le cours vous convient. '
                : 'L’adhésion se fait en ligne, puis le règlement. '}
              <a href="/tarifs" className="text-orange-primary underline underline-offset-2 font-medium">
                Détail des tarifs
              </a>
            </>
          ) : (
            <>
              {TARIF_LABEL} l&apos;année — {INCLUS_LABEL}. Même tarif en cours de saison.
              {essais && NB_ESSAIS > 0 ? ` Les ${ESSAIS_LABEL} restent disponibles.` : ''}
            </>
          )}
        </p>

        <div className={`grid grid-cols-1 ${essais ? 'md:grid-cols-2' : ''} gap-4 md:gap-5 items-stretch`}>
          {essais ? (
          <div className="rounded-2xl border-2 border-orange-primary bg-orange-primary text-white p-6 flex flex-col min-h-[280px] shadow-[0_12px_32px_rgba(196,83,9,0.28)]">
            <p className="font-mono text-[11px] tracking-[2px] uppercase text-white/85 mb-2">
              Essayer
            </p>
            <h3 className="font-display font-black text-[22px] md:text-[24px] leading-tight">
              {COURS_ESSAI_LABEL}
            </h3>
            <p className="font-body text-[16px] text-white/90 mt-2">
              Gratuit. Sans rien signer. Un créneau suffit pour commencer.
            </p>
            <div className="mt-auto pt-6">
              <a
                href="/essai"
                data-analytics="CTA-Tarifs-Essai-Gratuit"
                className="flex items-center justify-center w-full font-body font-semibold text-[16px] rounded-full bg-white text-orange-primary hover:bg-orange-light min-h-[48px]"
              >
                Réserver un essai
              </a>
              <p className="font-body text-[14px] text-white/80 mt-3 text-center">
                Sans engagement · le créneau s’affiche tout de suite
              </p>
            </div>
          </div>
          ) : null}

          <div className={`rounded-2xl border-2 p-6 flex flex-col min-h-[280px] ${
            essais
              ? 'border-orange-primary/30 bg-white shadow-[0_8px_24px_rgba(196,83,9,0.08)]'
              : 'border-orange-primary bg-orange-primary text-white shadow-[0_12px_32px_rgba(196,83,9,0.28)]'
          }`}>
            <p className={`font-mono text-[11px] tracking-[2px] uppercase mb-2 ${essais ? 'text-orange-primary' : 'text-white/85'}`}>
              Adhérer
            </p>
            <h3 className={`font-display font-black text-[22px] md:text-[24px] leading-tight ${essais ? 'text-brand-black' : ''}`}>
              {isHome ? 'Rejoindre le club' : `${TARIF_LABEL} l'année`}
            </h3>
            <p className={`font-body text-[16px] mt-2 ${essais ? 'text-brand-gray' : 'text-white/90'}`}>
              Tous les cours, {INCLUS_LABEL}.{' '}
              {HAS_PAIEMENT_EN_LIGNE ? 'Carte en ligne, ou règlement au bureau.' : 'Règlement au bureau.'}
            </p>
            <div className="mt-auto pt-6 space-y-2">
              <a
                href="/inscription"
                data-analytics="CTA-Tarifs-Inscription"
                className={
                  essais
                    ? 'flex items-center justify-center w-full min-h-[48px] rounded-full border border-orange-primary/40 text-orange-primary font-body font-semibold text-[16px] hover:bg-orange-primary hover:text-white'
                    : 'flex items-center justify-center w-full min-h-[48px] rounded-full bg-white text-orange-primary font-body font-semibold text-[16px] hover:bg-orange-light'
                }
              >
                Remplir le formulaire
              </a>
              <p className={`font-body text-[14px] text-center pt-1 ${essais ? 'text-brand-gray' : 'text-white/80'}`}>
                Rien n’est prélevé ici.{' '}
                {HAS_PAIEMENT_EN_LIGNE
                  ? `Carte (${PAIEMENT_NOM}) ou bureau : vous choisissez à la dernière étape, après l’envoi.`
                  : 'Le règlement se fait au bureau.'}
              </p>
            </div>
          </div>
        </div>

        {!isHome && (
        <div className="mt-8 max-w-[760px]">
          <p className="font-mono text-[11px] tracking-[2px] uppercase text-orange-primary mb-3">
            Avant de décider
          </p>
          <div className="divide-y divide-black/10 border-t border-b border-black/10">
            {[
              {
                q: 'Faut-il un certificat médical ?',
                a: 'Non pour la pratique de loisir. Un questionnaire QS-SPORT suffit. Si une réponse est positive, un certificat vous sera demandé.',
              },
              {
                q: 'Je m’engage pour toute la saison ?',
                a: `La cotisation est annuelle (${TARIF_LABEL}), sans obligation de présence. Vous venez quand vous pouvez.${essais ? ' Les essais gratuits sont sans engagement.' : ''}`,
              },
              {
                q: 'Je ne connais personne, ça se passe comment ?',
                a: 'Quelqu’un vous accueille et vous présente au coach. Au bout de quelques séances, les visages deviennent familiers.',
              },
            ].map((item) => (
              <details key={item.q} className="group py-3">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none min-h-[44px] font-body font-medium text-[15px] text-brand-black">
                  {item.q}
                  <span className="text-brand-gray group-open:rotate-45 transition-transform text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="font-body text-[14px] text-brand-gray leading-relaxed pt-1 pb-2">{item.a}</p>
              </details>
            ))}
          </div>
          <a
            href="/faq"
            className="inline-flex items-center min-h-[44px] mt-3 font-body font-semibold text-[14px] text-orange-primary hover:underline"
          >
            Toutes les questions
          </a>
        </div>
        )}
      </div>
    </section>
  );
}
