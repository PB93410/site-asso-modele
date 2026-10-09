import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { BLOG_ARTICLES_LIVE } from '../data/blogLive';
import { ASSO } from '../data/asso';

/** Les 4 articles les plus récents sur l'accueil. */
const preview = [...BLOG_ARTICLES_LIVE].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

export default function BlogSection() {
  return (
    <section id="blog" className="bg-white section-padding !py-10 md:!py-12 border-t border-black/[0.04]">
      <div className="content-max-width max-w-[760px]">
        <h2 className="font-display font-black text-[24px] md:text-[30px] text-brand-black leading-tight mb-6">
          {ASSO.accroche} à {ASSO.ville} : conseils et actualités
        </h2>

        <ul className="space-y-4">
          {preview.map((article) =>
            article ? (
              <li key={article.slug}>
                <Link to={`/blog/${article.slug}`} className="block group">
                  <h3 className="font-display font-bold text-[17px] text-brand-black group-hover:text-orange-primary leading-snug">
                    {article.title}
                  </h3>
                  <p className="hidden sm:block font-body text-[14px] text-brand-gray mt-1 leading-relaxed">
                    {article.excerpt}
                  </p>
                </Link>
              </li>
            ) : null,
          )}
        </ul>

        <Link
          to="/blog"
          className="inline-flex items-center gap-1 mt-6 font-body font-semibold text-[14px] text-orange-primary hover:underline min-h-[44px]"
        >
          Tous les articles
          <ChevronRight size={16} />
        </Link>
      </div>
    </section>
  );
}
