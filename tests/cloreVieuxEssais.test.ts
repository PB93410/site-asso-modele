import { describe, expect, it } from 'vitest';
import {
  aJourKeysFromAdherents,
  previewLine,
  selectVieuxEssais,
} from '../scripts/clore-vieux-essais.mjs';

const TODAY = '2026-10-07';
const TEL = '0612345678';

describe('clôture des vieux essais', () => {
  it('garde le récent, prend le daté et la demande ancienne, ignore Relancé, marque l’adhérent à jour', () => {
    const keys = aJourKeysFromAdherents([
      { prenom: 'Marie', nom: 'Dupont', tel: TEL, statut: 'À jour' },
    ]);
    const selected = selectVieuxEssais(
      [
        {
          prenom: 'Luc',
          nom: 'Petit',
          tel: '0600000001',
          statut: 'À venir',
          creneau: '06/10/2026 · Lundi 13h30 · Gym Douce',
          row: 2,
        },
        {
          prenom: 'Paul',
          nom: 'Martin',
          tel: '0600000002',
          statut: 'Confirmé',
          creneau: '27/09/2026 · Lundi 13h30 · Gym Douce',
          row: 3,
        },
        {
          prenom: 'Léa',
          nom: 'Bernard',
          tel: '0600000003',
          statut: 'À venir',
          creneau: 'Lundi 13h30 · Gym Douce',
          dateDemande: '17/09/2026',
          row: 4,
        },
        {
          prenom: 'Noé',
          nom: 'Roy',
          tel: '0600000004',
          statut: 'Relancé',
          creneau: '01/09/2026 · Lundi 13h30 · Gym Douce',
          row: 5,
        },
        {
          prenom: 'Marie',
          nom: 'Dupont',
          tel: TEL,
          statut: 'À venir',
          creneau: '01/09/2026 · Lundi 13h30 · Gym Douce',
          notes: 'venue le matin',
          row: 6,
        },
        {
          prenom: 'test',
          nom: 'Martin',
          tel: '0600000009',
          statut: 'À venir',
          creneau: '01/09/2026 · Lundi 13h30 · Gym Douce',
          row: 7,
        },
      ],
      keys,
      TODAY,
    );

    expect(selected.map((row) => row.prenom)).toEqual(['Paul', 'Léa', 'Marie']);
    expect(selected.find((row) => row.prenom === 'Paul')?.statutPrevu).toBe('Annulé');
    expect(selected.find((row) => row.prenom === 'Léa')?.statutPrevu).toBe('Annulé');
    expect(selected.find((row) => row.prenom === 'Marie')?.statutPrevu).toBe('Adhérent');
    expect(selected.find((row) => row.prenom === 'Marie')?.notesNext).toBe(
      'venue le matin | Clos 07/10/2026 : essai non pointé',
    );
    const line = previewLine(selected[0]);
    expect(line).toBe('Paul M. · 27/09/2026 · Lundi 13h30 · Gym Douce · 27/09/2026 · Annulé');
    expect(line).not.toContain('0600000002');
  });

  it('traite un statut vide comme À venir', () => {
    const selected = selectVieuxEssais(
      [
        {
          prenom: 'Anne',
          nom: 'Durand',
          tel: '0600000011',
          statut: '',
          creneau: '01/09/2026 · Lundi 13h30 · Gym Douce',
          row: 2,
        },
      ],
      new Set(),
      TODAY,
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].statutPrevu).toBe('Annulé');
  });
});
