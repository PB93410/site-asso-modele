/**
 * Rapport annuel (modules.rapport).
 */

function testNom(prenom, nom) {
  return /test/i.test(`${prenom || ''} ${nom || ''}`);
}

function anneeDe(dateNaissance) {
  const s = String(dateNaissance || '').trim();
  const m = s.match(/(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= 2100 ? y : null;
}

export function ageAu(dateNaissance, au = new Date()) {
  const y = anneeDe(dateNaissance);
  if (y == null) return null;
  const m = String(dateNaissance).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    let age = au.getFullYear() - dt.getFullYear();
    const md = au.getMonth() - dt.getMonth();
    if (md < 0 || (md === 0 && au.getDate() < dt.getDate())) age -= 1;
    return age;
  }
  return au.getFullYear() - y;
}

export function trancheAge(age) {
  if (age == null) return 'Non renseigné';
  if (age < 18) return 'Moins de 18 ans';
  if (age < 40) return '18–39 ans';
  if (age < 60) return '40–59 ans';
  return '60 ans et plus';
}

/** 9 derniers chiffres du téléphone (06 12… et +33 6 12… donnent la même clé), sinon ''. */
function cleTel(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
}

/**
 * Personnes arrivées par un lien de parrainage (essais de provenance « Parrainage », une fois chacune),
 * et combien sont adhérentes (essai passé à « Adhérent », ou fiche à jour au même téléphone). Aucun nom.
 */
function compterParrainage(essais, aJour) {
  const personnes = new Map();
  for (const e of essais) {
    if (String(e.SOURCE || e.source || '').trim().toLowerCase() !== 'parrainage') continue;
    const cle = cleTel(e.TEL || e.tel) || `${e.PRENOM || e.prenom}|${e.NOM || e.nom}`.toLowerCase();
    const adherent = String(e.STATUT || e.statut || '').trim() === 'Adhérent';
    personnes.set(cle, Boolean(personnes.get(cle)) || adherent);
  }
  const telsAJour = new Set(aJour.map((a) => cleTel(a.TEL || a.tel)).filter(Boolean));
  let adherents = 0;
  for (const [cle, adherent] of personnes) if (adherent || telsAJour.has(cle)) adherents += 1;
  return { personnes: personnes.size, adherents };
}

function compte(map, cle) {
  const k = String(cle || 'Non renseigné').trim() || 'Non renseigné';
  map[k] = (map[k] || 0) + 1;
}

export function calculerRapport({ adherents = [], essais = [], presences = [] } = {}, maintenant = new Date()) {
  const adh = adherents.filter((a) => !testNom(a.PRENOM || a.prenom, a.NOM || a.nom));
  const ess = essais.filter((e) => !testNom(e.PRENOM || e.prenom, e.NOM || e.nom));
  const aJour = adh.filter((a) => String(a.STATUT || a.statut || '').trim() === 'À jour');
  const enAttente = adh.filter((a) => String(a.STATUT || a.statut || '').trim() === 'En attente');
  const essaisAdherent = ess.filter((e) => String(e.STATUT || e.statut || '').trim() === 'Adhérent');
  const conversion = ess.length ? Math.round((essaisAdherent.length / ess.length) * 100) : 0;

  const ages = {};
  const communes = {};
  for (const a of aJour) {
    compte(ages, trancheAge(ageAu(a.DATE_NAISSANCE || a.date_naissance, maintenant)));
    compte(communes, a.VILLE || a.ville);
  }

  const parCours = {};
  for (const p of presences || []) {
    if (testNom(p.PRENOM || p.prenom, p.NOM || p.nom)) continue;
    compte(parCours, p.COURS || p.cours || 'Cours');
  }

  return {
    saison: '',
    adhérentsAJour: aJour.length,
    adhesionsEnAttente: enAttente.length,
    essais: ess.length,
    essaisDevenusAdherents: essaisAdherent.length,
    conversionEssaiPct: conversion,
    presences: (presences || []).filter((p) => !testNom(p.PRENOM || p.prenom, p.NOM || p.nom)).length,
    parAge: ages,
    parCommune: communes,
    parCours,
    parrainage: compterParrainage(ess, aJour),
  };
}

export function rapportCsv(r) {
  const lignes = [
    ['Indicateur', 'Valeur'],
    ['Adhérents à jour', r.adhérentsAJour],
    ['Adhésions en attente', r.adhesionsEnAttente],
    ['Essais', r.essais],
    ['Essais devenus adhérents', r.essaisDevenusAdherents],
    ['Conversion essai → adhésion (%)', r.conversionEssaiPct],
    ['Pointages', r.presences],
    ...(r.parrainage?.personnes ? [['Venus par parrainage', r.parrainage.personnes], ['… dont adhérents', r.parrainage.adherents]] : []),
    [],
    ['Âge', 'Nombre'],
    ...Object.entries(r.parAge).map(([k, v]) => [k, v]),
    [],
    ['Commune', 'Nombre'],
    ...Object.entries(r.parCommune).map(([k, v]) => [k, v]),
    [],
    ['Cours (présences)', 'Nombre'],
    ...Object.entries(r.parCours).map(([k, v]) => [k, v]),
  ];
  return lignes
    .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');
}

function pdfEsc(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** PDF minimal (Helvetica, sans accents) pour un téléchargement bureau. */
export function rapportPdf(r, asso) {
  const lignes = [
    asso.nom || 'Association',
    `Rapport ${r.saison || ''}`.trim(),
    '',
    `Adherents a jour : ${r.adhérentsAJour}`,
    `Adhesions en attente : ${r.adhesionsEnAttente}`,
    `Essais : ${r.essais}`,
    `Essais devenus adherents : ${r.essaisDevenusAdherents}`,
    `Conversion essai -> adhesion : ${r.conversionEssaiPct} %`,
    `Pointages : ${r.presences}`,
    ...(r.parrainage?.personnes ? [`Venus par parrainage : ${r.parrainage.personnes}, dont ${r.parrainage.adherents} adherents`] : []),
    '',
    'Par age',
    ...Object.entries(r.parAge).map(([k, v]) => `  ${k} : ${v}`),
    '',
    'Par commune',
    ...Object.entries(r.parCommune).map(([k, v]) => `  ${k} : ${v}`),
  ];
  let y = 800;
  const ops = ['BT', '/F1 14 Tf', '50 800 Td', `(${pdfEsc(lignes[0])}) Tj`];
  y -= 22;
  for (const line of lignes.slice(1)) {
    ops.push('0 -18 Td', `/F1 11 Tf`, `(${pdfEsc(line)}) Tj`);
    y -= 18;
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
