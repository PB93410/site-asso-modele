import { describe, expect, it } from 'vitest';
import {
  emailError,
  essaiFormError,
  nameError,
  phoneError,
  postalCodeError,
} from '../src/lib/formValidation';

describe('essai / inscription — validation',
  () => {
    it('accepte un dossier essai correct',
      () => {
        expect(essaiFormError('Marie', 'Dupont', '06 12 34 56 78')).toBeNull();
        expect(essaiFormError('Jean', 'Martin', '+33 6 12 34 56 78')).toBeNull();
      });

    it('refuse un prénom avec un chiffre',
      () => {
        expect(nameError('Prénom', 'Marie2')).toMatch(/chiffre/);
      });

    it('refuse un téléphone incomplet',
      () => {
        expect(phoneError('06 12')).toMatch(/10 chiffres/);
      });

    it('refuse 00 comme début national',
      () => {
        expect(phoneError('00 12 34 56 78')).not.toBeNull();
      });

    it('e-mail facultatif vide, refuse incomplet',
      () => {
        expect(emailError('')).toBeNull();
        expect(emailError('marie@')).toMatch(/E-mail/);
        expect(emailError('marie@exemple.fr')).toBeNull();
      });

    it('code postal 75001',
      () => {
        expect(postalCodeError('')).toBeNull();
        expect(postalCodeError('75001')).toBeNull();
        expect(postalCodeError('9341')).toMatch(/5 chiffres/);
      });
  });
