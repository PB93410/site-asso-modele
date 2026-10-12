/**
 * Envoi des mails du site (alertes essai et adhésion, cartes d'adhérent), quel que soit le fournisseur.
 *
 *   smtp  : la boîte mail de l'asso (OVH, Gandi, Infomaniak, Orange, Free, Gmail…).
 *           SMTP_HOST, SMTP_PORT (465 par défaut), SMTP_USER (sinon l'adresse de l'asso), SMTP_PASS.
 *   brevo : BREVO_API_KEY (offre gratuite, expéditeur validé dans Brevo).
 *   gmail : compte Google de l'asso connecté depuis /bureau (GOOGLE_REFRESH_TOKEN), comme avant.
 *
 * Choix : MAIL_ENVOI=smtp|brevo|gmail|aucun, sinon le premier configuré dans cet ordre.
 * Adresse de l'asso (expéditeur, et boîte qui reçoit les alertes) : MAIL_ASSO, sinon ASSO_GMAIL,
 * sinon asso.config.js → email. Voir docs/DOC-MAIL.md. Ne jamais logger un mot de passe ni le corps des mails.
 */

import nodemailer from 'nodemailer';
import { ASSO } from '../../asso.derive.js';
import { DEMO, demoGmail } from './_demo.mjs';

export const MODES_ENVOI = ['smtp', 'brevo', 'gmail'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const v = (env, k) => String(env[k] || '').trim();

/** Adresse de l'asso : expéditeur des mails et destinataire des alertes du bureau. */
export function adresseAsso(env = process.env) {
  return v(env, 'MAIL_ASSO') || v(env, 'ASSO_GMAIL') || ASSO.email;
}

/** Fournisseur utilisé pour envoyer, ou null si aucun n'est configuré. */
export function modeEnvoi(env = process.env, demo = DEMO) {
  if (demo) return 'demo';
  const choix = v(env, 'MAIL_ENVOI').toLowerCase();
  if (MODES_ENVOI.includes(choix)) return choix;
  if (choix === 'aucun') return null;
  if (v(env, 'SMTP_HOST')) return 'smtp';
  if (v(env, 'BREVO_API_KEY')) return 'brevo';
  if (v(env, 'GOOGLE_REFRESH_TOKEN')) return 'gmail';
  return null;
}

/** Erreur dont le message peut être montré tel quel au bureau. */
function erreurLisible(message, cause) {
  return Object.assign(new Error(message), { lisible: true, cause });
}

/** Message SMTP en clair pour le bureau (jamais le mot de passe). */
export function messageSmtp(err) {
  const code = String(err?.code || '');
  const rc = Number(err?.responseCode) || 0;
  if (code === 'EAUTH' || rc === 535 || rc === 534) {
    return 'La boîte mail refuse l’identifiant ou le mot de passe (SMTP_USER / SMTP_PASS). Avec Gmail ou Outlook, il faut un « mot de passe d’application ».';
  }
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND'].includes(code)) {
    return 'Le serveur de mail ne répond pas. Vérifiez SMTP_HOST et SMTP_PORT (465, ou 587).';
  }
  if (code === 'EENVELOPE' || rc === 550 || rc === 553 || rc === 554) {
    return 'Le serveur de mail refuse l’adresse d’expéditeur ou de destinataire. L’expéditeur doit être l’adresse de la boîte (MAIL_ASSO).';
  }
  return 'Le serveur de mail n’a pas accepté le message. Réessayez dans quelques minutes.';
}

/** Message Brevo en clair pour le bureau. */
export function messageBrevo(status, texte = '') {
  if (status === 401) return 'Clé Brevo refusée (BREVO_API_KEY). Créez-en une dans Brevo → SMTP & API.';
  if (status === 400 && /sender/i.test(texte)) {
    return 'Brevo refuse l’expéditeur : validez l’adresse de l’asso (ou son domaine) dans Brevo → Expéditeurs.';
  }
  if (status === 402 || status === 429) return 'Quota Brevo atteint pour aujourd’hui. Réessayez demain.';
  return 'Brevo n’a pas accepté le message. Réessayez dans quelques minutes.';
}

/** Message complet (MIME) : pour Gmail, et pour vérifier le contenu dans les tests. */
export async function messageBrut(m) {
  const t = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const info = await t.sendMail(m);
  return info.message;
}

/**
 * Envoie un mail depuis l'adresse de l'asso.
 * @param {{ to: string, subject: string, text: string, replyTo?: string,
 *   attachments?: { filename: string, content: Buffer, contentType?: string }[] }} mail
 * @returns {Promise<{ mode: string }>}  lève une erreur au message lisible (err.lisible) si l'envoi échoue.
 */
export async function envoyerMail(mail, env = process.env) {
  const mode = modeEnvoi(env);
  if (!mode) {
    throw erreurLisible('Aucun envoi de mail n’est configuré (SMTP, Brevo ou Gmail) : voir docs/DOC-MAIL.md.');
  }
  if (!EMAIL_RE.test(String(mail.to || '').trim())) throw erreurLisible('Adresse du destinataire invalide.');
  const adresse = adresseAsso(env);
  const replyTo = mail.replyTo && EMAIL_RE.test(String(mail.replyTo).trim()) ? String(mail.replyTo).trim() : adresse;
  const m = {
    from: { name: ASSO.nom, address: adresse },
    to: String(mail.to).trim(),
    replyTo,
    subject: mail.subject,
    text: mail.text,
    attachments: mail.attachments || [],
  };

  if (mode === 'smtp') {
    const port = Number(v(env, 'SMTP_PORT')) || 465;
    const t = nodemailer.createTransport({
      host: v(env, 'SMTP_HOST'),
      port,
      secure: port === 465,
      auth: { user: v(env, 'SMTP_USER') || adresse, pass: String(env.SMTP_PASS || '') },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    });
    try {
      await t.sendMail(m);
    } catch (err) {
      throw erreurLisible(messageSmtp(err), err);
    }
    return { mode };
  }

  if (mode === 'brevo') {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': v(env, 'BREVO_API_KEY'), 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: ASSO.nom, email: adresse },
        to: [{ email: m.to }],
        replyTo: { email: replyTo },
        subject: m.subject,
        textContent: m.text,
        ...(m.attachments.length
          ? { attachment: m.attachments.map((a) => ({ name: a.filename, content: Buffer.from(a.content).toString('base64') })) }
          : {}),
      }),
    }).catch((err) => {
      throw erreurLisible('Brevo ne répond pas. Réessayez dans quelques minutes.', err);
    });
    if (!res.ok) {
      const texte = await res.text().catch(() => '');
      throw erreurLisible(messageBrevo(res.status, texte), new Error(`brevo ${res.status}`));
    }
    return { mode };
  }

  // gmail (et démo : faux Gmail, rien n'est expédié)
  const raw = (await messageBrut(m)).toString('base64url');
  try {
    let gmail;
    if (mode === 'demo') gmail = demoGmail();
    else gmail = (await import('./_google-user.mjs')).gmailApi();
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  } catch (err) {
    const { googleErrorMessage } = await import('./_google-user.mjs');
    throw erreurLisible(googleErrorMessage(err), err);
  }
  return { mode };
}
