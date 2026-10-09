import { BLOG_ARTICLES, type BlogArticle } from './blogData';

/**
 * Point d'entrée « live » du blog : permet d'ajuster un article déjà publié
 * (ex. remplacer « commence le… » par « a repris le… ») sans toucher à blogData.ts.
 */
export function liveBlogArticle(a: BlogArticle): BlogArticle {
  return a;
}

export const BLOG_ARTICLES_LIVE = BLOG_ARTICLES.map(liveBlogArticle);

export function getLiveBlogArticle(slug: string) {
  return BLOG_ARTICLES_LIVE.find((a) => a.slug === slug);
}
