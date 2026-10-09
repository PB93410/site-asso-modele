import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { ACTIVITIES } from '../data/siteData';
import { ASSO } from '../data/asso';
import { ACTIVITY_PAGES } from '../data/activityPages';
import { useScheduleFromSheet } from '../hooks/useSheetData';

/** Phrase « pour qui » de chaque cours (clé = nom de l'activité). */
const INTENT: Record<string, string> = {
  'Gym Douce': 'Si vous reprenez après une longue pause',
  Pilates: 'Si vous travaillez assis toute la journée',
  Zumba: 'Si vous aimez bouger en musique, sans savoir danser',
  'Renforcement Musculaire': 'Si vous voulez un peu plus d’effort',
  Stretching: 'Si vous avez besoin de relâcher',
  'Cardio & Gym': 'Si vous voulez travailler votre souffle',
};

const SLUG: Record<string, string> = {};
ACTIVITY_PAGES.forEach((p) => {
  SLUG[p.name] = p.slug;
});

export default function ActivitiesSection() {
  const { schedule } = useScheduleFromSheet();

  return (
    <section id="activites" className="bg-brand-cream section-padding overflow-hidden">
      <div className="content-max-width mb-8">
        <h2 className="font-display font-black text-brand-black leading-[1.05] text-title">
          Bougez à {ASSO.ville}, à votre rythme
        </h2>
        <p className="font-body text-[16px] text-brand-gray mt-3 max-w-[600px]">
          {ACTIVITIES.length} cours par semaine. Le planning ci-dessus donne l’horaire ; ici, l’intention.
        </p>
      </div>

      <div className="content-max-width">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {ACTIVITIES.map((activity) => {
            const slug = SLUG[activity.name];
            const phrase = INTENT[activity.name];
            const row = schedule.find((c) => c.course === activity.name);
            const page = ACTIVITY_PAGES.find((p) => p.name === activity.name);
            const showLevel = activity.level && activity.level !== 'Tous niveaux';
            const cardClass = 'bg-white rounded-2xl overflow-hidden block ring-1 ring-black/10';
            const notice = page?.scheduleNotice || null;

            const inner = (
              <>
                <div className="relative aspect-[16/10] overflow-hidden">
                  <picture>
                    <source
                      media="(max-width: 767px)"
                      srcSet={activity.image.replace(/\.webp$/, '-600.webp')}
                      type="image/webp"
                    />
                    <img
                      loading="lazy"
                      decoding="async"
                      width={900}
                      height={675}
                      src={activity.image}
                      alt={`Cours de ${activity.name} — ${ASSO.nom}`}
                      className="w-full h-full object-cover"
                    />
                  </picture>
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-black/70 via-brand-black/20 to-transparent" />
                  {showLevel ? (
                    <span className="hidden sm:inline-block absolute top-3 left-3 font-mono text-[10px] tracking-[1px] uppercase px-3 py-1 rounded-full bg-white/90 text-brand-black">
                      {activity.level}
                    </span>
                  ) : null}
                  <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4">
                    <h3 className="font-display font-bold text-[15px] sm:text-[22px] text-white leading-tight">
                      {activity.name}
                    </h3>
                    {row ? (
                      <p className="font-body text-[11px] sm:text-[14px] text-white/90 mt-0.5 sm:mt-1.5 flex items-center gap-1.5">
                        <Clock size={12} className="shrink-0 hidden sm:block" aria-hidden="true" />
                        {row.day} · {row.time}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="p-2.5 sm:p-4">
                  {phrase ? (
                    <p className="font-body text-[12px] sm:text-[14px] text-brand-gray leading-snug">{phrase}</p>
                  ) : null}
                  {notice ? (
                    <p className="mt-2 sm:mt-3 font-body text-[12px] sm:text-[13px] text-brand-gray leading-snug rounded-xl border border-black/10 bg-brand-cream px-2.5 py-2 sm:px-3 sm:py-2.5">
                      {notice}
                    </p>
                  ) : null}
                  {slug ? (
                    <p className="mt-2 sm:mt-3 font-body font-semibold text-[13px] sm:text-[14px] text-brand-olive">Découvrir</p>
                  ) : null}
                </div>
              </>
            );

            return slug ? (
              <Link key={activity.name} to={`/${slug}`} className={cardClass}>
                {inner}
              </Link>
            ) : (
              <div key={activity.name} className={cardClass}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
