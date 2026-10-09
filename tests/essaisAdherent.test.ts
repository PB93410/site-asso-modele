import { describe, expect, it } from 'vitest';
import { adherentEssaiKey, isAdherentAJourForEssai } from '../src/lib/bureauSearch';

describe('adhérent à jour masqué des vues de suivi', () => {
  const keys = new Set([adherentEssaiKey('0612345678', 'Marie')]);

  it('même téléphone et même prénom : masqué', () => {
    expect(isAdherentAJourForEssai({ tel: '0612345678', prenom: 'Marie' }, keys)).toBe(true);
    expect(isAdherentAJourForEssai({ tel: '+33612345678', prenom: 'marie' }, keys)).toBe(true);
  });

  it('même téléphone et prénom différent : visible', () => {
    expect(isAdherentAJourForEssai({ tel: '0612345678', prenom: 'Luc' }, keys)).toBe(false);
  });
});
