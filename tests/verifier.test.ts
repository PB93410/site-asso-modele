import { describe, expect, it } from 'vitest';
import {
  compteDeService,
  contraste,
  ecartsColonnes,
  valeursExemple,
  verifierConfig,
  verifierEnv,
  verifierEnvoi,
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

  it('vacances mal saisies, ou oubliées', () => {
    const pauses = [{ libelle: 'vacances de Noël', du: '2027-01-04', reprise: '2026-12-20' }];
    expect(erreurs(verifierConfig({ ...ASSO, saison: { ...ASSO.saison, pauses } }, TOUS, () => true, '2627'))).toEqual([
      expect.stringContaining('saison.pauses : vacances de Noël'),
    ]);
    const r = verifierConfig({ ...ASSO, saison: { ...ASSO.saison, pauses: [] } }, TOUS, () => true, '2627');
    expect(r.some((x) => x.texte.includes('aucune vacance'))).toBe(true);
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

describe('npm run verifier — envoi des mails', () => {
  const textes = (r: { texte: string }[]) => r.map((x) => x.texte);

  it('site vitrine seul : pas de mail à envoyer', () => {
    expect(verifierEnvoi({}, AUCUN)).toEqual([]);
  });

  it('sans fournisseur : prévient, sans bloquer la mise en ligne', () => {
    const r = verifierEnvoi({}, { ...AUCUN, essais: true });
    expect(r.map((x) => x.niveau)).toEqual(['attention']);
    expect(r[0].aFaire).toMatch(/SMTP/);
  });

  it('SMTP : demande le mot de passe, puis dit d’où partent les mails', () => {
    expect(erreurs(verifierEnvoi({ SMTP_HOST: 'ssl0.ovh.net' }, { ...AUCUN, essais: true }))).toEqual(['SMTP_PASS manquante.']);
    expect(textes(verifierEnvoi({ SMTP_HOST: 'ssl0.ovh.net', SMTP_PASS: 'x', MAIL_ASSO: 'bureau@club.fr' }, { ...AUCUN, essais: true }))).toEqual([
      'Envoi des mails : SMTP ssl0.ovh.net:465, depuis bureau@club.fr.',
    ]);
  });

  it('Gmail forcé sans connexion Google : erreur claire', () => {
    expect(erreurs(verifierEnvoi({ MAIL_ENVOI: 'gmail' }, { ...AUCUN, bureau: true }))[0]).toMatch(/GOOGLE_REFRESH_TOKEN/);
  });
});

describe('npm run verifier — boîte mail du bureau', () => {
  const MAIL = { essais: false, adhesion: false, bureau: true, mail: true };
  const BASE = { BUREAU_PASSWORD: 'une phrase assez longue', BUREAU_SECRET: 'x'.repeat(40) };

  it('IMAP avec le mot de passe du SMTP : rien de Google demandé', () => {
    const r = verifierEnv({ ...BASE, IMAP_HOST: 'ssl0.ovh.net', SMTP_HOST: 'ssl0.ovh.net', SMTP_USER: 'bureau@club.fr', SMTP_PASS: 'p' }, MAIL);
    expect(erreurs(r)).toEqual([]);
    expect(r.some((x) => /IMAP ssl0.ovh.net:993, compte bureau@club.fr/.test(x.texte))).toBe(true);
  });

  it('ni IMAP ni Gmail : erreur claire, et proposition de couper le module', () => {
    const r = verifierEnv(BASE, MAIL);
    expect(erreurs(r)).toContain('Boîte mail du bureau non branchée.');
    expect(r.some((x) => x.aFaire?.includes('mail: false'))).toBe(true);
  });

  it('Gmail connecté : demande toujours les variables Google', () => {
    const r = verifierEnv({ ...BASE, GOOGLE_REFRESH_TOKEN: 't' }, MAIL);
    expect(erreurs(r)).toEqual(expect.arrayContaining(['GOOGLE_CLIENT_ID manquante.', 'GOOGLE_CLIENT_SECRET manquante.']));
  });
});
