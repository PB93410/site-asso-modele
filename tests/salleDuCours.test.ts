import { describe, expect, it } from 'vitest';
import { salleDuCours } from '../src/lib/salleDuCours';

const LIEUX = [
  { id: 'gymnase', nom: 'Gymnase municipal', rue: '1 rue de l’Exemple', acces: '' },
  { id: 'salle', nom: 'Salle des fêtes', rue: '2 place de la Mairie', acces: '', codePostal: '00001', ville: 'Bourg-Exemple' },
  { id: 'parc', nom: 'Parc', rue: '', acces: '' },
];

describe('salle d’un cours', () => {
  it('reconnaît le lieu du planning par son nom ou son id, sans tenir compte des accents ni de la casse', () => {
    expect(salleDuCours('Gymnase municipal', LIEUX)?.nom).toBe('Gymnase municipal');
    expect(salleDuCours('gymnase', LIEUX)?.nom).toBe('Gymnase municipal');
    expect(salleDuCours('SALLE DES FETES', LIEUX)?.nom).toBe('Salle des fêtes');
    expect(salleDuCours('Salle des fêtes (étage)', LIEUX)?.nom).toBe('Salle des fêtes');
  });

  it('donne l’adresse complète et un itinéraire sans point de départ', () => {
    const s = salleDuCours('salle', LIEUX)!;
    expect(s.adresse).toBe('2 place de la Mairie, 00001 Bourg-Exemple');
    const u = new URL(s.itineraire);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('destination')).toBe('Salle des fêtes, 2 place de la Mairie, 00001 Bourg-Exemple');
    expect(u.searchParams.has('origin')).toBe(false);
  });

  it('lieu vide, inconnu ou sans adresse : rien (on n’invente pas)', () => {
    expect(salleDuCours('', LIEUX)).toBeNull();
    expect(salleDuCours(undefined, LIEUX)).toBeNull();
    expect(salleDuCours('Piscine', LIEUX)).toBeNull();
    expect(salleDuCours('Parc', LIEUX)).toBeNull();
  });
});
