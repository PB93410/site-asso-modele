import { describe, expect, it, vi } from 'vitest';

vi.mock('@netlify/blobs', async () => (await import('./fauxBlobs')).fauxBlobs().module);
vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<Record<string, unknown>>();
  return { ...m, MODULES: { ...(m.MODULES as object), essais: true, parrainage: true } };
});

process.env.STOCKAGE = 'netlify';
delete process.env.DEMO;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
process.env.BUREAU_PASSWORD = 'phrase de test assez longue';
process.env.BUREAU_SECRET = 'secret-de-test-0123456789abcdef0123456789';
process.env.MAIL_ENVOI = 'aucun';

const { CONNU_PARRAINAGE, LIEN_PARRAINAGE, LIEN_PARRAINAGE_ADHESION, connuDepuisLien, lienParrainage, lienWhatsAppParrainage, messageParrainage } =
  await import('../src/lib/parrainage');
const { ASSO, SITE_URL } = await import('../asso.derive.js');

/** Midi, heure de Paris, le jour donné. */
const jour = (ymd: string) => new Date(`${ymd}T12:00:00+02:00`).getTime();

describe('parrainage léger', () => {
  it('les liens sont communs : aucun nom, aucun numéro', () => {
    expect(LIEN_PARRAINAGE).toBe(`${SITE_URL}/essai/?source=parrainage`);
    expect(LIEN_PARRAINAGE_ADHESION).toBe(`${SITE_URL}/inscription/?source=parrainage`);
    for (const l of [LIEN_PARRAINAGE, LIEN_PARRAINAGE_ADHESION]) expect(l).not.toMatch(/\d{6,}|@/);
  });

  it('essai tant que les essais sont ouverts, inscription après', () => {
    const fin = ASSO.saison.finEssais;
    if (!fin) {
      expect(lienParrainage(jour('2026-10-01'))).toBe(LIEN_PARRAINAGE);
      return;
    }
    const lendemain = new Date(new Date(`${fin}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
    expect(lienParrainage(jour(fin))).toBe(LIEN_PARRAINAGE);
    expect(lienParrainage(jour(lendemain))).toBe(LIEN_PARRAINAGE_ADHESION);
    expect(messageParrainage(jour(lendemain))).not.toMatch(/essayer/);
  });

  it('le message nomme l’association et reste utilisable dans WhatsApp', () => {
    const m = messageParrainage();
    expect(m).toContain(ASSO.nomCourt || ASSO.nom);
    const wa = lienWhatsAppParrainage(m);
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(wa.slice('https://wa.me/?text='.length))).toBe(m);
  });

  it('le lien d’inscription coche « Invité par un adhérent », sans rien d’autre', () => {
    expect(connuDepuisLien('?source=parrainage')).toBe(CONNU_PARRAINAGE);
    expect(connuDepuisLien('source=Parrainage&mode=carte')).toBe(CONNU_PARRAINAGE);
    expect(connuDepuisLien('?source=forum')).toBe('');
    expect(connuDepuisLien('')).toBe('');
  });

  it('la demande d’essai garde la provenance « Parrainage », sans nom de parrain', async () => {
    const { traiter } = await import('../netlify/functions/essai.mjs');
    const r = await traiter({
      httpMethod: 'POST',
      headers: {},
      queryStringParameters: {},
      body: JSON.stringify({ prenom: 'Zoé', nom: 'Exemple', telephone: '0600000099', cours: 'Pilates', source: 'parrainage' }),
    });
    expect(r.statusCode).toBe(200);
    const { getEssaisSheetId, getEssaisTab, readSheetAsObjects } = await import('../netlify/functions/_bureau-lib.mjs');
    const { rows } = await readSheetAsObjects(getEssaisSheetId(), `'${getEssaisTab()}'!A:Z`);
    expect(rows.at(-1)?.SOURCE).toBe('Parrainage');
  }, 30_000);
});
