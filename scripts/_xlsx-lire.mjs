/**
 * Lit un classeur .xlsx (sauvegarde du site, éventuellement réenregistrée par Excel ou LibreOffice) :
 * onglets → lignes de texte. Sans dépendance. Formules : la dernière valeur calculée, jamais la formule.
 */

import { inflateRawSync } from 'node:zlib';

/** Fichiers d'une archive zip (répertoire central : tailles fiables même avec « data descriptor »). */
export function dezipper(buf) {
  let fin = buf.length - 22;
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin -= 1;
  if (fin < 0) throw new Error('Ce fichier n’est pas un classeur .xlsx.');
  const n = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const fichiers = new Map();
  for (let i = 0; i < n; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Classeur .xlsx abîmé.');
    const methode = buf.readUInt16LE(p + 10);
    const taille = buf.readUInt32LE(p + 20);
    const lnom = buf.readUInt16LE(p + 28);
    const lextra = buf.readUInt16LE(p + 30);
    const lcomm = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nom = buf.subarray(p + 46, p + 46 + lnom).toString('utf8');
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const brut = buf.subarray(debut, debut + taille);
    fichiers.set(nom, methode === 8 ? inflateRawSync(brut) : brut);
    p += 46 + lnom + lextra + lcomm;
  }
  return fichiers;
}

const texte = (s) =>
  String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

/** Texte d'un nœud (<t> simples ou morceaux enrichis <r><t>). */
const tousLesT = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => texte(m[1])).join('');

const attr = (balise, nom) => new RegExp(`\\s${nom}="([^"]*)"`).exec(balise)?.[1];

function colonne(ref) {
  const lettres = /^[A-Z]+/.exec(ref)?.[0] || 'A';
  let n = 0;
  for (const ch of lettres) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** @returns {{ nom: string, lignes: string[][] }[]} */
export function lireXlsx(buf) {
  const f = dezipper(buf);
  const lire = (nom) => f.get(nom)?.toString('utf8') || '';
  const partages = [...lire('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => tousLesT(m[1]));
  const liens = new Map(
    [...lire('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]),
  );
  const onglets = [];
  for (const m of lire('xl/workbook.xml').matchAll(/<sheet\b[^>]*\/?>/g)) {
    const nom = texte(attr(m[0], 'name') || '');
    const cible = String(liens.get(attr(m[0], 'r:id')) || '').replace(/^\/?(xl\/)?/, '');
    const xml = lire(`xl/${cible}`);
    const lignes = [];
    for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const num = Number(attr(r[1], 'r')) || lignes.length + 1;
      const ligne = [];
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const type = attr(c[1], 't');
        const corps = c[2] || '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(corps)?.[1];
        let val = '';
        if (type === 's') val = partages[Number(v)] ?? '';
        else if (type === 'inlineStr') val = tousLesT(corps);
        else if (v !== undefined) val = texte(v);
        const col = colonne(attr(c[1], 'r') || '');
        while (ligne.length < col) ligne.push('');
        ligne[col] = val;
      }
      while (lignes.length < num - 1) lignes.push([]);
      lignes[num - 1] = ligne;
    }
    onglets.push({ nom, lignes });
  }
  return onglets;
}
