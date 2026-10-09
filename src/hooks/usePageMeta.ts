import { useEffect } from 'react';
import { SITE_URL } from '../data/asso';

type PageMetaOptions = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  /** Absolute path or full URL for canonical + og:url (e.g. /cours-pilates) */
  path?: string;
  /** Scroll to top on mount / when deps change (default true) */
  scrollToTop?: boolean;
};

const SITE_ORIGIN = SITE_URL;

function setMetaName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http')) {
    if (pathOrUrl === SITE_ORIGIN || pathOrUrl === `${SITE_ORIGIN}/`) return `${SITE_ORIGIN}/`;
    return pathOrUrl.endsWith('/') ? pathOrUrl : `${pathOrUrl}/`;
  }
  const clean = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  if (clean === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${clean.endsWith('/') ? clean : `${clean}/`}`;
}

/**
 * Met à jour title + meta description / Open Graph / canonical et scroll en haut de page.
 * Utile en navigation SPA pour que le head reste cohérent (partage, onglets, crawlers JS).
 */
export function usePageMeta({
  title,
  description,
  ogTitle,
  ogDescription,
  path,
  scrollToTop = true,
}: PageMetaOptions) {
  useEffect(() => {
    if (scrollToTop) {
      window.scrollTo(0, 0);
    }
    if (title) {
      document.title = title;
    }
    if (description) {
      setMetaName('description', description);
    }
    if (ogTitle || title) {
      setMetaProperty('og:title', ogTitle || title || '');
    }
    if (ogDescription || description) {
      setMetaProperty('og:description', ogDescription || description || '');
    }
    if (title) {
      setMetaName('twitter:title', ogTitle || title);
    }
    if (ogDescription || description) {
      setMetaName('twitter:description', ogDescription || description || '');
    }
    if (path) {
      const absolute = toAbsoluteUrl(path);
      setCanonical(absolute);
      setMetaProperty('og:url', absolute);
      for (const lang of ['fr-fr', 'x-default']) {
        let el = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
        if (!el) {
          el = document.createElement('link');
          el.setAttribute('rel', 'alternate');
          el.setAttribute('hreflang', lang);
          document.head.appendChild(el);
        }
        el.setAttribute('href', absolute);
      }
    }
  }, [title, description, ogTitle, ogDescription, path, scrollToTop]);
}
