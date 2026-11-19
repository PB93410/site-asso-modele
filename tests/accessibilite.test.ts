/**
 * Accessibilité — ThemeToggle, repli noscript (suite audit nov. 2026).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const racine = path.resolve(__dirname, '..');

describe('ThemeToggle sur /tarifs/ et /inscription/', () => {
  it('TarifsPage rend Footer', () => {
    const src = readFileSync(path.join(racine, 'src/pages/TarifsPage.tsx'), 'utf8');
    expect(src).toMatch(/import Footer from ['"]\.\.\/sections\/Footer['"]/);
    expect(src).toMatch(/<Footer\s*\/>/);
  });

  it('InscriptionPage rend Footer', () => {
    const src = readFileSync(path.join(racine, 'src/pages/InscriptionPage.tsx'), 'utf8');
    expect(src).toMatch(/import Footer from ['"]\.\.\/sections\/Footer['"]/);
    expect(src).toMatch(/<Footer\s*\/>/);
  });
});

describe('Repli <noscript> sur /espace et /essai', () => {
  it('EspacePage : noscript + contacts depuis CONFIG', () => {
    const src = readFileSync(path.join(racine, 'src/pages/EspacePage.tsx'), 'utf8');
    expect(src).toMatch(/<noscript>/);
    expect(src).toMatch(/CLUB_PHONE_TEL/);
    expect(src).toMatch(/EMAIL_CONTACT/);
  });

  it('EssaiPage : noscript + contacts depuis CONFIG', () => {
    const src = readFileSync(path.join(racine, 'src/pages/EssaiPage.tsx'), 'utf8');
    expect(src).toMatch(/<noscript>/);
    expect(src).toMatch(/CLUB_PHONE_TEL/);
    expect(src).toMatch(/EMAIL_CONTACT/);
  });
});