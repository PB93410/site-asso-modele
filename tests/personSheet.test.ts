import { describe, expect, it } from 'vitest';
import { telDedupeKey } from '../src/lib/bureauSearch';
import { buildPersonSheet, personSheetKey } from '../src/lib/personSheet';

const TEL = '0612345678';

describe('fiche personne', () => {
  it('deux personnes du même foyer ont deux fiches', () => {
    const essais = [
      { prenom: 'Marie', nom: 'Dupont', tel: TEL, statut: 'Venu', row: 2, notes: 'Relance B 01/10/2026' },
      { prenom: 'Paul', nom: 'Dupont', tel: TEL, statut: 'À venir', row: 3 },
    ];
    const adherents = [
      { prenom: 'Marie', nom: 'Dupont', tel: TEL, mail: 'marie@example.com', statut: 'En attente' },
      { prenom: 'Paul', nom: 'Dupont', tel: TEL, statut: 'À jour', numero: 'ASE-2627-004' },
    ];
    const marie = buildPersonSheet(personSheetKey(TEL, 'Marie'), essais, adherents);
    const paul = buildPersonSheet(personSheetKey(TEL, 'Paul'), essais, adherents);
    expect(marie?.key).not.toBe(paul?.key);
    expect(marie?.essais.map((row) => row.prenom)).toEqual(['Marie']);
    expect(paul?.essais.map((row) => row.prenom)).toEqual(['Paul']);
    expect(marie?.adherent?.mail).toBe('marie@example.com');
    expect(paul?.adherent?.statut).toBe('À jour');
    expect(marie?.whatsapp).toBe('B');
    expect(paul?.whatsapp).toBe('confirmation');
    expect(marie?.relances.map((row) => row.msg)).toEqual(['B']);
  });

  it('un prénom vide n’utilise que le téléphone', () => {
    const key = personSheetKey(TEL, '  ');
    expect(key).toBe(telDedupeKey(TEL));
    expect(key.includes('|')).toBe(false);
    const sheet = buildPersonSheet(key, [
      { prenom: '', nom: 'Dupont', tel: TEL, statut: 'À venir', row: 2 },
      { prenom: 'Marie', nom: 'Dupont', tel: TEL, statut: 'Venu', row: 3 },
    ], []);
    expect(sheet?.essais).toHaveLength(1);
    expect(sheet?.essais[0].nom).toBe('Dupont');
    expect(sheet?.prenom).toBe('');
  });

  it('l’action vise l’essai non clos le plus récent', () => {
    const sheet = buildPersonSheet(personSheetKey(TEL, 'Marie'), [
      { prenom: 'Marie', tel: TEL, statut: 'À venir', row: 2, creneau: '05/10/2026 · Lundi 13h30 · Gym Douce' },
      { prenom: 'Marie', tel: TEL, statut: 'Annulé', row: 9, creneau: '12/10/2026 · Lundi 13h30 · Gym Douce' },
      { prenom: 'Marie', tel: TEL, statut: 'Venu', row: 4, creneau: '06/10/2026 · Lundi 13h30 · Gym Douce' },
    ], []);
    expect(sheet?.actionEssai?.row).toBe(4);
    expect(sheet?.essais).toHaveLength(3);
    expect(sheet?.whatsapp).toBe('B');
  });

  it('ignore les notes qui ne sont que Formulaire ou Forum', () => {
    const sheet = buildPersonSheet(personSheetKey(TEL, 'Marie'), [
      { prenom: 'Marie', tel: TEL, statut: 'À venir', row: 2, notes: '  Formulaire ' },
      { prenom: 'Marie', tel: TEL, statut: 'Venu', row: 3, notes: 'FORUM' },
      { prenom: 'Marie', tel: TEL, statut: 'Relancé', row: 4, notes: 'Formulaire | venue le matin' },
    ], []);
    expect(sheet?.notesEssais).toEqual(['Formulaire | venue le matin']);
  });
});
