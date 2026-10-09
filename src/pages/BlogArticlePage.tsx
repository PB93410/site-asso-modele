import { Link, useParams, useNavigate } from 'react-router-dom';
import { Clock, CalendarDays, ChevronRight, ArrowLeft, HelpCircle, User } from 'lucide-react';
import { BLOG_ARTICLES_LIVE, getLiveBlogArticle } from '../data/blogLive';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
} from '../lib/schema';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import BackToTop from '../components/BackToTop';
import NotFoundPage from './NotFoundPage';
import { ASSO, ESSAIS_LABEL, SITE_URL } from '../data/asso';

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const article = getLiveBlogArticle(slug || '');

  usePageMeta({
    title: article?.metaTitle,
    description: article?.metaDescription,
    path: article ? `/blog/${article.slug}` : undefined,
  });

  if (!article) {
    return <NotFoundPage />;
  }

  const essaiHref = article.ctaCourse
    ? `/essai?cours=${encodeURIComponent(article.ctaCourse.name)}`
    : '/essai';

  const articleSchema = buildArticleSchema(article);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Accueil', item: `${SITE_URL}/` },
    { name: 'Blog', item: `${SITE_URL}/blog/` },
    {
      name: article.title,
      item: `${SITE_URL}/blog/${article.slug}/`,
    },
  ]);

  const related = BLOG_ARTICLES_LIVE.filter((a) => a.slug !== article.slug).slice(0, 2);

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <nav aria-label="Fil d'Ariane" className="bg-white border-b border-black/[0.06] page-chrome-top">
        <div className="content-max-width py-3">
          <ol className="flex items-center gap-2 font-body text-[13px]">
            <li>
              <Link to="/" className="text-brand-gray hover:text-brand-black transition-colors">
                Accueil
              </Link>
            </li>
            <li className="text-brand-gray" aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li>
              <Link to="/blog" className="text-brand-gray hover:text-brand-black transition-colors">
                Blog
              </Link>
            </li>
            <li className="text-brand-gray" aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li
              className="text-brand-black font-medium truncate max-w-[300px]"
              aria-current="page"
            >
              {article.title}
            </li>
          </ol>
        </div>
      </nav>

      <main id="main-content">
        {article.poster ? (
          <section className="bg-[#F8F7F4] pt-10">
            <div className="content-max-width max-w-[720px]">
              <button
                onClick={() => navigate('/blog')}
                className="inline-flex items-center gap-1.5 font-body text-[13px] text-brand-gray hover:text-brand-black mb-6 transition-colors"
              >
                <ArrowLeft size={14} /> Retour au blog
              </button>
              <span className="inline-block font-mono text-[11px] tracking-[2px] uppercase text-orange-primary bg-orange-primary/10 px-3 py-1 rounded-full mb-4">
                {article.category}
              </span>
              <h1 className="font-display font-black text-brand-black leading-[1.1] tracking-[-1px] text-title">
                {article.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-4 font-body text-[13px] text-brand-gray">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} /> {article.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} /> {article.readTime} min
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User size={14} /> {ASSO.nom}
                </span>
              </div>
              <figure className="mt-8">
                <img
                  src={article.image}
                  alt={article.title}
                  width="600"
                  height="900"
                  className="mx-auto w-full max-w-[420px] h-auto rounded-2xl border border-black/[0.06]"
                />
              </figure>
            </div>
          </section>
        ) : (
        <section className="relative w-full min-h-[50vh] overflow-hidden flex items-end">
          <div className="absolute inset-0">
            <img
              height="630"
              width="1200"
              loading="lazy"
              decoding="async"
              src={article.image}
              alt={article.title}
              className="w-full h-full object-cover"
            />
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
              onClick={() => navigate('/blog')}
              className="inline-flex items-center gap-1.5 font-body text-[13px] text-white/60 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft size={14} /> Retour au blog
            </button>
            <span className="inline-block font-mono text-[11px] tracking-[2px] uppercase text-orange-primary bg-orange-primary/10 px-3 py-1 rounded-full mb-4">
              {article.category}
            </span>
            <h1 className="font-display font-black text-white leading-[1.1] tracking-[-1px] text-title">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-4 font-body text-[13px] text-white/70">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} /> {article.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} /> {article.readTime} min
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User size={14} /> {ASSO.nom}
              </span>
            </div>
          </div>
        </section>
        )}

        <section className="bg-[#F8F7F4] section-padding">
          <div className="content-max-width max-w-[720px]">
            <div
              className="prose-blog"
              dangerouslySetInnerHTML={{ __html: article.content.join('') }}
            />

            {article.faq?.length > 0 && (
              <div className="mt-12">
                <h2 className="font-display font-black text-[24px] text-brand-black mb-6">FAQ</h2>
                <div className="space-y-4">
                  {article.faq.map((f, i) => (
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
            )}

            <div className="mt-12 rounded-2xl border border-orange-primary/20 bg-orange-primary/10 p-8 text-center">
              <p className="font-display font-bold text-[20px] text-brand-black mb-2">
                {article.ctaCourse
                  ? `Envie d'essayer le ${article.ctaCourse.name} ?`
                  : 'Envie d’essayer un cours ?'}
              </p>
              <p className="font-body text-[14px] text-brand-gray mb-5">
                {ESSAIS_LABEL
                  ? `${ESSAIS_LABEL} à ${ASSO.ville} — sans engagement`
                  : `À ${ASSO.ville} — sans engagement`}
              </p>
              <a
                href={essaiHref}
                className="font-body font-semibold text-[15px] text-white px-8 py-3.5 rounded-full transition-all inline-flex items-center justify-center bg-orange-primary hover:bg-orange-hover"
              >
                Réserver un essai
              </a>
            </div>

            {related.length > 0 && (
              <div className="mt-16">
                <h2 className="font-display font-bold text-[20px] text-brand-black mb-6">
                  Articles liés
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {related.map((relatedArticle) => (
                    <Link
                      key={relatedArticle.slug}
                      to={`/blog/${relatedArticle.slug}`}
                      className="group rounded-2xl border border-black/[0.08] bg-white overflow-hidden hover:border-orange-primary/30 transition-colors"
                    >
                      <img
                        height="630"
                        width="1200"
                        loading="lazy"
                        decoding="async"
                        src={relatedArticle.image}
                        alt={relatedArticle.title}
                        className="w-full h-full object-cover max-h-36"
                      />
                      <div className="p-4">
                        <p className="font-display font-bold text-[15px] text-brand-black group-hover:text-orange-primary transition-colors">
                          {relatedArticle.title}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
      <BackToTop />
    </div>
  );
}
