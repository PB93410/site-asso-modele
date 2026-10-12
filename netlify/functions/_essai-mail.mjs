/**
 * Copie mail bureau pour /essai — sujet INTANGIBLE [ESSAI] …
 * Le dossier se traite dans Bureau → Essais. L’essai s’enregistre même si le mail échoue.
 */

import { adresseAsso, envoyerMail } from './_envoi.mjs';

function formatFrPhoneDisplay(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  while (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('33') && d.length >= 11) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length > 9) d = d.slice(-9);
  if (d.length !== 9) return String(raw || '').trim();
  const n = `0${d}`;
  return n.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

function essaiNLabel(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) return '';
  if (num >= 4) return `Essai ${num} — au-delà de 3`;
  return `Essai ${num}/3`;
}

function withCourse(cours, slot) {
  const course = String(cours || '').trim();
  const when = String(slot || '').trim();
  if (!course) return when;
  if (!when) return course;
  if (when.toLowerCase().includes(course.toLowerCase())) return when;
  return `${course} · ${when}`;
}

/** Sujet INTANGIBLE — toujours préfixe exact `[ESSAI]`. */
export function buildEssaiMailSubject({ prenom, nom, creneau, cours }) {
  const who = `${String(prenom || '').trim()} ${String(nom || '').trim()}`.replace(/\s+/g, ' ').trim() || 'Sans nom';
  const slot = withCourse(cours, String(creneau || '').trim() || 'créneau non précisé');
  return `[ESSAI] ${who} · ${slot}`;
}

export function buildEssaiMailBody({ prenom, nom, telephone, creneau, nEssai, email, cours }) {
  const who = `${String(prenom || '').trim()} ${String(nom || '').trim()}`.replace(/\s+/g, ' ').trim() || 'Sans nom';
  const tel = formatFrPhoneDisplay(telephone);
  const slot = withCourse(cours, String(creneau || '').trim() || 'créneau non précisé');
  const nLabel = essaiNLabel(nEssai);
  const lines = [who];
  if (tel) lines.push(`Tél. ${tel}`);
  lines.push(nLabel ? `${slot} · ${nLabel}` : slot);
  const mail = String(email || '').trim();
  if (mail) lines.push(`E-mail : ${mail}`);
  lines.push('');
  lines.push('Traiter dans Bureau → Essais. Ce mail est une copie.');
  return lines.join('\n');
}

/**
 * Envoie la copie à la boîte asso (SMTP, Brevo ou Gmail : _envoi.mjs).
 * Ne lance pas d’autre canal (ntfy reste à part dans essai.mjs).
 */
export async function sendEssaiNotification(payload) {
  const subject = buildEssaiMailSubject(payload);
  try {
    await envoyerMail({
      to: adresseAsso(),
      replyTo: String(payload.email || '').trim(),
      subject,
      text: buildEssaiMailBody(payload),
    });
    return { sent: true, subject };
  } catch (err) {
    console.error('essai mail:', err?.message || err);
    return { sent: false, subject, error: 'mail_failed' };
  }
}
