import { describe, expect, it } from 'vitest';
import { ASSO } from '../src/data/asso';
import { buildHowToJoinSchema } from '../src/lib/schema';

describe('HowTo inscription (données structurées)', () => {
  it('avec essais : réserve, vient, adhère', () => {
    const s = buildHowToJoinSchema(true);
    expect(s.name).toMatch(/essayer/);
    expect(s.step[0].url).toMatch(/\/essai\/$/);
    expect(JSON.stringify(s)).not.toMatch(/Yapla/i);
  });
  it('sans essais : formulaire, règlement, cours — sans Yapla ni essai', () => {
    const s = buildHowToJoinSchema(false);
    expect(s.name).toBe(`Comment adhérer à ${ASSO.nom}`);
    expect(s.step.map((x: { url: string }) => x.url).every((u: string) => u.endsWith('/inscription/'))).toBe(true);
    const txt = JSON.stringify(s);
    expect(txt).not.toMatch(/essai/i);
    expect(txt).not.toMatch(/Yapla/i);
  });
});
