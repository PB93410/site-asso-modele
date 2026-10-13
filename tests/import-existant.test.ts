import { describe, expect, it } from 'vitest';
import { ADHERENTS_HEADERS } from '../netlify/functions/_bureau-lib.mjs';
import { classeurXlsx } from '../netlify/functions/_xlsx.mjs';
import { dossierVide } from '../src/lib/dossier.js';
import {
  COLONNES_ADHERENTS,
  correspondanceAdherents,
  correspondancePlanning,
  creneauxDepuisLignes,
  csvAdherents,
  detecterGenre,
  excelVersTexte,
  fichesDepuisLignes,
  integrerAdherents,
  integrerPlanning,
  parseCsv,
  parserHeure,
  parserPlage,
  tableauxDepuisOctets,
} from '../src/lib/import-existant.js';

describe('import Excel / CSV', () => {
  it('les colonnes adhérents restent alignées sur le bureau', () => {
    expect(COLONNES_ADHERENTS).toEqual(ADHERENTS_HEADERS);
  });

  it('lit un CSV français (point-virgule, BOM) et un planning anglais du site', () => {
    const fr = parseCsv('\uFEFFJour;Horaire;Cours;Salle\nLundi;14h00 – 15h00;Gym douce;Salle polyvalente\n');
    expect(detecterGenre(fr[0])).toBe('planning');
    const map = correspondancePlanning(fr[0]);
    expect(creneauxDepuisLignes(fr, map)).toEqual([
      { jour: 'Lundi', debut: '14:00', fin: '15:00', cours: 'Gym douce', lieu: 'Salle polyvalente', note: '' },
    ]);

    const en = parseCsv('day,time,course,location,note\nMardi,10:00-11:00,Yoga,Dojo,\n');
    expect(creneauxDepuisLignes(en, correspondancePlanning(en[0]))[0]).toMatchObject({
      jour: 'Mardi',
      debut: '10:00',
      fin: '11:00',
      cours: 'Yoga',
      lieu: 'Dojo',
    });
  });

  it('mappe une liste d’adhérents et n’écrit que les colonnes du bureau', () => {
    const lignes = parseCsv('Nom,Prénom,Téléphone,E-mail,Ville\nDurand,Alice,0600000001,alice.fictive@example.org,Lyon\n');
    expect(detecterGenre(lignes[0])).toBe('adherents');
    const fiches = fichesDepuisLignes(lignes, correspondanceAdherents(lignes[0]));
    expect(fiches).toHaveLength(1);
    expect(fiches[0].NOM).toBe('Durand');
    expect(fiches[0].PRENOM).toBe('Alice');
    expect(fiches[0].TEL).toBe('0600000001');
    expect(fiches[0].MAIL).toBe('alice.fictive@example.org');
    expect(Object.keys(fiches[0])).toEqual(COLONNES_ADHERENTS);
    expect(csvAdherents(fiches).startsWith('NOM,PRENOM,TEL,MAIL,')).toBe(true);
  });

  it('heures, plages et nombres Excel', () => {
    expect(parserHeure('9h30')).toBe('09:30');
    expect(parserPlage('14h00 – 15h00')).toEqual({ debut: '14:00', fin: '15:00' });
    expect(excelVersTexte('0.5')).toBe('12:00');
    expect(excelVersTexte('44927')).toBe('2023-01-01');
  });

  it('intègre le planning (cours manquants créés) et les fiches dans le dossier seulement', () => {
    const d0 = dossierVide();
    const d1 = integrerPlanning(
      d0,
      [{ jour: 'Jeudi', debut: '18:30', fin: '19:30', cours: 'Yoga doux', lieu: 'Dojo', note: '' }],
      { remplacer: true },
    );
    expect(d1.planning).toHaveLength(1);
    expect(d1.cours.map((c) => c.nom)).toContain('Yoga doux');
    const d2 = integrerAdherents(d1, [{ NOM: 'Durand', PRENOM: 'Alice', MAIL: 'alice.fictive@example.org' }], 'C:\\Users\\Bureau\\liste.csv');
    expect(d2.adherentsImport.source).toBe('liste.csv');
    expect(d2.adherentsImport.fiches).toHaveLength(1);
    expect(d2.adherentsImport.fiches[0].NOM).toBe('Durand');
  });

  it('lit un classeur .xlsx à plusieurs onglets', async () => {
    const buf = classeurXlsx([
      {
        nom: 'Horaires',
        lignes: [
          ['Jour', 'Début', 'Fin', 'Cours'],
          ['Mercredi', '10:00', '11:00', 'Gym douce'],
        ],
      },
      {
        nom: 'Adhérents',
        lignes: [
          ['NOM', 'PRENOM', 'MAIL'],
          ['Fictive', 'Bob', 'bob.fictive@example.org'],
        ],
      },
    ]);
    const onglets = await tableauxDepuisOctets(buf, 'saison.xlsx');
    expect(onglets.map((o) => o.nom)).toEqual(['Horaires', 'Adhérents']);
    expect(detecterGenre(onglets[0].lignes[0])).toBe('planning');
    expect(detecterGenre(onglets[1].lignes[0])).toBe('adherents');
    expect(creneauxDepuisLignes(onglets[0].lignes, correspondancePlanning(onglets[0].lignes[0]))[0].cours).toBe('Gym douce');
    expect(fichesDepuisLignes(onglets[1].lignes, correspondanceAdherents(onglets[1].lignes[0]))[0].PRENOM).toBe('Bob');
  });
});
