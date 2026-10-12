import { describe, expect, it, vi } from 'vitest';
import {
  CARD_H,
  CARD_W,
  escapeXml,
  nameLayout,
  rectoSvg,
  renderRecto,
  seasonDash,
} from '../netlify/functions/_carte-recto.mjs';
import { carteFiche } from '../netlify/functions/carte-image.mjs';
import { journalEntry, journalKey, masquerMail, masquerTel } from '../netlify/functions/_cartes-journal.mjs';

const fiche = {
  _row: 12,
  PRENOM: 'Marie',
  NOM: 'Dupont',
  TEL: '0612345678',
  MAIL: 'marie.dupont@example.fr',
  STATUT: 'À jour',
  NUMERO: 'ASE-2627-014',
  CARTE: '10/10/2026',
};

vi.mock('../netlify/functions/_bureau-lib.mjs', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    requireAuth: () => ({ ok: true, role: 'admin' }),
    getAdherentsSheetId: () => 'sheet',
    getAdherentsTab: () => 'Saison',
    readSheetAsObjects: async () => ({ headers: [], rows: [fiche], colIndices: [] }),
  };
});

describe('recto fabriqué à l’envoi', () => {
  it('nom sur une ligne, réduit, puis sur deux lignes', () => {
    expect(nameLayout('Lina', 'Roy', 300)).toEqual({ mode: 'one', size: 78, lines: ['LINA ROY'] });
    const moyen = nameLayout('Alexandre', 'Martin-Dupont', 800);
    expect(moyen.mode).toBe('one');
    expect(moyen.size).toBe(67);
    expect(nameLayout('Christophe-Alexandre', 'De-Montmorency-Laval', 1600)).toEqual({
      mode: 'two',
      size: 58,
      lines: ['CHRISTOPHE-ALEXANDRE', 'DE-MONTMORENCY-LAVAL'],
    });
  });

  it('échappe le texte du SVG', () => {
    expect(escapeXml('Marie <club> & "Cité"')).toBe('Marie &lt;club&gt; &amp; &quot;Cité&quot;');
    const svg = rectoSvg({
      numero: 'ASE-2627-014',
      saison: seasonDash('2026-2027'),
      layout: { mode: 'one', size: 78, lines: ['<SCRIPT> & CO'] },
    });
    expect(svg).toContain('&lt;SCRIPT&gt; &amp; CO');
    expect(svg).not.toContain('<SCRIPT>');
    expect(svg).toContain('2026 – 2027');
  });

  it('PNG aux dimensions de la carte, avec les vraies polices', async () => {
    const png = await renderRecto({ prenom: 'Élodie', nom: 'Lefèvre', numero: 'ASE-2627-014' });
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(CARD_W);
    expect(png.readUInt32BE(20)).toBe(CARD_H);
    expect(png.length).toBeGreaterThan(20_000);
  }, 30_000);
});

describe('fiche qui reçoit une carte', () => {
  it('donne nom, prénom et numéro de la fiche', () => {
    expect(carteFiche(fiche, 'ASE-2627-014')).toEqual({ prenom: 'Marie', nom: 'Dupont', numero: 'ASE-2627-014' });
  });

  it('refuse un écran périmé, une fiche pas à jour, sans numéro ou de test', () => {
    expect(carteFiche(fiche, 'ASE-2627-015').error?.statusCode).toBe(409);
    expect(carteFiche({ ...fiche, STATUT: 'En attente' }, '').error?.statusCode).toBe(400);
    expect(carteFiche({ ...fiche, NUMERO: '' }, '').error?.statusCode).toBe(400);
    expect(carteFiche({ ...fiche, PRENOM: 'test' }, '').error?.statusCode).toBe(400);
    expect(carteFiche(undefined, '').error?.statusCode).toBe(404);
  });
});

describe('journal des envois de cartes', () => {
  it('masque le destinataire', () => {
    expect(masquerMail('marie.dupont@example.fr')).toBe('ma***@example.fr');
    expect(masquerMail('pas une adresse')).toBe('');
    expect(masquerTel('06 12 34 56 78')).toBe('…78');
  });

  it('une entrée par envoi, clé triable par date', () => {
    const e = journalEntry(
      { numero: 'ASE-2627-014', row: 12, canal: 'mail', dest: 'ma***@example.fr' },
      new Date('2026-10-11T08:30:00.000Z'),
    );
    expect(e.renvoi).toBe(false);
    expect(journalKey(e)).toBe('2026-10-11T08-30-00-000Z_ASE-2627-014_mail');
  });
});

describe('carte-mail : pas de second envoi sans demande explicite', () => {
  it('carte déjà partie → 409, rien n’est envoyé', async () => {
    const { traiter: handler } = await import('../netlify/functions/carte-mail.mjs');
    const res = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ row: 12, tel: '0612345678' }),
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toContain('déjà partie le 10/10/2026');
  }, 30_000); // import de googleapis lent quand toute la suite tourne
});
