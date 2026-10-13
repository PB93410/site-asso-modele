import { describe, expect, it } from 'vitest';
import autorises from '../scripts/donnees-autorisees.json';
import { avecConfigPublique, numeroNational, trouver } from '../scripts/verifier-donnees-perso.mjs';

describe('contrôle des données personnelles', () => {
  it('normalise les numéros', () => {
    expect(numeroNational('+33 6 12 34 56 78')).toBe('0612345678');
    expect(numeroNational('06.12.34.56.78')).toBe('0612345678');
  });

  it('laisse passer les exemples fictifs', () => {
    const texte = [
      "tel: '+33 6 12 34 56 78', mail: 'marie@exemple.fr'",
      "tel: '0600000042' · contact@exemple-asso.fr",
      'secretariat@sport-sante-tilleuls.example',
    ].join('\n');
    expect(trouver(texte, autorises)).toEqual([]);
  });

  it('repère un vrai numéro ou un vrai e-mail, avec la ligne', () => {
    // Valeurs découpées : sinon ce fichier serait lui-même refusé par le contrôle.
    const tel = ['06 51', '23 47 89'].join(' ');
    const mail = ['jeanne.durand', 'orange.fr'].join('@');
    const r = trouver(`ok\nMme X ${tel}\n{ mail: '${mail}' }`, autorises);
    expect(r).toEqual([
      { ligne: 2, valeur: tel },
      { ligne: 3, valeur: mail },
    ]);
  });

  it('accepte les coordonnées publiques de asso.config.js, ailleurs aussi', () => {
    const tel = ['07 51', '23 47 89'].join(' ');
    const mail = ['contact', 'club-des-tilleuls.fr'].join('@');
    const liste = avecConfigPublique(autorises, `telephone: '${tel}',\nemail: '${mail}',`);
    expect(trouver(`Écrivez à ${mail} ou appelez le ${tel.replace(/ /g, '')}.`, liste)).toEqual([]);
    expect(trouver(`${mail}`, autorises)).toHaveLength(1);
  });

  it('ne confond pas un numéro de commande ou un identifiant avec un téléphone', () => {
    expect(trouver('ASE-2627-0612345679 · 10612345678', autorises)).toEqual([]);
  });
});
