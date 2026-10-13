/**
 * Liste d’attente (modules.listeAttente).
 * GET  action=etat|files|claim
 * POST action=inscrire|notifier|liberer|claim
 */

import { MODULES } from '../../asso.derive.js';
import {
  apercuClaim,
  etatPlace,
  inscrireFile,
  lireFile,
  notifierSuivant,
  reclamer,
} from './_liste-attente.mjs';
import {
  assertBrowserOrigin,
  clientIp,
  consumeRateLimit,
  handleOptions,
  json,
  moduleOff,
  pickValue,
  requireAuth,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('listeAttente');
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
  const action = String(q.action || body.action || (event.httpMethod === 'GET' ? 'etat' : 'inscrire')).trim();

  if (action === 'etat') {
    const type = String(q.type || body.type || 'essai');
    const cours = String(q.cours || body.cours || '');
    const creneau = String(q.creneau || body.creneau || '');
    return json(200, await etatPlace({ type, cours, creneau }));
  }

  if (action === 'claim' && event.httpMethod === 'GET') {
    const token = String(q.t || q.token || '');
    const r = await apercuClaim(token);
    if (!r.ok && !r.deja) return json(r.status || 400, { error: r.error, expire: Boolean(r.expire) });
    return json(200, { ok: true, prenom: r.prenom, cours: r.cours, deja: Boolean(r.deja), type: r.type, expireLe: r.expireLe });
  }

  if (action === 'claim' && event.httpMethod === 'POST') {
    const originCheck = assertBrowserOrigin(event);
    if (!originCheck.ok) return json(originCheck.status, { error: originCheck.error });
    if (!consumeRateLimit(`liste:${clientIp(event)}`, 12, 10 * 60 * 1000).ok) {
      return json(429, { error: 'Trop de tentatives.' });
    }
    const token = pickValue(body, 'token', 't');
    const r = await reclamer(token, event);
    if (!r.ok && !r.deja) return json(r.status || 400, { error: r.error });
    return json(200, { ok: true, prenom: r.prenom, cours: r.cours, deja: Boolean(r.deja), type: r.type });
  }

  const auth = requireAuth(event, { roles: ['admin', 'seance'] });
  if (!auth.ok) return auth.response;

  if (action === 'files') {
    const { lignes } = await lireFile();
    return json(200, { files: lignes, mail: MODULES.mail });
  }

  if (action === 'inscrire') {
    const row = await inscrireFile(
      {
        type: pickValue(body, 'type') || 'essai',
        cours: pickValue(body, 'cours'),
        creneau: pickValue(body, 'creneau'),
        prenom: pickValue(body, 'prenom'),
        nom: pickValue(body, 'nom'),
        tel: pickValue(body, 'tel', 'telephone'),
        mail: pickValue(body, 'mail', 'email'),
      },
      event,
    );
    return json(200, { ok: true, ...row });
  }

  if (action === 'notifier' || action === 'liberer') {
    const r = await notifierSuivant(
      {
        type: pickValue(body, 'type') || q.type || 'essai',
        cours: pickValue(body, 'cours') || q.cours,
        creneau: pickValue(body, 'creneau') || q.creneau,
      },
      event,
    );
    return json(r.ok ? 200 : 200, r);
  }

  return json(400, { error: 'Action inconnue.' });
}

export { handler as traiter };
export default versV2(handler);
