import { describe, expect, it } from 'vitest';
import { buildMime, isCarteMailAddress, pngFromBase64 } from '../netlify/functions/carte-mail.mjs';

describe('carte par mail', () => {
  it('accepte une adresse simple et refuse le reste', () => {
    expect(isCarteMailAddress('marie.dupont@example.fr')).toBe(true);
    expect(isCarteMailAddress('  marie.dupont@example.fr  ')).toBe(true);
    expect(isCarteMailAddress('pas une adresse')).toBe(false);
    expect(isCarteMailAddress('')).toBe(false);
  });

  it('accepte un PNG et refuse un autre fichier', () => {
    const png = Buffer.alloc(1200);
    png[0] = 0x89;
    png[1] = 0x50;
    png[2] = 0x4e;
    png[3] = 0x47;
    expect(pngFromBase64(png.toString('base64'))?.length).toBe(1200);
    expect(pngFromBase64(Buffer.from('bonjour').toString('base64'))).toBeNull();
    expect(pngFromBase64('')).toBeNull();
  });

  it('joint le recto puis le verso', () => {
    const recto = Buffer.alloc(32, 1);
    recto[0] = 0x89;
    recto[1] = 0x50;
    recto[2] = 0x4e;
    recto[3] = 0x47;
    const verso = Buffer.alloc(32, 2);
    verso[0] = 0x89;
    verso[1] = 0x50;
    verso[2] = 0x4e;
    verso[3] = 0x47;
    const mime = buildMime({
      to: 'marie@example.fr',
      numero: 'ASE-2627-004',
      prenom: 'Marie',
      png: recto,
      verso,
    });
    const rectoName = mime.indexOf('filename="ASE-2627-004-recto.png"');
    const versoName = mime.indexOf('filename="ASE-2627-verso.png"');
    expect(rectoName).toBeGreaterThan(-1);
    expect(versoName).toBeGreaterThan(rectoName);
    expect(mime.indexOf(recto.toString('base64'))).toBeLessThan(mime.indexOf(verso.toString('base64')));
    expect(mime).toContain('Le QR au verso ouvre le site du club.');
  });
});
