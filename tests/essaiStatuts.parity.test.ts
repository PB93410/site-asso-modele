import { describe, expect, it } from 'vitest';
import { isEssaiAVenir, isEssaiCountableStatut } from '../netlify/functions/_bureau-lib.mjs';
import { isAVenir, isCountableEssai } from '../src/lib/essaiStatuts';

const STATUTS = [
  'À venir',
  'Confirmé',
  'Venu',
  'Absent',
  'Annulé',
  'Adhérent',
  'Relancé',
  'À faire',
  'Pas intéressé',
  '',
];

describe('statuts essai front et serveur', () => {
  it('isAVenir suit isEssaiAVenir', () => {
    for (const statut of STATUTS) {
      expect(isAVenir(statut), statut || '(vide)').toBe(isEssaiAVenir(statut));
    }
  });

  it('isCountableEssai suit isEssaiCountableStatut', () => {
    for (const statut of STATUTS) {
      expect(isCountableEssai(statut), statut || '(vide)').toBe(isEssaiCountableStatut(statut));
    }
  });
});
