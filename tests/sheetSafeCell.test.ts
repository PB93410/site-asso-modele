import { describe, expect, it } from 'vitest';
import { sheetSafeCell } from '../netlify/functions/_bureau-lib.mjs';

describe('sheetSafeCell', () => {
  it('préfixe une formule et laisse le texte ordinaire', () => {
    expect(sheetSafeCell('=1+1')).toBe("'=1+1");
    expect(sheetSafeCell('+33612345678')).toBe("'+33612345678");
    expect(sheetSafeCell('-x')).toBe("'-x");
    expect(sheetSafeCell('@a')).toBe("'@a");
    expect(sheetSafeCell('Dupont')).toBe('Dupont');
    expect(sheetSafeCell('')).toBe('');
    expect(sheetSafeCell('07/10/2026')).toBe('07/10/2026');
  });
});
