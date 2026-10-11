/**
 * Mail bureau — Gmail API (lecture + réponse dans le fil)
 * Routes via path :
 *   GET  /api/bureau/mail/list
 *   GET  /api/bureau/mail/:id
 *   POST /api/bureau/mail/:id/reply
 */

import { handleOptions, json, moduleOff, requireAuth } from './_bureau-lib.mjs';
import {
  ASSO_GMAIL,
  ensureReSubject,
  extractMessageBody,
  getMessageHeaders,
  gmailApi,
  googleErrorMessage,
  toBase64Url,
} from './_google-user.mjs';

function parseMailPath(event) {
  const candidates = [
    event.path,
    event.rawPath,
    event.rawUrl,
    event.headers?.['x-forwarded-uri'],
    event.headers?.['x-original-path'],
  ]
    .filter(Boolean)
    .map(String);
  let rest = '';
  for (const raw of candidates) {
    for (const m of ['/api/bureau/mail', '/.netlify/functions/bureau-mail']) {
      const i = raw.indexOf(m);
      if (i >= 0) {
        rest = raw.slice(i + m.length).split('?')[0];
        break;
      }
    }
    if (rest) break;
  }
  const parts = rest.split('/').filter(Boolean);
  const q = event.queryStringParameters || {};
  return { parts, q };
}

/** Le bureau ne lit et ne répond qu’aux messages de la boîte de réception (pas envoyés, archives, brouillons). */
export function isInboxMessage(msg) {
  return Array.isArray(msg?.labelIds) && msg.labelIds.includes('INBOX');
}

const NOT_IN_INBOX = { error: 'Ce message n’est pas dans la boîte de réception.' };

async function gmailClient() {
  return gmailApi();
}

function formatListItem(msg) {
  const headers = getMessageHeaders(msg.payload);
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: headers.from || '',
    subject: headers.subject || '(sans objet)',
    date: headers.date || '',
    snippet: msg.snippet || '',
  };
}

async function handleList(event) {
  const pageToken = event.queryStringParameters?.pageToken || undefined;
  const gmail = await gmailClient();
  const list = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 20,
    pageToken,
    q: 'in:inbox',
  });
  const ids = list.data.messages || [];
  const messages = await Promise.all(
    ids.map(async (m) => {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      return formatListItem(full.data);
    }),
  );
  return json(200, {
    messages,
    nextPageToken: list.data.nextPageToken || null,
  });
}

async function handleGet(id) {
  const gmail = await gmailClient();
  const full = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full',
  });
  if (!isInboxMessage(full.data)) return json(404, NOT_IN_INBOX);
  const headers = getMessageHeaders(full.data.payload);
  const { text } = extractMessageBody(full.data.payload);
  return json(200, {
    id: full.data.id,
    threadId: full.data.threadId,
    from: headers.from || '',
    to: headers.to || '',
    subject: headers.subject || '(sans objet)',
    date: headers.date || '',
    text,
    messageId: headers['message-id'] || '',
    references: headers.references || '',
  });
}

function encodeMimeSubject(raw) {
  const s = String(raw || '').trim();
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function extractEmailAddress(fromHeader) {
  const s = String(fromHeader || '');
  const m = s.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  if (/^[^\s@]+@[^\s@]+$/.test(s.trim())) return s.trim();
  return '';
}

async function handleReply(id, body) {
  const text = String(body?.text || '').trim();
  if (!text) {
    return json(400, { error: 'Écrivez un message avant d’envoyer.' });
  }
  if (text.length > 20000) {
    return json(400, { error: 'Réponse trop longue.' });
  }

  const gmail = await gmailClient();
  const original = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Message-ID', 'References', 'Reply-To'],
  });
  if (!isInboxMessage(original.data)) return json(404, NOT_IN_INBOX);
  const headers = getMessageHeaders(original.data.payload);
  const to =
    extractEmailAddress(headers['reply-to']) || extractEmailAddress(headers.from);
  if (!to) {
    return json(400, { error: 'Impossible de trouver l’adresse de réponse.' });
  }

  const subject = encodeMimeSubject(ensureReSubject(headers.subject));
  const messageId = headers['message-id'] || '';
  const prevRefs = headers.references || '';
  const references = [prevRefs, messageId].filter(Boolean).join(' ').trim();

  const mimeLines = [
    `From: ${ASSO_GMAIL}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  if (messageId) mimeLines.push(`In-Reply-To: ${messageId}`);
  if (references) mimeLines.push(`References: ${references}`);
  mimeLines.push('', text);

  const raw = toBase64Url(mimeLines.join('\r\n'));
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: original.data.threadId,
    },
  });

  return json(200, { ok: true, message: 'Réponse envoyée.' });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('mail');
  if (off) return off;

  const auth = requireAuth(event);
  if (!auth.ok) return auth.response;

  const { parts } = parseMailPath(event);

  try {
    if (event.httpMethod === 'GET' && (parts[0] === 'list' || parts.length === 0)) {
      return await handleList(event);
    }
    if (event.httpMethod === 'GET' && parts[0] && parts[1] !== 'reply') {
      return await handleGet(parts[0]);
    }
    if (event.httpMethod === 'POST' && parts[0] && parts[1] === 'reply') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return json(400, { error: 'JSON invalide' });
      }
      return await handleReply(parts[0], body);
    }
    return json(404, { error: 'Route mail inconnue.' });
  } catch (err) {
    console.error('bureau-mail', err?.message || err);
    return json(502, { error: googleErrorMessage(err) });
  }
}
