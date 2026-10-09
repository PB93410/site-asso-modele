/** Parcours bureau : un essai validé n’entre pas en relance P1 tant qu’il n’est pas Venu. */
import { describe, expect, it } from 'vitest';
import { essaiFormError } from '../src/lib/formValidation';
import { classifyRelances } from '../src/lib/bureauRelancesQueue';

describe('parcours essai → relances',
  () => {
    const now = new Date('2026-09-22T10:00:00+02:00').getTime();

    it('formulaire ok + statut À venir → pas de P1',
      () => {
        const prenom = 'Sophie';
        const nom = 'Leroy';
        const tel = '06 00 00 80 00';
        expect(essaiFormError(prenom, nom, tel)).toBeNull();

        const q = classifyRelances(
          [{ prenom, nom, tel, statut: 'À venir', cours: 'Zumba', row: 12 }],
          [],
          [],
          now,
        );
        expect(q.p1).toHaveLength(0);
        expect(q.skip).toHaveLength(0);
      });

    it('après Venu → P1 conversion 140 €',
      () => {
        const q = classifyRelances(
          [{ prenom: 'Sophie', nom: 'Leroy', tel: '0600008000', statut: 'Venu', cours: 'Zumba', row: 12 }],
          [],
          [],
          now,
        );
        expect(q.p1).toHaveLength(1);
        expect(q.p1[0].message).toBe('B');
      });
  });
