import { describe, expect, it } from 'vitest';
import { matchSheetPerson, type MailSheetPerson } from '../src/lib/mailMatch';

function person(partial: Partial<MailSheetPerson> & Pick<MailSheetPerson, 'row' | 'prenom' | 'nom'>): MailSheetPerson {
  return { tel: '', mail: '', ...partial };
}

describe('rapprochement mail → fiche', () => {
  it('Marie ne correspond pas à Marie-Laure Dupont', () => {
    const people = [person({ row: 2, prenom: 'Marie-Laure', nom: 'Dupont' })];
    expect(matchSheetPerson('Marie', [], '', people)).toEqual({ person: null, how: null });
  });

  it('l’e-mail exact gagne sur un nom', () => {
    const byMail = person({ row: 3, prenom: 'Marie', nom: 'Martin', mail: 'Marie@Exemple.fr' });
    const byName = person({ row: 4, prenom: 'Marie', nom: 'Dupont', mail: 'autre@exemple.fr' });
    const found = matchSheetPerson('Marie Dupont', ['marie@exemple.fr'], '', [byName, byMail]);
    expect(found.how).toBe('email');
    expect(found.person?.row).toBe(3);
  });

  it('deux fiches au même prénom et nom : ambigu', () => {
    const people = [
      person({ row: 5, prenom: 'Marie', nom: 'Dupont' }),
      person({ row: 6, prenom: 'Marie', nom: 'Dupont' }),
    ];
    expect(matchSheetPerson('Marie Dupont', [], '', people)).toEqual({ person: null, how: null });
  });

  it('le téléphone +33 égale le 06 affiché', () => {
    const people = [person({ row: 7, prenom: 'Sam', nom: 'Leroy', tel: '06 12 34 56 78' })];
    const found = matchSheetPerson('', [], '+33612345678', people);
    expect(found.how).toBe('tel');
    expect(found.person?.row).toBe(7);
  });

  it('même téléphone, prénom différent → nom-different', () => {
    const people = [person({ row: 8, prenom: 'Marie', nom: 'Dupont', tel: '0612345678' })];
    const found = matchSheetPerson('Luc Dupont', [], '0612345678', people);
    expect(found.how).toBe('nom-different');
    expect(found.person?.row).toBe(8);
  });

  it('même e-mail, même prénom → email', () => {
    const people = [person({ row: 9, prenom: 'Marie', nom: 'Dupont', mail: 'marie@exemple.fr' })];
    const found = matchSheetPerson('Marie Dupont', ['marie@exemple.fr'], '', people);
    expect(found.how).toBe('email');
    expect(found.person?.row).toBe(9);
  });
});
