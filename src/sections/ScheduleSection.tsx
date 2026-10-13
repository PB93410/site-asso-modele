import { useRef, useMemo } from 'react';
import { useScheduleFromSheet } from '../hooks/useSheetData';
import WhatsAppNotice from '../components/WhatsAppNotice';
import { ASSO, ESSAIS_LABEL } from '../data/asso';
import { ACTIVITIES } from '../data/siteData';
import { libelleDate, parisMaintenant, sansCoursLe, type SansCours } from '../lib/accueil';

/** Couleur de pastille par lieu : 1er lieu = couleur principale, les autres = secondaire. */
function lieuDot(location: string) {
  const loc = (location || '').toLowerCase();
  const first = ASSO.lieux[0]?.nom.toLowerCase() ?? '';
  return first && loc.includes(first) ? 'bg-orange-primary' : 'bg-brand-olive';
}

/** Détecte si un horaire est en journée (avant 18h) */
function isDaytime(time: string): boolean {
  const match = time.match(/(\d+)h/);
  if (!match) return false;
  return parseInt(match[1], 10) < 18;
}

/** Jour de la semaine en français (aligné sur les données planning) */
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

function getTodayLabel(): string {
  return DAYS_FR[new Date().getDay()];
}

/** Phrase du bloc « Aujourd'hui » quand le planning ne s'applique pas. */
function texteSansCours(s: SansCours | null): string {
  if (s?.raison === 'avant-reprise') return `Les cours reprennent ${libelleDate(s.reprise)}. Consultez le planning ci-dessous.`;
  if (s?.raison === 'vacances') return `Pas de cours pendant les ${s.libelle} : reprise ${libelleDate(s.reprise)}.`;
  if (s?.raison === 'ferie') return 'Pas de cours aujourd’hui (jour férié). Consultez le planning complet ci-dessous.';
  if (s?.raison === 'fin') return 'La saison est terminée : à bientôt pour la reprise.';
  return 'Pas de cours prévu aujourd’hui. Consultez le planning complet ci-dessous.';
}

function isSameDay(rowDay: string, todayLabel: string): boolean {
  return (rowDay || '').trim().toLowerCase() === todayLabel.toLowerCase();
}

function CourseCell({ name, note }: { name: string; note?: string }) {
  return (
    <div>
      <p className="font-body text-[16px] text-white font-medium leading-snug">{name}</p>
      {note ? (
        <p className="font-body text-[12px] text-orange-primary/90 font-normal mt-0.5 leading-snug">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function ScheduleHeading() {
  return (
    <div className="mb-10">
      <div className="content-max-width w-full">
        <h2 className="font-display font-black text-white leading-[1.05] text-title">
          Nos <span className="text-brand-olive">cours</span>
        </h2>
      </div>
    </div>
  );
}

export default function ScheduleSection() {
  const tableRef = useRef<HTMLDivElement>(null);
  const { schedule } = useScheduleFromSheet();
  const todayLabel = useMemo(() => getTodayLabel(), []);
  const sansCours = useMemo(() => sansCoursLe(parisMaintenant(new Date()).ymd, ASSO.saison), []);
  const todayRows = useMemo(
    () => (sansCours ? [] : schedule.filter((row) => isSameDay(row.day, todayLabel))),
    [schedule, todayLabel, sansCours]
  );

  return (
    <section id="horaires" className="bg-brand-black section-padding">
      <ScheduleHeading />

      <div ref={tableRef} className="content-max-width">
        <p className="font-body text-[15px] text-white/90 mb-4 max-w-[600px] leading-relaxed">
          {ACTIVITIES.length} cours · {ASSO.lieux.map((l) => l.nom).join(' et ')}, {ASSO.ville}.
        </p>

        <div className="mb-8 rounded-2xl border border-orange-primary/30 bg-orange-primary/10 px-4 py-4 sm:px-5">
          <p className="font-mono text-[11px] tracking-[2px] uppercase text-orange-primary mb-2">
            Aujourd&apos;hui — {todayLabel}
          </p>
          {todayRows.length > 0 ? (
            <ul className="space-y-1.5">
              {todayRows.map((row, i) => (
                <li key={i} className="font-body text-[15px] sm:text-[16px] text-white leading-snug">
                  <span className="font-mono text-brand-olive font-medium">{row.time}</span>
                  <span className="text-white/40 mx-2">·</span>
                  <span className="font-semibold">{row.course}</span>
                  <span className="text-white/50"> — {row.location}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-[15px] text-white/70">{texteSansCours(sansCours)}</p>
          )}
        </div>

        {/* Légende lieux */}
        <div className="flex flex-wrap gap-4 mb-6 text-[13px] font-body text-white/80">
          {ASSO.lieux.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${lieuDot(l.nom)}`} aria-hidden />
              {l.nom}
            </span>
          ))}
          <span className="text-white/50 hidden sm:inline">· Fond teinté = cours de journée</span>
        </div>

          <div className="hidden md:block">
          <div className="grid grid-cols-[16%_18%_36%_30%] border-b border-white/[0.08] pb-3 mb-1">
            <span className="font-mono text-[11px] tracking-[2px] uppercase text-brand-gray">Jour</span>
            <span className="font-mono text-[11px] tracking-[2px] uppercase text-brand-gray">Horaire</span>
            <span className="font-mono text-[11px] tracking-[2px] uppercase text-brand-gray">Cours</span>
            <span className="font-mono text-[11px] tracking-[2px] uppercase text-brand-gray">Lieu</span>
          </div>

          {schedule.map((row, i) => {
            const daytime = isDaytime(row.time);
            const dot = lieuDot(row.location);
            const isToday = !sansCours && isSameDay(row.day, todayLabel);
            return (
              <div
                key={i}
                className={`schedule-row grid grid-cols-[16%_18%_36%_30%] items-center border-b border-white/[0.06] py-4 px-2 -mx-2 rounded-xl transition-colors duration-200 hover:bg-white/[0.04] ${
                  isToday
                    ? 'bg-brand-olive/25 ring-1 ring-brand-olive/50'
                    : daytime
                      ? 'bg-brand-olive/[0.12]'
                      : ''
                }`}
              >
                <span className="font-body text-[16px] text-white font-bold inline-flex items-center gap-2 flex-wrap">
                  {row.day}
                  {isToday && (
                    <span className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-brand-olive text-white">
                      Aujourd&apos;hui
                    </span>
                  )}
                </span>
                <span className="font-mono text-[15px] text-brand-olive font-medium">{row.time}</span>
                <CourseCell name={row.course} note={row.note} />
                <span className="inline-flex items-center gap-2 font-body text-[14px] text-white/85">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`}
                    aria-hidden
                  />
                  {row.location}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {schedule.map((row, i) => {
            const daytime = isDaytime(row.time);
            const dot = lieuDot(row.location);
            const isToday = !sansCours && isSameDay(row.day, todayLabel);
            return (
              <div
                key={i}
                className={`rounded-2xl border p-4 ${
                  isToday
                    ? 'border-orange-primary/50 bg-orange-primary/15'
                    : daytime
                      ? 'border-white/[0.10] bg-orange-primary/[0.10]'
                      : 'border-white/[0.10] bg-white/[0.04]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <span className="font-body text-[16px] text-white font-bold inline-flex items-center gap-2 flex-wrap">
                    {row.day}
                    {isToday && (
                      <span className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-brand-olive text-white">
                        Aujourd&apos;hui
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[14px] text-brand-olive font-medium">{row.time}</span>
                </div>
                <CourseCell name={row.course} note={row.note} />
                <p className="inline-flex items-center gap-2 font-body text-[14px] text-white/80">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`}
                    aria-hidden
                  />
                  {row.location}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <a
            href="/essai"
            data-analytics="CTA-Horaires-Essai"
            className="inline-flex items-center justify-center min-h-[48px] px-7 rounded-full bg-orange-primary hover:bg-orange-hover text-white font-body font-semibold text-[15px]"
          >
            Venir essayer un cours
          </a>
          <p className="font-body text-[14px] text-white/70 leading-snug">
            {ESSAIS_LABEL ? `${ESSAIS_LABEL[0].toUpperCase()}${ESSAIS_LABEL.slice(1)}. ` : ''}Le créneau se choisit sur le formulaire.
          </p>
        </div>

        <WhatsAppNotice className="mt-6 text-white/45" />
      </div>
    </section>
  );
}
