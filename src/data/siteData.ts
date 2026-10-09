// ============================================
// DONNÉES DU SITE — contenus éditoriaux
// ============================================
//
// Identité, contacts, salles, tarif : asso.config.js (racine).
// Ici : coachs, bureau, activités, événements, planning par défaut.
//
// OPTION 1 : Modifier ce fichier directement
//   → Changez les textes, sauvegardez, rebuild
//
// OPTION 2 : Google Sheets (recommandé pour les bénévoles)
//   → Planning et événements se modifient depuis /bureau
//   → Voir DOC-GOOGLE-SHEETS.md
//
// ============================================

import { ASSO, TARIF_LABEL } from './asso';

// ============================================
// 1. COACHS
// ============================================
// Pour ajouter un coach : copiez un bloc { ... } et modifiez
// Pour supprimer : effacez le bloc

export interface Coach {
  name: string;
  specialties: string[];
  image: string;
  bio: string;
}

export const COACHS: Coach[] = [
  {
    name: 'Claire',
    specialties: ['Gym', 'Cardio', 'Stretching'],
    image: '/assets/coach-1.svg',
    bio: "Claire commence chaque séance par un tour des épaules et du dos : si quelque chose tire, elle propose une autre version. Assez d’énergie pour avancer, personne n’est laissé sur le bord du tapis.",
  },
  {
    name: 'Karim',
    specialties: ['Pilates', 'Renfo'],
    image: '/assets/coach-2.svg',
    bio: "Karim pose le cadre : on avance sans se forcer, on sent le corps travailler, et on repart plus droit. Diplômé en activité physique adaptée.",
  },
  {
    name: 'Julie',
    specialties: ['Zumba', 'Fitness'],
    image: '/assets/coach-3.svg',
    bio: "Julie démarre par un échauffement simple sur une musique que tout le monde connaît : pas besoin d’avoir dansé avant. Les pas se répètent, le groupe se lance, et on termine souvent en riant.",
  },
];

// ============================================
// 2. BUREAU
// ============================================

export interface BureauMember {
  name: string;
  role: string;
  phone: string;
  whatsapp: string;
}

export const BUREAU: BureauMember[] = [
  { name: 'Prénom Nom', role: 'Président·e', phone: '', whatsapp: ASSO.whatsapp },
  { name: 'Prénom Nom', role: 'Trésorier·e', phone: '', whatsapp: ASSO.whatsapp },
  { name: 'Prénom Nom', role: 'Secrétaire', phone: '', whatsapp: ASSO.whatsapp },
];

// ============================================
// 3. ACTIVITÉS / COURS
// ============================================
// Chaque cours a : nom, niveau, description, coach, bienfaits, image.
// Le nom doit correspondre à la colonne « course » du planning.

export interface Activity {
  name: string;
  level: string;
  desc: string;
  coach: string;
  benefits: string[];
  image: string;
  /** Message si le créneau n'est pas encore au planning */
  scheduleNotice?: string;
}

export const ACTIVITIES: Activity[] = [
  {
    name: 'Pilates',
    level: 'Tous niveaux',
    desc: 'Renforcement profond, posture, gainage et bien-être',
    coach: 'Karim',
    benefits: ['Tenir le dos', 'Souplesse', 'Tout le matériel est sur place'],
    image: '/assets/act-pilates.svg',
  },
  {
    name: 'Zumba',
    level: 'Tous niveaux',
    desc: 'Danse fitness rythmée et festive',
    coach: 'Julie',
    benefits: ['Souffle', 'Pas besoin de savoir danser', 'On suit le groupe'],
    image: '/assets/act-zumba.svg',
  },
  {
    name: 'Renforcement Musculaire',
    level: 'Tous niveaux',
    desc: 'Renforcement musculaire ciblé',
    coach: 'Karim',
    benefits: ['Tenir le dos', 'Jambes et bras, sans machines', 'Tout le matériel est sur place'],
    image: '/assets/act-renfo.svg',
  },
  {
    name: 'Stretching',
    level: 'Tous niveaux',
    desc: 'Souplesse, détente et récupération',
    coach: 'Claire',
    benefits: ['Relâcher', 'Souplesse', 'Équilibre'],
    image: '/assets/act-stretch.svg',
  },
  {
    name: 'Cardio & Gym',
    level: 'Tous niveaux',
    desc: 'Endurance et dynamisme',
    coach: 'Claire',
    benefits: ['Souffle', 'Endurance', 'On module l’effort'],
    image: '/assets/act-cardio.svg',
  },
  {
    name: 'Gym Douce',
    level: 'Reprise en douceur',
    desc: 'Aucun niveau requis · rythme adapté — mobilité, équilibre et bien-être',
    coach: 'Claire',
    benefits: ['Mobilité', 'Équilibre', 'Reprise sans se brusquer'],
    image: '/assets/act-stretch.svg',
  },
];

// ============================================
// 4. ÉVÉNEMENTS
// ============================================
// Pour ajouter un événement : copiez un bloc { ... }
// highlight: true = carte mise en avant
// En production, les événements viennent du Sheet (onglet evenements).

export interface Event {
  id: string;
  date: string;
  month: string;
  year: string;
  title: string;
  description: string;
  time: string;
  location: string;
  highlight?: boolean;
  image?: string;
  logo?: string;
  link?: string;
  /** Type d'événement pour le badge coloré */
  type?: 'administratif' | 'festif' | 'sportif' | 'caritatif' | 'sortie';
}

const LIEU_1 = ASSO.lieux[0]?.nom ?? '';

export const EVENTS: Event[] = [
  {
    id: 'portes-ouvertes',
    date: '15',
    month: 'NOV',
    year: '2026',
    title: 'Séance portes ouvertes',
    description: 'Venez avec un ami : séance ouverte à tous, sans inscription.',
    time: '10h00',
    location: `${LIEU_1}, ${ASSO.ville}`,
    highlight: true,
    type: 'sportif',
  },
  {
    id: 'repas-fin-annee',
    date: '12',
    month: 'DÉC',
    year: '2026',
    title: 'Repas de fin d’année',
    description: 'Séance festive pour célébrer les fêtes ensemble.',
    time: '19h00',
    location: `${LIEU_1}, ${ASSO.ville}`,
    type: 'festif',
  },
];

// ============================================
// 6. HORAIRES / PLANNING
// ============================================
// Planning par défaut (si le Sheet n'est pas branché).
// location = nom d'un lieu de asso.config.js

export interface ScheduleRow {
  day: string;
  time: string;
  course: string;
  location: string;
  note: string;
}

const LIEU_2 = ASSO.lieux[1]?.nom ?? LIEU_1;

export const SCHEDULE: ScheduleRow[] = [
  { day: 'Lundi', time: '13h30 – 14h30', course: 'Gym Douce', location: LIEU_2, note: '' },
  { day: 'Lundi', time: '20h00 – 21h30', course: 'Renforcement Musculaire', location: LIEU_1, note: '' },
  { day: 'Mercredi', time: '20h45 – 21h45', course: 'Cardio & Gym', location: LIEU_1, note: '' },
  { day: 'Jeudi', time: '15h30 – 16h30', course: 'Stretching', location: LIEU_2, note: '' },
  { day: 'Jeudi', time: '19h30 – 20h30', course: 'Zumba', location: LIEU_1, note: '' },
  { day: 'Samedi', time: '10h00 – 11h00', course: 'Pilates', location: LIEU_2, note: '' },
];

// ============================================
// 7. LIENS & CONFIGURATION
// ============================================

export const SITE_CONFIG = {
  /** Paiement en ligne de l'adhésion (HelloAsso…) */
  paiementUrl: ASSO.adhesion.paiementUrl,
  paiementNom: ASSO.adhesion.paiementNom,
  whatsappNumber: ASSO.whatsapp,
  email: ASSO.email,
  price: TARIF_LABEL,
  instagramUrl: ASSO.reseaux.instagram,
  instagramHandle: ASSO.reseaux.instagram
    ? `@${ASSO.reseaux.instagram.replace(/\/+$/, '').split('/').pop()}`
    : '',
  facebookUrl: ASSO.reseaux.facebook,
};

// ============================================
// 8. MESSAGES WHATSAPP PRÉREMPLIS (source unique)
// ============================================
// Ton : clair, chaleureux, senior-friendly. Laisser un espace pour que
// l'utilisateur complète (créneau, question…).

const MOYENS_PAIEMENT = [ASSO.adhesion.paiementNom, ...ASSO.adhesion.autresPaiements]
  .filter(Boolean)
  .join(' / ');

export const WHATSAPP_TEMPLATES = {
  essai: `Bonjour,
Je voudrais un essai.
Créneau souhaité :
Merci`,

  question: `Bonjour,
Ma question :
Merci`,

  inscription: `Bonjour,
Je voudrais adhérer (${TARIF_LABEL}/an).
Préférence : ${MOYENS_PAIEMENT}
Merci`,

  rentree: `Bonjour,
Je voudrais un renseignement sur les cours.
Merci`,

  generic: `Bonjour,
Je vous contacte pour les cours à ${ASSO.ville}.
Merci`,
} as const;

/** Helper : construit l'URL wa.me à partir d'un template */
export function waUrl(template: keyof typeof WHATSAPP_TEMPLATES | string): string {
  const number = SITE_CONFIG.whatsappNumber;
  const text =
    typeof template === 'string' && template in WHATSAPP_TEMPLATES
      ? WHATSAPP_TEMPLATES[template as keyof typeof WHATSAPP_TEMPLATES]
      : template;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
