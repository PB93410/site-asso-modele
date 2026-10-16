import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import ASSO from '../asso.config.js';
import {
  configDepuisDossier,
  contraste,
  couleurLisible,
  dossierVide,
  erreursDossier,
  imagesDossier,
  normaliserDossier,
  plageHoraire,
  planningCsv,
  saisonCourante,
  sigleDepuis,
  telAffiche,
  whatsappDepuis,
} from '../src/lib/dossier.js';
import { rendreConfig } from '../scripts/_config-gabarit.mjs';
import { installerDossier, lireDossier } from '../scripts/installer.mjs';

const EXEMPLE = path.resolve(__dirname, '../scripts/dossier-exemple.json');
const dossier = () => lireDossier(EXEMPLE);

describe('préremplissage', () => {
  it('sigle, téléphone, WhatsApp, horaires, saison', () => {
    expect(sigleDepuis('Gymnastique Volontaire de Vaujours')).toBe('GVV');
    expect(sigleDepuis('Association Sportive d’Étampes et des environs')).toBe('ASEE');
    expect(telAffiche('0612345678')).toBe('06 12 34 56 78');
    expect(telAffiche('+33 6 12 34 56 78')).toBe('06 12 34 56 78');
    expect(whatsappDepuis('06 12 34 56 78')).toBe('33612345678');
    expect(whatsappDepuis('01 23 45 67 89')).toBe('');
    expect(plageHoraire('9:00', '10:30')).toBe('09h00 – 10h30');
    expect(saisonCourante(new Date(2026, 9, 11))).toBe('2026-2027');
    expect(saisonCourante(new Date(2027, 2, 1))).toBe('2026-2027');
    expect(saisonCourante(new Date(2027, 5, 15))).toBe('2027-2028');
  });

  it('couleur assombrie juste assez pour un texte blanc lisible', () => {
    const vert = couleurLisible('#4CAF50');
    expect(contraste(vert)!).toBeGreaterThanOrEqual(4.5);
    expect(contraste(vert)!).toBeLessThan(5.2);
    expect(couleurLisible('#C45309')).toBe('#C45309');
    expect(couleurLisible('pas une couleur')).toBe('');
  });
});

describe('dossier', () => {
  it('un dossier vide dit ce qui manque, l’exemple est complet', () => {
    const champs = erreursDossier(dossierVide()).map((e) => e.champ);
    expect(champs).toContain('association.nom');
    expect(champs).toContain('lieux');
    expect(champs).toContain('cours');
    expect(erreursDossier(dossier())).toEqual([]);
  });

  it('repère un créneau qui cite un cours ou une salle inconnus', () => {
    const d = dossier();
    d.planning.push({ jour: 'Mardi', debut: '20:00', fin: '21:00', cours: 'Boxe', lieu: 'Piscine' });
    expect(erreursDossier(d).map((e) => e.message)).toEqual([
      'Créneau 5 : choisissez un cours de la liste.',
      'Créneau 5 : choisissez une salle de la liste.',
    ]);
  });

  it('configuration : couleur lisible, WhatsApp, salle dans une autre commune, logo', () => {
    const c = configDepuisDossier(dossier(), ASSO);
    expect(c.couleurs.primaire).toBe(couleurLisible('#4CAF50'));
    expect(c.whatsapp).toBe('33600000042');
    expect(c.telephone).toBe('06 00 00 00 42');
    expect(c.siteUrl).toBe('https://www.sport-sante-tilleuls.example');
    expect(c.lieux[0]).toMatchObject({ id: 'salle-polyvalente', lat: 46.5, lon: 2.5 });
    expect(c.lieux[0].ville).toBeUndefined();
    expect(c.lieux[1]).toMatchObject({ id: 'dojo-de-saint-fictif', codePostal: '99010', ville: 'Saint-Fictif' });
    expect(c.logo).toBe('/assets/logo-asso.svg');
    expect(c.federation.logo).toBe('/assets/logo-federation.svg');
    expect(c.typeAsso).toBe('gym-volontaire');
    expect(c.modules).toEqual({
      essais: true,
      adhesion: false,
      bureau: true,
      mail: false,
      presences: false,
      quiz: false,
      alertes: false,
      listeAttente: false,
      wallet: false,
      financement: false,
      rapport: false,
      attestations: false,
      espace: false,
      parrainage: false,
      sondageEssai: false,
      clubEnChiffres: false,
      checklists: false,
      tablette: false,
      carteHorsLigne: false,
      demandeAvis: false,
      essaiMail: false,
      inscriptionsEvenements: false,
    });
  });

  it('planning trié par jour puis heure', () => {
    expect(planningCsv(dossier()).split('\n').slice(0, 3)).toEqual([
      'day,time,course,location,note',
      'Lundi,14h00 – 15h00,Gym douce,Salle polyvalente,',
      'Mardi,10h00 – 11h00,Gym douce,Salle polyvalente,',
    ]);
  });

  it('les images gardent un nom distinct des images générées', () => {
    expect(imagesDossier(dossier()).map((i) => i.chemin)).toEqual(['assets/logo-asso.svg']);
  });
});

describe('asso.config.js écrit par l’outil', () => {
  it('la config actuelle est réécrite à l’identique (commentaires compris)', () => {
    expect(rendreConfig(ASSO)).toBe(fs.readFileSync(path.resolve(__dirname, '../asso.config.js'), 'utf8'));
  });

  it('npm run installer écrit un projet valide, relu à l’identique', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-'));
    const { config, ecrits } = installerDossier({ dossier: dossier(), root, base: ASSO });
    expect(ecrits).toEqual([
      'public/assets/logo-asso.svg',
      'asso.config.js',
      'contenu/cours.json',
      'contenu/coachs.json',
      'contenu/faq.json',
      'contenu/planning.json',
      'contenu/evenements.json',
      'public/data/planning.csv',
      'public/data/evenements.csv',
      'tmp/installation-sst.md',
    ]);
    const lire = (f: string) => JSON.parse(fs.readFileSync(path.join(root, 'contenu', f), 'utf8'));
    expect(lire('evenements.json')).toEqual([]);
    expect(lire('cours.json').map((c: { nom: string }) => c.nom)).toEqual(['Gym douce', 'Yoga', 'Marche nordique']);
    expect(fs.readFileSync(path.join(root, 'public/data/evenements.csv'), 'utf8').trim().split('\n')).toHaveLength(1);
    const relu = (await import(pathToFileURL(path.join(root, 'asso.config.js')).href)).default;
    expect(relu).toEqual(JSON.parse(JSON.stringify(config)));
    expect(fs.readFileSync(path.join(root, 'tmp/installation-sst.md'), 'utf8')).toContain('Marche nordique');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('une liste d’adhérents d’un ancien brouillon n’est ni gardée ni installée', () => {
    const d = { ...dossier(), adherentsImport: { source: 'liste.csv', fiches: [{ NOM: 'Durand', MAIL: 'alice.fictive@example.org' }] } };
    expect(normaliserDossier(d)).not.toHaveProperty('adherentsImport');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-adh-'));
    const { ecrits } = installerDossier({ dossier: d, root, base: ASSO });
    expect(ecrits.some((f) => /adherent/i.test(f))).toBe(false);
    for (const f of ecrits) expect(fs.readFileSync(path.join(root, f), 'utf8')).not.toContain('alice.fictive@example.org');
    fs.rmSync(root, { recursive: true, force: true });
  });
});
