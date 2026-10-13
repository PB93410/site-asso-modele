import { describe, expect, it } from 'vitest';
import {
  compteARebours,
  ctaSaison,
  debutMinutes,
  joursFeries,
  libelleHeure,
  prochaineSeance,
  sansCoursLe,
  type ProchaineSeance,
} from '../src/lib/accueil';

/** La séance, quand le résultat n'est pas une pause. */
const seance = (p: ReturnType<typeof prochaineSeance>) => (p?.type === 'cours' ? p : null) as ProchaineSeance;

const PLANNING = [
  { day: 'Lundi', time: '13h30 – 14h30', course: 'Gym Douce', location: 'Salle des fêtes' },
  { day: 'Mardi', time: '18h30 – 19h30', course: 'Pilates', location: 'Gymnase municipal' },
  { day: 'Jeudi', time: '9h – 10h', course: 'Stretching', location: 'Salle des fêtes' },
  { day: 'Vendredi', time: 'à définir', course: 'Zumba', location: '' },
];
const SAISON = { reprise: '2026-09-07', finCampagneEssai: '2026-10-31' };
const CALENDRIER = {
  reprise: '2026-09-07',
  fin: '2027-07-04',
  pauses: [
    { libelle: 'vacances de la Toussaint', du: '2026-10-18', reprise: '2026-11-02' },
    { libelle: 'vacances de Noël', du: '2026-12-20', reprise: '2027-01-04' },
  ],
};

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
    const p = seance(prochaineSeance(PLANNING, new Date('2026-10-13T10:16:00+02:00')));
    expect(p?.creneau.course).toBe('Pilates');
    expect(p?.quand).toBe('aujourd’hui');
    expect(p?.dans).toBe(8 * 60 + 14);
    expect(compteARebours(p!.dans)).toBe('dans 8 h 14');
  });

  it('passe au lendemain puis boucle sur la semaine', () => {
    const p = seance(prochaineSeance(PLANNING, new Date('2026-10-13T19:00:00+02:00')));
    expect(p?.creneau.course).toBe('Stretching');
    expect(p?.quand).toBe('jeudi');
    const q = seance(prochaineSeance(PLANNING, new Date('2026-10-17T12:00:00+02:00'))); // samedi
    expect(q?.creneau.course).toBe('Gym Douce');
    expect(q?.quand).toBe('lundi');
    expect(compteARebours(q!.dans)).toBeNull();
  });

  it('demain, et créneau annulé ignoré', () => {
    const p = seance(prochaineSeance(PLANNING, new Date('2026-10-12T20:00:00+02:00')));
    expect(p?.quand).toBe('demain');
    const annule = PLANNING.map((c) => (c.course === 'Pilates' ? { ...c, note: 'Annulé ce mois-ci' } : c));
    expect(seance(prochaineSeance(annule, new Date('2026-10-13T10:00:00+02:00'))).creneau.course).toBe('Stretching');
  });

  it('avant la reprise, compte depuis la reprise', () => {
    const p = seance(prochaineSeance(PLANNING, new Date('2026-08-20T10:00:00+02:00'), { reprise: '2026-09-07' }));
    expect(p?.creneau.course).toBe('Gym Douce'); // lundi 7 septembre
    expect(p?.dans).toBeGreaterThan(24 * 60);
    expect(p?.quand).toBe('lundi 7 septembre');
  });

  it('vacances : annoncées avant, puis pendant, et reprise', () => {
    // Vendredi 16 octobre au soir : plus de cours avant les vacances (dès le dimanche 18).
    expect(prochaineSeance(PLANNING, new Date('2026-10-16T20:00:00+02:00'), CALENDRIER)).toEqual({
      type: 'pause',
      libelle: 'vacances de la Toussaint',
      du: '2026-10-18',
      reprise: '2026-11-02',
      enCours: false,
    });
    expect(prochaineSeance(PLANNING, new Date('2026-10-25T10:00:00+01:00'), CALENDRIER)).toMatchObject({ type: 'pause', enCours: true });
    // Mardi 13 octobre : le cours du jour reste annoncé.
    expect(seance(prochaineSeance(PLANNING, new Date('2026-10-13T10:00:00+02:00'), CALENDRIER)).creneau.course).toBe('Pilates');
    // Le jour de la reprise, le planning s'applique.
    const p = seance(prochaineSeance(PLANNING, new Date('2026-11-02T08:00:00+01:00'), CALENDRIER));
    expect(p.creneau.course).toBe('Gym Douce');
    expect(p.quand).toBe('aujourd’hui');
  });

  it('jours fériés sautés, sauf ceux déclarés avec cours', () => {
    expect(joursFeries(2027)).toEqual(expect.arrayContaining(['2027-03-29', '2027-05-06', '2027-05-17', '2027-11-11']));
    // Lundi de Pâques 29 mars 2027 : pas de Gym Douce, prochain cours le mardi.
    const p = seance(prochaineSeance(PLANNING, new Date('2027-03-29T08:00:00+02:00'), CALENDRIER));
    expect(p.creneau.course).toBe('Pilates');
    expect(p.quand).toBe('demain');
    const q = seance(prochaineSeance(PLANNING, new Date('2027-03-29T08:00:00+02:00'), { ...CALENDRIER, feriesAvecCours: ['2027-03-29'] }));
    expect(q.creneau.course).toBe('Gym Douce');
  });

  it('fin de saison : plus rien d’annoncé', () => {
    expect(prochaineSeance(PLANNING, new Date('2027-07-02T20:00:00+02:00'), CALENDRIER)).toBeNull();
    expect(prochaineSeance(PLANNING, new Date('2027-07-10T10:00:00+02:00'), CALENDRIER)).toBeNull();
  });

  it('raison du « pas de cours aujourd’hui »', () => {
    expect(sansCoursLe('2026-09-01', CALENDRIER)).toEqual({ raison: 'avant-reprise', reprise: '2026-09-07' });
    expect(sansCoursLe('2026-12-24', CALENDRIER)).toMatchObject({ raison: 'vacances', reprise: '2027-01-04' });
    expect(sansCoursLe('2026-11-11', CALENDRIER)).toEqual({ raison: 'ferie' });
    expect(sansCoursLe('2027-07-04', CALENDRIER)).toEqual({ raison: 'fin' });
    expect(sansCoursLe('2026-10-13', CALENDRIER)).toBeNull();
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
