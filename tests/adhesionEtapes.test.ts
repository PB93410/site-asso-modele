import { describe, expect, it } from 'vitest';
import { birthDateError, erreurEtape, NB_ETAPES, premiereEtapeIncomplete, progressionEtape } from '../src/lib/adhesionEtapes';

const TODAY = new Date(2026, 9, 13);
const OK = {
  prenom: 'Marie',
  nom: 'Dupont',
  date_naissance: '14/03/1958',
  telephone: '06 12 34 56 78',
  email: '',
  code_postal: '',
  droit_image: 'Oui',
  qs_sport: 'Non',
  mode_paiement: 'Espèces',
};

describe('étapes de l’adhésion', () => {
  it('cinq étapes et progression', () => {
    expect(NB_ETAPES).toBe(5);
    expect(progressionEtape(1)).toBe(0);
    expect(progressionEtape(3)).toBe(50);
    expect(progressionEtape(5)).toBe(100);
    expect(progressionEtape(9)).toBe(100);
  });

  it('identité : prénom, nom, date de naissance', () => {
    expect(erreurEtape(1, { ...OK, prenom: '' }, { today: TODAY })?.champ).toBe('prenom');
    expect(erreurEtape(1, { ...OK, nom: 'D2' }, { today: TODAY })?.champ).toBe('nom');
    expect(erreurEtape(1, { ...OK, date_naissance: '31/02/1960' }, { today: TODAY })?.champ).toBe('date_naissance');
    expect(erreurEtape(1, OK, { today: TODAY })).toBeNull();
  });

  it('contact : téléphone obligatoire, e-mail et code postal contrôlés si remplis', () => {
    expect(erreurEtape(2, { ...OK, telephone: '0612' })?.champ).toBe('telephone');
    expect(erreurEtape(2, { ...OK, email: 'marie@' })?.champ).toBe('email');
    expect(erreurEtape(2, { ...OK, code_postal: '750' })?.champ).toBe('code_postal');
    expect(erreurEtape(2, OK)).toBeNull();
  });

  it('cours : deux réponses obligatoires', () => {
    expect(erreurEtape(3, { ...OK, droit_image: '' })?.champ).toBe('droit_image');
    expect(erreurEtape(3, { ...OK, qs_sport: '' })?.champ).toBe('qs_sport');
    expect(erreurEtape(3, OK)).toBeNull();
  });

  it('paiement : un moyen choisi', () => {
    expect(erreurEtape(4, { ...OK, mode_paiement: '' }, { tarifLabel: '140 €' })?.message).toContain('140 €');
    expect(erreurEtape(4, OK)).toBeNull();
    expect(erreurEtape(4, { ...OK, mode_paiement: 'Chèque' })?.champ).toBe('numero_cheque');
    expect(erreurEtape(4, { ...OK, mode_paiement: 'Chèque', numero_cheque: '1234567' })).toBeNull();
    expect(erreurEtape(5, OK)).toBeNull();
  });

  it('avant l’envoi : renvoie la première étape incomplète', () => {
    expect(premiereEtapeIncomplete(OK, { today: TODAY })).toBeNull();
    expect(premiereEtapeIncomplete({ ...OK, telephone: '', mode_paiement: '' }, { today: TODAY })?.etape).toBe(2);
    expect(premiereEtapeIncomplete({ ...OK, mode_paiement: '' }, { today: TODAY })?.etape).toBe(4);
  });

  it('âge minimum', () => {
    expect(birthDateError('01/01/2015', TODAY)).toContain('16 ans');
    expect(birthDateError('01/01/2030', TODAY)).toContain('futur');
  });
});
