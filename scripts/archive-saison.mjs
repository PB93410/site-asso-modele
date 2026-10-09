/**
 * Lancer quand personne n'utilise le bureau. Supprimer la sauvegarde tmp/archives/ après un mois (elle contient des données personnelles).
 *
 * Archivage de fin de saison.
 * Conforme au registre RGPD (DOC-RGPD-REGISTRE.md).
 *
 * Sans --apply : compte les lignes et montre un échantillon (prénom + initiale),
 * sans téléphone. Aucune écriture.
 *
 * Avec --apply : copie CSV dans tmp/archives/AAAA-MM-JJ/ (ignoré par git),
 * puis supprime les lignes du bas vers le haut. Jamais la ligne d’en-tête.
 *
 *   node scripts/archive-saison.mjs --avant 2026-09-01
 *   node scripts/archive-saison.mjs --avant 2026-09-01 --forum
 *   node scripts/archive-saison.mjs --avant 2026-09-01 --apply
 *
 * Ne pas lancer --apply sans avoir lu le compte-rendu du passage précédent.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { adherentAJourKey, foldStatut, telPersonKey } from '../netlify/functions/_bureau-lib.mjs';
import { loadEnv } from './_env.mjs';

/** Onglet des essais pris au stand du forum des associations (facultatif). */
const FORUM_TAB = process.env.GOOGLE_FORUM_TAB || 'Forum';

export function toYmd(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!fr) return '';
  const year = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
  return `${year}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
}

/** Date réelle du créneau (JJ/MM/AAAA en tête), sinon date de demande. */
export function essaiArchiveYmd(creneau, dateDemande) {
  const dated = String(creneau || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  if (dated) return `${dated[3]}-${dated[2]}-${dated[1]}`;
  return toYmd(dateDemande);
}

export function addMonthsYmd(ymd, delta) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  const monthIndex = m - 1 + delta;
  const year = y + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function parisTodayYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function aJourKeysFromAdherents(rows) {
  const keys = new Set();
  for (const row of rows || []) {
    if (foldStatut(row.statut) !== 'a jour') continue;
    const key = adherentAJourKey(row.tel, row.prenom);
    if (key) keys.add(key);
  }
  return keys;
}

/** Essais antérieurs à `avant`, sauf personne déjà adhérente À jour (tél + prénom). */
export function selectEssaiRows(rows, aJourKeys, avant) {
  return (rows || []).filter((row) => {
    const ymd = essaiArchiveYmd(row.creneau, row.dateDemande);
    if (!ymd || ymd >= avant) return false;
    const key = adherentAJourKey(row.tel, row.prenom);
    if (key && aJourKeys.has(key)) return false;
    return true;
  });
}

/** Demandes « En attente » dont la date est strictement plus vieille que 12 mois. */
export function selectPendingOlderThan(rows, cutoffYmd) {
  return (rows || []).filter((row) => {
    if (foldStatut(row.statut) !== 'en attente') return false;
    const ymd = toYmd(row.dateDemande);
    return Boolean(ymd && ymd < cutoffYmd);
  });
}

export function sampleName(prenom, nom) {
  const first = String(prenom || '').trim() || '—';
  const initial = String(nom || '').trim().charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return '';
  return String(process.argv[index + 1] || '').trim();
}

function validYmd(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function indexOfHeader(headers, names) {
  const folded = headers.map((header) => foldStatut(header).replace(/ /g, '_'));
  for (const name of names) {
    const wanted = foldStatut(name).replace(/ /g, '_');
    const index = folded.findIndex((header) => header === wanted);
    if (index >= 0) return index;
  }
  return -1;
}

function blankRow(cells) {
  return (cells || []).every((value) => !String(value || '').trim());
}

/** Même règle que readSheetAsObjects : prénom ou nom, et un téléphone, dans les 12 premières lignes. */
function looksLikeHeader(row) {
  const cells = (row || []).map((cell) =>
    String(cell || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  );
  const hasName = cells.some((cell) => cell.includes('prenom') || cell === 'nom');
  const hasTel = cells.some((cell) => cell.includes('tel') || cell.includes('telephone'));
  return hasName && hasTel;
}

function headerIndex(values) {
  const limit = Math.min((values || []).length, 12);
  for (let index = 0; index < limit; index += 1) {
    if (looksLikeHeader(values[index])) return index;
  }
  return 0;
}

export function rowsFromValues(values) {
  const list = values || [];
  const headerAt = headerIndex(list);
  const headers = (list[headerAt] || []).map((header) => String(header || '').trim());
  const prenomIdx = indexOfHeader(headers, ['PRENOM', 'Prénom']);
  const nomIdx = indexOfHeader(headers, ['NOM']);
  const telIdx = indexOfHeader(headers, ['TEL', 'Téléphone', 'Telephone']);
  const statutIdx = indexOfHeader(headers, ['STATUT', 'Statut', 'Relance']);
  const creneauIdx = indexOfHeader(headers, ['CRENEAU', 'Essai prévu (date)', 'Essai prévu']);
  const dateIdx = indexOfHeader(headers, ['DATE_DEMANDE', 'Date essai']);
  const rows = [];
  for (let index = headerAt + 1; index < list.length; index += 1) {
    const cells = list[index] || [];
    if (blankRow(cells)) continue;
    const at = (idx) => (idx >= 0 ? String(cells[idx] || '').trim() : '');
    rows.push({
      row: index + 1,
      cells,
      prenom: at(prenomIdx),
      nom: at(nomIdx),
      tel: at(telIdx),
      statut: at(statutIdx),
      creneau: at(creneauIdx),
      dateDemande: at(dateIdx),
    });
  }
  return { headers, headerRow: headerAt + 1, rows };
}

function samePersonAndDate(planned, fresh) {
  if (!fresh) return false;
  if (telPersonKey(planned.tel) !== telPersonKey(fresh.tel)) return false;
  if (foldStatut(planned.prenom) !== foldStatut(fresh.prenom)) return false;
  return essaiArchiveYmd(planned.creneau, planned.dateDemande) === essaiArchiveYmd(fresh.creneau, fresh.dateDemande);
}

/** Relu juste avant suppression. Tableau vide = ne rien supprimer. */
export function rowsToDelete(planned, freshRows, headerRow) {
  const byRow = new Map((freshRows || []).map((row) => [row.row, row]));
  for (const row of planned || []) {
    if (!samePersonAndDate(row, byRow.get(row.row))) return [];
  }
  return (planned || []).map((row) => row.row).filter((row) => Number.isInteger(row) && row > headerRow);
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers, selected) {
  const width = headers.length;
  const lines = [headers.map(csvCell).join(',')];
  for (const row of selected) {
    const cells = [];
    for (let index = 0; index < width; index += 1) cells.push(csvCell(row.cells[index] ?? ''));
    lines.push(cells.join(','));
  }
  return `${lines.join('\n')}\n`;
}

function printPlan(title, selected) {
  console.log(`${title} : ${selected.length}`);
  for (const row of selected.slice(0, 8)) {
    console.log(`  ${sampleName(row.prenom, row.nom)}`);
  }
  if (selected.length > 8) console.log(`  … et ${selected.length - 8} autre(s)`);
}

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON manquante. Ne pas coller la clé dans le chat.');
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON illisible.');
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('JSON service account incomplet');
  }
  return credentials;
}

async function readTab(sheets, spreadsheetId, tab) {
  const safe = String(tab).replace(/'/g, "''");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${safe}'!A:Z`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return rowsFromValues(res.data.values || []);
}

async function sheetNumericId(sheets, spreadsheetId, tab) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const found = (meta.data.sheets || []).find((sheet) => sheet.properties?.title === tab);
  if (!found) throw new Error(`Onglet introuvable : ${tab}`);
  return found.properties.sheetId;
}

async function deleteRowsBottomUp(sheets, spreadsheetId, tab, rowNumbers) {
  const targets = [...new Set(rowNumbers)].sort((a, b) => b - a);
  if (!targets.length) return;
  const sheetId = await sheetNumericId(sheets, spreadsheetId, tab);
  const chunkSize = 80;
  for (let start = 0; start < targets.length; start += chunkSize) {
    const chunk = targets.slice(start, start + chunkSize);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: chunk.map((row) => ({
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: row - 1,
              endIndex: row,
            },
          },
        })),
      },
    });
  }
}

async function writeBackup(dir, fileName, headers, selected) {
  if (!selected.length) return '';
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, fileName);
  await writeFile(file, `\uFEFF${toCsv(headers, selected)}`, 'utf8');
  return file;
}

async function main() {
  const avant = argValue('--avant');
  const apply = process.argv.includes('--apply');
  const includeForum = process.argv.includes('--forum');
  if (!validYmd(avant)) {
    console.error('Indiquez --avant AAAA-MM-JJ. Sans --apply, rien n’est écrit.');
    process.exitCode = 1;
    return;
  }

  loadEnv();
  const { google } = await import('googleapis');
  const {
    getAdherentsSheetId,
    getAdherentsTab,
    getEssaisSheetId,
    getEssaisTab,
  } = await import('../netlify/functions/_bureau-lib.mjs');

  const auth = new google.auth.GoogleAuth({
    credentials: loadCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const essaisId = getEssaisSheetId();
  const essaisTab = getEssaisTab();
  const adherentsId = getAdherentsSheetId();
  const adherentsTab = getAdherentsTab();

  const essaisSheet = await readTab(sheets, essaisId, essaisTab);
  const adherentsSheet = await readTab(sheets, adherentsId, adherentsTab);
  const forumSheet = includeForum ? await readTab(sheets, essaisId, FORUM_TAB) : null;

  const aJour = aJourKeysFromAdherents(adherentsSheet.rows);
  const essais = selectEssaiRows(essaisSheet.rows, aJour, avant);
  const cutoff = addMonthsYmd(parisTodayYmd(), -12);
  const pending = selectPendingOlderThan(adherentsSheet.rows, cutoff);
  const forum = forumSheet ? forumSheet.rows : [];

  console.log(apply ? 'Archivage — écriture demandée.' : 'Archivage — aperçu, rien n’est écrit.');
  printPlan(`Essais avant ${avant}, hors adhérents à jour`, essais);
  printPlan(`Adhérents en attente avant ${cutoff}`, pending);
  if (includeForum) printPlan(`Onglet ${FORUM_TAB}`, forum);
  else console.log(`${FORUM_TAB} : non demandé (ajoutez --forum).`);

  if (!apply) return;

  const dir = path.join('tmp', 'archives', parisTodayYmd());
  const removed = [];

  async function commitTab(spreadsheetId, tab, parsed, selected, fileName) {
    if (!selected.length) return;
    const file = await writeBackup(dir, fileName, parsed.headers, selected);
    if (file) console.log(`Copie : ${file}`);
    const fresh = await readTab(sheets, spreadsheetId, tab);
    const targets = rowsToDelete(selected, fresh.rows, parsed.headerRow);
    if (targets.length !== selected.length) {
      console.log(
        `Le Sheet a changé depuis la lecture. Rien n'a été supprimé dans ${tab}. Relancez le script.`,
      );
      return;
    }
    await deleteRowsBottomUp(sheets, spreadsheetId, tab, targets);
    removed.push(tab);
  }

  await commitTab(essaisId, essaisTab, essaisSheet, essais, 'essais.csv');
  await commitTab(adherentsId, adherentsTab, adherentsSheet, pending, 'adherents.csv');
  if (forumSheet) await commitTab(essaisId, FORUM_TAB, forumSheet, forum, 'forum.csv');
  if (removed.length) console.log('Lignes retirées. Les en-têtes sont restés.');
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
