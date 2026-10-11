import { describe, expect, it } from 'vitest';
import { isCarteImageNumero } from '../netlify/functions/_cartes-store.mjs';

describe('format du numéro de carte', () => {
  it('accepte ASE-2627-001 et refuse le reste', () => {
    expect(isCarteImageNumero('ASE-2627-001')).toBe(true);
    expect(isCarteImageNumero('ASE-2627-067')).toBe(true);
    expect(isCarteImageNumero('../secret')).toBe(false);
    expect(isCarteImageNumero('ASE-2627-1')).toBe(false);
    expect(isCarteImageNumero('')).toBe(false);
  });
});
