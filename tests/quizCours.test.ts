import { describe, expect, it } from 'vitest';
import { COURS, PLANNING_CONTENU } from '../src/data/contenu';
import { QUIZ_QUESTIONS, recommanderCours } from '../src/lib/quizCours';

describe('quiz « Quel cours pour moi ? »', () => {
  it('pose 6 questions avec des choix', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(6);
    for (const q of QUIZ_QUESTIONS) {
      expect(q.choix.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('recommande la gym douce pour une reprise senior, le matin', () => {
    const recos = recommanderCours(
      {
        pratique: 'jamais',
        age: 'senior',
        objectif: 'detente',
        intensite: 'douce',
        dispo: 'apres-midi',
        contrainte: 'genoux',
      },
      COURS,
      PLANNING_CONTENU,
      3,
    );
    expect(recos[0].nom).toBe('Gym Douce');
    expect(recos[0].score).toBeGreaterThan(recos[2].score);
    expect(recos[0].creneaux.length).toBeGreaterThan(0);
    expect(recos[0].creneaux.every((c) => !c.lieu.includes('{'))).toBe(true);
  });

  it('oriente vers Zumba pour danse + soirée', () => {
    const recos = recommanderCours({
      pratique: 'un-peu',
      age: 'adulte',
      objectif: 'danse',
      intensite: 'dynamique',
      dispo: 'soir',
      contrainte: 'aucun',
    });
    expect(recos[0].nom).toBe('Zumba');
  });

  it('ne invente pas un cours hors config', () => {
    const noms = new Set(COURS.map((c) => c.nom));
    for (const r of recommanderCours({ objectif: 'cardio' })) {
      expect(noms.has(r.nom)).toBe(true);
    }
  });
});
