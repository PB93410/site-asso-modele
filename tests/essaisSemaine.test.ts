import { describe, expect, it } from 'vitest';
import { countEssaisATraiter, essaisAPointer, formatEssaiDu } from '../src/lib/essaisSemaine';

const TODAY = '2026-10-07';

describe('À pointer', () => {
  const pool = [
    { creneau: '05/10/2026 · Lundi 13h30 · Gym Douce', statut: 'À venir', row: 2 },
    { creneau: '01/10/2026 · Jeudi 19h30 · Zumba', statut: 'Relancé', row: 1 },
    { creneau: '05/10/2026 · Lundi 13h30 · Gym Douce', statut: 'Venu', row: 3 },
    { creneau: 'Lundi 13h30 · Gym Douce', statut: 'À venir', row: 4 },
    { creneau: '06/10/2026 · Mardi 20h00 · Renforcement Musculaire', statut: 'Confirmé', row: 5 },
    { creneau: '12/10/2026 · Lundi 13h30 · Gym Douce', statut: 'À venir', row: 6 },
  ];

  it('garde le passé À venir, Confirmé ou Relancé, du plus ancien au plus récent', () => {
    expect(essaisAPointer(pool, TODAY).map((item) => item.row)).toEqual([1, 2, 5]);
  });

  it('exclut Venu, le non daté et le futur', () => {
    const rows = essaisAPointer(pool, TODAY).map((item) => item.row);
    expect(rows).not.toContain(3);
    expect(rows).not.toContain(4);
    expect(rows).not.toContain(6);
  });

  it('formate la date de l’essai', () => {
    expect(formatEssaiDu('2026-10-12')).toMatch(/^essai du lundi 12 oct/);
  });

  it('le badge ignore un essai daté passé depuis plus de 30 jours', () => {
    const items = [
      { creneau: '08/10/2026 · Jeudi 15h30 · Stretching', statut: 'À venir' },
      { creneau: '04/10/2026 · Dimanche 10h00 · Pilates', statut: 'À venir' },
      { creneau: '06/09/2026 · Dimanche 10h00 · Pilates', statut: 'À venir' },
      { creneau: 'Lundi 13h30 · Gym Douce', statut: 'À venir' },
      { creneau: '05/10/2026 · Lundi 13h30 · Gym Douce', statut: 'Venu' },
    ];
    expect(countEssaisATraiter(items, TODAY)).toBe(3);
  });
});
