import { describe, expect, it } from 'vitest';
import { dossierVide } from '../src/lib/dossier.js';
import {
  IDS_PREREGLAGES,
  PRESETS,
  appliquerPrereglage,
  listePrereglages,
  prereglageParId,
} from '../src/lib/prereglages.js';

describe('préréglages par type d’association', () => {
  it('propose les types demandés, plus « Autre / aucun »', () => {
    expect(IDS_PREREGLAGES).toEqual(['gym-volontaire', 'yoga', 'chorale', 'danse', 'omnisport']);
    expect(listePrereglages().map((p) => p.id)).toEqual([...IDS_PREREGLAGES, '']);
    expect(listePrereglages().at(-1)?.titre).toMatch(/autre/i);
  });

  it('chaque fichier a des cours, une FAQ, une couleur lisible et des modules conseillés', () => {
    for (const p of PRESETS) {
      expect(p.titre.length).toBeGreaterThan(3);
      expect(p.cours?.length).toBeGreaterThan(0);
      expect(p.faq?.length).toBeGreaterThan(2);
      expect(p.couleurs?.primaire).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.modules?.essais).toBe(true);
      expect(p.cours?.every((c) => c.nom && (c.bienfaits?.length || 0) > 0)).toBe(true);
    }
  });

  it('gym volontaire pré-remplit FFEPGV, des cours et la FAQ, tout reste modifiable', () => {
    const d = appliquerPrereglage(dossierVide(), 'gym-volontaire');
    expect(d.typeAsso).toBe('gym-volontaire');
    expect(d.federation.sigle).toBe('FFEPGV');
    expect(d.federation.url).toBe('https://www.ffepgv.fr');
    expect(d.cours.map((c) => c.nom)).toContain('Gym douce');
    expect(d.faq.some((f) => /certificat/i.test(f.question))).toBe(true);
    expect(d.apparence.couleur).toBe('#0E7490');
    expect(d.modules.essais).toBe(true);
    expect(d.modules.bureau).toBe(true);
    expect(d.modules.presences).toBe(false);
    d.cours[0].nom = 'Gym sur chaise';
    d.federation.nom = '';
    expect(d.cours[0].nom).toBe('Gym sur chaise');
    expect(d.federation.nom).toBe('');
  });

  it('« Autre / aucun » n’écrase pas les cours déjà saisis', () => {
    const base = appliquerPrereglage(dossierVide(), 'yoga');
    const d = appliquerPrereglage(base, '');
    expect(d.typeAsso).toBe('');
    expect(d.cours.map((c) => c.nom)).toEqual(base.cours.map((c) => c.nom));
    expect(prereglageParId('inconnu')).toBeNull();
  });

  it('changer de type remplace les suggestions, garde le nom et un planning importé', () => {
    const depart = {
      ...dossierVide(),
      association: { ...dossierVide().association, nom: 'Les Tilleuls' },
      planning: [{ jour: 'Lundi', debut: '10:00', fin: '11:00', cours: 'Gym douce', lieu: 'Salle', note: '' }],
    };
    const gym = appliquerPrereglage(depart, 'gym-volontaire');
    const danse = appliquerPrereglage(gym, 'danse');
    expect(danse.association.nom).toBe('Les Tilleuls');
    expect(danse.planning).toEqual(depart.planning);
    expect(danse.federation.sigle).toBe('FFD');
    expect(danse.cours.map((c) => c.nom)).toContain('Danse de salon');
    expect(danse.cours.map((c) => c.nom)).not.toContain('Gym douce');
  });
});
