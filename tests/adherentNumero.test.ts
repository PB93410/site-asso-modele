import { describe, expect, it } from 'vitest';
import { nextAdherentNumero } from '../netlify/functions/_bureau-lib.mjs';

describe('prochain numéro d’adhérent', () => {
  const prefix = 'ASE-2627-';

  it('liste vide → 001', () => {
    expect(nextAdherentNumero([], prefix)).toBe('ASE-2627-001');
  });

  it('les trous sont ignorés : max + 1', () => {
    expect(nextAdherentNumero(['ASE-2627-001', 'ASE-2627-003'], prefix)).toBe('ASE-2627-004');
  });

  it('les valeurs hors format sont ignorées', () => {
    expect(nextAdherentNumero(['bonjour', 'ASE-2627-1', 'ASE-2627-002'], prefix)).toBe(
      'ASE-2627-003',
    );
  });
});
