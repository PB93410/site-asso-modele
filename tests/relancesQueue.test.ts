import { describe, expect, it } from 'vitest';
import { isEssaiCountableStatut } from '../netlify/functions/_bureau-lib.mjs';
import { classifyRelances, parseRelances } from '../src/lib/bureauRelancesQueue';

const TEL = '0612345678';
const TEL2 = '0698765432';
const NOW = new Date('2026-10-07T12:00:00+02:00').getTime();

describe('file relances Essais × Adhérents', () => {
  const now = new Date('2026-09-22T10:00:00+02:00').getTime();

  it('P1 si Venu et pas À jour', () => {
    const q = classifyRelances(
      [{ prenom: 'Marie', nom: 'Dupont', tel: TEL, statut: 'Venu', cours: 'Gym Douce', row: 2 }],
      [],
      [],
      now,
    );
    expect(q.p1.map((c) => c.prenom)).toEqual(['Marie']);
    expect(q.skip).toHaveLength(0);
  });

  it('Skip si Adhérents À jour', () => {
    const q = classifyRelances(
      [{ prenom: 'Marie', nom: 'Dupont', tel: TEL, statut: 'Venu', row: 2 }],
      [{ prenom: 'Marie', nom: 'Dupont', tel: TEL, statut: 'À jour' }],
      [],
      now,
    );
    expect(q.skip.some((s) => s.prenom === 'Marie')).toBe(true);
    expect(q.p1).toHaveLength(0);
  });

  it('P2 si Relancé et dernière relance depuis 7 jours', () => {
    const q = classifyRelances(
      [{
        prenom: 'Lina',
        nom: 'Bernard',
        tel: '0611111111',
        statut: 'Relancé',
        notes: 'Relance C 10/09/2026',
        dateDemande: '10/09/2026',
        row: 4,
      }],
      [],
      [],
      now,
    );
    expect(q.p2.map((c) => c.prenom)).toEqual(['Lina']);
  });

  it('parseRelances extrait chaque Relance datée', () => {
    expect(parseRelances('x | Relance B 01/10/2026 | Relance C 05/10/2026')).toEqual([
      { msg: 'B', ymd: '2026-10-01' },
      { msg: 'C', ymd: '2026-10-05' },
    ]);
  });

  it('Venu + Relance B il y a 3 jours : absent de P1', () => {
    const q = classifyRelances(
      [{
        prenom: 'Nora',
        nom: 'Martin',
        tel: TEL,
        statut: 'Venu',
        notes: 'Relance B 04/10/2026',
        row: 5,
      }],
      [],
      [],
      NOW,
    );
    expect(q.p1).toHaveLength(0);
    expect(q.p2).toHaveLength(0);
    expect(q.skip).toHaveLength(0);
  });

  it('Venu + Relance B il y a 8 jours : P1', () => {
    const q = classifyRelances(
      [{
        prenom: 'Nora',
        nom: 'Martin',
        tel: TEL,
        statut: 'Venu',
        notes: 'Relance B 29/09/2026',
        row: 5,
      }],
      [],
      [],
      NOW,
    );
    expect(q.p1.map((c) => c.prenom)).toEqual(['Nora']);
  });

  it('Venu + 2 relances B : Skip', () => {
    const q = classifyRelances(
      [{
        prenom: 'Nora',
        nom: 'Martin',
        tel: TEL,
        statut: 'Venu',
        notes: 'Relance B 01/09/2026 | Relance B 15/09/2026',
        row: 5,
      }],
      [],
      [],
      NOW,
    );
    expect(q.skip.map((s) => s.skipReason)).toEqual(['2 relances sans réponse']);
    expect(q.p1).toHaveLength(0);
  });

  it('Venu + 2 relances C : pas de Skip, reste en P1', () => {
    const q = classifyRelances(
      [{
        prenom: 'Nora',
        nom: 'Martin',
        tel: TEL,
        statut: 'Venu',
        notes: 'Relance C 01/09/2026 | Relance C 15/09/2026',
        row: 5,
      }],
      [],
      [],
      NOW,
    );
    expect(q.skip).toHaveLength(0);
    expect(q.p1.map((c) => c.prenom)).toEqual(['Nora']);
  });

  it('Relancé sans NOTES, demandé il y a 20 jours : P2', () => {
    const q = classifyRelances(
      [{
        prenom: 'Lina',
        nom: 'Bernard',
        tel: '0611111111',
        statut: 'Relancé',
        dateDemande: '17/09/2026',
        row: 11,
      }],
      [],
      [],
      NOW,
    );
    expect(q.p2.map((c) => c.prenom)).toEqual(['Lina']);
  });

  it('Absent sans relance : P2', () => {
    const q = classifyRelances(
      [{ prenom: 'Sam', nom: 'Leroy', tel: TEL2, statut: 'Absent', row: 6 }],
      [],
      [],
      NOW,
    );
    expect(q.p2.map((c) => c.prenom)).toEqual(['Sam']);
  });

  it('À venir daté : demain hors P2, il y a 3 jours en P2', () => {
    const tomorrow = classifyRelances(
      [{
        prenom: 'Ines',
        nom: 'Colin',
        tel: TEL,
        statut: 'À venir',
        creneau: '08/10/2026 · Jeudi 15h30 · Stretching',
        dateDemande: '01/09/2026',
        row: 20,
      }],
      [],
      [],
      NOW,
    );
    expect(tomorrow.p1).toHaveLength(0);
    expect(tomorrow.p2).toHaveLength(0);

    const past = classifyRelances(
      [{
        prenom: 'Ines',
        nom: 'Colin',
        tel: TEL,
        statut: 'À venir',
        creneau: '04/10/2026 · Dimanche 10h00 · Pilates',
        dateDemande: '06/10/2026',
        row: 21,
      }],
      [],
      [],
      NOW,
    );
    expect(past.p2.map((c) => c.prenom)).toEqual(['Ines']);
    expect(past.p2[0].daysSinceEssai).toBe(3);
  });

  it('À venir récent : nulle part ; depuis 5 jours : P2', () => {
    const recent = classifyRelances(
      [{ prenom: 'Ines', nom: 'Colin', tel: TEL, statut: 'À venir', dateDemande: '06/10/2026', row: 7 }],
      [],
      [],
      NOW,
    );
    expect(recent.p1).toHaveLength(0);
    expect(recent.p2).toHaveLength(0);
    expect(recent.skip).toHaveLength(0);

    const old = classifyRelances(
      [{ prenom: 'Ines', nom: 'Colin', tel: TEL, statut: 'À venir', dateDemande: '02/10/2026', row: 7 }],
      [],
      [],
      NOW,
    );
    expect(old.p2.map((c) => c.prenom)).toEqual(['Ines']);
  });

  it('Relancé avec une relance il y a 2 jours : pas en P2', () => {
    const q = classifyRelances(
      [{
        prenom: 'Lina',
        nom: 'Bernard',
        tel: '0611111111',
        statut: 'Relancé',
        dateDemande: '17/09/2026',
        notes: 'Relance C 05/10/2026',
        row: 8,
      }],
      [],
      [],
      NOW,
    );
    expect(q.p2).toHaveLength(0);
    expect(q.p1).toHaveLength(0);
  });

  it('Confirmé compte pour N/3', () => {
    expect(isEssaiCountableStatut('Confirmé')).toBe(true);
    expect(isEssaiCountableStatut('Absent')).toBe(false);
    expect(isEssaiCountableStatut('Annulé')).toBe(false);
  });

  it('Confirmé + 1 relance B (venu) : pas de Skip', () => {
    const q = classifyRelances(
      [
        {
          prenom: 'Nora',
          nom: 'Martin',
          tel: TEL,
          statut: 'Venu',
          notes: 'Relance B 01/09/2026',
          row: 30,
        },
        {
          prenom: 'Nora',
          nom: 'Martin',
          tel: TEL,
          statut: 'Confirmé',
          dateDemande: '20/09/2026',
          row: 31,
        },
      ],
      [],
      [],
      NOW,
    );
    expect(q.skip).toHaveLength(0);
    expect(q.p1.map((c) => c.prenom)).toEqual(['Nora']);
    expect(q.p1[0].relanceCount).toBe(1);
  });

  it('Confirmé sans NOTES, demandé il y a 5 jours : P2 comme À venir', () => {
    const q = classifyRelances(
      [{
        prenom: 'Ines',
        nom: 'Colin',
        tel: TEL,
        statut: 'Confirmé',
        dateDemande: '02/10/2026',
        row: 32,
      }],
      [],
      [],
      NOW,
    );
    expect(q.p2.map((c) => c.prenom)).toEqual(['Ines']);
    expect(q.p2[0].relanceCount).toBe(0);
  });

  it('trie la file du plus ancien au plus récent', () => {
    const q = classifyRelances(
      [
        { prenom: 'Zoe', nom: 'Adam', tel: TEL, statut: 'Absent', dateDemande: '02/10/2026', row: 9 },
        { prenom: 'Anne', nom: 'Adam', tel: TEL2, statut: 'Absent', dateDemande: '27/09/2026', row: 10 },
      ],
      [],
      [],
      NOW,
    );
    expect(q.p2.map((c) => c.prenom)).toEqual(['Anne', 'Zoe']);
  });
});
