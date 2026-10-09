import { MapPin, Zap, Heart } from 'lucide-react';
import { ASSO, FEDERATION_LABEL } from '../data/asso';
import { ACTIVITIES } from '../data/siteData';

const REASONS = [
  {
    value: String(ASSO.lieux.length),
    label: `${ASSO.lieux.length > 1 ? 'lieux' : 'lieu'} à ${ASSO.ville}`,
    desc: `${ASSO.lieux.map((l) => l.nom).join(' et ')} — tout se passe dans la commune.`,
    Icon: MapPin,
  },
  {
    value: String(ACTIVITIES.length),
    label: 'cours / semaine',
    desc: `${ACTIVITIES.map((a) => a.name).join(', ')}. Un tarif pour tous.`,
    Icon: Zap,
  },
  {
    value: '',
    label: 'Sans classement',
    desc: 'Pas de compétition, pas de pression. On avance à son rythme.',
    Icon: Heart,
  },
];

export default function WhyJoinSection() {
  return (
    <section id="le-club" className="bg-brand-black section-padding !py-12 md:!py-14">
      <div className="content-max-width">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3 text-center">
          Le club
        </p>
        <h2 className="font-display font-black text-white text-center leading-[1] tracking-[-0.5px] mb-3 text-title">
          Ce qui change, <span className="text-orange-primary">ici</span>
        </h2>
        <p className="font-body text-[15px] md:text-[16px] text-brand-gray text-center max-w-[560px] mx-auto mb-8">
          Association locale depuis {ASSO.anneeCreation}
          {FEDERATION_LABEL ? `, ${FEDERATION_LABEL}` : ''}. Des coachs diplômés, un bureau
          bénévole, un tarif unique.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 max-w-[880px] mx-auto">
          {REASONS.map(({ value, label, desc, Icon }) => (
            <div
              key={label}
              className="reason-card rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5"
            >
              <Icon size={24} className="text-orange-primary mb-2.5" aria-hidden="true" />
              <div className="flex items-baseline gap-2 mb-1.5">
                {value ? (
                  <>
                    <span className="font-display font-black text-[24px] md:text-[26px] text-orange-primary leading-none">
                      {value}
                    </span>
                    <span className="font-display font-bold text-[13px] text-white/70 uppercase tracking-wider">
                      {label}
                    </span>
                  </>
                ) : (
                  <span className="font-display font-black text-[22px] md:text-[24px] text-orange-primary leading-tight">
                    {label}
                  </span>
                )}
              </div>
              <p className="font-body text-[13px] md:text-[14px] text-brand-gray leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
