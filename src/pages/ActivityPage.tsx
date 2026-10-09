import { Link, useParams } from 'react-router-dom';
import { ChevronRight, HelpCircle } from 'lucide-react';
import { getActivityPage, getRelatedPages } from '../data/activityPages';
import { SITE_CONFIG } from '../data/siteData';
import {
  buildActivitySchema,
  buildBreadcrumbSchema,
} from '../lib/schema';
import { usePageMeta } from '../hooks/usePageMeta';
import ActivityHero from '../components/activity/ActivityHero';
import ActivityBenefits from '../components/activity/ActivityBenefits';
import ActivitySchedule from '../components/activity/ActivitySchedule';
import ActivityRelated from '../components/activity/ActivityRelated';
import ActivityIntentLinks from '../components/activity/ActivityIntentLinks';
import Footer from '../sections/Footer';
import BackToTop from '../components/BackToTop';
import NotFoundPage from './NotFoundPage';
import { ASSO, COURS_ESSAI_LABEL, ESSAIS_LABEL, SITE_URL } from '../data/asso';

export default function ActivityPage() {
  const { slug } = useParams<{ slug: string }>();
  const activity = getActivityPage(slug || '');

  usePageMeta({
    title: activity?.metaTitle,
    description: activity?.metaDescription,
    path: activity ? `/${activity.slug}` : undefined,
  });

  if (!activity) {
    return <NotFoundPage />;
  }

  const relatedPages = getRelatedPages(activity.relatedActivities);

  const schemaData = buildActivitySchema(activity);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Accueil', item: `${SITE_URL}/` },
    {
      name: activity.name,
      item: `${SITE_URL}/${activity.slug}/`,
    },
  ]);

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <nav aria-label="Fil d'Ariane" className="bg-white border-b border-black/[0.06] page-chrome-top">
        <div className="content-max-width py-3">
          <ol className="flex items-center gap-2 font-body text-[13px]">
            <li>
              <Link
                to="/"
                className="text-brand-gray hover:text-brand-black transition-colors flex items-center gap-1"
              >
                Accueil
              </Link>
            </li>
            <li className="text-brand-gray" aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li className="text-brand-black font-medium" aria-current="page">
              {activity.name}
            </li>
          </ol>
        </div>
      </nav>

      <main id="main-content">
        <ActivityHero activity={activity} />
        <ActivityBenefits
          activity={activity}
          relatedPages={relatedPages}
        />
        <ActivitySchedule activity={activity} />
        <ActivityIntentLinks currentName={activity.name} />

        {/* FAQ */}
        <section className="bg-[#F8F7F4] section-padding">
          <div className="content-max-width max-w-[800px]">
            <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3 text-center">
              Questions fréquentes
            </p>
            <h2 className="font-display font-black text-[28px] text-brand-black mb-8 text-center">
              FAQ — Cours de {activity.name}
            </h2>
            <div className="space-y-4">
              {activity.faq.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-2xl border border-black/[0.08] bg-white overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <HelpCircle size={18} className="text-orange-primary shrink-0" />
                      <span className="font-display font-bold text-[15px] text-brand-black">
                        {f.question}
                      </span>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-brand-gray group-open:rotate-90 transition-transform shrink-0"
                    />
                  </summary>
                  <div className="px-5 pb-5 pl-11">
                    <p className="font-body text-[14px] text-brand-gray leading-relaxed">
                      {f.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#F8F7F4] section-padding">
          <div className="content-max-width max-w-[700px] text-center">
            <h2 className="font-display font-black text-[32px] md:text-[40px] text-brand-black leading-tight">
              Rejoignez le cours de{' '}
              <span className="text-orange-primary">{activity.name}</span> à {ASSO.ville}
            </h2>
            <p className="font-body text-[16px] text-brand-gray mt-4 mb-8">
              {ESSAIS_LABEL ? `${COURS_ESSAI_LABEL} gratuits, sans engagement. Puis ` : 'Adhésion : '}{SITE_CONFIG.price} par an pour
              accéder à tous les cours de l&apos;association.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={`/essai?cours=${encodeURIComponent(activity.name)}`}
                data-analytics={`CTA-Activite-${activity.name.replace(/\s+/g, '-')}-Reserver`}
                className="font-body font-semibold text-[15px] text-white px-8 py-4 rounded-full transition-all inline-flex items-center justify-center bg-orange-primary hover:bg-orange-hover"
              >
                Réserver mon essai gratuit
              </a>
              <Link
                to="/#horaires"
                className="font-body font-medium text-[15px] text-brand-black border border-black/15 hover:border-black/30 px-6 py-4 rounded-full transition-all inline-flex items-center justify-center"
              >
                Voir tous les cours
              </Link>
            </div>
          </div>
        </section>

        <ActivityRelated currentSlug={activity.slug} />
      </main>

      <Footer />
      <BackToTop />
    </div>
  );
}
