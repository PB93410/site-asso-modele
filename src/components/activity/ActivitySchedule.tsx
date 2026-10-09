import { CalendarDays, MapPin, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ActivityPageData } from '../../data/activityPages';

type Props = {
  activity: ActivityPageData;
};

export default function ActivitySchedule({ activity }: Props) {
  return (
    <section id="horaires-cours" className="bg-[#F8F7F4] section-padding">
      <div className="content-max-width">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">
          Horaires
        </p>
        <h2 className="font-display font-black text-[28px] text-brand-black mb-8">
          Quand a lieu le cours de {activity.name} ?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activity.schedule.map((s) => (
            <div
              key={s.day + s.time}
              className="rounded-2xl border border-black/[0.08] bg-white p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-primary/10 flex items-center justify-center">
                  <CalendarDays size={20} className="text-orange-primary" />
                </div>
                <div>
                  <p className="font-display font-bold text-[18px] text-brand-black">{s.day}</p>
                  <p className="font-body text-[14px] text-orange-primary">{s.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-brand-gray">
                <MapPin size={14} />
                <span className="font-body text-[13px]">{s.location}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="font-body text-[13px] text-brand-gray mt-4">
          <Navigation size={12} className="inline mr-1" />
          Consultez le{' '}
          <Link
            to="/"
            onClick={() =>
              setTimeout(() => document.getElementById('horaires')?.scrollIntoView(), 100)
            }
            className="text-orange-primary hover:underline"
          >
            planning complet de toutes les activités
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
