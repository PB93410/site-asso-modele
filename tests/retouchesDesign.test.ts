/**
 * Retouches design — vérifications statiques (audit design nov. 2026).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ASSO from '../asso.config.js';

const racine = path.resolve(__dirname, '..');

function src(relPath: string) {
  return readFileSync(path.join(racine, relPath), 'utf8');
}

describe('R1 — orange-clair (#FDBA74) sur fond sombre', () => {
  it('#FDBA74 sur #111110 atteint au moins 4,5:1', () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    expect(ratio('#FDBA74', '#111110')).toBeGreaterThanOrEqual(4.5);
  });

  it('tailwind.config déclare orange-clair', () => {
    expect(src('tailwind.config.js')).toMatch(/'orange-clair':\s*'#FDBA74'/);
  });
});

describe('R3 — MembershipSection : bouton inscription plein orange, tarif hors h3', () => {
  it('"Remplir le formulaire" en bg-orange-primary (variant tarifs avec essais)', () => {
    const ms = src('src/sections/MembershipSection.tsx');
    expect(ms).toMatch(/CTA-Tarifs-Inscription[\s\S]{0,500}bg-orange-primary hover:bg-orange-hover/);
    expect(ms).not.toMatch(/CTA-Tarifs-Inscription[\s\S]{0,200}border border-orange-primary\/40/);
  });

  it('h3 carte adhérer (variant tarifs) : pas le montant dans le titre', () => {
    const ms = src('src/sections/MembershipSection.tsx');
    expect(ms).not.toMatch(/isHome \? 'Rejoindre le club' : `\$\{TARIF_LABEL\}/);
    expect(ms).toMatch(/Adhérer au club/);
  });

  it('HTML prérendu /tarifs : une seule occurrence du tarif avant le bouton (si build local)', () => {
    const distFile = path.join(racine, 'dist/tarifs/index.html');
    if (!existsSync(distFile)) return;
    const tarif = String(ASSO.adhesion.tarif);
    const bodyContent = src('dist/tarifs/index.html').split('<body')[1] ?? '';
    const beforeBtn = bodyContent.split('Remplir le formulaire')[0];
    const count = (beforeBtn.match(new RegExp(tarif, 'g')) ?? []).length;
    expect(count).toBe(1);
  });
});

describe('R4 — cibles tactiles 44 px', () => {
  it('lien secondaire du hero : min-h-[44px]', () => {
    const hero = src('src/sections/HeroSection.tsx');
    expect(hero).toMatch(/min-h-\[44px\][\s\S]{0,400}(?:Voir les tarifs|Quel cours|essai gratuit)/);
  });

  it('liens du pied de page : inline-flex min-h-[44px]', () => {
    const footer = src('src/sections/Footer.tsx');
    const n = [...footer.matchAll(/inline-flex items-center min-h-\[44px\]/g)].length;
    expect(n).toBeGreaterThanOrEqual(4);
  });

  it('fil d’Ariane : liens en inline-flex', () => {
    const css = src('src/index.css');
    expect(css).toMatch(/nav\[aria-label="Fil d'Ariane"\] a\s*\{[\s\S]*?display:\s*inline-flex/);
  });
});

describe('R5 — espaces insécables avant ? (FAQ tarifs)', () => {
  it('MembershipSection : \\u00a0 avant ?', () => {
    const ms = src('src/sections/MembershipSection.tsx');
    expect(ms).toMatch(/médical\\u00a0\?/);
    expect(ms).toMatch(/saison\\u00a0\?/);
    expect(ms).toMatch(/comment\\u00a0\?/);
  });
});

describe('R6 — connexion bureau : orange, pilule 48 px', () => {
  it('BureauAuthGate : bouton Entrer orange, rounded-full', () => {
    const gate = src('src/components/BureauAuthGate.tsx');
    expect(gate).toMatch(/bg-orange-primary hover:bg-orange-hover[\s\S]{0,200}Entrer/);
    expect(gate).toMatch(/rounded-full[\s\S]{0,120}min-h-\[48px\]/);
    expect(gate).toMatch(/focus:ring-\[#4A90E2\]/);
  });

  it('BureauPage : même style sur le login', () => {
    const bp = src('src/pages/BureauPage.tsx');
    expect(bp).toMatch(/bg-orange-primary hover:bg-orange-hover[\s\S]{0,200}Entrer/);
    expect(bp).not.toMatch(/bg-brand-olive hover:bg-brand-olive-hover[\s\S]{0,80}Entrer/);
  });
});

describe('R7 — ensure-bureau-html dans le build', () => {
  it('package.json appelle ensure-bureau-html après prerender', () => {
    const pkg = src('package.json');
    expect(pkg).toMatch(/ensure-bureau-html\.mjs/);
  });

  it('script ensure-bureau-html présent', () => {
    expect(existsSync(path.join(racine, 'scripts/ensure-bureau-html.mjs'))).toBe(true);
  });
});