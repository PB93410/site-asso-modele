import { CheckCircle, ChevronRight, Clock, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ActivityPageData } from '../../data/activityPages';
import { SITE_CONFIG } from '../../data/siteData';

type Props = {
  activity: ActivityPageData;
  relatedPages: ActivityPageData[];
};

function UserIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function ActivityBenefits({ activity, relatedPages }: Props) {
  const slot = activity.schedule[0];
  const slotStart = slot ? (slot.time || '').split(/[–-]/)[0].trim() : '';
  const essaiLabel = slot
    ? `Essayer le ${slot.day.toLowerCase()} ${slotStart}`
    : 'Réserver un essai';

  return (
    <section className="bg-[#F8F7F4] section-padding">
      <div className="content-max-width">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">
              Présentation
            </p>
            <h2 className="font-display font-black text-[28px] md:text-[36px] text-brand-black leading-tight mb-6">
              {activity.description}
            </h2>
            <p className="font-body text-[16px] text-brand-gray leading-relaxed">
              {activity.longDescription}
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {activity.detailedBenefits.map((b) => (
                <div
                  key={b.title}
                  className="rounded-2xl border border-black/[0.08] bg-white p-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={18} className="text-whatsapp-from shrink-0" />
                    <h3 className="font-display font-bold text-[16px] text-brand-black">{b.title}</h3>
                  </div>
                  <p className="font-body text-[14px] text-brand-gray leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <h3 className="font-display font-bold text-[16px] text-brand-black mb-4">
                Informations pratiques
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock size={18} className="text-orange-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body text-[13px] text-brand-gray">Niveau</p>
                    <p className="font-body text-[14px] text-brand-black">{activity.level}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon size={18} className="text-orange-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body text-[13px] text-brand-gray">Coach</p>
                    <p className="font-body text-[14px] text-brand-black">{activity.coach}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star size={18} className="text-orange-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body text-[13px] text-brand-gray">Tarif</p>
                    <p className="font-body text-[14px] text-brand-black">
                      {SITE_CONFIG.price}/an — Tous cours inclus
                    </p>
                  </div>
                </div>
              </div>
              <a
                href={`/essai?cours=${encodeURIComponent(activity.name)}`}
                data-analytics={`CTA-Activite-${activity.name.replace(/\s+/g, '-')}-Essai`}
                className="mt-5 w-full block text-center font-body font-semibold text-[14px] text-white py-3 rounded-full transition-all bg-orange-primary hover:bg-orange-hover"
              >
                {essaiLabel}
              </a>
            </div>

            <div className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <h3 className="font-display font-bold text-[16px] text-brand-black mb-4">Cours similaires</h3>
              <div className="space-y-2">
                {relatedPages.map((rp) => (
                  <Link
                    key={rp.slug}
                    to={`/${rp.slug}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-black/[0.04] transition-colors group"
                  >
                    <span className="font-body text-[14px] text-brand-black group-hover:text-orange-primary transition-colors">
                      {rp.name}
                    </span>
                    <ChevronRight
                      size={14}
                      className="text-brand-gray group-hover:text-orange-primary"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
