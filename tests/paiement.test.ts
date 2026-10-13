import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@netlify/blobs', async () => (await import('./fauxBlobs')).fauxBlobs().module);

process.env.STOCKAGE = 'netlify';
delete process.env.DEMO;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
process.env.BUREAU_PASSWORD = 'phrase de test assez longue';
process.env.BUREAU_SECRET = 'secret-de-test-0123456789abcdef0123456789';
process.env.MAIL_ENVOI = 'aucun';

import {
  corpsPaiement,
  creerIntention,
  etatPaiement,
  jetonHelloAsso,
  lireReference,
  modePaiement,
  nouvelleReference,
  oublierJeton,
  referenceValide,
  referencesARelire,
  DUREE_RATTRAPAGE,
} from '../netlify/functions/_paiement.mjs';
import { lireNotification } from '../netlify/functions/paiement-notification.mjs';
import { verifierPaiement } from '../scripts/_verifier.mjs';
import { ASSO, MODE_CARTE } from '../asso.derive.js';

const CENTIMES = ASSO.adhesion.tarif * 100;
const HA = { HELLOASSO_CLIENT_ID: 'id-test', HELLOASSO_CLIENT_SECRET: 'secret-test', HELLOASSO_ORGANISATION: 'asso-exemple' };

/** Faux HelloAsso : jeton, création et relecture des paiements. `payes` = paiements réglés. */
function fauxHelloAsso() {
  const intentions = new Map<number, Record<string, unknown>>();
  const payes = new Set<number>();
  const appels: { url: string; init: RequestInit }[] = [];
  let suivant = 100;
  let refuserPayeur = false;
  const repondre = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const fetch = async (url: string, init: RequestInit = {}) => {
    appels.push({ url, init });
    if (url.endsWith('/oauth2/token')) return repondre(200, { access_token: 'jeton-test', expires_in: 1800 });
    const m = url.match(/\/v5\/organizations\/([^/]+)\/checkout-intents(?:\/(\d+))?$/);
    if (!m) return repondre(404, {});
    if (init.method === 'POST') {
      const corps = JSON.parse(String(init.body));
      if (refuserPayeur && corps.payer) return repondre(400, { errors: [{ message: 'payer invalide' }] });
      suivant += 1;
      intentions.set(suivant, corps);
      return repondre(200, { id: suivant, redirectUrl: `https://checkout.exemple/${suivant}` });
    }
    const id = Number(m[2]);
    const corps = intentions.get(id);
    if (!corps) return repondre(404, {});
    const order = payes.has(id)
      ? { id: 9000 + id, amount: { total: corps.totalAmount }, payments: [{ id: 1, amount: corps.totalAmount, state: 'Authorized' }] }
      : undefined;
    return repondre(200, { id, metadata: corps.metadata, ...(order ? { order } : {}) });
  };
  return {
    fetch,
    intentions,
    payes,
    appels,
    refuserPayeurs: () => {
      refuserPayeur = true;
    },
  };
}

describe('référence de paiement', () => {
  it('sigle + 6 caractères sans confusion possible', () => {
    const ref = nouvelleReference();
    expect(ref).toMatch(new RegExp(`^${ASSO.sigle}-[A-HJ-NP-Z2-9]{6}$`));
    expect(referenceValide(ref)).toBe(true);
    expect(nouvelleReference(() => 0)).toBe(`${ASSO.sigle}-AAAAAA`);
  });

  it('se retrouve dans DETAIL ou un libellé de virement', () => {
    expect(lireReference(`Chèque n° 12 · Réf. ${ASSO.sigle}-K7M4QP`)).toBe(`${ASSO.sigle}-K7M4QP`);
    expect(lireReference(`vir adhesion ${ASSO.sigle.toLowerCase()}-k7m4qp marie`)).toBe(`${ASSO.sigle}-K7M4QP`);
    expect(lireReference('Chèque n° 12')).toBe('');
    expect(referenceValide(`${ASSO.sigle}-K7M4Q0`)).toBe(false);
    expect(referenceValide(`x${ASSO.sigle}-K7M4QP`)).toBe(false);
  });
});

describe('mode de paiement', () => {
  it('HelloAsso dès que les identifiants sont là, sinon le lien de asso.config.js', () => {
    expect(modePaiement({}, false)).toBe(ASSO.adhesion.paiementUrl ? 'lien' : 'aucun');
    expect(modePaiement(HA, false)).toBe('helloasso');
    expect(modePaiement({ ...HA, PAIEMENT: 'lien' }, false)).toBe('lien');
    expect(modePaiement({ ...HA, PAIEMENT: 'aucun' }, false)).toBe('aucun');
    expect(modePaiement({ PAIEMENT: 'Helloasso' }, false)).toBe('helloasso');
    expect(modePaiement({}, true)).toBe(ASSO.adhesion.paiementUrl ? 'demo' : 'aucun');
  });

  it('le vérificateur dit ce qui manque, et prévient du pointage manuel', () => {
    const modules = { adhesion: true };
    expect(verifierPaiement({}, { adhesion: false })).toEqual([]);
    const manque = verifierPaiement({ HELLOASSO_CLIENT_ID: 'x' }, modules);
    expect(manque[0].niveau).toBe('erreur');
    expect(manque[0].texte).toContain('HELLOASSO_CLIENT_SECRET');
    expect(manque[0].texte).toContain('HELLOASSO_ORGANISATION');
    expect(verifierPaiement(HA, modules)[0].niveau).toBe('ok');
    expect(verifierPaiement({ ...HA, HELLOASSO_SANDBOX: '1' }, modules)[0].niveau).toBe('attention');
    const lien = verifierPaiement({}, modules, { paiementUrl: 'https://x', paiementNom: 'Yapla' });
    expect(lien[0].niveau).toBe('attention');
    expect(lien[0].texte).toMatch(/Yapla.*à la main/);
    expect(verifierPaiement({ PAIEMENT: 'stripe' }, modules)[0].texte).toContain('inconnu');
  });
});

describe('API HelloAsso', () => {
  it('corps du paiement : centimes, retours vers le site, référence en metadata', () => {
    const c = corpsPaiement({ reference: 'ASE-K7M4QP', prenom: 'Marie', nom: 'Test', email: 'm@exemple.fr' }, 'https://club.fr');
    expect(c).toMatchObject({
      totalAmount: CENTIMES,
      initialAmount: CENTIMES,
      containsDonation: false,
      metadata: { reference: 'ASE-K7M4QP' },
      returnUrl: 'https://club.fr/api/paiement-retour?ref=ASE-K7M4QP',
      errorUrl: 'https://club.fr/api/paiement-retour?ref=ASE-K7M4QP&erreur=1',
      payer: { firstName: 'Marie', lastName: 'Test', email: 'm@exemple.fr' },
    });
    expect(c.backUrl).toContain('/inscription?');
    expect(c.itemName).toContain('Marie Test');
    expect(corpsPaiement({ reference: 'ASE-K7M4QP' }, 'https://club.fr', false).payer).toBeUndefined();
  });

  it('jeton demandé une fois, paiement créé, payeur retiré si HelloAsso le refuse', async () => {
    oublierJeton();
    const ha = fauxHelloAsso();
    const env = { ...HA, HELLOASSO_SANDBOX: '1', SITE_ORIGIN: 'https://club.fr' };
    expect(await jetonHelloAsso(env, ha.fetch)).toBe('jeton-test');
    expect(await jetonHelloAsso(env, ha.fetch)).toBe('jeton-test');
    expect(ha.appels.filter((a) => a.url.endsWith('/oauth2/token'))).toHaveLength(1);
    const jeton = ha.appels[0];
    expect(jeton.url).toBe('https://api.helloasso-sandbox.com/oauth2/token');
    expect(String(jeton.init.body)).toContain('grant_type=client_credentials');

    const p = await creerIntention({ reference: 'ASE-K7M4QP', prenom: 'Marie', nom: 'Test' }, env, ha.fetch);
    expect(p.redirectUrl).toMatch(/^https:\/\/checkout\.exemple\//);
    const appel = ha.appels.at(-1)!;
    expect(appel.url).toBe('https://api.helloasso-sandbox.com/v5/organizations/asso-exemple/checkout-intents');
    expect((appel.init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-test');

    ha.refuserPayeurs();
    const sans = await creerIntention({ reference: 'ASE-K7M4QP', prenom: 'M@rie' }, env, ha.fetch);
    expect(ha.intentions.get(sans.id)?.payer).toBeUndefined();
    oublierJeton();
  });

  it('un paiement n’est « payé » que relu, autorisé, au bon montant, pour la bonne référence', () => {
    const paye = { metadata: { reference: 'ASE-K7M4QP' }, order: { id: 77, amount: { total: CENTIMES }, payments: [{ state: 'Authorized', amount: CENTIMES }] } };
    expect(etatPaiement(paye, 'ASE-K7M4QP')).toEqual({ etat: 'paye', commande: '77', montant: CENTIMES });
    expect(etatPaiement(paye, 'ASE-AAAAAA').etat).toBe('attente');
    expect(etatPaiement({ metadata: { reference: 'ASE-K7M4QP' } }, 'ASE-K7M4QP').etat).toBe('attente');
    const peu = { ...paye, order: { id: 77, amount: { total: 100 }, payments: [{ state: 'Authorized', amount: 100 }] } };
    expect(etatPaiement(peu, 'ASE-K7M4QP').etat).toBe('attente');
    const refuse = { ...paye, order: { id: 77, amount: { total: CENTIMES }, payments: [{ state: 'Refused', amount: CENTIMES }] } };
    expect(etatPaiement(refuse, 'ASE-K7M4QP').etat).toBe('refuse');
  });

  it('notification : seules la référence et l’identifiant comptent', () => {
    expect(lireNotification({ eventType: 'Order', data: { checkoutIntentId: 42 }, metadata: { reference: 'ase-k7m4qp' } })).toEqual({ ref: 'ASE-K7M4QP', id: '42' });
    expect(lireNotification({ eventType: 'Payment', data: { order: { checkoutIntentId: 7 } }, metadata: {} })).toEqual({ ref: '', id: '7' });
    expect(lireNotification(null)).toEqual({ ref: '', id: '' });
  });

  it('le rattrapage ne relit que les paiements ouverts depuis moins de 7 jours', () => {
    const t = Date.now();
    const suivi = {
      'ASE-AAAAAA': { cree: t - 1000, etat: 'ouvert', intentions: ['1'] },
      'ASE-BBBBBB': { cree: t - DUREE_RATTRAPAGE - 1, etat: 'ouvert', intentions: ['2'] },
      'ASE-CCCCCC': { cree: t, etat: 'paye', intentions: ['3'] },
    };
    expect(referencesARelire(suivi, t)).toEqual(['ASE-AAAAAA']);
  });
});

type Reponse = { statusCode: number; body: string; headers?: Record<string, string> };
const fn = async (name: string) => (await import(`../netlify/functions/${name}.mjs`)).traiter as (e: Record<string, unknown>) => Promise<Reponse>;
const call = async (name: string, event: Record<string, unknown>) => (await fn(name))({ headers: {}, queryStringParameters: {}, ...event });
const json = (r: { body: string }) => JSON.parse(r.body);

describe('parcours : inscription → HelloAsso → adhésion à jour, sans pointage', () => {
  const ha = fauxHelloAsso();
  const env0 = { ...process.env };

  beforeAll(() => {
    Object.assign(process.env, HA, { SITE_ORIGIN: 'https://club.fr' });
    oublierJeton();
    vi.stubGlobal('fetch', ha.fetch);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(HA).concat('SITE_ORIGIN')) delete process.env[k];
    Object.assign(process.env, env0);
  });

  const inscrire = async (prenom: string, telephone: string, mode = MODE_CARTE) => {
    const r = await call('adhesion', {
      httpMethod: 'POST',
      body: JSON.stringify({
        prenom, nom: 'Enligne', telephone, email: `${prenom.toLowerCase()}@exemple.fr`,
        date_naissance: '01/02/1960', mode_paiement: mode, droit_image: 'Oui', qs_sport: 'Oui',
      }),
    });
    expect(r.statusCode, r.body).toBe(200);
    return json(r);
  };
  const fiche = async (prenom: string) => {
    const auth = await call('bureau-auth', { httpMethod: 'POST', body: JSON.stringify({ password: process.env.BUREAU_PASSWORD }) });
    const H = { authorization: `Bearer ${json(auth).token}` };
    return json(await call('adhesions-pending', { httpMethod: 'GET', headers: H })).all.find((x: { prenom: string }) => x.prenom === prenom);
  };

  it('payé chez HelloAsso → à jour, mode carte, commande notée, référence gardée', async () => {
    const d = await inscrire('Lea', '0600000081');
    expect(referenceValide(d.reference)).toBe(true);
    expect(d.paiementUrl).toBe(`/api/paiement?ref=${d.reference}`);

    const go = await call('paiement', { httpMethod: 'GET', queryStringParameters: { ref: d.reference } });
    expect(go.statusCode).toBe(302);
    const id = Number(go.headers?.Location.split('/').pop());
    expect(ha.intentions.get(id)).toMatchObject({ metadata: { reference: d.reference }, payer: { firstName: 'Lea', lastName: 'Enligne' } });

    // Retour avant que le paiement soit autorisé : rien ne change.
    const tot = await call('paiement-retour', { httpMethod: 'GET', queryStringParameters: { ref: d.reference, checkoutIntentId: String(id) } });
    expect(tot.headers?.Location).toContain('paiement=attente');
    expect((await fiche('Lea')).statut).toBe('En attente');

    ha.payes.add(id);
    const ret = await call('paiement-retour', { httpMethod: 'GET', queryStringParameters: { ref: d.reference, checkoutIntentId: String(id) } });
    expect(ret.statusCode).toBe(302);
    expect(ret.headers?.Location).toBe(`/inscription?ok=1&mode=carte&paiement=ok&ref=${d.reference}`);
    const a = await fiche('Lea');
    expect(a.statut).toBe('À jour');
    expect(a.mode).toBe(MODE_CARTE);
    expect(JSON.stringify(a)).toContain(`commande ${9000 + id} · Réf. ${d.reference}`);

    // La notification qui arrive ensuite ne refait rien.
    const n = await call('paiement-notification', {
      httpMethod: 'POST',
      body: JSON.stringify({ eventType: 'Order', data: { checkoutIntentId: id }, metadata: { reference: d.reference } }),
    });
    expect(json(n)).toEqual({ ok: true, etat: 'paye' });
  }, 60_000);

  it('un identifiant de paiement d’une autre demande ne valide rien', async () => {
    const payeuse = await inscrire('Ines', '0600000082');
    const autre = await inscrire('Zoe', '0600000083');
    const go = await call('paiement', { httpMethod: 'GET', queryStringParameters: { ref: payeuse.reference } });
    const id = Number(go.headers?.Location.split('/').pop());
    ha.payes.add(id);
    const triche = await call('paiement-retour', { httpMethod: 'GET', queryStringParameters: { ref: autre.reference, checkoutIntentId: String(id) } });
    expect(triche.headers?.Location).toContain('paiement=attente');
    expect((await fiche('Zoe')).statut).toBe('En attente');
  }, 60_000);

  it('onglet fermé, pas de notification : le rattrapage horaire valide quand même', async () => {
    const { rattraper } = await import('../netlify/functions/paiement-rattrapage.mjs');
    const d = await inscrire('Rose', '0600000084');
    const go = await call('paiement', { httpMethod: 'GET', queryStringParameters: { ref: d.reference } });
    ha.payes.add(Number(go.headers?.Location.split('/').pop()));
    const bilan = await rattraper();
    expect(bilan.payes).toBeGreaterThanOrEqual(1);
    expect(bilan.erreurs).toBe(0);
    expect((await fiche('Rose')).statut).toBe('À jour');
    // Déjà réglée : le lien ne rouvre pas de paiement.
    const encore = await call('paiement', { httpMethod: 'GET', queryStringParameters: { ref: d.reference } });
    expect(encore.headers?.Location).toContain('paiement=deja');
  }, 60_000);

  it('virement : pas de lien de paiement, la référence est dans la fiche', async () => {
    const d = await inscrire('Vera', '0600000085', 'Virement');
    expect(d.paiementUrl).toBeUndefined();
    expect(referenceValide(d.reference)).toBe(true);
    const a = await fiche('Vera');
    expect(a.statut).toBe('En attente');
    expect(JSON.stringify(a)).toContain(d.reference);
  }, 60_000);

  it('référence inconnue ou mal formée : retour propre sur /inscription', async () => {
    const r = await call('paiement', { httpMethod: 'GET', queryStringParameters: { ref: 'n’importe quoi' } });
    expect(r.headers?.Location).toContain('paiement=introuvable');
    const n = await call('paiement-notification', { httpMethod: 'POST', body: JSON.stringify({ eventType: 'Form', data: {} }) });
    expect(n.statusCode).toBe(200);
  });
});
