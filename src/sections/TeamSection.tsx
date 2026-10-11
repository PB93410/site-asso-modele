import { useEffect, useRef, useState } from 'react';
import { ACTIVITIES, BUREAU } from '../data/siteData';
import { ASSO, AUTOUR_PATH, HAS_FEDERATION, TEL_INTL } from '../data/asso';
import { useCoachsFromSheet, useEventsFromSheet, useScheduleFromSheet } from '../hooks/useSheetData';

/** Invalide le cache Netlify (assets webp en immutable). */
const COACH_IMG_V = '20260829b';

function coachImgSrc(src: string, mobile = false) {
  const path = mobile ? src.replace(/\.webp$/, '-320.webp') : src;
  return `${path}?v=${COACH_IMG_V}`;
}

function agendaPhrase(events: { title: string; date: string; month: string }[]) {
  const items = events.slice(0, 4).map((e) => {
    const title = e.title || '';
    const month = (e.month || '').toLowerCase();
    return `${title} le ${e.date} ${month}`;
  });
  if (items.length === 0) return 'Agenda à venir.';
  return `Agenda : ${items.join(' · ')}.`;
}

export default function TeamSection({ part = 'all' }: { part?: 'coaches' | 'club' | 'all' }) {
  const { coachs: COACHS } = useCoachsFromSheet();
  const { schedule } = useScheduleFromSheet();
  const { events } = useEventsFromSheet();
  const headerRef = useRef<HTMLDivElement>(null);
  const coachesRef = useRef<HTMLDivElement>(null);
  const [openCoach, setOpenCoach] = useState<string | null>(null);

  // Sans animateur renseigné (contenu/coachs.json vide), le bloc disparaît.
  const showCoaches = (part === 'coaches' || part === 'all') && COACHS.length > 0;
  const showClub = part === 'club' || part === 'all';
  const selectedCoach = COACHS.find((c) => c.name === openCoach) ?? null;
  const selectedCourses = selectedCoach
    ? ACTIVITIES.filter((a) => a.coach === selectedCoach.name).map((a) => {
        const slot = schedule.find((s) => s.course === a.name);
        if (!slot) return a.name;
        return `${a.name} · ${slot.day.toLowerCase()} ${slot.time.split('–')[0].trim()}`;
      })
    : [];
  const selectedEssaiUrl = selectedCoach
    ? `/essai?cours=${encodeURIComponent(
        ACTIVITIES.find((a) => a.coach === selectedCoach.name)?.name || ''
      )}`
    : '/essai';

  useEffect(() => {
    if (!openCoach) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenCoach(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [openCoach]);

  if (!showCoaches && !showClub) return null;

  return (
    <section
      id={part === 'club' ? 'le-bureau' : 'equipe'}
      className={
        part === 'club'
          ? 'bg-white section-padding'
          : 'bg-orange-light section-padding !py-8 md:!py-12'
      }
    >
      <div className="content-max-width">
        {showCoaches && (
          <>
            <div ref={headerRef} className="mb-8 md:mb-10">
              <h2 className="font-display font-black text-brand-black leading-[1.05] text-title">
                {COACHS.length > 1
                  ? `${COACHS.slice(0, -1).map((c) => c.name).join(', ')} et ${COACHS[COACHS.length - 1].name}`
                  : COACHS[0]?.name ?? 'Nos coachs'}
              </h2>
              <p className="font-body text-[16px] sm:text-[17px] text-brand-gray mt-4 max-w-[600px]">
                {COACHS.length} coach{COACHS.length > 1 ? 's' : ''}, {ACTIVITIES.length} cours — ils sont dans la salle, pas sur un CV.
              </p>
            </div>

            <div ref={coachesRef} className="grid grid-cols-3 gap-2 md:gap-5 mb-0">
              {COACHS.map((coach) => {
                return (
                  <div
                    key={coach.name}
                    className="group relative flex flex-col h-full rounded-[24px] overflow-hidden bg-white shadow-sm"
                    itemScope
                    itemType="https://schema.org/Person"
                  >
                    <div className="relative aspect-square md:aspect-[4/5] overflow-hidden">
                      <button
                        type="button"
                        className="absolute inset-0 z-[1] md:hidden"
                        onClick={() => setOpenCoach(coach.name)}
                        aria-haspopup="dialog"
                        aria-expanded={openCoach === coach.name}
                        aria-label={`Voir ${coach.name}, ${coach.specialties.join(', ')}`}
                      />
                      <picture>
                        <source
                          media="(max-width: 767px)"
                          srcSet={coachImgSrc(coach.image, true)}
                          type="image/webp"
                        />
                        <img
                          src={coachImgSrc(coach.image)}
                          alt={`${coach.name} — Coach de ${coach.specialties.join(', ')} — ${ASSO.nom}`}
                          width={520}
                          height={800}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          itemProp="image"
                        />
                      </picture>
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4">
                        <p
                          className="font-display font-black text-[15px] sm:text-[22px] md:text-[24px] text-white leading-tight"
                          itemProp="name"
                        >
                          {coach.name}
                        </p>
                        <meta
                          itemProp="jobTitle"
                          content={`Coach de ${coach.specialties.join(', ')}`}
                        />
                        <meta itemProp="worksFor" content={ASSO.nom} />
                        {coach.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 md:mt-2">
                            {coach.specialties.map((spec) => (
                              <span
                                key={spec}
                                className="inline-block font-mono text-[8px] md:text-[10px] tracking-[0.5px] md:tracking-[1px] uppercase px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full bg-orange-primary text-white font-semibold"
                                itemProp="knowsAbout"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:flex p-4 flex-col">
                      <p
                        className="font-body text-[14px] text-brand-gray leading-relaxed line-clamp-1"
                        itemProp="description"
                      >
                        {coach.bio}
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenCoach(coach.name)}
                        className="mt-2 self-start font-body font-medium text-[13px] text-brand-olive hover:underline min-h-[40px]"
                      >
                        Lire plus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedCoach && (
              <div
                className="fixed inset-0 z-[60]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="coach-sheet-title"
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-black/50"
                  aria-label="Fermer"
                  onClick={() => setOpenCoach(null)}
                />
                <div className="absolute left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[420px] rounded-t-3xl md:rounded-3xl bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-6 shadow-[0_-8px_32px_rgba(0,0,0,0.18)]">
                  <div className="w-10 h-1 rounded-full bg-black/15 mx-auto mb-4" aria-hidden />
                  <p
                    id="coach-sheet-title"
                    className="font-display font-black text-[28px] text-brand-black leading-tight"
                  >
                    {selectedCoach.name}
                  </p>
                  {selectedCoach.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedCoach.specialties.map((spec) => (
                        <span
                          key={spec}
                          className="inline-block font-mono text-[10px] tracking-[1px] uppercase px-2.5 py-1 rounded-full bg-orange-primary text-white font-semibold"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="font-body text-[15px] text-brand-gray leading-relaxed mt-3">
                    {selectedCoach.bio}
                  </p>
                  {selectedCourses.length > 0 && (
                    <p className="font-body text-[13px] text-brand-black mt-3">
                      Cours : {selectedCourses.join(' · ')}
                    </p>
                  )}
                  <a
                    href={selectedEssaiUrl}
                    data-analytics={`CTA-Coach-Sheet-Essai-${selectedCoach.name}`}
                    className="mt-5 flex items-center justify-center w-full min-h-[48px] rounded-full bg-orange-primary text-white font-body font-semibold text-[16px] hover:bg-orange-hover"
                  >
                    Réserver un essai
                  </a>
                  <a
                    href="/#contact"
                    className="mt-2 flex items-center justify-center w-full min-h-[44px] font-body font-medium text-[14px] text-brand-gray"
                  >
                    Une question au bureau
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {showClub && (
          <div id="a-propos" className="scroll-mt-28">
            <h2
              id="le-club"
              className="font-display font-black text-brand-black leading-[1.05] mb-3 text-title"
            >
              Depuis {ASSO.anneeCreation}
            </h2>
            <p className="font-body text-[16px] sm:text-[17px] text-brand-gray max-w-[720px] leading-relaxed">
              Pas de compétition, pas de classement. {ASSO.lieux.length > 1 ? `${ASSO.lieux.length} salles` : 'Une salle'} à{' '}
              {ASSO.ville}, {ACTIVITIES.length} cours par semaine, coachs diplômés
              {HAS_FEDERATION ? (
                <>
                  , affiliation <strong className="text-brand-black">{ASSO.federation.sigle || ASSO.federation.nom}</strong>
                </>
              ) : null}
              .{' '}
              <a href="/tarifs" className="font-semibold text-orange-primary hover:underline">
                Voir les tarifs
              </a>
              .
            </p>
            <p
              id="le-bureau"
              className="font-body text-[15px] text-brand-black mt-5 leading-relaxed scroll-mt-28"
            >
              Bureau bénévole — {BUREAU.map((m) => `${m.name} (${m.role})`).join(', ')} ·{' '}
              <a href={`tel:${TEL_INTL}`} className="font-semibold text-orange-primary hover:underline">
                {ASSO.telephone}
              </a>
            </p>
            <p className="font-body text-[15px] text-brand-gray mt-2 leading-relaxed">
              {ASSO.lieux.map((l) => l.nom).join(' et ')}.{' '}
              <a
                href={AUTOUR_PATH}
                className="font-semibold text-orange-primary hover:underline"
              >
                Venir de {ASSO.communesVoisines.join(', ')}…
              </a>
            </p>
            <p
              id="evenements"
              className="font-body text-[15px] text-brand-gray mt-2 leading-relaxed scroll-mt-28"
            >
              {agendaPhrase(events)}{' '}
              <a href="/faq" className="font-semibold text-orange-primary hover:underline">
                FAQ (tenue, matériel)
              </a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
