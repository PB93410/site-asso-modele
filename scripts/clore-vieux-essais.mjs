/**
 * Lancer quand personne n'utilise le bureau. Supprimer la sauvegarde tmp/archives/ après un mois (elle contient des données personnelles).
 *
 * Clôt les essais « À venir » ou « Confirmé » non pointés.
 * Date réelle du créneau depuis 7 jours, ou, sans date, demande depuis 14 jours.
 * Adhérent déjà À jour (téléphone + prénom) → STATUT Adhérent, sinon Annulé.
 * NOTES : « Clos JJ/MM/AAAA : essai non pointé », ajouté avec « | ».
 * Jamais de suppression de ligne.
 *
 *   node scripts/clore-vieux-essais.mjs
 *   node scripts/clore-vieux-essais.mjs --jours-date 7 --jours-demande 14
 *   node scripts/clore-vieux-essais.mjs --apply
 *
 * Ne pas lancer --apply sans avoir lu l'aperçu.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { adherentAJourKey, foldStatut, isTestPrenom, telPersonKey } from '../netlify/functions/_bureau-lib.mjs';
import { loadEnv } from './_env.mjs';

/** AAAA-MM-JJ si CRENEAU commence par jj/mm/aaaa, sinon chaîne vide. */
export function essaiYmdFromCreneau(raw) {
  const m = String(raw || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

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

export function addDaysYmd(ymd, delta) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export function parisTodayYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function ymdToFr(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function appendClosNote(notes, todayYmd) {
  const bit = `Clos ${ymdToFr(todayYmd)} : essai non pointé`;
  const existing = String(notes || '').trim();
  return existing ? `${existing} | ${bit}` : bit;
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

export function plannedStatut(row, aJourKeys) {
  const key = adherentAJourKey(row.tel, row.prenom);
  if (key && aJourKeys.has(key)) return 'Adhérent';
  return 'Annulé';
}

/**
 * À venir (un statut vide compte comme À venir), Confirmé, hors fiches test.
 * Date réelle depuis `joursDate` jours, sinon (sans date réelle) demande depuis `joursDemande` jours.
 */
export function selectVieuxEssais(rows, aJourKeys, todayYmd, options = {}) {
  const joursDate = options.joursDate ?? 7;
  const joursDemande = options.joursDemande ?? 14;
  const dateLimit = addDaysYmd(todayYmd, -joursDate);
  const demandeLimit = addDaysYmd(todayYmd, -joursDemande);
  const selected = [];
  for (const row of rows || []) {
    if (isTestPrenom(row.prenom, row.nom)) continue;
    const statut = foldStatut(row.statut);
    if (statut && statut !== 'a venir' && statut !== 'confirme') continue;
    const real = essaiYmdFromCreneau(row.creneau);
    let ymd = '';
    if (real) {
      if (real > dateLimit) continue;
      ymd = real;
    } else {
      const asked = toYmd(row.dateDemande);
      if (!asked || asked > demandeLimit) continue;
      ymd = asked;
    }
    selected.push({
      ...row,
      ymd,
      statutPrevu: plannedStatut(row, aJourKeys),
      notesNext: appendClosNote(row.notes, todayYmd),
    });
  }
  return selected;
}

export function sampleName(prenom, nom) {
  const first = String(prenom || '').trim() || '—';
  const initial = String(nom || '').trim().charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

export function previewLine(row) {
  const when = String(row.creneau || '').trim() || 'sans créneau';
  const date = ymdToFr(row.ymd) || 'sans date';
  return `${sampleName(row.prenom, row.nom)} · ${when} · ${date} · ${row.statutPrevu}`;
}

/** Relu juste avant écriture. false = ne rien écrire. */
export function rowsStillSame(planned, freshRows) {
  const byRow = new Map((freshRows || []).map((row) => [row.row, row]));
  for (const row of planned || []) {
    const fresh = byRow.get(row.row);
    if (!fresh) return false;
    if (telPersonKey(row.tel) !== telPersonKey(fresh.tel)) return false;
    if (foldStatut(row.prenom) !== foldStatut(fresh.prenom)) return false;
    if (foldStatut(row.statut) !== foldStatut(fresh.statut)) return false;
  }
  return true;
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return '';
  return String(process.argv[index + 1] || '').trim();
}

function argDays(flag, fallback) {
  if (!process.argv.includes(flag)) return fallback;
  const raw = argValue(flag);
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
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
  const statutIdx = indexOfHeader(headers, ['STATUT', 'Statut']);
  const creneauIdx = indexOfHeader(headers, ['CRENEAU', 'Essai prévu (date)', 'Essai prévu']);
  const dateIdx = indexOfHeader(headers, ['DATE_DEMANDE', 'Date essai']);
  const notesIdx = indexOfHeader(headers, ['NOTES', 'Remarque']);
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
      notes: at(notesIdx),
    });
  }
  return { headers, headerRow: headerAt + 1, statutCol: statutIdx, notesCol: notesIdx, rows };
}

function colLetter(index) {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
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

async function writeBackup(dir, headers, selected) {
  if (!selected.length) return '';
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'clore-essais.csv');
  await writeFile(file, `\uFEFF${toCsv(headers, selected)}`, 'utf8');
  return file;
}

function printPlan(selected) {
  const annule = selected.filter((row) => row.statutPrevu === 'Annulé').length;
  const adherent = selected.filter((row) => row.statutPrevu === 'Adhérent').length;
  console.log(`Essais à clore : ${selected.length}`);
  console.log(`Annulé : ${annule}`);
  console.log(`Adhérent : ${adherent}`);
  for (const row of selected) console.log(`  ${previewLine(row)}`);
}

async function main() {
  const joursDate = argDays('--jours-date', 7);
  const joursDemande = argDays('--jours-demande', 14);
  const apply = process.argv.includes('--apply');
  if (joursDate === null || joursDemande === null) {
    console.error('Indiquez --jours-date et --jours-demande avec un nombre de jours. Sans --apply, rien n’est écrit.');
    process.exitCode = 1;
    return;
  }

  loadEnv();
  const { google } = await import('googleapis');
  const { getAdherentsSheetId, getAdherentsTab, getEssaisSheetId, getEssaisTab } = await import(
    '../netlify/functions/_bureau-lib.mjs'
  );

  const auth = new google.auth.GoogleAuth({
    credentials: loadCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const essaisId = getEssaisSheetId();
  const essaisTab = getEssaisTab();
  const adherentsId = getAdherentsSheetId();
  const adherentsTab = getAdherentsTab();
  const today = parisTodayYmd();

  const essaisSheet = await readTab(sheets, essaisId, essaisTab);
  const adherentsSheet = await readTab(sheets, adherentsId, adherentsTab);
  const selected = selectVieuxEssais(essaisSheet.rows, aJourKeysFromAdherents(adherentsSheet.rows), today, {
    joursDate,
    joursDemande,
  });

  console.log(
    apply
      ? 'Clôture des essais non pointés — écriture demandée.'
      : 'Clôture des essais non pointés — aperçu, rien n’est écrit.',
  );
  console.log(`Seuils : date réelle ${joursDate} j, demande ${joursDemande} j. Aujourd’hui ${ymdToFr(today)}.`);
  printPlan(selected);
  if (!apply || !selected.length) return;

  if (essaisSheet.statutCol < 0 || essaisSheet.notesCol < 0) {
    console.error('Colonnes STATUT ou NOTES introuvables. Rien n’a été écrit.');
    process.exitCode = 1;
    return;
  }

  const dir = path.join('tmp', 'archives', today);
  const file = await writeBackup(dir, essaisSheet.headers, selected);
  if (file) console.log(`Copie : ${file}`);

  const fresh = await readTab(sheets, essaisId, essaisTab);
  if (!rowsStillSame(selected, fresh.rows) || fresh.statutCol < 0 || fresh.notesCol < 0) {
    console.log("Le Sheet a changé depuis la lecture. Rien n'a été écrit. Relancez le script.");
    return;
  }

  const safe = String(essaisTab).replace(/'/g, "''");
  const statutLetter = colLetter(fresh.statutCol);
  const notesLetter = colLetter(fresh.notesCol);
  const byRow = new Map(fresh.rows.map((row) => [row.row, row]));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: essaisId,
    requestBody: {
      valueInputOption: 'RAW',
      data: selected.flatMap((row) => {
        const current = byRow.get(row.row);
        const notes = appendClosNote(current?.notes, today);
        return [
          { range: `'${safe}'!${statutLetter}${row.row}`, values: [[row.statutPrevu]] },
          { range: `'${safe}'!${notesLetter}${row.row}`, values: [[notes]] },
        ];
      }),
    },
  });
  console.log('STATUT et NOTES mis à jour. Aucune ligne supprimée.');
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
