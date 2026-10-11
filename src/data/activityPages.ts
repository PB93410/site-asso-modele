// ============================================
// DONNÉES DES PAGES D'ACTIVITÉ — SEO LONGUE TRAÎNE
// ============================================
// Une page par cours : /cours-<activite>-<ville>
// Le planning de chaque page est tiré de SCHEDULE (colonne course = name).
// Textes de chaque cours : contenu/cours.json (accroche, texte, bienfaitsDetail, faq, liens).

import { ASSO, ESSAIS_LABEL, TARIF_LABEL, VILLE_SLUG, slugify } from './asso';
import { remplir } from '../lib/gabarit.js';
import { COURS } from './contenu';
import { ACTIVITIES, SCHEDULE, VALEURS_TEXTE } from './siteData';

export interface ActivityFAQ {
  question: string;
  answer: string;
}

export interface ActivityPageData {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subheadline: string;
  description: string;
  longDescription: string;
  level: string;
  coach: string;
  benefits: string[];
  detailedBenefits: { title: string; desc: string }[];
  image: string;
  schedule: { day: string; time: string; location: string }[];
  faq: ActivityFAQ[];
  relatedActivities: string[];
  schemaType: 'Course' | 'SportsActivityLocation';
  scheduleNotice?: string;
  /** Première séance de la saison si différente de la reprise (AAAA-MM-JJ). */
  startDate?: string;
}

/** Contenu rédactionnel propre à chaque cours (clé = nom du cours). */
type ActivityContent = {
  subheadline: string;
  longDescription: string;
  detailedBenefits: { title: string; desc: string }[];
  faq: ActivityFAQ[];
  relatedActivities: string[];
  scheduleNotice?: string;
  startDate?: string;
};

const t = (s: string) => remplir(s, VALEURS_TEXTE);

const CONTENT: Record<string, ActivityContent> = Object.fromEntries(
  COURS.filter((c) => c.accroche || c.texte || c.bienfaitsDetail?.length || c.faq?.length).map((c) => [
    c.nom,
    {
      subheadline: t(c.accroche || ''),
      longDescription: t(c.texte || ''),
      detailedBenefits: (c.bienfaitsDetail || []).map((b) => ({ title: t(b.titre), desc: t(b.texte) })),
      faq: (c.faq || []).map((f) => ({ question: t(f.question), answer: t(f.reponse) })),
      relatedActivities: c.liens || [],
      ...(c.noteHoraire ? { scheduleNotice: t(c.noteHoraire) } : {}),
      ...(c.debut ? { startDate: c.debut } : {}),
    },
  ]),
);

const DEFAULT_CONTENT: ActivityContent = {
  subheadline: 'Un cours collectif ouvert à tous',
  longDescription: '',
  detailedBenefits: [],
  faq: [],
  relatedActivities: [],
};

function scheduleFor(name: string) {
  return SCHEDULE.filter((s) => s.course === name).map(({ day, time, location }) => ({
    day,
    time,
    location,
  }));
}

export const ACTIVITY_PAGES: ActivityPageData[] = ACTIVITIES.map((a) => {
  const c = CONTENT[a.name] ?? DEFAULT_CONTENT;
  return {
    slug: `cours-${slugify(a.name)}-${VILLE_SLUG}`,
    name: a.name,
    metaTitle: `Cours de ${a.name} à ${ASSO.ville} (${ASSO.codePostal}) | ${ASSO.nomCourt}`,
    metaDescription: `Cours de ${a.name} à ${ASSO.ville} : ${a.desc.toLowerCase()}. ${a.level}. ${TARIF_LABEL}/an${ESSAIS_LABEL ? `, ${ESSAIS_LABEL}` : ''}.`,
    headline: `Cours de ${a.name} à ${ASSO.ville}`,
    subheadline: c.subheadline || DEFAULT_CONTENT.subheadline,
    description: a.desc,
    longDescription: c.longDescription || a.desc,
    level: a.level,
    coach: a.coach,
    benefits: a.benefits,
    detailedBenefits: c.detailedBenefits.length
      ? c.detailedBenefits
      : a.benefits.map((b) => ({ title: b, desc: '' })),
    image: a.image,
    schedule: scheduleFor(a.name),
    faq: c.faq,
    relatedActivities: c.relatedActivities,
    schemaType: 'Course',
    scheduleNotice: c.scheduleNotice ?? a.scheduleNotice,
    startDate: c.startDate,
  };
});

// Helper pour trouver une page par slug
export function getActivityPage(slug: string): ActivityPageData | undefined {
  return ACTIVITY_PAGES.find((p) => p.slug === slug);
}

// Helper pour trouver les pages liées
export function getRelatedPages(slugs: string[]): ActivityPageData[] {
  return ACTIVITY_PAGES.filter((p) => slugs.includes(p.name));
}
