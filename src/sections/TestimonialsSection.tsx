/**
 * Invitation avis Google uniquement — pas de témoignages tant que
 * le bureau n’a pas fourni de citations réelles.
 */
import { ASSO } from '../data/asso';

export default function TestimonialsSection() {
  if (!ASSO.reseaux.avisGoogle) return null;
  return (
    <section id="avis-google" className="bg-[#F5EFE6] py-12 md:py-14">
      <div className="content-max-width text-center">
        <p className="font-body text-[14px] sm:text-[15px] text-brand-gray mb-4 max-w-md mx-auto">
          Vous êtes adhérent ? Un avis Google aide les nouveaux à pousser la porte. Nous
          n&apos;inventons pas de témoignages sur le site.
        </p>
        <a
          href={ASSO.reseaux.avisGoogle}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-body font-semibold text-[13px] text-white px-5 py-2.5 rounded-full transition-opacity hover:opacity-90 min-h-[44px] bg-orange-primary hover:bg-orange-hover"
        >
          Laisser un avis Google →
        </a>
      </div>
    </section>
  );
}
