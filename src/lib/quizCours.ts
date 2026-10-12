/**
 * Quiz public « Quel cours pour moi ? » (modules.quiz).
 * 6 questions, ranking des cours du fichier contenu/.
 */

import { COURS, PLANNING_CONTENU } from '../data/contenu';
import type { CoursContenu, CreneauContenu } from '../data/contenu';

export type QuizQuestionId = 'pratique' | 'age' | 'objectif' | 'intensite' | 'dispo' | 'contrainte';

export type QuizChoix = { id: string; label: string };

export type QuizQuestion = {
  id: QuizQuestionId;
  titre: string;
  aide?: string;
  choix: QuizChoix[];
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'pratique',
    titre: 'Vous bougez déjà ?',
    choix: [
      { id: 'jamais', label: 'Pas depuis longtemps, ou jamais' },
      { id: 'un-peu', label: 'De temps en temps' },
      { id: 'regulier', label: 'Chaque semaine' },
    ],
  },
  {
    id: 'age',
    titre: 'Vous avez…',
    choix: [
      { id: 'jeune', label: 'Moins de 40 ans' },
      { id: 'adulte', label: 'Entre 40 et 60 ans' },
      { id: 'senior', label: '60 ans ou plus' },
    ],
  },
  {
    id: 'objectif',
    titre: 'Vous cherchez surtout…',
    choix: [
      { id: 'souplesse', label: 'Souplesse et mobilité' },
      { id: 'cardio', label: 'Le souffle, bouger vraiment' },
      { id: 'renfo', label: 'Tenir le dos, se muscler un peu' },
      { id: 'danse', label: 'Danser, sans être danseur' },
      { id: 'detente', label: 'Détendre le corps, sans se brusquer' },
    ],
  },
  {
    id: 'intensite',
    titre: 'Vous préférez un cours…',
    choix: [
      { id: 'douce', label: 'Tout en douceur' },
      { id: 'moderee', label: 'Un peu d’effort, à votre rythme' },
      { id: 'dynamique', label: 'Dynamique' },
    ],
  },
  {
    id: 'dispo',
    titre: 'Vous êtes plus libre…',
    aide: 'On regarde le planning de la semaine.',
    choix: [
      { id: 'matin', label: 'Le matin' },
      { id: 'apres-midi', label: 'L’après-midi' },
      { id: 'soir', label: 'En soirée' },
      { id: 'weekend', label: 'Le week-end' },
    ],
  },
  {
    id: 'contrainte',
    titre: 'Un point à ménager ?',
    choix: [
      { id: 'aucun', label: 'Rien de particulier' },
      { id: 'dos', label: 'Le dos' },
      { id: 'genoux', label: 'Les genoux ou les articulations' },
    ],
  },
];

type Profil = {
  pratique: string[];
  age: string[];
  objectif: string[];
  intensite: string[];
  contrainte: string[];
};

/** Profils par nom de cours (mots du questionnaire). Le reste se déduit du texte. */
const PROFILS: Record<string, Profil> = {
  'Gym Douce': {
    pratique: ['jamais', 'un-peu'],
    age: ['senior', 'adulte'],
    objectif: ['detente', 'souplesse'],
    intensite: ['douce'],
    contrainte: ['dos', 'genoux', 'aucun'],
  },
  Stretching: {
    pratique: ['jamais', 'un-peu', 'regulier'],
    age: ['adulte', 'senior', 'jeune'],
    objectif: ['souplesse', 'detente'],
    intensite: ['douce', 'moderee'],
    contrainte: ['dos', 'aucun'],
  },
  Pilates: {
    pratique: ['un-peu', 'regulier', 'jamais'],
    age: ['adulte', 'jeune', 'senior'],
    objectif: ['renfo', 'souplesse'],
    intensite: ['douce', 'moderee'],
    contrainte: ['dos', 'aucun'],
  },
  'Renforcement Musculaire': {
    pratique: ['un-peu', 'regulier'],
    age: ['adulte', 'jeune'],
    objectif: ['renfo'],
    intensite: ['moderee', 'dynamique'],
    contrainte: ['aucun', 'dos'],
  },
  'Cardio & Gym': {
    pratique: ['un-peu', 'regulier'],
    age: ['jeune', 'adulte'],
    objectif: ['cardio'],
    intensite: ['moderee', 'dynamique'],
    contrainte: ['aucun'],
  },
  Zumba: {
    pratique: ['un-peu', 'regulier', 'jamais'],
    age: ['jeune', 'adulte'],
    objectif: ['danse', 'cardio'],
    intensite: ['dynamique', 'moderee'],
    contrainte: ['aucun'],
  },
};

export type QuizReponses = Partial<Record<QuizQuestionId, string>>;

export type QuizMatch = {
  nom: string;
  score: number;
  raisons: string[];
  creneaux: { jour: string; horaire: string; lieu: string }[];
  niveau: string;
  resume: string;
  slug?: string;
};

function heureDebut(horaire: string) {
  const m = String(horaire || '').match(/(\d{1,2})h(\d{2})?/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] || 0);
}

function creneauMatcheDispo(jour: string, horaire: string, dispo: string) {
  const j = String(jour || '').toLowerCase();
  if (dispo === 'weekend') return j.startsWith('samedi') || j.startsWith('dimanche');
  const min = heureDebut(horaire);
  if (min == null) return true;
  if (dispo === 'matin') return min < 12 * 60;
  if (dispo === 'apres-midi') return min >= 12 * 60 && min < 17 * 60;
  if (dispo === 'soir') return min >= 17 * 60;
  return true;
}

function profilDe(cours: CoursContenu): Profil {
  if (PROFILS[cours.nom]) return PROFILS[cours.nom];
  const blob = `${cours.nom} ${cours.niveau} ${cours.resume} ${cours.texte || ''} ${(cours.bienfaits || []).join(' ')}`.toLowerCase();
  const has = (re: RegExp) => re.test(blob);
  return {
    pratique: has(/reprise|début|debut|doux/) ? ['jamais', 'un-peu'] : ['un-peu', 'regulier'],
    age: ['adulte', 'senior', 'jeune'],
    objectif: [
      ...(has(/souple|étir|etir/) ? ['souplesse'] : []),
      ...(has(/cardio|souffle|endurance/) ? ['cardio'] : []),
      ...(has(/renfor|dos|gainage|muscle/) ? ['renfo'] : []),
      ...(has(/danse|zumba/) ? ['danse'] : []),
      ...(has(/détente|detente|relax/) ? ['detente'] : []),
    ],
    intensite: has(/doux|douce|lent/) ? ['douce'] : has(/dynamiq|rythm/) ? ['dynamique'] : ['moderee'],
    contrainte: has(/articulation|genou|doux/) ? ['genoux', 'dos', 'aucun'] : ['aucun', 'dos'],
  };
}

const LIBELLES: Record<string, string> = {
  jamais: 'adapté à une reprise',
  'un-peu': 'tous niveaux',
  regulier: 'vous pourrez y mettre de l’intensité',
  senior: 'pensé pour avancer à son rythme',
  souplesse: 'souplesse et mobilité',
  cardio: 'le souffle',
  renfo: 'le dos et le renforcement',
  danse: 'bouger en musique',
  detente: 'sans se brusquer',
  douce: 'en douceur',
  moderee: 'un effort mesuré',
  dynamique: 'dynamique',
  dos: 'en ménageant le dos',
  genoux: 'en ménageant les articulations',
};

export function scorerCours(cours: CoursContenu, reponses: QuizReponses, planning: CreneauContenu[] = PLANNING_CONTENU): QuizMatch {
  const p = profilDe(cours);
  let score = 0;
  const raisons: string[] = [];
  const add = (ok: boolean, pts: number, key: string) => {
    if (!ok) return;
    score += pts;
    if (LIBELLES[key]) raisons.push(LIBELLES[key]);
  };

  if (reponses.pratique) add(p.pratique.includes(reponses.pratique), 3, reponses.pratique);
  if (reponses.age) add(p.age.includes(reponses.age), 2, reponses.age);
  if (reponses.objectif) add(p.objectif.includes(reponses.objectif), 4, reponses.objectif);
  if (reponses.intensite) add(p.intensite.includes(reponses.intensite), 3, reponses.intensite);
  if (reponses.contrainte && reponses.contrainte !== 'aucun') {
    add(p.contrainte.includes(reponses.contrainte), 3, reponses.contrainte);
    if (!p.contrainte.includes(reponses.contrainte)) score -= 2;
  } else if (reponses.contrainte === 'aucun') {
    score += 1;
  }

  const creneaux = planning
    .filter((c) => c.cours === cours.nom)
    .filter((c) => !reponses.dispo || creneauMatcheDispo(c.jour, c.horaire, reponses.dispo))
    .map((c) => ({ jour: c.jour, horaire: c.horaire, lieu: c.lieu }));
  if (reponses.dispo) {
    if (creneaux.length) {
      score += 3;
      raisons.push(
        creneaux.length === 1
          ? `${creneaux[0].jour} ${creneaux[0].horaire}`
          : `${creneaux.length} créneaux sur votre créneau`,
      );
    } else {
      score -= 1;
    }
  }

  return {
    nom: cours.nom,
    score,
    raisons: [...new Set(raisons)].slice(0, 3),
    creneaux: planning.filter((c) => c.cours === cours.nom).map((c) => ({ jour: c.jour, horaire: c.horaire, lieu: c.lieu })),
    niveau: cours.niveau,
    resume: cours.resume,
  };
}

export function recommanderCours(
  reponses: QuizReponses,
  cours: CoursContenu[] = COURS,
  planning: CreneauContenu[] = PLANNING_CONTENU,
  n = 3,
): QuizMatch[] {
  return cours
    .map((c) => scorerCours(c, reponses, planning))
    .sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, n);
}
