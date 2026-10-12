/**
 * Attestations PDF (modules.attestations).
 * GET  action=types|ouvrir|pdf|adherents
 * POST action=ouvrir|lien
 */

import { ASSO, MODULES, SITE_URL } from '../../asso.derive.js';
import {
  attestationPdf,
  estAJour,
  expireDans,
  fichePublique,
  foldMail,
  foldNumero,
  libelleType,
  nomFichier,
  recuFiscalEligible,
  secretAttestations,
  signerAcces,
  trouverAdherent,
  typesDisponibles,
  urlMagique,
  verifierAcces,
} from '../../src/lib/attestations.js';
import {
  assertBrowserOrigin,
  clientIp,
  consumeRateLimit,
  getAdherentsSheetId,
  getAdherentsTab,
  handleOptions,
  json,
  moduleOff,
  pickRow,
  pickValue,
  readSheetAsObjects,
  requireAuth,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { envoyerMail, modeEnvoi } from './_envoi.mjs';
import { versV2 } from './_v2.mjs';

function basePublique(event) {
  if (process.env.DEMO === '1') {
    const origin = String(event?.headers?.origin || '').replace(/\/+$/, '');
    if (origin && /^https?:\/\//i.test(origin)) return origin;
    const host = String(event?.headers?.host || '').split(',')[0].trim();
    if (host) return `http://${host}`;
  }
  return SITE_URL;
}

async function adherents() {
  const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
  return rows;
}

function accesDepuis(q, body) {
  return {
    numero: foldNumero(q.n || q.numero || body.numero || body.n),
    mail: foldMail(q.m || q.mail || q.email || body.mail || body.email || body.m),
    exp: String(q.x || q.exp || body.exp || body.x || ''),
    token: String(q.t || q.token || body.token || body.t || ''),
  };
}

function pdfReponse(type, fiche) {
  const pdf = attestationPdf(type, { asso: ASSO, fiche });
  const numero = foldNumero(pickRow(fiche, 'NUMERO', 'Numero') || '');
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomFichier(type, numero)}"`,
      'Cache-Control': 'no-store',
    },
    body: pdf.toString('base64'),
    isBase64Encoded: true,
  };
}

async function ficheParNumeroMail(numero, mail) {
  const rows = await adherents();
  return trouverAdherent(rows, numero, mail);
}

async function envoyerLien({ numero, mail }, event) {
  const fiche = await ficheParNumeroMail(numero, mail);
  if (!fiche || !estAJour(fiche)) return { ok: false, error: 'Numéro ou e-mail introuvable.', status: 404 };
  const secret = secretAttestations();
  const exp = expireDans(168);
  const token = signerAcces({ numero, mail, exp }, secret);
  const url = urlMagique(basePublique(event), { numero, mail, exp, token });
  const prenom = pickRow(fiche, 'PRENOM', 'Prenom') || '';
  let mailOk = false;
  const mode = modeEnvoi();
  const sujet = `${ASSO.nomCourt || ASSO.nom} — vos attestations`;
  const text = `Bonjour ${prenom},

Voici le lien pour télécharger vos attestations (${ASSO.saison.label}) :

${url}

Le lien reste valable 7 jours. Personne d’autre ne doit l’ouvrir.
${ASSO.nom}`;
  if (mail && mode) {
    try {
      await envoyerMail({ to: mail, subject: sujet, text });
      mailOk = true;
    } catch {
      mailOk = false;
    }
  } else if (process.env.DEMO === '1') {
    mailOk = true;
  }
  return { ok: true, url, mailOk, prenom };
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('attestations');
  if (off) return off;

  const q = event.queryStringParameters || {};
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { error: 'Requête illisible.' });
    }
  }
  const action = String(q.action || body.action || (event.httpMethod === 'GET' ? 'types' : 'ouvrir')).trim();

  if (action === 'types') {
    return json(200, {
      docs: typesDisponibles(ASSO).map((id) => ({ id, label: libelleType(id) })),
      recuFiscal: recuFiscalEligible(ASSO),
    });
  }

  if (action === 'ouvrir' && event.httpMethod === 'POST') {
    const originCheck = assertBrowserOrigin(event);
    if (!originCheck.ok) return json(originCheck.status, { error: originCheck.error });
    if (!consumeRateLimit(`att-ouv:${clientIp(event)}`, 12, 10 * 60 * 1000).ok) {
      return json(429, { error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    }
    const numero = foldNumero(pickValue(body, 'numero', 'n'));
    const mail = foldMail(pickValue(body, 'mail', 'email'));
    const fiche = await ficheParNumeroMail(numero, mail);
    if (!fiche || !estAJour(fiche)) return json(404, { error: 'Numéro ou e-mail introuvable.' });
    const secret = secretAttestations();
    const exp = expireDans(2);
    const token = signerAcces({ numero, mail, exp }, secret);
    const p = fichePublique(fiche, ASSO);
    return json(200, {
      ok: true,
      prenom: p.prenom,
      numero: p.numero,
      exp,
      token,
      docs: typesDisponibles(ASSO).map((id) => ({ id, label: libelleType(id) })),
    });
  }

  if (action === 'lien' && event.httpMethod === 'POST') {
    const originCheck = assertBrowserOrigin(event);
    if (!originCheck.ok) return json(originCheck.status, { error: originCheck.error });
    const auth = requireAuth(event, { roles: ['admin', 'seance'] });
    if (!auth.ok) {
      if (!consumeRateLimit(`att-lien:${clientIp(event)}`, 6, 10 * 60 * 1000).ok) {
        return json(429, { error: 'Trop de tentatives.' });
      }
    }
    const numero = foldNumero(pickValue(body, 'numero', 'n'));
    let mail = foldMail(pickValue(body, 'mail', 'email'));
    if (auth.ok && numero && !mail) {
      const rows = await adherents();
      const f = rows.find((r) => foldNumero(pickRow(r, 'NUMERO', 'Numero')) === numero);
      mail = foldMail(pickRow(f || {}, 'MAIL', 'Mail', 'EMAIL'));
    }
    const r = await envoyerLien({ numero, mail }, event);
    if (!r.ok) return json(r.status || 400, { error: r.error });
    return json(200, r);
  }

  if (action === 'pdf') {
    const type = String(q.type || body.type || 'adhesion').trim();
    if (!typesDisponibles(ASSO).includes(type)) {
      return json(404, { error: type === 'fiscal' ? 'Reçu fiscal non proposé.' : 'Document inconnu.' });
    }
    const acces = accesDepuis(q, body);
    const bureau = requireAuth(event, { roles: ['admin', 'seance'] });
    if (bureau.ok && acces.numero && !acces.token) {
      const rows = await adherents();
      const fiche = rows.find((r) => foldNumero(pickRow(r, 'NUMERO', 'Numero')) === acces.numero);
      if (!fiche) return json(404, { error: 'Adhérent introuvable.' });
      return pdfReponse(type, fiche);
    }
    const secret = secretAttestations();
    if (!verifierAcces(acces, secret)) return json(403, { error: 'Lien invalide ou expiré.' });
    const fiche = await ficheParNumeroMail(acces.numero, acces.mail);
    if (!fiche || !estAJour(fiche)) return json(404, { error: 'Numéro ou e-mail introuvable.' });
    return pdfReponse(type, fiche);
  }

  if (action === 'adherents') {
    const auth = requireAuth(event, { roles: ['admin', 'seance'] });
    if (!auth.ok) return auth.response;
    const rows = await adherents();
    const liste = rows
      .filter((r) => estAJour(r) && pickRow(r, 'NUMERO', 'Numero'))
      .map((r) => ({
        numero: foldNumero(pickRow(r, 'NUMERO', 'Numero')),
        prenom: pickRow(r, 'PRENOM', 'Prenom') || '',
        nom: pickRow(r, 'NOM', 'Nom') || '',
        mail: foldMail(pickRow(r, 'MAIL', 'Mail', 'EMAIL')),
      }));
    return json(200, { adherents: liste, docs: typesDisponibles(ASSO).map((id) => ({ id, label: libelleType(id) })), recuFiscal: recuFiscalEligible(ASSO), mail: MODULES.mail });
  }

  return json(400, { error: 'Action inconnue.' });
}

export { handler as traiter };
export default versV2(handler);
