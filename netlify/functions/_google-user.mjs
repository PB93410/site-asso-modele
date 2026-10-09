/**
 * OAuth utilisateur (compte Gmail asso) — distinct du compte de service Sheets.
 * Secrets : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 * Ne jamais logger le refresh token ni le corps des mails.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { google } from 'googleapis';
import { ASSO, SITE_URL } from '../../asso.derive.js';

/** Compte Google de l’association (Gmail, Agenda, Contacts) : ASSO_GMAIL ou asso.config.js → email. */
export const ASSO_GMAIL = process.env.ASSO_GMAIL || ASSO.email;

/** Nom affiché dans « From: », encodé en base64 si accents. */
export function mimeName(name) {
  const s = String(name || '').trim();
  if (/^[\x20-\x7E]*$/.test(s)) return `"${s.replace(/"/g, '')}"`;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts',
];

function getBureauHmacSecret() {
  const secret = process.env.BUREAU_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error('BUREAU_SECRET manquante ou trop courte');
  }
  return secret;
}

export function getOAuthRedirectUri() {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI.trim();
  }
  const origin = process.env.SITE_ORIGIN || SITE_URL;
  return `${origin.replace(/\/$/, '')}/api/bureau/google/callback`;
}

export function getOAuthClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquant — branchez le compte asso (voir DOC-BUREAU-GOOGLE.md).',
    );
  }
  return { clientId, clientSecret, redirectUri: getOAuthRedirectUri() };
}

export function createOAuth2Client(opts = {}) {
  const { clientId, clientSecret, redirectUri } = getOAuthClientConfig();
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  if (opts.refreshToken) {
    client.setCredentials({ refresh_token: opts.refreshToken });
  }
  return client;
}

/** Client prêt pour Gmail / Calendar (refresh token Netlify). */
export function getUserGoogleAuth() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      'GOOGLE_REFRESH_TOKEN manquant — le référent doit connecter le compte asso une fois.',
    );
  }
  return createOAuth2Client({ refreshToken });
}

export function getCalendarId() {
  return (process.env.GOOGLE_CALENDAR_ID || 'primary').trim() || 'primary';
}

export function createGoogleOAuthState() {
  const exp = Date.now() + 15 * 60 * 1000;
  const nonce = randomBytes(16).toString('hex');
  const payload = `goauth:${exp}:${nonce}`;
  const sig = createHmac('sha256', getBureauHmacSecret()).update(payload).digest('hex');
  return `${exp}.${nonce}.${sig}`;
}

export function verifyGoogleOAuthState(state) {
  if (!state || typeof state !== 'string') return false;
  const [expStr, nonce, sig] = state.split('.');
  if (!expStr || !nonce || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const payload = `goauth:${exp}:${nonce}`;
  let expected;
  try {
    expected = createHmac('sha256', getBureauHmacSecret()).update(payload).digest('hex');
  } catch {
    return false;
  }
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildConsentUrl(state) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: false,
    login_hint: ASSO_GMAIL,
  });
}

export function googleErrorMessage(err) {
  const msg = String(err?.message || err || '');
  const code = err?.code || err?.response?.status;
  if (code === 401 || /invalid_grant|invalid credentials|Token has been expired/i.test(msg)) {
    return 'Connexion Google expirée ou révoquée. Le référent doit reconnecter le compte asso.';
  }
  if (code === 403 || /insufficient|accessNotConfigured|Daily Limit/i.test(msg)) {
    return 'Accès Google refusé ou quota atteint. Vérifiez les API Gmail, Calendar et People (Contacts) dans Google Cloud.';
  }
  if (/GOOGLE_|manqu/i.test(msg)) {
    return msg;
  }
  return 'Google n’a pas répondu correctement. Réessayez dans quelques minutes.';
}

/** Base64url (Gmail raw). */
export function toBase64Url(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeBase64Url(data) {
  const pad = data.length % 4 === 0 ? '' : '='.repeat(4 - (data.length % 4));
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function headerMap(headers) {
  const map = {};
  for (const h of headers || []) {
    if (!h?.name) continue;
    map[String(h.name).toLowerCase()] = String(h.value || '');
  }
  return map;
}

function walkParts(part, acc) {
  if (!part) return;
  const mime = String(part.mimeType || '');
  const data = part.body?.data;
  if (data && mime === 'text/plain' && !acc.plain) {
    acc.plain = decodeBase64Url(data);
  }
  if (data && mime === 'text/html' && !acc.html) {
    acc.html = decodeBase64Url(data);
  }
  for (const child of part.parts || []) walkParts(child, acc);
}

export function extractMessageBody(payload) {
  const acc = { plain: '', html: '' };
  walkParts(payload, acc);
  if (acc.plain) return { text: acc.plain.trim(), htmlSafe: '' };
  if (acc.html) {
    const text = stripHtml(acc.html);
    return { text, htmlSafe: '' };
  }
  if (payload?.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    if (String(payload.mimeType || '').includes('html')) {
      return { text: stripHtml(raw), htmlSafe: '' };
    }
    return { text: raw.trim(), htmlSafe: '' };
  }
  return { text: '', htmlSafe: '' };
}

export function getMessageHeaders(payload) {
  return headerMap(payload?.headers);
}

export function ensureReSubject(subject) {
  const s = String(subject || '').trim() || '(sans objet)';
  if (/^re\s*:/i.test(s)) return s;
  return `Re: ${s}`;
}
