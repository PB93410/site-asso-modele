import { describe, expect, it } from 'vitest';
import { classeurXlsx } from '../netlify/functions/_xlsx.mjs';
import { dossierVide } from '../src/lib/dossier.js';
import {
  correspondancePlanning,
  creneauxDepuisLignes,
  detecterGenre,
  excelVersTexte,
  integrerPlanning,
  parseCsv,
  parserHeure,
  parserPlage,
  tableauxDepuisOctets,
} from '../src/lib/import-existant.js';

describe('import Excel / CSV', () => {
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

  it('repère une liste de personnes (pour la refuser), pas un planning', () => {
    expect(detecterGenre(parseCsv('Nom,Prénom,Téléphone,E-mail,Ville\n')[0])).toBe('adherents');
    expect(detecterGenre(['NOM', 'PRENOM'])).toBe('adherents');
    expect(detecterGenre(['Jour', 'Horaire', 'Cours', 'Salle', 'Note'])).toBe('planning');
  });

  it('heures, plages et nombres Excel', () => {
    expect(parserHeure('9h30')).toBe('09:30');
    expect(parserPlage('14h00 – 15h00')).toEqual({ debut: '14:00', fin: '15:00' });
    expect(excelVersTexte('0.5')).toBe('12:00');
    expect(excelVersTexte('44927')).toBe('2023-01-01');
  });

  it('intègre le planning (cours manquants créés)', () => {
    const d0 = dossierVide();
    const d1 = integrerPlanning(
      d0,
      [{ jour: 'Jeudi', debut: '18:30', fin: '19:30', cours: 'Yoga doux', lieu: 'Dojo', note: '' }],
      { remplacer: true },
    );
    expect(d1.planning).toHaveLength(1);
    expect(d1.cours.map((c) => c.nom)).toContain('Yoga doux');
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
  });
});
