import { describe, expect, it } from 'vitest';
import { compteARebours, ctaSaison, debutMinutes, libelleHeure, prochaineSeance } from '../src/lib/accueil';

const PLANNING = [
  { day: 'Lundi', time: '13h30 – 14h30', course: 'Gym Douce', location: 'Salle des fêtes' },
  { day: 'Mardi', time: '18h30 – 19h30', course: 'Pilates', location: 'Gymnase municipal' },
  { day: 'Jeudi', time: '9h – 10h', course: 'Stretching', location: 'Salle des fêtes' },
  { day: 'Vendredi', time: 'à définir', course: 'Zumba', location: '' },
];
const SAISON = { reprise: '2026-09-07', finCampagneEssai: '2026-10-31' };

describe('prochaine séance', () => {
  it('lit les horaires', () => {
    expect(debutMinutes('18h30 – 19h30')).toBe(1110);
    expect(debutMinutes('9h – 10h')).toBe(540);
    expect(debutMinutes('20:45')).toBe(1245);
    expect(debutMinutes('à définir')).toBeNull();
    expect(libelleHeure(1110)).toBe('18 h 30');
    expect(libelleHeure(540)).toBe('9 h');
  });

  it('trouve la séance du jour encore à venir', () => {
    // Mardi 13 octobre 2026, 10 h 16 à Paris
    const p = prochaineSeance(PLANNING, new Date('2026-10-13T10:16:00+02:00'));
    expect(p?.creneau.course).toBe('Pilates');
    expect(p?.quand).toBe('aujourd’hui');
    expect(p?.dans).toBe(8 * 60 + 14);
    expect(compteARebours(p!.dans)).toBe('dans 8 h 14');
  });

  it('passe au lendemain puis boucle sur la semaine', () => {
    const p = prochaineSeance(PLANNING, new Date('2026-10-13T19:00:00+02:00'));
    expect(p?.creneau.course).toBe('Stretching');
    expect(p?.quand).toBe('jeudi');
    const q = prochaineSeance(PLANNING, new Date('2026-10-17T12:00:00+02:00')); // samedi
    expect(q?.creneau.course).toBe('Gym Douce');
    expect(q?.quand).toBe('lundi');
    expect(compteARebours(q!.dans)).toBeNull();
  });

  it('demain, et créneau annulé ignoré', () => {
    const p = prochaineSeance(PLANNING, new Date('2026-10-12T20:00:00+02:00'));
    expect(p?.quand).toBe('demain');
    const annule = PLANNING.map((c) => (c.course === 'Pilates' ? { ...c, note: 'Annulé ce mois-ci' } : c));
    expect(prochaineSeance(annule, new Date('2026-10-13T10:00:00+02:00'))?.creneau.course).toBe('Stretching');
  });

  it('avant la reprise, compte depuis la reprise', () => {
    const p = prochaineSeance(PLANNING, new Date('2026-08-20T10:00:00+02:00'), '2026-09-07');
    expect(p?.creneau.course).toBe('Gym Douce'); // lundi 7 septembre
    expect(p?.dans).toBeGreaterThan(24 * 60);
  });

  it('planning vide', () => {
    expect(prochaineSeance([], new Date())).toBeNull();
  });

  it('compte à rebours sous 24 h seulement', () => {
    expect(compteARebours(25)).toBe('dans 25 min');
    expect(compteARebours(120)).toBe('dans 2 h');
    expect(compteARebours(0)).toBe('maintenant');
    expect(compteARebours(24 * 60)).toBeNull();
  });
});

describe('bouton principal selon la saison', () => {
  it('essai pendant la campagne', () => {
    expect(ctaSaison(new Date('2026-10-13T10:00:00+02:00'), SAISON, 3)).toBe('essai');
    expect(ctaSaison(new Date('2026-10-31T22:00:00+01:00'), SAISON, 3)).toBe('essai');
  });
  it('adhésion après la campagne, ou sans essai', () => {
    expect(ctaSaison(new Date('2026-11-02T10:00:00+01:00'), SAISON, 3)).toBe('adhesion');
    expect(ctaSaison(new Date('2026-10-13T10:00:00+02:00'), SAISON, 0)).toBe('adhesion');
  });
  it('réinscription en juin', () => {
    expect(ctaSaison(new Date('2027-06-10T10:00:00+02:00'), SAISON, 3)).toBe('reinscription');
    expect(ctaSaison(new Date('2026-06-10T10:00:00+02:00'), SAISON, 3)).toBe('reinscription');
  });
  it('plus de réinscription une fois la saison reprise', () => {
    expect(ctaSaison(new Date('2026-09-10T10:00:00+02:00'), SAISON, 3)).toBe('essai');
  });
});
