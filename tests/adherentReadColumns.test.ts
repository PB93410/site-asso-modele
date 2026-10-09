import { describe, expect, it } from 'vitest';
import { adherentReadColumns } from '../netlify/functions/_bureau-lib.mjs';

const A_TO_R = [
  'NOM',
  'PRENOM',
  'TEL',
  'MAIL',
  'DATE_NAISSANCE',
  'ADRESSE',
  'CP',
  'VILLE',
  'MODE',
  'STATUT',
  'MONTANT',
  'DETAIL',
  'DATE_PAIEMENT',
  'DROIT_IMAGE',
  'QS_SPORT',
  'SOURCE',
  'NOTES',
  'DATE_DEMANDE',
];

describe('colonnes après DATE_DEMANDE', () => {
  it('garde NUMERO en S et CARTE en T', () => {
    const { headers, colIndices } = adherentReadColumns([...A_TO_R, 'NUMERO', 'CARTE']);
    expect(headers.at(-2)).toBe('NUMERO');
    expect(headers.at(-1)).toBe('CARTE');
    expect(colIndices[headers.indexOf('NUMERO')]).toBe(18);
    expect(colIndices[headers.indexOf('CARTE')]).toBe(19);
    expect(colIndices[headers.indexOf('STATUT')]).toBe(9);
  });

  it('ignore une colonne inconnue entre S et T, sans décaler CARTE', () => {
    const { headers, colIndices } = adherentReadColumns([...A_TO_R, 'NUMERO', 'BROUILLON', 'CARTE']);
    expect(headers).not.toContain('BROUILLON');
    expect(colIndices[headers.indexOf('CARTE')]).toBe(20);
  });

  it('ne coupe pas la feuille Essais (DATE_DEMANDE en A)', () => {
    const essais = ['DATE_DEMANDE', 'NOM', 'PRENOM', 'TEL', 'CRENEAU', 'STATUT'];
    const { headers, colIndices } = adherentReadColumns(essais);
    expect(headers).toEqual(essais);
    expect(colIndices).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
