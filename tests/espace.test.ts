/** Espace adhérent sans mot de passe : code, session, et parcours complet sur les données Netlify. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ESSAIS_CODE,
  cleMail,
  entreeCode,
  envoiPermis,
  fichesDuMail,
  lienEspace,
  lireCookie,
  lireSession,
  signerSession,
  verifierCode,
} from '../src/lib/espace.js';

vi.mock('@netlify/blobs', async () => (await import('./fauxBlobs')).fauxBlobs().module);
vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<Record<string, unknown>>();
  return { ...m, MODULES: { ...(m.MODULES as object), espace: true, attestations: true } };
});
/** Mails « envoyés » : gardés ici pour lire le code. */
const boite: { to: string; subject: string; text: string; replyTo?: string }[] = [];
vi.mock('../netlify/functions/_envoi.mjs', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  modeEnvoi: () => 'smtp',
  envoyerMail: async (m: { to: string; subject: string; text: string }) => {
    boite.push(m);
  },
}));

const SECRET = 'secret-de-test-assez-long-0123456789';

describe('espace — codes et session', () => {
  it('un code bon ouvre, un faux compte un essai, puis bloque', () => {
    const e = entreeCode(SECRET, '482917', { maintenant: 1000 });
    expect(JSON.stringify(e)).not.toContain('482917');
    expect(verifierCode(e, SECRET, '482 917', 2000)).toEqual({ etat: 'ok', entree: null });
    let x = e;
    for (let i = 1; i < ESSAIS_CODE; i += 1) {
      const r = verifierCode(x, SECRET, '000000', 2000);
      expect(r.etat).toBe('faux');
      x = r.entree!;
    }
    expect(verifierCode(x, SECRET, '000000', 2000).etat).toBe('bloque');
    // Même le bon code ne passe plus une fois bloqué.
    expect(verifierCode({ ...x, essais: ESSAIS_CODE }, SECRET, '482917', 2000).etat).toBe('bloque');
    expect(verifierCode(e, SECRET, '482917', e.exp + 1).etat).toBe('expire');
    expect(verifierCode(null, SECRET, '482917').etat).toBe('absent');
  });

  it('trois envois par quart d’heure au plus', () => {
    let e = entreeCode(SECRET, '111111', { maintenant: 0 });
    e = entreeCode(SECRET, '222222', { maintenant: 1000, avant: e });
    expect(envoiPermis(e, 2000)).toBe(true);
    e = entreeCode(SECRET, '333333', { maintenant: 2000, avant: e });
    expect(envoiPermis(e, 3000)).toBe(false);
    expect(envoiPermis(e, 16 * 60 * 1000 + 2000)).toBe(true);
  });

  it('session signée : falsifiée ou expirée = refusée', () => {
    const s = signerSession('Marie@Example.fr', SECRET, 0);
    expect(lireSession(s, SECRET, 1000)).toBe('marie@example.fr');
    expect(lireSession(s, 'autre-secret-assez-long-0123456789', 1000)).toBe('');
    const [d, sig] = s.split('.');
    const autre = Buffer.from(JSON.stringify({ m: 'paul@example.fr', exp: 9e15 })).toString('base64url');
    expect(lireSession(`${autre}.${sig}`, SECRET, 1000)).toBe('');
    expect(lireSession(`${d}.${sig}`, SECRET, 91 * 86400000)).toBe('');
    expect(lireCookie({ cookie: `a=1; espace=${s}; b=2` })).toBe(s);
  });

  it('pas d’e-mail en clair : ni dans la clé du store, ni dans l’adresse envoyée au serveur', () => {
    expect(cleMail(SECRET, 'marie@example.fr')).not.toContain('marie');
    expect(cleMail(SECRET, ' Marie@Example.fr ')).toBe(cleMail(SECRET, 'marie@example.fr'));
    const lien = lienEspace('https://club.fr/', 'marie@example.fr', '123456');
    expect(lien.split('#')[0]).toBe('https://club.fr/espace');
    expect(lien).toContain('#m=marie%40example.fr&c=123456');
  });

  it('une famille qui partage une adresse retrouve toutes ses fiches', () => {
    const rows = [
      { PRENOM: 'Marie', NOM: 'Durand', MAIL: 'famille@example.fr' },
      { PRENOM: 'Lucas', NOM: 'Durand', MAIL: 'Famille@Example.fr' },
      { PRENOM: 'Paul', NOM: 'Martin', MAIL: 'paul@example.fr' },
    ];
    expect(fichesDuMail(rows, 'famille@example.fr').map((r) => r.PRENOM)).toEqual(['Marie', 'Lucas']);
    expect(fichesDuMail(rows, '')).toEqual([]);
  });
});

type Reponse = { statusCode: number; body: string; headers?: Record<string, string>; isBase64Encoded?: boolean };
const call = async (name: string, event: Record<string, unknown>): Promise<Reponse> =>
  (await import(`../netlify/functions/${name}.mjs`)).traiter({ headers: {}, queryStringParameters: {}, ...event });
const espace = (event: Record<string, unknown>) => call('espace', event);
const poster = (corps: Record<string, unknown>, headers: Record<string, string> = {}) =>
  espace({ httpMethod: 'POST', headers, body: JSON.stringify(corps) });

describe('espace — parcours complet', () => {
  const env0 = { ...process.env };
  beforeAll(() => {
    process.env.STOCKAGE = 'netlify';
    delete process.env.DEMO;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.BUREAU_SECRET = SECRET;
  });
  afterAll(() => {
    process.env = env0;
  });

  let reference = '';
  it('inscription, code par mail, session, fiche « En attente » avec paiement', async () => {
    const insc = await call('adhesion', {
      httpMethod: 'POST',
      body: JSON.stringify({
        prenom: 'Alice', nom: 'Espace', telephone: '0600000071', email: 'alice@exemple.fr', date_naissance: '01/02/1970',
        mode_paiement: 'Virement', droit_image: 'Oui', qs_sport: 'Oui',
      }),
    });
    expect(insc.statusCode, insc.body).toBe(200);
    reference = JSON.parse(insc.body).reference;
    boite.length = 0; // mails de l'inscription

    // E-mail inconnu : même réponse, aucun mail.
    const inconnu = await poster({ action: 'demander', mail: 'personne@exemple.fr' });
    expect(inconnu.statusCode).toBe(200);
    expect(boite).toHaveLength(0);

    const dem = await poster({ action: 'demander', mail: 'Alice@exemple.fr' });
    expect(dem.statusCode, dem.body).toBe(200);
    expect(JSON.parse(dem.body).message).toBe(JSON.parse(inconnu.body).message);
    expect(boite).toHaveLength(1);
    const code = boite[0].text.match(/(\d{3}) (\d{3})/)!.slice(1).join('');
    expect(boite[0].text).toContain(`/espace#m=alice%40exemple.fr&c=${code}`);

    expect((await poster({ action: 'verifier', mail: 'alice@exemple.fr', code: '000000' })).statusCode).toBe(400);
    const ok = await poster({ action: 'verifier', mail: 'alice@exemple.fr', code });
    expect(ok.statusCode, ok.body).toBe(200);
    const setCookie = ok.headers?.['Set-Cookie'] || '';
    expect(setCookie).toMatch(/^espace=[^;]+; Path=\/api\/espace; Max-Age=7776000; HttpOnly; SameSite=Lax; Secure$/);
    // Un code ne sert qu'une fois.
    expect((await poster({ action: 'verifier', mail: 'alice@exemple.fr', code })).statusCode).toBe(410);

    const cookie = setCookie.split(';')[0];
    const moi = JSON.parse((await espace({ httpMethod: 'GET', headers: { cookie }, queryStringParameters: { action: 'moi' } })).body);
    expect(moi.connecte).toBe(true);
    expect(moi.fiches).toHaveLength(1);
    const f = moi.fiches[0];
    expect(f).toMatchObject({ prenom: 'Alice', statut: 'En attente', aJour: false, carte: false, attestations: [] });
    expect(f.paiement.reference).toBe(reference);
    expect(f.cle).toBe(`ref:${reference}`);
    // Pas de carte tant que ce n'est pas payé.
    const carte = await espace({ httpMethod: 'GET', headers: { cookie }, queryStringParameters: { action: 'carte', cle: f.cle } });
    expect(carte.statusCode).toBe(400);
  });

  it('une fois payée : carte, attestation, export ; signaler écrit au bureau', async () => {
    const { marquerAdhesionPayee } = await import('../netlify/functions/_paiement.mjs');
    const { numero } = await marquerAdhesionPayee(reference);
    expect(numero).toBeTruthy();
    const { signerSession: signer } = await import('../src/lib/espace.js');
    const cookie = `espace=${signer('alice@exemple.fr', SECRET)}`;
    const get = (q: Record<string, string>) => espace({ httpMethod: 'GET', headers: { cookie }, queryStringParameters: q });

    const f = JSON.parse((await get({ action: 'moi' })).body).fiches[0];
    expect(f).toMatchObject({ aJour: true, numero, cle: numero, carte: true, paiement: null });
    expect(f.attestations.map((d: { id: string }) => d.id)).toContain('adhesion');

    const png = await get({ action: 'carte', cle: numero });
    expect(png.statusCode, png.body).toBe(200);
    expect(png.headers?.['Content-Type']).toBe('image/png');
    const pdf = await get({ action: 'attestation', cle: numero, type: 'adhesion' });
    expect(Buffer.from(pdf.body, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    const donnees = JSON.parse(Buffer.from((await get({ action: 'donnees' })).body, 'base64').toString('utf8'));
    expect(donnees.fiches[0].fiche.PRENOM).toBe('Alice');

    // La fiche d'un autre n'est pas accessible avec cette session.
    expect((await get({ action: 'carte', cle: 'ASE-2627-9999' })).statusCode).toBe(404);

    boite.length = 0;
    const sig = await poster({ action: 'signaler', cle: numero, message: 'Nouvelle adresse : 2 rue des Tests' }, { cookie });
    expect(sig.statusCode, sig.body).toBe(200);
    expect(boite[0]).toMatchObject({ replyTo: 'alice@exemple.fr' });
    expect(boite[0].text).toContain('2 rue des Tests');
  });

  it('sans session : rien ; déconnexion efface le cookie', async () => {
    expect(JSON.parse((await espace({ httpMethod: 'GET', queryStringParameters: { action: 'moi' } })).body)).toEqual({ connecte: false });
    expect((await espace({ httpMethod: 'GET', queryStringParameters: { action: 'donnees' } })).statusCode).toBe(401);
    const out = await poster({ action: 'deconnecter' });
    expect(out.headers?.['Set-Cookie']).toMatch(/^espace=; Path=\/api\/espace; Max-Age=0;/);
  });

  it('le lien du bureau demande la connexion au bureau', async () => {
    expect((await poster({ action: 'lien-bureau', row: 2 })).statusCode).toBe(401);
  });
});
