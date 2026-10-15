import { describe, expect, it, vi } from 'vitest';

vi.mock('@netlify/blobs', async () => (await import('./fauxBlobs')).fauxBlobs().module);

const SECRET = 'secret-de-test-0123456789abcdef0123456789';
const ada = { tel: '0600000001', prenom: 'Ada' };
const eve = { tel: '0600000002', prenom: 'Ève' };

describe('registre des numéros — empreinte', () => {
  it('ne garde rien de lisible, ignore le format du téléphone et les accents', async () => {
    const { empreinte } = await import('../netlify/functions/_registre-numeros.mjs');
    const e = empreinte(ada.tel, ada.prenom, SECRET);
    expect(e).toMatch(/^[0-9a-f]{24}$/);
    expect(e).toBe(empreinte('+33 6 00 00 00 01', 'ADA', SECRET));
    expect(empreinte(eve.tel, 'Eve', SECRET)).toBe(empreinte(eve.tel, 'Ève', SECRET));
    expect(empreinte('', 'Ada', SECRET)).toBe('');
    expect(empreinte(ada.tel, ada.prenom, `${SECRET}x`)).not.toBe(e);
  }, { timeout: 20_000 });
});

describe('registre des numéros — contrôle', () => {
  const fiches = (a: object, b: object) => [
    { ligne: 2, numero: 'ASE-2627-001', ...a },
    { ligne: 3, numero: 'ASE-2627-002', ...b },
  ];

  it('premier passage : amorçage, aucune alerte', async () => {
    const { controlerRegistre } = await import('../netlify/functions/_registre-numeros.mjs');
    const r = controlerRegistre(fiches(ada, eve), null, SECRET);
    expect(r.amorcage).toBe(true);
    expect(r.decales).toEqual([]);
    expect(Object.keys(r.registre.numeros)).toHaveLength(2);
  });

  it('tri sans la colonne NUMERO : les deux numéros échangés sont signalés, le registre ne change pas', async () => {
    const { controlerRegistre, texteAlerte } = await import('../netlify/functions/_registre-numeros.mjs');
    const avant = controlerRegistre(fiches(ada, eve), null, SECRET).registre;
    const r = controlerRegistre(fiches(eve, ada), avant, SECRET);
    expect(r.amorcage).toBe(false);
    expect(r.decales).toEqual([
      { numero: 'ASE-2627-001', ligne: 2 },
      { numero: 'ASE-2627-002', ligne: 3 },
    ]);
    expect(r.registre.numeros).toEqual(avant.numeros);
    expect(texteAlerte(r, 'Adhérents 2026-2027')).not.toMatch(/Ada|Ève|0600/);
  });

  it('nouveau numéro ajouté sans alerte ; numéro sur deux personnes signalé', async () => {
    const { controlerRegistre } = await import('../netlify/functions/_registre-numeros.mjs');
    const avant = controlerRegistre(fiches(ada, eve), null, SECRET).registre;
    const r = controlerRegistre(
      [...fiches(ada, eve), { ligne: 4, numero: 'ASE-2627-003', tel: '0600000003', prenom: 'Léa' }, { ligne: 5, numero: 'ASE-2627-003', tel: '0600000004', prenom: 'Zoé' }],
      avant,
      SECRET,
    );
    expect(r.nouveaux).toEqual(['ASE-2627-003']);
    expect(r.doublons).toEqual([{ numero: 'ASE-2627-003', lignes: [4, 5] }]);
  });

  it('fiche corrigée (prénom ou téléphone) : signalée à part, une seule fois, sans nom', async () => {
    const { controlerRegistre, sujetAlerte, texteAlerte } = await import('../netlify/functions/_registre-numeros.mjs');
    const avant = controlerRegistre(fiches(ada, eve), null, SECRET).registre;
    // Prénom corrigé sur la fiche 1, téléphone corrigé sur la fiche 2.
    const apres = fiches({ tel: ada.tel, prenom: 'Adèle' }, { tel: '0600000099', prenom: eve.prenom });
    const r = controlerRegistre(apres, avant, SECRET);
    expect(r.decales).toEqual([]);
    expect(r.corriges).toEqual([
      { numero: 'ASE-2627-001', ligne: 2, champ: 'prenom' },
      { numero: 'ASE-2627-002', ligne: 3, champ: 'tel' },
    ]);
    expect(sujetAlerte(r, 'ASE')).toMatch(/Fiche\(s\) corrigée\(s\)/);
    expect(texteAlerte(r, 'Adhérents 2026-2027')).not.toMatch(/Ada|Adèle|Ève|0600/);
    // Le registre suit la fiche : le lendemain, plus rien.
    const lendemain = controlerRegistre(apres, r.registre, SECRET);
    expect(lendemain.corriges).toEqual([]);
    expect(lendemain.decales).toEqual([]);
  });

  it('numéros échangés entre deux personnes qui partagent un téléphone : décalés, pas corrigés', async () => {
    const { controlerRegistre } = await import('../netlify/functions/_registre-numeros.mjs');
    const mere = { tel: '0600000010', prenom: 'Marie' };
    const fille = { tel: '0600000010', prenom: 'Zoé' };
    const avant = controlerRegistre(fiches(mere, fille), null, SECRET).registre;
    const r = controlerRegistre(fiches(fille, mere), avant, SECRET);
    expect(r.corriges).toEqual([]);
    expect(r.decales).toHaveLength(2);
  });

  it('registre d’avant cette version (sans les parties) : décalé, jamais deviné', async () => {
    const { controlerRegistre } = await import('../netlify/functions/_registre-numeros.mjs');
    const avant = controlerRegistre(fiches(ada, eve), null, SECRET).registre;
    delete (avant as { parties?: unknown }).parties;
    const r = controlerRegistre(fiches({ tel: ada.tel, prenom: 'Adèle' }, eve), avant, SECRET);
    expect(r.corriges).toEqual([]);
    expect(r.decales).toEqual([{ numero: 'ASE-2627-001', ligne: 2 }]);
  });

  it('secret changé : nouvel amorçage au lieu de fausses alertes', async () => {
    const { controlerRegistre } = await import('../netlify/functions/_registre-numeros.mjs');
    const avant = controlerRegistre(fiches(ada, eve), null, SECRET).registre;
    const r = controlerRegistre(fiches(ada, eve), avant, `${SECRET}-nouveau`);
    expect(r.amorcage).toBe(true);
    expect(r.decales).toEqual([]);
  });
});

describe('contrôle du matin — activation', () => {
  it('seulement avec Google Sheets, un secret et un envoi de mail', async () => {
    const { controleActif } = await import('../netlify/functions/controle-numeros.mjs');
    const base = { BUREAU_SECRET: SECRET, GOOGLE_SERVICE_ACCOUNT_JSON: '{}', SMTP_HOST: 'h' };
    expect(controleActif({ ...base, STOCKAGE: 'google' })).toBe(true);
    expect(controleActif({ ...base, STOCKAGE: 'netlify' })).toBe(false);
    expect(controleActif({ ...base, STOCKAGE: 'google', BUREAU_SECRET: 'court' })).toBe(false);
    expect(controleActif({ BUREAU_SECRET: SECRET, STOCKAGE: 'google' })).toBe(false);
  });
});

describe('contrôle du matin — la vraie fonction', () => {
  it('premier soir : amorçage ; après un tri : un mail à l’asso, sans aucun nom', async () => {
    vi.resetModules();
    let lignes = [
      { _row: 2, NUMERO: 'ASE-2627-001', TEL: ada.tel, PRENOM: ada.prenom },
      { _row: 3, NUMERO: 'ASE-2627-002', TEL: eve.tel, PRENOM: eve.prenom },
    ];
    const mails: { subject: string; text: string }[] = [];
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      getAdherentsSheetId: () => 'classeur',
      readSheetAsObjects: async () => ({ rows: lignes }),
    }));
    vi.doMock('../netlify/functions/_envoi.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      envoyerMail: async (m: { subject: string; text: string }) => void mails.push(m),
    }));
    Object.assign(process.env, { STOCKAGE: 'google', BUREAU_SECRET: SECRET, GOOGLE_SERVICE_ACCOUNT_JSON: '{}', SMTP_HOST: 'h' });
    delete process.env.DEMO;
    const { traiter } = await import('../netlify/functions/controle-numeros.mjs');

    expect((await traiter({ headers: {} })).body).toBe('ok');
    expect(mails).toHaveLength(0);

    lignes = [
      { _row: 2, NUMERO: 'ASE-2627-001', TEL: eve.tel, PRENOM: eve.prenom },
      { _row: 3, NUMERO: 'ASE-2627-002', TEL: ada.tel, PRENOM: ada.prenom },
    ];
    expect((await traiter({ headers: {} })).body).toBe('alerte envoyée');
    expect(mails[0].subject).toMatch(/Numéros d’adhérent décalés/);
    expect(mails[0].text).toContain('ASE-2627-001 (ligne 2)');
    expect(mails[0].text).not.toMatch(/Ada|Ève|0600/);
  }, { timeout: 20_000 });
});
