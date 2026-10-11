// ============================================
// DONNÉES DU SITE — contenus éditoriaux
// ============================================
//
// Identité, contacts, salles, tarif : asso.config.js (racine).
// Cours, animateurs, FAQ, planning et événements par défaut : contenu/*.json
// (écrits par `npm run installer`, modifiables à la main).
// Ici : la forme utilisée par le site, et le bureau.
//
// En production, planning et événements se modifient depuis /bureau
// (Google Sheets, voir DOC-GOOGLE-SHEETS.md).
//
// ============================================

import { ASSO, TARIF_LABEL } from './asso';
import { remplir, valeursTexte } from '../lib/gabarit.js';
import { COACHS_CONTENU, COURS, EVENEMENTS_CONTENU, PLANNING_CONTENU } from './contenu';

/** Valeurs des textes à trous ({ville}, {lieu1}…). */
export const VALEURS_TEXTE = valeursTexte(ASSO, COURS.length);

// ============================================
// 1. COACHS
// ============================================
// Source : contenu/coachs.json

export interface Coach {
  name: string;
  specialties: string[];
  image: string;
  bio: string;
}

export const COACHS: Coach[] = COACHS_CONTENU.map((c) => ({
  name: c.nom,
  specialties: c.specialites,
  image: c.image,
  bio: remplir(c.bio, VALEURS_TEXTE),
}));

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
// Source : contenu/cours.json. Le nom doit correspondre à la colonne « course » du planning.

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

export const ACTIVITIES: Activity[] = COURS.map((c) => ({
  name: c.nom,
  level: c.niveau,
  desc: remplir(c.resume, VALEURS_TEXTE),
  coach: c.animateur,
  benefits: c.bienfaits,
  image: c.image,
  ...(c.noteHoraire ? { scheduleNotice: remplir(c.noteHoraire, VALEURS_TEXTE) } : {}),
}));

// ============================================
// 4. ÉVÉNEMENTS
// ============================================
// Source par défaut : contenu/evenements.json (miseEnAvant = carte mise en avant).
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

export const EVENTS: Event[] = EVENEMENTS_CONTENU.map((e) => ({
  id: e.id,
  date: e.date,
  month: e.mois,
  year: e.annee,
  title: remplir(e.titre, VALEURS_TEXTE),
  description: remplir(e.description, VALEURS_TEXTE),
  time: e.heure,
  location: remplir(e.lieu, VALEURS_TEXTE),
  ...(e.miseEnAvant ? { highlight: true } : {}),
  ...(e.image ? { image: e.image } : {}),
  ...(e.logo ? { logo: e.logo } : {}),
  ...(e.lien ? { link: e.lien } : {}),
  ...(e.type ? { type: e.type } : {}),
}));

// ============================================
// 6. HORAIRES / PLANNING
// ============================================
// Planning par défaut (si le Sheet n'est pas branché) : contenu/planning.json.
// lieu = nom d'un lieu de asso.config.js, ou {lieu1} / {lieu2}.

export interface ScheduleRow {
  day: string;
  time: string;
  course: string;
  location: string;
  note: string;
}

export const SCHEDULE: ScheduleRow[] = PLANNING_CONTENU.map((p) => ({
  day: p.jour,
  time: p.horaire,
  course: p.cours,
  location: remplir(p.lieu, VALEURS_TEXTE),
  note: p.note || '',
}));

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
