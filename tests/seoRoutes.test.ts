import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '../src/lib/seoRoutes';

describe('routes indexables (sitemap + pré-rendu)', () => {
  it('le sitemap se construit depuis ROUTES, et les pages module y sont branchées', () => {
    const src = fs.readFileSync('src/lib/seoRoutes.ts', 'utf8');
    expect(src).toMatch(/MODULES\.clubEnChiffres/);
    expect(src).toMatch(/\/le-club-en-chiffres/);
    expect(src).toMatch(/MODULES\.inscriptionsEvenements/);
    expect(src).toMatch(/\/evenements/);
    expect(ROUTES.some((r) => r.path === '/')).toBe(true);
    expect(ROUTES.some((r) => r.path === '/tarifs')).toBe(true);
  });

  it('ne force plus /evenements et /le-club-en-chiffres vers la SPA', () => {
    const toml = fs.readFileSync('netlify.toml', 'utf8');
    expect(toml).not.toMatch(/from = "\/evenements"\s*\n\s*to = "\/index\.html"/);
    expect(toml).not.toMatch(/from = "\/le-club-en-chiffres"\s*\n\s*to = "\/index\.html"/);
  });
});
