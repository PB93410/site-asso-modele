import { ArrowLeft, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ActivityPageData } from '../../data/activityPages';
import { SITE_CONFIG } from '../../data/siteData';
import { ASSO, NB_ESSAIS } from '../../data/asso';

type Props = {
  activity: ActivityPageData;
};

export default function ActivityHero({ activity }: Props) {
  const navigate = useNavigate();
  const notice = activity.scheduleNotice || null;

  return (
    <section className="relative w-full min-h-[60vh] overflow-hidden flex items-end">
      <div className="absolute inset-0">
        <picture>
          <source
            media="(max-width: 767px)"
            srcSet={activity.image.replace(/\.webp$/, '-600.webp')}
            type="image/webp"
          />
          <img
            height={514}
            width={900}
            loading="eager"
            decoding="async"
            src={activity.image}
            alt={`Cours de ${activity.name} à ${ASSO.ville}`}
            className="w-full h-full object-cover"
            fetchPriority="high"
          />
        </picture>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(17,17,16,0.3) 0%, rgba(17,17,16,0.85) 60%, rgba(17,17,16,0.95) 100%)',
          }}
        />
      </div>
      <div className="relative z-10 w-full px-6 pb-12 pt-32 content-max-width mx-auto">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 font-body text-[13px] text-white/60 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Retour à l&apos;accueil
        </button>
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">
          Cours de {activity.name}
        </p>
        <h1 className="font-display font-black text-white leading-[1] tracking-[-1px] text-title">
          {activity.headline}
        </h1>
        <p className="font-body text-[17px] text-white/80 mt-3 max-w-[600px]">
          {activity.subheadline}
        </p>
        {notice ? (
          <div className="mt-5 max-w-[560px] rounded-2xl border border-orange-primary/40 bg-black/40 backdrop-blur-sm px-4 py-4">
            <p className="font-body text-[14px] text-white/90 leading-relaxed mb-3">
              {notice}
            </p>
            <a
              href={`https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(
                "Bonjour, je souhaite être informé(e) de l'ouverture du cours " + activity.name + "."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-body font-semibold text-[13px] text-white px-5 py-2.5 rounded-full min-h-[44px] bg-orange-primary hover:bg-orange-hover"
            >
              Être informé par WhatsApp
            </a>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 mt-6">
          <a
            href={`/essai?cours=${encodeURIComponent(activity.name)}`}
            data-analytics={`CTA-Activite-${activity.name.replace(/\s+/g, '-')}-Essai`}
            className="font-body font-semibold text-[14px] text-white px-6 py-3 rounded-full transition-all inline-flex items-center justify-center bg-orange-primary hover:bg-orange-hover"
          >
            {NB_ESSAIS > 1 ? `Essai gratuit — ${NB_ESSAIS} cours` : 'Essai gratuit'}
          </a>
          <a
            href="#horaires-cours"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('horaires-cours')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="font-body font-medium text-[14px] text-white/80 border border-white/20 hover:border-white/40 px-6 py-3 rounded-full transition-all inline-flex items-center gap-2"
          >
            <Clock size={16} />
            Voir les horaires
          </a>
        </div>
      </div>
    </section>
  );
}
