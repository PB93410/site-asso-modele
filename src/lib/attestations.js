/**
 * Attestations PDF (modules.attestations).
 * Adhésion, reçu fiscal (si éligible), comité d’entreprise.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const TYPES_ATTESTATION = ['adhesion', 'fiscal', 'ce'];

export function foldMail(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

export function foldNumero(s) {
  return String(s || '')
    .trim()
    .toUpperCase();
}

export function recuFiscalEligible(asso) {
  return asso?.attestations?.recuFiscal === true;
}

export function typesDisponibles(asso) {
  const out = ['adhesion'];
  if (recuFiscalEligible(asso)) out.push('fiscal');
  out.push('ce');
  return out;
}

export function libelleType(type) {
  if (type === 'fiscal') return 'Reçu fiscal';
  if (type === 'ce') return 'Attestation comité d’entreprise';
  return 'Attestation d’adhésion';
}

export function secretAttestations(env = process.env) {
  const secret = String(env.BUREAU_SECRET || env.ATTESTATIONS_SECRET || '').trim();
  if (!secret || secret.length < 24) {
    throw new Error('BUREAU_SECRET manquante ou trop courte pour les attestations.');
  }
  return secret;
}

export function expireDans(heures, maintenant = new Date()) {
  return String(Math.floor(maintenant.getTime() / 1000) + Math.max(1, Number(heures) || 48) * 3600);
}

export function signerAcces({ numero, mail, exp }, secret) {
  const payload = `att:${foldNumero(numero)}:${foldMail(mail)}:${exp}`;
  return createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
}

export function verifierAcces({ numero, mail, exp, token }, secret, maintenant = new Date()) {
  const e = Number(exp);
  if (!Number.isFinite(e) || e * 1000 < maintenant.getTime()) return false;
  const attendu = signerAcces({ numero, mail, exp }, secret);
  const a = Buffer.from(String(token || ''), 'utf8');
  const b = Buffer.from(attendu, 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function urlMagique(siteUrl, { numero, mail, exp, token }) {
  const base = String(siteUrl || '').replace(/\/+$/, '');
  const q = new URLSearchParams({
    n: foldNumero(numero),
    m: foldMail(mail),
    x: String(exp),
    t: token,
  });
  return `${base}/attestations?${q}`;
}

export function numeroRecu(asso, numero) {
  const n = foldNumero(numero).replace(/[^A-Z0-9-]+/g, '') || 'X';
  return `${asso.sigle || 'ASSO'}-${String(asso.saison?.label || '').replace(/\D/g, '')}-${n.slice(-6)}`;
}

export function trouverAdherent(rows, numero, mail) {
  const n = foldNumero(numero);
  const m = foldMail(mail);
  if (!n || !m) return null;
  return (
    (rows || []).find((r) => {
      const num = foldNumero(r.NUMERO || r.Numero || r.numero);
      const em = foldMail(r.MAIL || r.Mail || r.EMAIL || r.Email || r.mail);
      return num === n && em === m;
    }) || null
  );
}

export function estAJour(fiche) {
  return String(fiche?.STATUT || fiche?.statut || '').trim() === 'À jour';
}

export function montantPaye(fiche, asso) {
  const brut = String(fiche?.MONTANT || fiche?.montant || '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number(brut);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return Math.round(Number(asso?.adhesion?.tarif) || 0);
}

function pdfEsc(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function couper(s, max = 88) {
  const t = String(s || '');
  if (t.length <= max) return [t];
  const out = [];
  let rest = t;
  while (rest.length > max) {
    let i = rest.lastIndexOf(' ', max);
    if (i < 30) i = max;
    out.push(rest.slice(0, i).trim());
    rest = rest.slice(i).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** PDF A4 Helvetica (sans accents) pour un téléchargement immédiat. */
export function fabriquerPdf({ titre, lignes }) {
  const plat = [];
  plat.push(titre || 'Attestation');
  plat.push('');
  for (const line of lignes || []) {
    for (const morceau of couper(line)) plat.push(morceau);
  }
  const ops = ['BT', '/F1 14 Tf', '50 800 Td', `(${pdfEsc(plat[0])}) Tj`];
  for (const line of plat.slice(1)) {
    ops.push('0 -16 Td', '/F1 10 Tf', `(${pdfEsc(line)}) Tj`);
  }
  ops.push('ET');
  const stream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const xref = [0];
  for (let i = 0; i < objects.length; i += 1) {
    xref.push(body.length);
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const startxref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of xref.slice(1)) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function champ(fiche, ...cles) {
  for (const c of cles) {
    const v = fiche?.[c];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function fichePublique(fiche, asso) {
  return {
    prenom: champ(fiche, 'PRENOM', 'Prenom', 'prenom'),
    nom: champ(fiche, 'NOM', 'Nom', 'nom'),
    numero: foldNumero(champ(fiche, 'NUMERO', 'Numero', 'numero')),
    mail: foldMail(champ(fiche, 'MAIL', 'Mail', 'EMAIL', 'Email', 'mail')),
    adresse: champ(fiche, 'ADRESSE', 'Adresse', 'adresse'),
    cp: champ(fiche, 'CP', 'CODE_POSTAL', 'code_postal'),
    ville: champ(fiche, 'VILLE', 'Ville', 'ville'),
    mode: champ(fiche, 'MODE', 'MODE_PAIEMENT', 'mode_paiement'),
    datePaiement: champ(fiche, 'DATE_PAIEMENT', 'date_paiement'),
    montant: montantPaye(fiche, asso),
    saison: asso?.saison?.label || '',
  };
}

function dateFr(d = new Date()) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function lignesAdhesion(asso, p, aujourdHui = new Date()) {
  return [
    asso.nom,
    asso.statut || 'Association loi 1901',
    `Siege : ${asso.siege || `${asso.codePostal || ''} ${asso.ville || ''}`.trim()}`,
    asso.rna ? `RNA : ${asso.rna}` : '',
    asso.siret ? `SIRET : ${asso.siret}` : '',
    '',
    `Nous certifions que ${p.prenom} ${p.nom},`,
    `numero ${p.numero || '—'}, est adherent·e pour la saison ${p.saison}.`,
    `Cotisation : ${p.montant} €${p.mode ? ` — ${p.mode}` : ''}${p.datePaiement ? ` — payee le ${p.datePaiement}` : ''}.`,
    asso.adhesion?.inclus ? `Comprend : ${asso.adhesion.inclus}.` : '',
    '',
    `Fait a ${asso.ville || ''}, le ${dateFr(aujourdHui)}.`,
    asso.responsablePublication || 'Le ou la president·e',
    '',
    'Document genere a la demande. Aucune signature manuscrite n’est exigee.',
  ].filter((l) => l !== '');
}

export function lignesFiscal(asso, p, aujourdHui = new Date()) {
  const objet = String(asso.attestations?.objet || '').trim() || asso.accroche || 'pratique sportive amateur';
  return [
    'Recu fiscal — modele Cerfa n° 11580*03',
    'Articles 200 et 238 bis du code general des impots',
    '',
    '1. Organisme beneficiaire du versement',
    `Nom : ${asso.nom}`,
    `Objet : ${objet}`,
    `Siege : ${asso.siege || ''}`,
    `RNA : ${asso.rna || 'non publie'}   SIRET : ${asso.siret || 'non publie'}`,
    '',
    '2. Beneficiaire du recu (adherent)',
    `Nom : ${p.nom}    Prenom : ${p.prenom}`,
    `Adresse : ${[p.adresse, p.cp, p.ville].filter(Boolean).join(', ') || 'non renseignee'}`,
    '',
    '3. Versement',
    `Numero du recu : ${numeroRecu(asso, p.numero)}`,
    `Nature : cotisation / don en numeraire`,
    `Montant : ${p.montant} €`,
    `Date : ${p.datePaiement || dateFr(aujourdHui)}`,
    `Forme : ${p.mode || 'non precisee'}`,
    `Saison : ${p.saison}`,
    '',
    '4. Mentions legales',
    'Le beneficiaire certifie sur l’honneur que les versements qu’il recoit ouvrent droit a la reduction d’impot prevue aux articles 200 et 238 bis du CGI, des lors que l’association remplit les conditions d’eligibilite (interet general).',
    'Ce document n’a de valeur que si l’association est habilitee a delivrer un recu fiscal. Modele a usage interne ; il ne remplace pas un Cerfa officiel si l’administration en exige un autre.',
    '',
    `Fait a ${asso.ville || ''}, le ${dateFr(aujourdHui)}.`,
    `Qualite du signataire : ${asso.responsablePublication || 'President·e'}`,
  ];
}

export function lignesCe(asso, p, aujourdHui = new Date()) {
  return [
    asso.nom,
    `Attestation destinee au comite d’entreprise / a l’employeur`,
    '',
    `Nous certifions que ${p.prenom} ${p.nom}, numero ${p.numero || '—'},`,
    `est adherent·e pour la saison ${p.saison}.`,
    `Montant regle : ${p.montant} €${p.mode ? ` (${p.mode})` : ''}${p.datePaiement ? `, le ${p.datePaiement}` : ''}.`,
    `Saison : ${p.saison}${asso.saison?.reprise ? ` (reprise ${asso.saison.reprise})` : ''}.`,
    '',
    'Document a remettre a l’employeur ou au comite d’entreprise.',
    `Fait a ${asso.ville || ''}, le ${dateFr(aujourdHui)}.`,
    asso.responsablePublication || 'Le ou la president·e',
  ];
}

export function attestationPdf(type, { asso, fiche, aujourdHui = new Date() }) {
  if (type === 'fiscal' && !recuFiscalEligible(asso)) {
    throw new Error('Reçu fiscal non proposé : l’association n’est pas déclarée éligible.');
  }
  const p = fichePublique(fiche, asso);
  if (type === 'fiscal') return fabriquerPdf({ titre: 'Recu fiscal', lignes: lignesFiscal(asso, p, aujourdHui) });
  if (type === 'ce') return fabriquerPdf({ titre: 'Attestation comite d’entreprise', lignes: lignesCe(asso, p, aujourdHui) });
  return fabriquerPdf({ titre: 'Attestation d’adhesion', lignes: lignesAdhesion(asso, p, aujourdHui) });
}

export function nomFichier(type, numero) {
  const n = foldNumero(numero).replace(/[^\w.-]+/g, '_') || 'adherent';
  return `${n}-${type}.pdf`;
}
