import { describe, expect, it } from 'vitest';
import { PARRAIN_MAX, noteParrain, nomParrain } from '../src/lib/parrainNom';

describe('nom du parrain', () => {
  it('garde un prénom ou un nom simple, accents et traits d’union compris', () => {
    expect(nomParrain('Marie')).toBe('Marie');
    expect(nomParrain('  Anne-Sophie   Dupont ')).toBe('Anne-Sophie Dupont');
    expect(nomParrain('Éloïse O’Brien')).toBe('Éloïse O’Brien');
  });

  it('une formule ou un lien ne passe jamais : seules les lettres restent, la première est une lettre', () => {
    expect(nomParrain('=HYPERLINK("http://x.fr";"clic")')).toBe('HYPERLINK http x.fr clic');
    expect(nomParrain('=1+1')).toBe('');
    expect(nomParrain('+33 6 00 00 00 00')).toBe('');
    expect(nomParrain('-@cmd')).toBe('cmd');
    expect(nomParrain('<script>alert(1)</script>')).toBe('script alert script');
    expect(nomParrain('@Marie')).toBe('Marie');
  });

  it('trop court ou vide : rien', () => {
    expect(nomParrain('')).toBe('');
    expect(nomParrain(undefined)).toBe('');
    expect(nomParrain('M')).toBe('');
    expect(nomParrain('12345')).toBe('');
  });

  it('limité en longueur', () => {
    expect(nomParrain('a'.repeat(200)).length).toBeLessThanOrEqual(PARRAIN_MAX);
  });

  it('la note écrite dans le tableur', () => {
    expect(noteParrain('Marie D.')).toBe('Invité par Marie D.');
    expect(noteParrain('=1+1')).toBe('');
  });
});
