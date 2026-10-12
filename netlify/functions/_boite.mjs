/**
 * Boîte mail de l'asso lue dans /bureau (module `mail`), quel que soit le fournisseur :
 *
 *   imap  : la boîte de l'asso (OVH, Gandi, Infomaniak, Orange, Free, Gmail…).
 *           IMAP_HOST, IMAP_PORT (993 par défaut), IMAP_USER et IMAP_PASS (sinon ceux du SMTP).
 *   gmail : compte Google de l'asso connecté (GOOGLE_REFRESH_TOKEN), comme avant.
 *
 * Choix : MAIL_BOITE=imap|gmail, sinon imap si IMAP_HOST est présent, sinon gmail si connecté.
 * En démo : faux Gmail (bureau-mail.mjs). Les réponses partent par envoyerMail() (_envoi.mjs),
 * avec une copie dans « Envoyés » (IMAP). Voir docs/DOC-MAIL.md.
 * Ne jamais logger un mot de passe ni le corps des mails.
 */

import { ImapFlow } from 'imapflow';
import { ASSO } from '../../asso.derive.js';
import { DEMO } from './_demo.mjs';
import { adresseAsso, envoyerMail, messageBrut, modeEnvoi } from './_envoi.mjs';

export const MODES_BOITE = ['imap', 'gmail'];
const v = (env, k) => String(env[k] || '').trim();

export function modeBoite(env = process.env, demo = DEMO) {
  if (demo) return 'gmail';
  const choix = v(env, 'MAIL_BOITE').toLowerCase();
  if (MODES_BOITE.includes(choix)) return choix;
  if (v(env, 'IMAP_HOST')) return 'imap';
  if (v(env, 'GOOGLE_REFRESH_TOKEN')) return 'gmail';
  return null;
}

/** Réglages IMAP ; identifiants du SMTP par défaut (c'est presque toujours la même boîte). */
export function reglagesImap(env = process.env) {
  const port = Number(v(env, 'IMAP_PORT')) || 993;
  return {
    host: v(env, 'IMAP_HOST'),
    port,
    secure: port === 993,
    auth: {
      user: v(env, 'IMAP_USER') || v(env, 'SMTP_USER') || adresseAsso(env),
      pass: String(env.IMAP_PASS || env.SMTP_PASS || ''),
    },
  };
}

const erreurLisible = (message, code = 502, cause) => Object.assign(new Error(message), { lisible: true, code, cause });

/** Message IMAP en clair pour le bureau (jamais le mot de passe). */
export function messageImap(err) {
  if (err?.lisible) return err.message;
  const code = String(err?.code || '');
  if (err?.authenticationFailed || /AUTHENTICATIONFAILED|LOGIN failed|Invalid credentials/i.test(String(err?.responseText || err?.message || ''))) {
    return 'La boîte mail refuse l’identifiant ou le mot de passe (IMAP_USER / IMAP_PASS). Avec Gmail ou Outlook, il faut un « mot de passe d’application ».';
  }
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'NoConnection'].includes(code) || /timeout/i.test(String(err?.message || ''))) {
    return 'Le serveur de la boîte mail ne répond pas. Vérifiez IMAP_HOST et IMAP_PORT (993).';
  }
  return 'La boîte mail n’a pas répondu correctement. Réessayez dans quelques minutes.';
}

/** Ouvre la boîte de réception, exécute fn, referme toujours. */
export async function avecBoite(fn, env = process.env, Client = ImapFlow) {
  const r = reglagesImap(env);
  if (!r.host) throw erreurLisible('La boîte mail n’est pas branchée (IMAP_HOST) : voir docs/DOC-MAIL.md.', 503);
  if (!r.auth.pass) throw erreurLisible('Mot de passe de la boîte manquant (IMAP_PASS ou SMTP_PASS) : voir docs/DOC-MAIL.md.', 503);
  const client = new Client({ ...r, logger: false, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 20000 });
  try {
    await client.connect();
  } catch (err) {
    throw erreurLisible(messageImap(err), 502, err);
  }
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      return await fn(client);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close?.());
  }
}

/** Identifiant stable d'un message : « <UIDVALIDITY>.<UID> ». */
export const idMessage = (uidValidity, uid) => `${uidValidity}.${uid}`;
export function lireId(id, uidValidity) {
  const m = /^(\d+)\.(\d+)$/.exec(String(id || ''));
  if (!m || String(m[1]) !== String(uidValidity)) {
    throw erreurLisible('Ce message n’est plus dans la boîte. Appuyez sur Actualiser.', 404);
  }
  return Number(m[2]);
}

const adresse = (a) => (a ? (a.name ? `${a.name} <${a.address}>` : a.address || '') : '');
const dateMail = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toUTCString() : String(d || ''));

/** Partie texte d'un message (text/plain d'abord, sinon text/html), hors pièces jointes. */
export function partieTexte(noeud) {
  const parties = [];
  const parcourir = (n) => {
    if (!n) return;
    if (Array.isArray(n.childNodes) && n.childNodes.length) {
      n.childNodes.forEach(parcourir);
      return;
    }
    if (n.disposition === 'attachment') return;
    if (n.type === 'text/plain' || n.type === 'text/html') parties.push(n);
  };
  parcourir(noeud);
  const p = parties.find((x) => x.type === 'text/plain') || parties.find((x) => x.type === 'text/html');
  return p ? { part: p.part || '1', html: p.type === 'text/html' } : null;
}

export function texteDepuisHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function texteMessage(client, uid, structure, maxBytes) {
  const p = partieTexte(structure);
  if (!p) return '';
  const { content } = await client.download(String(uid), p.part, { uid: true, ...(maxBytes ? { maxBytes } : {}) });
  const morceaux = [];
  for await (const c of content) morceaux.push(Buffer.from(c));
  const brut = Buffer.concat(morceaux).toString('utf8');
  return p.html ? texteDepuisHtml(brut) : brut.trim();
}

/** 20 messages par page, du plus récent au plus ancien. pageToken = numéro de séquence où reprendre. */
export function pageSequence(total, pageToken, taille = 20) {
  const fin = Math.min(total, Number(pageToken) || total);
  if (fin < 1) return null;
  const debut = Math.max(1, fin - taille + 1);
  return { plage: `${debut}:${fin}`, suivante: debut > 1 ? String(debut - 1) : null };
}

export async function listerImap({ pageToken } = {}, env = process.env, Client = ImapFlow) {
  return avecBoite(async (client) => {
    const page = pageSequence(client.mailbox.exists, pageToken);
    if (!page) return { messages: [], nextPageToken: null };
    const lus = [];
    for await (const m of client.fetch(page.plage, { uid: true, envelope: true, bodyStructure: true })) lus.push(m);
    lus.sort((a, b) => b.seq - a.seq);
    const messages = [];
    for (const m of lus) {
      let snippet = '';
      try {
        snippet = (await texteMessage(client, m.uid, m.bodyStructure, 2048)).replace(/\s+/g, ' ').slice(0, 200);
      } catch {
        // aperçu facultatif
      }
      messages.push({
        id: idMessage(client.mailbox.uidValidity, m.uid),
        threadId: idMessage(client.mailbox.uidValidity, m.uid),
        from: adresse(m.envelope?.from?.[0]),
        subject: m.envelope?.subject || '(sans objet)',
        date: dateMail(m.envelope?.date),
        snippet,
      });
    }
    return { messages, nextPageToken: page.suivante };
  }, env, Client);
}

async function enveloppe(client, uid) {
  const m = await client.fetchOne(String(uid), { uid: true, envelope: true, bodyStructure: true, headers: ['references'] }, { uid: true });
  if (!m) throw erreurLisible('Ce message n’est plus dans la boîte. Appuyez sur Actualiser.', 404);
  const refs = /^references:\s*([\s\S]*)$/im.exec(Buffer.from(m.headers || '').toString('utf8'))?.[1]?.replace(/\s+/g, ' ').trim() || '';
  return { m, refs };
}

export async function lireImap(id, env = process.env, Client = ImapFlow) {
  return avecBoite(async (client) => {
    const uid = lireId(id, client.mailbox.uidValidity);
    const { m, refs } = await enveloppe(client, uid);
    const text = await texteMessage(client, uid, m.bodyStructure);
    return {
      id,
      threadId: id,
      from: adresse(m.envelope?.from?.[0]),
      to: (m.envelope?.to || []).map(adresse).join(', '),
      subject: m.envelope?.subject || '(sans objet)',
      date: dateMail(m.envelope?.date),
      text,
      messageId: m.envelope?.messageId || '',
      references: refs,
    };
  }, env, Client);
}

export const sujetReponse = (s) => {
  const t = String(s || '').trim() || '(sans objet)';
  return /^re\s*:/i.test(t) ? t : `Re: ${t}`;
};

/** Répond dans le fil (In-Reply-To / References), marque « répondu », range une copie dans Envoyés. */
export async function repondreImap(id, texte, env = process.env, Client = ImapFlow) {
  return avecBoite(async (client) => {
    const uid = lireId(id, client.mailbox.uidValidity);
    const { m, refs } = await enveloppe(client, uid);
    const to = m.envelope?.replyTo?.[0]?.address || m.envelope?.from?.[0]?.address || '';
    if (!to) throw erreurLisible('Impossible de trouver l’adresse de réponse.', 400);
    const messageId = m.envelope?.messageId || '';
    const mail = {
      to,
      subject: sujetReponse(m.envelope?.subject),
      text: texte,
      ...(messageId ? { inReplyTo: messageId, references: [refs, messageId].filter(Boolean).join(' ') } : {}),
    };
    await envoyerMail(mail, env);
    await client.messageFlagsAdd(String(uid), ['\\Answered'], { uid: true }).catch(() => {});
    // Gmail range déjà ses envois ; ailleurs, on dépose la copie dans « Envoyés ».
    if (modeEnvoi(env) !== 'gmail' && !/^(non|0|false)$/i.test(v(env, 'IMAP_COPIE_ENVOYES'))) {
      try {
        const envoyes = (await client.list()).find((b) => b.specialUse === '\\Sent');
        if (envoyes) {
          const brut = await messageBrut({ from: { name: ASSO.nom, address: adresseAsso(env) }, ...mail });
          await client.append(envoyes.path, brut, ['\\Seen']);
        }
      } catch (err) {
        console.error('copie Envoyés', err?.code || err?.message || 'échec');
      }
    }
    return { ok: true };
  }, env, Client);
}
