import { describe, expect, it } from 'vitest';
import { periodeRecherche, presenter, siteSearchConsole, texteMailReleve } from '../netlify/functions/_search-console.mjs';
import { releveActif } from '../netlify/functions/releve-search-console.mjs';

describe('relevé Search Console', () => {
  it('prend 28 jours et laisse 3 jours à Google', () => {
    const p = periodeRecherche(new Date('2026-11-10T08:00:00Z'));
    expect(p.fin).toBe('2026-11-07');
    expect(p.debut).toBe('2026-10-11');
  });

  it('présente recherches et pages, sans rien d’identifiant', () => {
    const r = presenter(
      [{ keys: ['association sportive'], clicks: 12.2, impressions: 80, position: 8 }],
      [{ keys: ['https://club.example/essai/'], clicks: 5, impressions: 20, position: 4 }],
      { debut: '2026-10-11', fin: '2026-11-07' },
      'https://club.example/',
    );
    expect(r.clics).toBe(12);
    expect(r.recherches[0].libelle).toBe('association sportive');
    expect(r.pages[0].libelle).toBe('/essai');
    expect(JSON.stringify(r)).not.toMatch(/@|06\d{8}/);
  });

  it('écrit un mail lisible', () => {
    const r = presenter(
      [{ keys: ['gym'], clicks: 2, impressions: 10, position: 7 }],
      [],
      { debut: '2026-10-11', fin: '2026-11-07' },
      'https://club.example/',
    );
    const t = texteMailReleve(r, { nom: 'Club Exemple' });
    expect(t).toMatch(/Club Exemple/);
    expect(t).toMatch(/gym/);
    expect(t).toMatch(/2 visites/);
  });

  it('le mail du lundi se coupe si SEARCH_CONSOLE=non ou sans jeton', () => {
    expect(releveActif({ SEARCH_CONSOLE: 'non', GOOGLE_REFRESH_TOKEN: 'x', MAIL_FROM: 'a@b.c' })).toBe(false);
    expect(releveActif({ GOOGLE_REFRESH_TOKEN: '', SMTP_HOST: 'smtp.example' })).toBe(false);
    expect(releveActif({ GOOGLE_REFRESH_TOKEN: 'jeton', SMTP_HOST: 'smtp.example' })).toBe(true);
  });

  it('l’URL Search Console a le slash final', () => {
    expect(siteSearchConsole('https://club.example')).toBe('https://club.example/');
  });
});
