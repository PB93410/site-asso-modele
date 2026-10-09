import { Link } from 'react-router-dom';
import { Clock, CalendarDays, ChevronRight, BookOpen } from 'lucide-react';
import { BLOG_ARTICLES_LIVE } from '../data/blogLive';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import BackToTop from '../components/BackToTop';
import { ASSO, SITE_URL } from '../data/asso';

export default function BlogListPage() {
  usePageMeta({
    title: `Blog — ${ASSO.nom}`,
    description: `Articles de ${ASSO.nom} à ${ASSO.ville} : essai, adhésion, premier cours, choix du cours.`,
    path: '/blog',
  });

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `Blog ${ASSO.nom}`,
    description: `Articles de ${ASSO.nom} : essai, tarifs et cours`,
    url: `${SITE_URL}/blog/`,
    publisher: {
      '@type': 'Organization',
      name: ASSO.nom,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.ico` },
    },
    blogPost: BLOG_ARTICLES_LIVE.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.excerpt,
      image: `${SITE_URL}${a.image}`,
      datePublished: a.date,
      url: `${SITE_URL}/blog/${a.slug}/`,
    })),
  };

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />
      <nav aria-label="Fil d'Ariane" className="bg-white border-b border-black/[0.06] page-chrome-top">
        <div className="content-max-width py-3">
          <ol className="flex items-center gap-2 font-body text-[13px]">
            <li><Link to="/" className="text-brand-gray hover:text-brand-black transition-colors">Accueil</Link></li>
            <li className="text-brand-gray" aria-hidden="true"><ChevronRight size={14} /></li>
            <li className="text-brand-black font-medium" aria-current="page">Blog</li>
          </ol>
        </div>
      </nav>

      <main id="main-content">
        <section className="bg-[#F8F7F4] pt-16 pb-8">
          <div className="content-max-width text-center">
            <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">Blog</p>
            <h1 className="font-display font-black text-[32px] md:text-[44px] text-brand-black leading-tight">
              {ASSO.accroche} à {ASSO.ville}
            </h1>
            <p className="font-body text-[16px] text-brand-gray mt-4 max-w-[560px] mx-auto">
              Essai, adhésion, premier cours — ce qui se passe au club.
            </p>
          </div>
        </section>

        <section className="bg-[#F8F7F4] section-padding">
          <div className="content-max-width">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BLOG_ARTICLES_LIVE.map((article) => (
                <Link
                  key={article.slug}
                  to={`/blog/${article.slug}`}
                  className="group rounded-2xl border border-black/[0.08] bg-white overflow-hidden hover:border-orange-primary/30"
                >
                  <div className={`relative aspect-[16/9] overflow-hidden ${article.poster ? 'bg-[#f6d5e3]' : ''}`}>
                    <img height="360" width="640" loading="lazy" decoding="async"
                      src={article.image}
                      alt={article.title}
                      className={article.poster ? 'w-full h-full object-contain' : 'w-full h-full object-cover'}
                    />
                    <div className="absolute top-3 left-3">
                      <span className="font-mono text-[10px] tracking-[1px] uppercase text-white bg-orange-primary/90 px-2.5 py-1 rounded-full">
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 text-brand-gray font-body text-[12px] mb-2">
                      <span className="flex items-center gap-1"><CalendarDays size={12} />{new Date(article.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      <span className="flex items-center gap-1"><Clock size={12} />{article.readTime} min</span>
                    </div>
                    <h2 className="font-display font-bold text-[18px] text-brand-black group-hover:text-orange-primary transition-colors leading-tight">
                      {article.title}
                    </h2>
                    <p className="font-body text-[13px] text-brand-gray mt-2 line-clamp-3 leading-relaxed">
                      {article.excerpt}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-3 font-body font-medium text-[13px] text-orange-primary group-hover:underline">
                      Lire l'article <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-16 text-center animate-card">
              <div className="rounded-2xl border border-black/[0.08] bg-white p-10 max-w-[600px] mx-auto">
                <BookOpen size={32} className="text-orange-primary mx-auto mb-4" />
                <h2 className="font-display font-black text-[24px] text-brand-black">Vous avez des questions ?</h2>
                <p className="font-body text-[15px] text-brand-gray mt-2 mb-6">
                  Nos coachs sont disponibles pour vous accompagner dans votre choix d'activité.
                </p>
                <a
                  href="/#contact"
                  className="font-body font-semibold text-[15px] text-white px-8 py-3.5 rounded-full inline-flex items-center gap-2 bg-brand-olive hover:bg-brand-olive-hover"
                >
                  Une question au bureau
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <BackToTop />
    </div>
  );
}
