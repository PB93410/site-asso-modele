import { describe, expect, it } from 'vitest';
import { aidesProposees, calculerReste, libelleAides, notesFinancement } from '../src/lib/financement.js';

describe('aides à la cotisation', () => {
  const plafonds = { passSport: 50, ancvMax: 40, comiteEntreprise: 30 };

  it('calcule le reste et plafonne les aides', () => {
    expect(calculerReste(180, { passSport: true, ancv: 40, ce: 20 }, plafonds)).toEqual({
      pass: 50,
      ancv: 40,
      ce: 20,
      aides: 110,
      reste: 70,
      tarif: 180,
    });
    expect(calculerReste(180, { passSport: true, ancv: 99, ce: 99 }, plafonds).reste).toBe(60);
    expect(calculerReste(80, { passSport: true, ancv: 40, ce: 30 }, plafonds).reste).toBe(0);
    expect(calculerReste(180, {}, plafonds).reste).toBe(180);
  });

  it('rédige les notes pour la fiche', () => {
    const calc = calculerReste(180, { passSport: true, ancv: 20 }, plafonds);
    expect(libelleAides(calc)).toBe("Pass'Sport 50 € + ANCV 20 €");
    expect(notesFinancement(calc)).toBe("Aides: Pass'Sport 50 € + ANCV 20 € | Reste: 110 €");
    expect(aidesProposees({ passSport: 0, ancvMax: 0, comiteEntreprise: 0 })).toEqual({
      passSport: 0,
      ancvMax: 0,
      comiteEntreprise: 0,
    });
  });
});
