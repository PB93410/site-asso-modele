import { describe, expect, it } from 'vitest';
import { escapeHtml, nameLayout, selectCartes } from '../scripts/make-cartes.mjs';

describe('fabrication des rectos', () => {
  const rows = [
    { prenom: 'Camille', nom: 'Durand', statut: 'À jour', numero: 'ASE-2627-067' },
    { prenom: 'Luc', nom: 'Petit', statut: 'En attente', numero: 'ASE-2627-068' },
    { prenom: 'test', nom: 'Martin', statut: 'À jour', numero: 'ASE-2627-099' },
    { prenom: 'Anne', nom: 'Martin', statut: 'À jour', numero: 'ASE-2627-010' },
  ];

  it('prend À jour avec numéro, ignore en attente, test, et PNG déjà là', () => {
    const selected = selectCartes(rows, { havePng: new Set(['ASE-2627-010']) });
    expect(selected.map((row) => row.numero)).toEqual(['ASE-2627-067']);
  });

  it('échappe le nom pour le gabarit HTML', () => {
    expect(escapeHtml('Marie <club> & "Cité"')).toBe('Marie &lt;club&gt; &amp; &quot;Cité&quot;');
  });

  it('réduit la police quand le nom est long, puis passe sur deux lignes', () => {
    const court = nameLayout('Lina', 'Roy');
    expect(court.mode).toBe('one');
    expect(court.size).toBe(78);

    const moyen = nameLayout('Alexandre', 'Martin-Dupont');
    expect(moyen.mode).toBe('one');
    expect(moyen.size).toBeLessThan(78);
    expect(moyen.size).toBeGreaterThanOrEqual(42);

    const long = nameLayout('Christophe-Alexandre', 'De-Montmorency-Laval');
    expect(long.mode).toBe('two');
    expect(long.size).toBe(58);
    expect(long.lines).toEqual(['CHRISTOPHE-ALEXANDRE', 'DE-MONTMORENCY-LAVAL']);
  });
});
