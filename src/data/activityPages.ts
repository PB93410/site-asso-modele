// ============================================
// DONNÉES DES PAGES D'ACTIVITÉ — SEO LONGUE TRAÎNE
// ============================================
// Une page par cours : /cours-<activite>-<ville>
// Le planning de chaque page est tiré de SCHEDULE (colonne course = name).
// Pour ajouter un cours : ajoutez-le dans siteData.ts (ACTIVITIES) puis un bloc dans CONTENT.

import { ASSO, ESSAIS_LABEL, TARIF_LABEL, VILLE_SLUG, slugify } from './asso';
import { ACTIVITIES, SCHEDULE } from './siteData';

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

/** Contenu rédactionnel propre à chaque cours (clé = nom dans ACTIVITIES). */
type ActivityContent = {
  subheadline: string;
  longDescription: string;
  detailedBenefits: { title: string; desc: string }[];
  faq: ActivityFAQ[];
  relatedActivities: string[];
  scheduleNotice?: string;
  startDate?: string;
};

const CONTENT: Record<string, ActivityContent> = {
  Pilates: {
    subheadline: 'Renforcement profond, posture et bien-être pour tous',
    longDescription:
      'On déroule le tapis, le coach pose le rythme de la respiration, et en vingt minutes le dos se tient déjà autrement. On travaille le ventre, le bas du dos et les cuisses, sans machines : respiration, mouvements lents, matériel déjà sur place. Ouvert à celles et ceux qui n’ont jamais fait de Pilates.',
    detailedBenefits: [
      { title: 'Tenir le dos', desc: 'On renforce le ventre et le bas du dos, à un rythme lent. Utile si vous restez assis toute la semaine.' },
      { title: 'Souplesse', desc: 'Les étirements restent contrôlés : on allonge sans forcer, chacun à son amplitude.' },
      { title: 'Tout le matériel est sur place', desc: 'Tapis, ballons, élastiques : vous venez en tenue confortable, rien d’autre à acheter.' },
    ],
    faq: [
      { question: 'Le Pilates est-il fait pour les débutants ?', answer: 'Oui. Le coach adapte chaque exercice et vous guide pas à pas dans les mouvements de base.' },
      { question: 'Faut-il un tapis ou du matériel ?', answer: 'Non, tout est fourni. Venez simplement en tenue confortable.' },
    ],
    relatedActivities: ['Stretching', 'Gym Douce'],
  },
  Zumba: {
    subheadline: 'Danse, sueur et bonne humeur',
    longDescription:
      'La musique démarre, le coach montre le premier pas, et en trois minutes même ceux qui « ne dansent pas » suivent le groupe. Des chorégraphies simples sur des rythmes latins et internationaux, pour bouger une heure sans voir le temps passer.',
    detailedBenefits: [
      { title: 'Souffle', desc: 'On bouge une heure sur la musique. Chacun garde son rythme : on peut marquer le pas si ça va trop vite.' },
      { title: 'Pas besoin de savoir danser', desc: 'Le coach montre le pas, on répète. Ce n’est pas un cours de danse.' },
      { title: 'On suit le groupe', desc: 'Les chorégraphies restent simples et reviennent d’une semaine à l’autre.' },
    ],
    faq: [
      { question: 'Faut-il savoir danser ?', answer: 'Pas du tout. Les mouvements sont simples, répétitifs et faciles à suivre.' },
      { question: 'Quelle tenue ?', answer: 'Une tenue de sport confortable, des baskets propres, une serviette et une bouteille d’eau.' },
    ],
    relatedActivities: ['Cardio & Gym'],
  },
  'Renforcement Musculaire': {
    subheadline: 'Jambes, bras, dos — sans machines',
    longDescription:
      'Un cours complet pour renforcer jambes, fessiers, bras et dos avec le poids du corps et un peu de matériel léger. Le coach propose toujours une version plus facile et une plus difficile.',
    detailedBenefits: [
      { title: 'Tenir le dos', desc: 'Gainage et renforcement du tronc, utile au quotidien.' },
      { title: 'Jambes et bras, sans machines', desc: 'Poids du corps, élastiques, haltères légers.' },
      { title: 'Tout le matériel est sur place', desc: 'Rien à acheter : venez en tenue.' },
    ],
    faq: [
      { question: 'Je n’ai jamais fait de musculation, c’est pour moi ?', answer: 'Oui. Chaque exercice a une version adaptée aux débutants.' },
    ],
    relatedActivities: ['Pilates', 'Cardio & Gym'],
  },
  Stretching: {
    subheadline: 'Souplesse, détente et récupération',
    longDescription:
      'Une heure pour relâcher les tensions : étirements lents, respiration, mobilité des épaules, du dos et des hanches. On repart plus léger, sans jamais forcer.',
    detailedBenefits: [
      { title: 'Relâcher', desc: 'On dénoue la nuque, les épaules et le dos.' },
      { title: 'Souplesse', desc: 'On gagne en amplitude, semaine après semaine.' },
      { title: 'Équilibre', desc: 'Des exercices simples pour se sentir plus stable.' },
    ],
    faq: [
      { question: 'Je ne suis pas souple, c’est grave ?', answer: 'Non, c’est justement le but du cours. Chacun va à son amplitude.' },
    ],
    relatedActivities: ['Pilates', 'Gym Douce'],
  },
  'Cardio & Gym': {
    subheadline: 'Endurance et dynamisme',
    longDescription:
      'Un cours rythmé qui alterne exercices cardio et renforcement. On travaille le souffle et l’endurance, chacun module l’effort selon sa forme du jour.',
    detailedBenefits: [
      { title: 'Souffle', desc: 'On travaille l’endurance progressivement.' },
      { title: 'Endurance', desc: 'Des enchaînements qui reviennent pour mesurer ses progrès.' },
      { title: 'On module l’effort', desc: 'Toujours une version plus douce proposée.' },
    ],
    faq: [
      { question: 'C’est très intense ?', answer: 'C’est dynamique, mais chacun garde son rythme. Le coach propose des variantes.' },
    ],
    relatedActivities: ['Zumba', 'Renforcement Musculaire'],
  },
  'Gym Douce': {
    subheadline: 'Reprendre le sport en douceur',
    longDescription:
      'Mobilité, équilibre, renforcement léger et détente : la gym douce est pensée pour reprendre après une longue pause ou bouger en préservant ses articulations. Aucun niveau requis.',
    detailedBenefits: [
      { title: 'Mobilité', desc: 'On fait travailler toutes les articulations, en douceur.' },
      { title: 'Équilibre', desc: 'Des exercices simples pour gagner en stabilité au quotidien.' },
      { title: 'Reprise sans se brusquer', desc: 'Le rythme est adapté, on fait des pauses quand il faut.' },
    ],
    faq: [
      { question: 'Faut-il un certificat médical ?', answer: 'Non pour la pratique de loisir, un questionnaire de santé suffit. En cas de doute, demandez l’avis de votre médecin.' },
    ],
    relatedActivities: ['Stretching', 'Pilates'],
  },
};

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
    subheadline: c.subheadline,
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
