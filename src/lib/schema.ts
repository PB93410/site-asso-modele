import type { ActivityFAQ, ActivityPageData } from '../data/activityPages';
import type { BlogArticle } from '../data/blogData';
import { faqs } from '../data/faqData';
import { SITE_CONFIG, type Event } from '../data/siteData';
import { ASSO, PAYMENT_MODES, SITE_URL, TEL_INTL, lieuAdresse, type AssoLieu } from '../data/asso';
import { eventIsoDates, isPastEvent } from './events';

export type Crumb = {
  name: string;
  item: string;
};

const TEL = TEL_INTL;
const PRICE = String(ASSO.adhesion.tarif);

/** Réseaux sociaux renseignés dans asso.config.js (sameAs). */
const SAME_AS = [ASSO.reseaux.facebook, ASSO.reseaux.instagram].filter(Boolean);

function postalAddress(streetAddress?: string, lieu?: AssoLieu) {
  return {
    '@type': 'PostalAddress',
    ...(streetAddress ? { streetAddress } : {}),
    addressLocality: lieu?.ville || ASSO.ville,
    postalCode: lieu?.codePostal || ASSO.codePostal,
    addressRegion: ASSO.departement,
    addressCountry: 'FR',
  };
}

function parseHourPart(raw: string) {
  const m = String(raw || '')
    .trim()
    .match(/^(\d{1,2})\s*h\s*(\d{2})?$/i);
  if (!m) return '10:00';
  return `${m[1].padStart(2, '0')}:${(m[2] || '00').padStart(2, '0')}`;
}

function slotTimes(timeRange: string) {
  const parts = String(timeRange || '').split(/\s*[–—-]\s*/);
  return {
    start: parseHourPart(parts[0] || '10h00'),
    end: parseHourPart(parts[1] || parts[0] || '11h00'),
  };
}

function courseStartDay(activity: ActivityPageData) {
  return activity.startDate || ASSO.saison.reprise;
}

/** Accueil : SportsOrganization + un lieu par salle + Offer adhésion. Les événements : buildEventsSchema. */
export function buildHomeSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SportsOrganization',
        '@id': `${SITE_URL}/#organization`,
        name: ASSO.nom,
        url: `${SITE_URL}/`,
        foundingDate: ASSO.anneeCreation,
        email: SITE_CONFIG.email,
        telephone: TEL,
        ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
      },
      ...ASSO.lieux.map((lieu) => ({
        '@type': ['LocalBusiness', 'SportsActivityLocation'],
        '@id': `${SITE_URL}/#location-${lieu.id}`,
        name: `${ASSO.nom} — ${lieu.nom}`,
        url: `${SITE_URL}/`,
        telephone: TEL,
        email: SITE_CONFIG.email,
        parentOrganization: { '@id': `${SITE_URL}/#organization` },
        address: postalAddress(lieu.rue, lieu),
        ...(lieu.lat !== undefined && lieu.lon !== undefined
          ? { geo: { '@type': 'GeoCoordinates', latitude: lieu.lat, longitude: lieu.lon } }
          : {}),
      })),
      {
        '@type': 'Offer',
        '@id': `${SITE_URL}/#offer-adhesion`,
        name: `Adhésion annuelle ${ASSO.nom}`,
        price: PRICE,
        priceCurrency: 'EUR',
        url: `${SITE_URL}/tarifs/`,
        availability: 'https://schema.org/InStock',
        offeredBy: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
}

/** Lieu d'un événement : adresse complète si le nom correspond à un lieu de asso.config.js. */
function eventPlace(location: string) {
  const loc = String(location || '').trim();
  const lieu = ASSO.lieux.find((l) => loc.toLowerCase().includes(l.nom.toLowerCase()));
  if (lieu) {
    return {
      '@type': 'Place',
      name: lieu.nom,
      address: { ...postalAddress(lieu.rue, lieu), name: lieuAdresse(lieu) },
    };
  }
  return { '@type': 'Place', name: loc || ASSO.ville, address: postalAddress() };
}

/**
 * Événements à venir (portes ouvertes, repas…) pour Google « événements près de chez moi ».
 * Accueil seulement, à côté de buildHomeSchema. Événements passés ou sans date exclus.
 * Calculé au build : relancer un build après avoir ajouté un événement.
 */
export function buildEventsSchema(events: Event[], now: Date = new Date()) {
  const nodes = events
    .filter((e) => e.title && !isPastEvent(e, now))
    .map((e) => {
      const dates = eventIsoDates(e);
      if (!dates) return null;
      return {
        '@type': 'Event',
        name: e.title,
        ...(e.description ? { description: e.description } : {}),
        startDate: dates.startDate,
        ...(dates.endDate ? { endDate: dates.endDate } : {}),
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: eventPlace(e.location),
        organizer: { '@id': `${SITE_URL}/#organization`, name: ASSO.nom, url: `${SITE_URL}/` },
        ...(e.image ? { image: `${SITE_URL}${e.image}` } : {}),
        url: e.link?.startsWith('/') ? `${SITE_URL}${e.link}` : `${SITE_URL}/#evenements`,
      };
    })
    .filter(Boolean);
  if (nodes.length === 0) return null;
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export function buildActivitySchema(activity: ActivityPageData) {
  const day = courseStartDay(activity);
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: activity.metaTitle,
    description: activity.metaDescription,
    provider: {
      '@type': 'SportsActivityLocation',
      name: ASSO.nom,
      address: postalAddress(ASSO.lieux[0]?.rue),
      telephone: TEL,
      url: `${SITE_URL}/`,
    },
    hasCourseInstance: activity.schedule.map((s) => {
      const { start, end } = slotTimes(s.time);
      return {
        '@type': 'CourseInstance',
        courseMode: 'onsite',
        courseWorkload: 'PT1H',
        inLanguage: 'fr',
        instructor: {
          '@type': 'Person',
          name: activity.coach,
        },
        location: {
          '@type': 'Place',
          name: s.location,
          address: postalAddress(),
        },
        startDate: `${day}T${start}:00`,
        endDate: `${day}T${end}:00`,
        dayOfWeek: s.day,
      };
    }),
    offers: {
      '@type': 'Offer',
      price: PRICE,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      validFrom: day,
      url: `${SITE_URL}/tarifs/`,
    },
  };
}

export function buildFaqSchema(faq: ActivityFAQ[] | { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}

/** FAQ site (/faq uniquement). */
export function buildSiteFaqSchema() {
  return buildFaqSchema(faqs);
}

export function buildBreadcrumbSchema(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  };
}

export function buildHowToJoinSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${SITE_URL}/#howto-inscription`,
    name: `Comment essayer puis adhérer à ${ASSO.nom}`,
    description: `Réserver un essai en ligne, venir au créneau, puis adhérer si le cours convient. Cotisation ${PRICE} € l’année, ${ASSO.adhesion.inclus}.`,
    totalTime: 'P3D',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'EUR',
      value: PRICE,
    },
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Réservez un essai',
        text: 'Remplissez le formulaire d’essai (prénom, nom, téléphone, créneau). Gratuit, sans engagement.',
        url: `${SITE_URL}/essai/`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Venez au créneau',
        text: `Le bureau confirme le créneau. Rien à payer le jour de l’essai. ${ASSO.lieux.map((l) => l.nom).join(' ou ')}, ${ASSO.ville}.`,
        url: `${SITE_URL}/essai/`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Adhérez si ça vous convient',
        text: `Cotisation ${PRICE} € l’année, ${ASSO.adhesion.inclus}. Formulaire d’inscription puis paiement : ${PAYMENT_MODES.join(', ').toLowerCase()}.`,
        url: `${SITE_URL}/inscription/`,
      },
    ],
  };
}

export function buildArticleSchema(post: BlogArticle) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription,
    image: `${SITE_URL}${post.image}`,
    datePublished: post.date,
    dateModified: post.dateModified || post.date,
    author: {
      '@type': 'Organization',
      name: ASSO.nom,
      url: `${SITE_URL}/`,
    },
    publisher: {
      '@type': 'Organization',
      name: ASSO.nom,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon-192.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${post.slug}/`,
    },
  };
}
