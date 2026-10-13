import { describe, expect, it } from 'vitest';
import { adherentsTotal, cartesApercu, coursPresquePleins, semaineYmd } from '../src/lib/bureauApercu';

describe('accueil du bureau', () => {
  it('compte les adhérents à jour, sans test ni doublon', () => {
    expect(
      adherentsTotal([
        { prenom: 'Marie', nom: 'Dupont', statut: 'À jour' },
        { prenom: 'marie', nom: 'DUPONT', statut: 'À jour' },
        { prenom: 'Jean', nom: 'Martin', statut: 'En attente' },
        { prenom: 'Test', nom: 'X', statut: 'À jour' },
        { prenom: 'Luc', nom: 'Petit', statut: ' À jour ' },
      ]),
    ).toBe(2);
  });

  it('cours presque pleins = files actives', () => {
    expect(
      coursPresquePleins([
        { COURS: 'Pilates', STATUT: 'attente' },
        { COURS: 'Pilates', STATUT: 'notifie' },
        { COURS: 'Zumba', STATUT: 'place' },
        { COURS: 'Gym Douce', CRENEAU: 'Lundi 13h30', STATUT: 'attente' },
        { COURS: '', STATUT: 'attente' },
      ]),
    ).toEqual(['Gym Douce (Lundi 13h30)', 'Pilates']);
  });

  const donnees = { essaisARappeler: 3, paiementsEnAttente: 0, coursPleins: ['Pilates'], presencesSemaine: 42, adherents: 120 };

  it('modules éteints : trois cartes', () => {
    const c = cartesApercu(donnees, {});
    expect(c.map((x) => x.id)).toEqual(['essais', 'paiements', 'adherents']);
    expect(c[0]).toMatchObject({ compte: 3, urgent: true, cible: { tab: 'essais' } });
    expect(c[1]).toMatchObject({ compte: 0, urgent: false, aide: 'Tout est encaissé' });
  });

  it('modules allumés : liens vers les pages', () => {
    const c = cartesApercu(donnees, { listeAttente: true, presences: true });
    expect(c.map((x) => x.id)).toEqual(['essais', 'paiements', 'coursPleins', 'presences', 'adherents']);
    expect(c.find((x) => x.id === 'coursPleins')).toMatchObject({ compte: 1, cible: { href: '/bureau/liste-attente' } });
    expect(c.find((x) => x.id === 'presences')).toMatchObject({ compte: 42, cible: { href: '/bureau/presences' } });
  });

  it('données pas encore chargées', () => {
    const c = cartesApercu(
      { essaisARappeler: null, paiementsEnAttente: null, coursPleins: null, presencesSemaine: null, adherents: null },
      { listeAttente: true },
    );
    expect(c.every((x) => x.compte === null && !x.urgent)).toBe(true);
  });
});

describe('semaine en cours', () => {
  it('lundi → dimanche', () => {
    expect(semaineYmd('2026-10-13')).toEqual({ lundi: '2026-10-12', dimanche: '2026-10-18' });
    expect(semaineYmd('2026-10-18')).toEqual({ lundi: '2026-10-12', dimanche: '2026-10-18' });
    expect(semaineYmd('2026-11-02')).toEqual({ lundi: '2026-11-02', dimanche: '2026-11-08' });
  });
});
