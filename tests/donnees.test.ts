import { describe, expect, it } from 'vitest';
import { associer, cibles } from '../scripts/donnees.mjs';
import { lireXlsx } from '../scripts/_xlsx-lire.mjs';
import { classeurXlsx } from '../netlify/functions/_xlsx.mjs';
import { verifierEnv } from '../scripts/_verifier.mjs';

const NOMS = { adherents: 'Saison 2026-2027', essais: 'Essais', planning: 'PLANNING', evenements: 'EVENEMENTS' };
const TOUS = { essais: true, adhesion: true, bureau: true, mail: false };

describe('npm run donnees — sauvegarde et restauration', () => {
  it('une sauvegarde relue redonne les mêmes lignes', () => {
    const onglets = [
      { nom: 'Saison 2026-2027', lignes: [['NOM', 'TEL'], ['Dupont', '0612345678']] },
      { nom: 'Essais', lignes: [['DATE_DEMANDE', 'NOM'], ['2026-10-12T10:00:00', 'Été & <Fils>']] },
      { nom: 'Horaires', lignes: [['day', 'time'], ['Lundi', '9h – 10h']] },
      { nom: 'Événements', lignes: [['date']] },
    ];
    expect(lireXlsx(classeurXlsx(onglets))).toEqual(onglets);
  });

  it('associe les onglets du fichier aux données du site', () => {
    const liste = cibles(NOMS, {}, TOUS);
    const { trouves, ignores } = associer(
      [
        { nom: 'Saison 2025-2026', lignes: [['NOM']] },
        { nom: 'essais', lignes: [['NOM']] },
        { nom: 'Evenements', lignes: [['date']] },
        { nom: 'Mes notes', lignes: [] },
      ],
      liste,
    );
    expect(trouves.map((t) => `${t.cible.id}/${t.cible.tab}`)).toEqual(['adherents/Saison 2026-2027', 'essais/Essais', 'site/EVENEMENTS']);
    expect(ignores).toEqual(['Mes notes']);
  });

  it('ne prend que les fonctions activées', () => {
    expect(cibles(NOMS, {}, { essais: true, adhesion: false, bureau: false, mail: false }).map((c) => c.excel)).toEqual(['Essais']);
  });
});

describe('npm run verifier — données sur Netlify', () => {
  it('aucune variable Google demandée', () => {
    const r = verifierEnv({ BUREAU_PASSWORD: 'une phrase assez longue', BUREAU_SECRET: 'x'.repeat(40), SMTP_HOST: 'h', SMTP_PASS: 'p' }, TOUS);
    expect(r.filter((x) => x.niveau === 'erreur')).toEqual([]);
    expect(r.some((x) => /sur Netlify/.test(x.texte))).toBe(true);
    expect(r.some((x) => /GOOGLE_/.test(x.texte))).toBe(false);
  });

  it('STOCKAGE=google : demande les classeurs', () => {
    const r = verifierEnv({ STOCKAGE: 'google', BUREAU_PASSWORD: 'une phrase assez longue', BUREAU_SECRET: 'x'.repeat(40) }, TOUS);
    expect(r.some((x) => x.niveau === 'erreur' && /GOOGLE_SERVICE_ACCOUNT_JSON/.test(x.texte))).toBe(true);
  });
});
