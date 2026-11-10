import { describe, expect, it } from 'vitest';
import { normalizeFrPhone } from '../src/lib/waPhone';

describe('normalizeFrPhone', () => {
  it('passe un 06… en 33…', () => {
    expect(normalizeFrPhone('06 00 00 00 00')).toBe('33600000000');
  });
  it('laisse un 33… intact', () => {
    expect(normalizeFrPhone('+33600000000')).toBe('33600000000');
  });
  it('refuse un numéro trop court', () => {
    expect(normalizeFrPhone('123')).toBeNull();
  });
});
