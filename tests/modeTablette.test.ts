import { describe, expect, it } from 'vitest';
import { SECONDES_AVANT_RAZ, SECONDES_INACTIVITE, aDesDonnees } from '../src/lib/modeTablette';

describe('mode tablette du forum', () => {
  it('l’écran se vide vite après un envoi, et plus lentement s’il est délaissé en cours de saisie', () => {
    expect(SECONDES_AVANT_RAZ).toBeGreaterThanOrEqual(5);
    expect(SECONDES_AVANT_RAZ).toBeLessThanOrEqual(15);
    expect(SECONDES_INACTIVITE).toBeGreaterThan(SECONDES_AVANT_RAZ);
  });

  it('il y a quelque chose à effacer dès qu’un champ est rempli, même d’un seul caractère', () => {
    const vide = { prenom: '', nom: '', telephone: '', cours: '' };
    expect(aDesDonnees(vide)).toBe(false);
    expect(aDesDonnees({ ...vide, prenom: '  ' })).toBe(false);
    expect(aDesDonnees({ ...vide, prenom: 'L' })).toBe(true);
    expect(aDesDonnees({ ...vide, telephone: '06' })).toBe(true);
    expect(aDesDonnees({ ...vide, cours: 'Zumba' })).toBe(true);
    expect(aDesDonnees({ ...vide, email: 'a@b.fr' })).toBe(true);
    expect(aDesDonnees({ ...vide, email: '  ' })).toBe(false);
  });
});
