/**
 * Classeur Excel (.xlsx) minimal, sans dépendance : un onglet par tableau, cellules en texte
 * (les 0 de tête des téléphones restent, aucune formule n'est jamais exécutée),
 * première ligne figée. S'ouvre dans Excel, LibreOffice, Numbers et Google Sheets.
 */

import { deflateRawSync } from 'node:zlib';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Archive zip (fichiers compressés « deflate »). */
export function zip(fichiers) {
  const locaux = [];
  const central = [];
  let offset = 0;
  for (const { nom, contenu } of fichiers) {
    const nomBuf = Buffer.from(nom, 'utf8');
    const data = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu, 'utf8');
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const tete = Buffer.alloc(30);
    tete.writeUInt32LE(0x04034b50, 0);
    tete.writeUInt16LE(20, 4);
    tete.writeUInt16LE(0x0800, 6); // noms en UTF-8
    tete.writeUInt16LE(8, 8); // deflate
    tete.writeUInt32LE(crc, 14);
    tete.writeUInt32LE(comp.length, 18);
    tete.writeUInt32LE(data.length, 22);
    tete.writeUInt16LE(nomBuf.length, 26);
    locaux.push(tete, nomBuf, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nomBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nomBuf);
    offset += tete.length + nomBuf.length + comp.length;
  }
  const tailleCentral = central.reduce((n, b) => n + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locaux, ...central, fin]);
}

const xml = (s) =>
  String(s ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function colonne(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nom d'onglet accepté par Excel : 31 caractères, sans []:*?/\ */
export function nomOnglet(nom, i = 0) {
  const s = String(nom || '').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return s || `Feuille ${i + 1}`;
}

function feuille(lignes) {
  const rows = (lignes || [])
    .map((ligne, r) => {
      const cells = (ligne || [])
        .map((v, c) => {
          const t = String(v ?? '');
          if (!t) return '';
          return `<c r="${colonne(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(t)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

/**
 * @param {{ nom: string, lignes: string[][] }[]} onglets
 * @returns {Buffer} le fichier .xlsx
 */
export function classeurXlsx(onglets) {
  const liste = onglets.length ? onglets : [{ nom: 'Feuille 1', lignes: [] }];
  const noms = liste.map((o, i) => nomOnglet(o.nom, i));
  const fichiers = [
    {
      nom: '[Content_Types].xml',
      contenu:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        noms
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join('') +
        '</Types>',
    },
    {
      nom: '_rels/.rels',
      contenu:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      nom: 'xl/workbook.xml',
      contenu:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        noms.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    },
    {
      nom: 'xl/_rels/workbook.xml.rels',
      contenu:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        noms
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
          .join('') +
        '</Relationships>',
    },
    ...liste.map((o, i) => ({ nom: `xl/worksheets/sheet${i + 1}.xml`, contenu: feuille(o.lignes) })),
  ];
  return zip(fichiers);
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
