/**
 * Alertes de dernière minute (modules.alertes).
 * GET  action=liste|vapid  (public) ; action=toutes (bureau)
 * POST action=abo|desabo (public) ; action=creer (bureau)
 * DELETE id=… (bureau)
 */

import { ASSO, MODULES, SITE_URL } from '../../asso.derive.js';
import {
  ALERTES_ABOS_HEADERS,
  ALERTES_HEADERS,
  alerteActive,
  emailValide,
  expireLe,
  libelleType,
  messageAlerteMail,
  nouvelIdAlerte,
  ONGLET_ALERTES,
  ONGLET_ALERTES_ABOS,
  payloadPush,
  secretAlertes,
  tokenDesabonnement,
  typeAlerte,
  verifierTokenDesabonnement,
} from '../../src/lib/alertes.js';
import { parisYmd } from '../../src/lib/presence.js';
import {
  assertBrowserOrigin,
  clientIp,
  consumeRateLimit,
  handleOptions,
  json,
  moduleOff,
  nowParisIso,
  pickValue,
  requireAuth,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { DEMO } from './_demo.mjs';
import { ajouterLigneSite, lireOngletSite, remplacerOngletSite } from './_onglet.mjs';
import { envoyerMail, modeEnvoi } from './_envoi.mjs';

function vapidPublic(env = process.env) {
  return String(env.VAPID_PUBLIC_KEY || '').trim();
}

function alertePublique(l) {
  return {
    id: l.ID,
    date: l.DATE,
    session: l.SESSION,
    cours: l.COURS,
    type: typeAlerte(l.TYPE),
    libelle: libelleType(typeAlerte(l.TYPE)),
    message: l.MESSAGE,
    expireLe: l.EXPIRE_LE,
  };
}

async function envoyerPushReel(abonnement, payload) {
  if (DEMO) return { ok: true, mode: 'demo' };
  const pub = vapidPublic();
  const priv = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pub || !priv || !abonnement) return { ok: false, mode: 'aucun' };
  try {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(`mailto:${ASSO.email}`, pub, priv);
    const sub = typeof abonnement === 'string' ? JSON.parse(abonnement) : abonnement;
    if (!sub?.endpoint) return { ok: false, mode: 'aucun' };
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return { ok: true, mode: 'push' };
  } catch {
    return { ok: false, mode: 'echec' };
  }
}

async function notifierAbonnes(alerte) {
  const { lignes } = await lireOngletSite(ONGLET_ALERTES_ABOS, ALERTES_ABOS_HEADERS);
  const actifs = lignes.filter((l) => String(l.ACTIF || 'oui').toLowerCase() !== 'non' && String(l.CONSENT).toLowerCase() === 'oui');
  const mode = modeEnvoi();
  const secret = secretAlertes();
  let mails = 0;
  let push = 0;
  for (const abo of actifs) {
    const token = abo.TOKEN || tokenDesabonnement(abo.MAIL, secret);
    const urlDesabo = `${SITE_URL}/alertes/desabo?t=${encodeURIComponent(token)}`;
    const msg = messageAlerteMail(ASSO, alerte, urlDesabo);
    if (mode && abo.MAIL) {
      try {
        await envoyerMail({ to: abo.MAIL, subject: msg.subject, text: msg.text });
        mails += 1;
      } catch {
        // on continue les autres
      }
    }
    if (abo.PUSH) {
      const r = await envoyerPushReel(abo.PUSH, payloadPush(ASSO, alerte));
      if (r.ok) push += 1;
    }
  }
  return { abonnes: actifs.length, mails, push, mode: mode || 'aucun' };
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('alertes');
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
  const action = String(q.action || body.action || '').trim();
  const method = event.httpMethod;

  if (method === 'GET' && (action === 'liste' || action === '' || action === 'publiques')) {
    const { lignes } = await lireOngletSite(ONGLET_ALERTES, ALERTES_HEADERS);
    const today = parisYmd();
    const actives = lignes.filter((l) => alerteActive(l, today)).map(alertePublique);
    return json(200, { alertes: actives });
  }

  if (method === 'GET' && action === 'vapid') {
    const pub = vapidPublic();
    return json(200, { publicKey: pub || '', push: Boolean(pub) && !DEMO });
  }

  if (method === 'POST' && action === 'abo') {
    const originCheck = assertBrowserOrigin(event);
    if (!originCheck.ok) return json(originCheck.status, { error: originCheck.error });
    if (!consumeRateLimit(`alertes-abo:${clientIp(event)}`, 8, 10 * 60 * 1000).ok) {
      return json(429, { error: 'Trop de demandes. Réessayez dans quelques minutes.' });
    }
    if (pickValue(body, 'bot-field')) return json(200, { ok: true });
    const mail = pickValue(body, 'mail', 'email').toLowerCase();
    const consent = body.consent === true || String(body.consent || '').toLowerCase() === 'oui';
    if (!emailValide(mail)) return json(400, { error: 'Adresse e-mail invalide.' });
    if (!consent) return json(400, { error: 'Cochez la case pour recevoir les alertes.' });
    const { lignes } = await lireOngletSite(ONGLET_ALERTES_ABOS, ALERTES_ABOS_HEADERS);
    const secret = secretAlertes();
    const token = tokenDesabonnement(mail, secret);
    const push = body.push ? JSON.stringify(body.push) : '';
    const existant = lignes.find((l) => String(l.MAIL || '').trim().toLowerCase() === mail);
    if (existant) {
      const maj = lignes.map((l) =>
        String(l.MAIL || '').trim().toLowerCase() === mail
          ? { ...l, CONSENT: 'oui', DATE: nowParisIso(), TOKEN: token, PUSH: push || l.PUSH, ACTIF: 'oui' }
          : l,
      );
      await remplacerOngletSite(ONGLET_ALERTES_ABOS, ALERTES_ABOS_HEADERS, maj);
    } else {
      await ajouterLigneSite(ONGLET_ALERTES_ABOS, ALERTES_ABOS_HEADERS, {
        MAIL: mail,
        CONSENT: 'oui',
        DATE: nowParisIso(),
        TOKEN: token,
        PUSH: push,
        ACTIF: 'oui',
      });
    }
    return json(200, { ok: true, token });
  }

  if ((method === 'POST' || method === 'GET') && (action === 'desabo' || q.t || body.token)) {
    const token = String(q.t || body.token || '').trim();
    if (!token) return json(400, { error: 'Lien incomplet.' });
    const { lignes } = await lireOngletSite(ONGLET_ALERTES_ABOS, ALERTES_ABOS_HEADERS);
    const secret = secretAlertes();
    const cible = lignes.find((l) => l.TOKEN === token || verifierTokenDesabonnement(l.MAIL, token, secret));
    if (!cible) return json(404, { error: 'Abonnement introuvable. Peut-être déjà retiré.' });
    const maj = lignes.map((l) => (l === cible || l.TOKEN === cible.TOKEN ? { ...l, ACTIF: 'non', PUSH: '' } : l));
    await remplacerOngletSite(ONGLET_ALERTES_ABOS, ALERTES_ABOS_HEADERS, maj);
    return json(200, { ok: true, mail: cible.MAIL });
  }

  const auth = requireAuth(event, { roles: ['admin'] });
  if (!auth.ok) return auth.response;

  if (method === 'GET' && action === 'toutes') {
    const { lignes } = await lireOngletSite(ONGLET_ALERTES, ALERTES_HEADERS);
    const { lignes: abos } = await lireOngletSite(ONGLET_ALERTES_ABOS, ALERTES_ABOS_HEADERS);
    const today = parisYmd();
    return json(200, {
      alertes: lignes.map((l) => ({ ...alertePublique(l), creeeLe: l.CREEE_LE, active: alerteActive(l, today) })),
      abonnes: abos.filter((a) => String(a.ACTIF || 'oui').toLowerCase() !== 'non').length,
      mail: Boolean(modeEnvoi()),
      mailModule: Boolean(MODULES.mail),
      push: Boolean(vapidPublic()) && !DEMO,
    });
  }

  if (method === 'POST' && (action === 'creer' || action === '')) {
    const type = typeAlerte(pickValue(body, 'type'));
    const date = pickValue(body, 'date');
    const cours = pickValue(body, 'cours');
    const message = pickValue(body, 'message');
    const session = pickValue(body, 'session');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: 'Indiquez la date du cours (AAAA-MM-JJ).' });
    if (!cours) return json(400, { error: 'Indiquez le cours.' });
    if (!message || message.length > 400) return json(400, { error: 'Un court message est obligatoire (400 caractères max).' });
    const alerte = {
      ID: nouvelIdAlerte(),
      DATE: date,
      SESSION: session,
      COURS: cours,
      TYPE: type,
      MESSAGE: message,
      CREEE_LE: nowParisIso(),
      EXPIRE_LE: expireLe(date),
    };
    await ajouterLigneSite(ONGLET_ALERTES, ALERTES_HEADERS, alerte);
    const notif = await notifierAbonnes(alerte);
    return json(200, { ok: true, alerte: alertePublique(alerte), notification: notif });
  }

  if (method === 'DELETE' || action === 'supprimer') {
    const id = String(q.id || body.id || '').trim();
    if (!id) return json(400, { error: 'Alerte manquante.' });
    const { lignes } = await lireOngletSite(ONGLET_ALERTES, ALERTES_HEADERS);
    const reste = lignes.filter((l) => l.ID !== id);
    if (reste.length === lignes.length) return json(404, { error: 'Alerte introuvable.' });
    await remplacerOngletSite(ONGLET_ALERTES, ALERTES_HEADERS, reste);
    return json(200, { ok: true });
  }

  return json(400, { error: 'Action inconnue.' });
}

export { handler as traiter };
export default versV2(handler);
