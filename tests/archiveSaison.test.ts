import { describe, expect, it } from 'vitest';
import {
  aJourKeysFromAdherents,
  addMonthsYmd,
  essaiArchiveYmd,
  rowsFromValues,
  rowsToDelete,
  sampleName,
  selectEssaiRows,
  selectPendingOlderThan,
} from '../scripts/archive-saison.mjs';

const TEL = '0612345678';

describe('archivage de saison', () => {
  it('retire un essai ancien, et garde la personne déjà à jour', () => {
    const adherents = [
      { prenom: 'Marie', nom: 'Dupont', tel: TEL, statut: 'À jour' },
      { prenom: 'Paul', nom: 'Dupont', tel: TEL, statut: 'En attente' },
    ];
    const essais = [
      { prenom: 'Marie', nom: 'Dupont', tel: TEL, creneau: '01/08/2026 · Lundi 13h30 · Gym Douce', row: 2 },
      { prenom: 'Paul', nom: 'Dupont', tel: TEL, dateDemande: '2026-08-15', row: 3 },
      { prenom: 'Léa', nom: 'Martin', tel: '0699999999', creneau: '12/10/2026 · Lundi 13h30 · Gym Douce', row: 4 },
      { prenom: 'Noé', nom: 'Bernard', tel: '0611111111', row: 5 },
    ];
    const selected = selectEssaiRows(essais, aJourKeysFromAdherents(adherents), '2026-09-01');
    expect(selected.map((row) => row.prenom)).toEqual(['Paul']);
    expect(essaiArchiveYmd('01/09/2026 · Lundi 13h30 · Gym Douce', '')).toBe('2026-09-01');
  });

  it('ne prend les demandes en attente que si elles ont plus de 12 mois', () => {
    expect(addMonthsYmd('2026-10-07', -12)).toBe('2025-10-07');
    const rows = [
      { prenom: 'Anne', nom: 'Durand', statut: 'En attente', dateDemande: '01/10/2025' },
      { prenom: 'Luc', nom: 'Petit', statut: 'En attente', dateDemande: '2025-10-07' },
      { prenom: 'Inès', nom: 'Roy', statut: 'À jour', dateDemande: '2024-01-01' },
      { prenom: 'Marc', nom: 'Colin', statut: 'En attente', dateDemande: '' },
    ];
    expect(selectPendingOlderThan(rows, '2025-10-07').map((row) => row.prenom)).toEqual(['Anne']);
    expect(sampleName('Anne', 'Durand')).toBe('Anne D.');
    expect(sampleName('Anne', 'Durand')).not.toMatch(/\d/);
  });

  it('numérote à partir de l’en-tête, même s’il est en ligne 2', () => {
    const parsed = rowsFromValues([
      ['Mon Association'],
      ['DATE_DEMANDE', 'NOM', 'PRENOM', 'TEL', 'CRENEAU'],
      ['15/08/2026', 'Dupont', 'Paul', '0612345678', ''],
      ['', '', '', '', ''],
      ['12/10/2026', 'Martin', 'Léa', '0699999999', ''],
    ]);
    expect(parsed.headerRow).toBe(2);
    expect(parsed.rows.map((row) => row.row)).toEqual([3, 5]);
    expect(parsed.rows[0].prenom).toBe('Paul');
  });

  it('ne supprime rien si une ligne a changé entre la lecture et la vérification', () => {
    const parsed = rowsFromValues([
      ['Titre'],
      ['PRENOM', 'NOM', 'TEL', 'DATE_DEMANDE'],
      ['Paul', 'Dupont', '0612345678', '15/08/2026'],
      ['Léa', 'Martin', '0699999999', '01/06/2026'],
    ]);
    const changed = rowsFromValues([
      ['Titre'],
      ['PRENOM', 'NOM', 'TEL', 'DATE_DEMANDE'],
      ['Paul', 'Dupont', '0600000000', '15/08/2026'],
      ['Léa', 'Martin', '0699999999', '01/06/2026'],
    ]);
    expect(rowsToDelete(parsed.rows, changed.rows, parsed.headerRow)).toEqual([]);
    expect(rowsToDelete(parsed.rows, parsed.rows, parsed.headerRow)).toEqual([3, 4]);
  });
});
