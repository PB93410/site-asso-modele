import { describe, expect, it } from 'vitest';
import {
  compteDeService,
  contraste,
  ecartsColonnes,
  valeursExemple,
  verifierConfig,
  verifierEnv,
} from '../scripts/_verifier.mjs';
import ASSO from '../asso.config.js';

const TOUS = { essais: true, adhesion: true, bureau: true, mail: true };
const AUCUN = { essais: false, adhesion: false, bureau: false, mail: false };
const erreurs = (r: { niveau: string; texte: string }[]) => r.filter((x) => x.niveau === 'erreur').map((x) => x.texte);

describe('npm run verifier — configuration', () => {
  it('contraste WCAG avec le blanc', () => {
    expect(contraste('#000000')).toBeCloseTo(21, 0);
    expect(contraste('#ffffff')).toBeCloseTo(1, 5);
    expect(contraste('#C45309')!).toBeGreaterThan(4.5);
    expect(contraste('#F59E0B')!).toBeLessThan(4.5);
    expect(contraste('orange')).toBeNull();
  });

  it('repère les valeurs d’exemple, même dans les listes', () => {
    expect(valeursExemple({ nom: 'Association Sportive Exemple', ville: 'Lyon', lieux: [{ rue: '1 rue de Villexemple' }] })).toEqual([
      'nom',
      'lieux[0].rue',
    ]);
  });

  it('la config livrée passe, avec des avertissements d’exemple', () => {
    const r = verifierConfig(ASSO, TOUS, () => true, '2627');
    expect(erreurs(r)).toEqual([]);
    expect(r.some((x) => /exemple/i.test(x.texte))).toBe(true);
  });

  it('couleur trop claire, sigle invalide, fichiers manquants', () => {
    const asso = { ...ASSO, sigle: 'as e', couleurs: { ...ASSO.couleurs, primaire: '#FDBA74' } };
    const r = erreurs(verifierConfig(asso, TOUS, (p: string) => !p.includes('carte-verso'), '2627'));
    expect(r.some((t) => t.startsWith('Sigle'))).toBe(true);
    expect(r.some((t) => t.startsWith('couleurs.primaire'))).toBe(true);
    expect(r.some((t) => t.includes('carte-verso-2627.png'))).toBe(true);
  });

  it('pas de verso de carte demandé sans bureau', () => {
    const r = erreurs(verifierConfig(ASSO, AUCUN, (p: string) => !p.includes('carte-verso'), '2627'));
    expect(r).toEqual([]);
  });
});

describe('npm run verifier — variables', () => {
  const sa = JSON.stringify({ client_email: 'site@projet.iam.gserviceaccount.com', private_key: 'x' });

  it('site vitrine seul : rien à régler', () => {
    expect(erreurs(verifierEnv({}, AUCUN))).toEqual([]);
  });

  it('demande seulement ce que les fonctions activées utilisent', () => {
    const r = erreurs(verifierEnv({ GOOGLE_SERVICE_ACCOUNT_JSON: sa }, { ...AUCUN, essais: true }));
    expect(r).toEqual(['GOOGLE_SHEET_ESSAIS_ID manquante.']);
  });

  it('propose de désactiver une fonction pas prête', () => {
    const r = verifierEnv({}, { ...AUCUN, mail: true, bureau: true });
    expect(r.some((x) => x.aFaire?.includes('mail: false'))).toBe(true);
  });

  it('refuse un mot de passe de démo, un secret court, DEMO en production', () => {
    const r = erreurs(
      verifierEnv(
        { GOOGLE_SERVICE_ACCOUNT_JSON: sa, GOOGLE_SHEET_ID: 'a', GOOGLE_SHEET_ESSAIS_ID: 'b', BUREAU_PASSWORD: 'demo', BUREAU_SECRET: 'court', DEMO: '1' },
        { ...TOUS, mail: false },
      ),
    );
    expect(r).toEqual([
      'BUREAU_SECRET trop courte (32 caractères minimum).',
      'BUREAU_PASSWORD trop facile à deviner.',
      'DEMO est activé : le site tourne sur des données fictives.',
    ]);
  });

  it('lit l’adresse du compte de service sans exposer la clé', () => {
    expect(compteDeService(sa)).toBe('site@projet.iam.gserviceaccount.com');
    expect(compteDeService('{pas du json')).toBeNull();
  });

  it('compare les en-têtes de colonnes', () => {
    expect(ecartsColonnes(['NOM', 'PRENOM', 'TEL'], ['Nom', 'Prénom', 'TEL'])).toEqual([
      'colonne 2 : « Prénom » au lieu de « PRENOM »',
    ]);
    expect(ecartsColonnes(['DATE_DEMANDE'], ['date demande'])).toEqual([]);
  });
});
