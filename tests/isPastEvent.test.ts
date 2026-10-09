import { describe, expect, it } from 'vitest';
import { isPastEvent } from '../src/hooks/useSheetData';

describe('isPastEvent', () => {
  const ev = (date: string, month: string, year = '2026') => ({ date, month, year });

  it('garde l’événement le jour même, le masque le lendemain', () => {
    expect(isPastEvent(ev('18', 'OCT'), new Date(2026, 9, 18, 21))).toBe(false);
    expect(isPastEvent(ev('18', 'OCT'), new Date(2026, 9, 19, 0, 1))).toBe(true);
  });

  it('plage « 4-5 DÉC » : compte le dernier jour', () => {
    expect(isPastEvent(ev('4-5', 'DÉC'), new Date(2026, 11, 5, 18))).toBe(false);
    expect(isPastEvent(ev('4-5', 'DÉC'), new Date(2026, 11, 6, 8))).toBe(true);
  });

  it('date illisible : on garde', () => {
    expect(isPastEvent(ev('', 'DÉC'), new Date(2030, 0, 1))).toBe(false);
    expect(isPastEvent(ev('12', '???'), new Date(2030, 0, 1))).toBe(false);
  });
});
