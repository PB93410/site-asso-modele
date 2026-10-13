/**
 * Alerte mail bureau — inscription.
 * Sheet = seul registre. Ce mail = copie d’alerte (SMTP, Brevo ou Gmail : _envoi.mjs), pas Netlify Forms.
 */

import { adresseAsso, envoyerMail } from './_envoi.mjs';
import { ASSO, SITE_URL } from '../../asso.derive.js';

function dash(value) {
  const t = String(value || '').trim();
  return t ? t : null;
}

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

/** Digits internationaux pour wa.me (ex. 33683524541). */
function phoneWaDigits(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 10) d = `33${d.slice(1)}`;
  if (d.startsWith('33') && d.length >= 11) return d;
  return '';
}

function paymentAction(mode, { enLigne = false, reference = '' } = {}) {
  if (mode.startsWith('Carte') && enLigne) {
    const lien = reference ? ` Pas payé sous 48 h : renvoyer le lien ${SITE_URL}/api/paiement?ref=${reference}` : '';
    return `Carte : rien à faire, l’adhésion passe « À jour » toute seule quand ${ASSO.adhesion.paiementNom || 'HelloAsso'} confirme le paiement.${lien}`;
  }
  if (/virement/i.test(mode)) {
    return `Virement : chercher la référence ${reference || 'de la demande'} sur le relevé, puis /bureau → À payer → J’ai reçu l’argent.`;
  }
  if (mode.startsWith('Carte')) {
    return `Carte : attendre le mail ${ASSO.adhesion.paiementNom || 'de paiement'}, puis /bureau → À payer → J’ai reçu l’argent.`;
  }
  if (/chèque|cheque/i.test(mode)) {
    return 'Chèque : encaisser, puis /bureau → À payer → J’ai reçu l’argent.';
  }
  if (/espèce/i.test(mode)) {
    return 'Espèces : encaisser, puis /bureau → À payer → J’ai reçu l’argent.';
  }
  if (/ancv/i.test(mode)) {
    return 'ANCV : encaisser, puis /bureau → À payer → J’ai reçu l’argent.';
  }
  return `Paiement « ${mode} » : noter dans /bureau quand l’argent est vraiment là.`;
}

/** Sujet INTANGIBLE — filtre Mail bureau + Gmail. */
export function buildAdhesionMailSubject({ prenom, nom }) {
  const who = `${String(prenom || '').trim()} ${String(nom || '').trim()}`.replace(/\s+/g, ' ').trim() || 'Sans nom';
  return `[${ASSO.sigle}] Adhésion — ${who}`;
}

export function formatAdhesionFiche(f) {
  const prenom = String(f.prenom || '').trim();
  const nom = String(f.nom || '').trim();
  const fullName = `${prenom} ${nom}`.trim() || 'Sans nom';
  const tel = dash(f.telephone);
  const telDisplay = tel ? formatFrPhoneDisplay(tel) : '';
  const wa = tel ? phoneWaDigits(tel) : '';
  const mail = dash(f.email);
  const birth = dash(f.date_naissance);
  const addr = [dash(f.adresse), dash(f.code_postal), dash(f.ville)].filter(Boolean).join(', ');
  const mode = dash(f.mode_paiement) || 'non précisé';
  const deja = dash(f.deja_adherent);
  const cours = dash(f.cours);
  const msg = dash(f.message);
  const connu = dash(f.connu);
  const detail = dash(f.detail);
  const nCheque =
    dash(f.numero_cheque) || dash(String(f.detail || '').match(/^Chèque n°\s*([^·]+)/i)?.[1]);

  const lines = [
    'Adhésion — nouvelle inscription',
    '',
    fullName,
    `${ASSO.adhesion.tarif} € · ${mode}`,
  ];

  if (detail) lines.push(detail);
  else if (nCheque) lines.push(`Chèque n° ${nCheque}`);

  if (deja && deja !== 'Non renseigné') {
    lines.push(`Déjà adhérent : ${deja}`);
  }

  lines.push('');

  if (telDisplay) lines.push(`Tél. ${telDisplay}`);
  if (wa) lines.push(`WhatsApp : https://wa.me/${wa}`);
  if (mail) lines.push(`E-mail : ${mail}`);
  if (nCheque) lines.push(`N° de chèque : ${nCheque}`);
  if (birth) lines.push(`Né(e) le : ${birth}`);
  if (addr) lines.push(`Adresse : ${addr}`);
  if (dash(f.droit_image)) lines.push(`Droit à l’image : ${String(f.droit_image).trim()}`);
  if (dash(f.qs_sport)) lines.push(`QS-SPORT : ${String(f.qs_sport).trim()}`);
  if (connu) lines.push(`Nous a connus : ${connu}`);
  if (cours) {
    lines.push('');
    lines.push(`Cours : ${cours}`);
  }
  if (msg) {
    lines.push('');
    lines.push('Message :');
    lines.push(msg);
  }

  lines.push('');
  lines.push('À faire');
  lines.push('• Déjà dans Adhérents — ne pas recréer une ligne.');
  lines.push(`• ${paymentAction(mode, { enLigne: Boolean(f.enLigne), reference: dash(f.reference) || '' })}`);
  lines.push(`• Bureau : ${SITE_URL}/bureau`);
  lines.push('');
  lines.push('Sheet = registre. Ce mail = alerte uniquement.');

  return lines.join('\n');
}

/**
 * Alerte vers la boîte asso. Ne plus poster Netlify Forms (mails vides « Nouvelle Adhesion : »).
 */
export async function sendAdhesionNotification(f) {
  const subject = buildAdhesionMailSubject(f);
  try {
    await envoyerMail({
      to: adresseAsso(),
      replyTo: String(f.email || '').trim(),
      subject,
      text: formatAdhesionFiche(f),
    });
    return { sent: true, subject };
  } catch (err) {
    console.error('adhesion mail:', err?.message || err);
    return { sent: false, subject, error: 'mail_failed' };
  }
}
