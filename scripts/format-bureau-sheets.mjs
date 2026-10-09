/**
 * Applique couleurs, en-têtes, filtres et menus sur les Sheets bureau.
 * Ne change pas les données ni l’ordre des colonnes. Pas de colonne PAYE.
 *
 * Adhérents A→R (ne pas renommer) :
 * NOM PRENOM TEL MAIL DATE_NAISSANCE ADRESSE CP VILLE MODE STATUT MONTANT
 * DETAIL DATE_PAIEMENT DROIT_IMAGE QS_SPORT SOURCE NOTES DATE_DEMANDE
 * STATUT : En attente | À jour | Essai | Arrêt
 * MODE : modes du formulaire (asso.derive.js → PAYMENT_MODES) | autres déjà présents
 * Colonnes vides après DATE_DEMANDE ignorées.
 *
 * Usage : node scripts/format-bureau-sheets.mjs
 * Env : .env local ou variables Netlify (compte de service éditeur).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './_env.mjs';
import { ASSO, PAYMENT_MODES } from '../asso.derive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LAST_DATA_ROW = 2000;

const HEADER_BG = hex('#3D4A2A');
const HEADER_FG = hex('#F7F4EE');
/** Corps du tableau : jamais blanc sur crème. */
const BODY_BG = hex('#FFFFFF');
const BODY_FG = hex('#1A1916');
const ADH_BODY_BG = hex('#F8F7F4');
const ADH_HEADER_FG = hex('#111110');

const ADH_STATUTS = ['En attente', 'À jour', 'Essai', 'Arrêt'];
const ESSAI_STATUTS = ['À faire', 'Relancé', 'Adhéré', 'Pas intéressé', 'À revoir'];
const EXTRA_ESSAI_STATUTS = ['Contacté', 'Créneau confirmé', 'Confirmé', 'Venu', 'Adhérent', 'Sans suite'];
const MODES = [...new Set([...PAYMENT_MODES, 'Bureau'])];
const SOURCES = ['Formulaire', ASSO.adhesion.paiementNom || 'En ligne', 'Bureau', 'Forum'];
const OUI_NON = ['Oui', 'Non', 'À demander', 'OK', 'Certificat demandé', 'Non renseigné', 'En attente', 'Annulé'];
/** Cours = colonne « course » de public/data/planning.csv. */
const COURSES = [
  ...new Set(
    fs
      .readFileSync(path.join(ROOT, 'public', 'data', 'planning.csv'), 'utf8')
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.split(',')[2]?.trim())
      .filter(Boolean),
  ),
  'À voir',
];
const NUM_ESSAI = Array.from({ length: Math.max(1, ASSO.adhesion.essais) }, (_, i) => String(i + 1));

const ADH_COLORS = {
  'En attente': '#FFF4EB',
  'À jour': '#EEF1E8',
};

const ESSAI_COLORS = {
  'À faire': '#FCE5CD',
  Relancé: '#FFF2CC',
  Adhéré: '#B6D7A8',
  'Pas intéressé': '#EFEFEF',
  'À revoir': '#F4CCCC',
  Contacté: '#FFF2CC',
  'Créneau confirmé': '#CFE2F3',
  Venu: '#D9EAD3',
  Adhérent: '#B6D7A8',
  'Sans suite': '#EFEFEF',
};

function hex(h) {
  const n = h.replace('#', '');
  return {
    red: parseInt(n.slice(0, 2), 16) / 255,
    green: parseInt(n.slice(2, 4), 16) / 255,
    blue: parseInt(n.slice(4, 6), 16) / 255,
  };
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function colIndex(headers, ...aliases) {
  const wanted = aliases.map(norm);
  return headers.findIndex((h) => wanted.includes(norm(h)));
}

function colLetter(idx) {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function listRule(values) {
  return {
    condition: {
      type: 'ONE_OF_LIST',
      values: values.map((userEnteredValue) => ({ userEnteredValue })),
    },
    showCustomUi: true,
    strict: false,
  };
}

function cfFormula(gid, colIdx, value, colorHex, endCol, index, headerRow) {
  const letter = colLetter(colIdx);
  const formulaRow = headerRow + 2;
  return {
    addConditionalFormatRule: {
      rule: {
        ranges: [
          {
            sheetId: gid,
            startRowIndex: headerRow + 1,
            endRowIndex: LAST_DATA_ROW,
            startColumnIndex: 0,
            endColumnIndex: endCol,
          },
        ],
        booleanRule: {
          condition: {
            type: 'CUSTOM_FORMULA',
            values: [{ userEnteredValue: `=$${letter}${formulaRow}="${value}"` }],
          },
          format: {
            backgroundColor: hex(colorHex),
            textFormat: { foregroundColor: BODY_FG },
          },
        },
      },
      index,
    },
  };
}

function bodyTextRequests(gid, colCount, headerRow, bg = BODY_BG, fg = BODY_FG) {
  return [
    {
      repeatCell: {
        range: {
          sheetId: gid,
          startRowIndex: headerRow + 1,
          endRowIndex: LAST_DATA_ROW,
          startColumnIndex: 0,
          endColumnIndex: colCount,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: bg,
            textFormat: { foregroundColor: fg, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
  ];
}

function headerRequests(gid, colCount, headerRow, opts = {}) {
  const headerBg = opts.headerBg || HEADER_BG;
  const headerFg = opts.headerFg || HEADER_FG;
  const freezeCols = opts.freezeCols || 0;
  const gridProperties = { frozenRowCount: headerRow + 1 };
  let gridFields = 'gridProperties.frozenRowCount';
  if (freezeCols > 0) {
    gridProperties.frozenColumnCount = freezeCols;
    gridFields += ',gridProperties.frozenColumnCount';
  }
  return [
    {
      updateSheetProperties: {
        properties: {
          sheetId: gid,
          gridProperties,
        },
        fields: gridFields,
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: gid,
          startRowIndex: headerRow,
          endRowIndex: headerRow + 1,
          startColumnIndex: 0,
          endColumnIndex: colCount,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerBg,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            textFormat: {
              foregroundColor: headerFg,
              bold: true,
              fontSize: 10,
            },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: gid,
          dimension: 'ROWS',
          startIndex: headerRow,
          endIndex: headerRow + 1,
        },
        properties: { pixelSize: 36 },
        fields: 'pixelSize',
      },
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId: gid,
            startRowIndex: headerRow,
            endRowIndex: LAST_DATA_ROW,
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
        },
      },
    },
  ];
}

/** Largeurs lisibles (px) — auto-resize Google trop étroit sur les en-têtes. */
function columnWidthPx(header) {
  const n = norm(header);
  const exact = {
    nom: 140,
    prenom: 130,
    tel: 120,
    telephone: 120,
    mail: 240,
    email: 240,
    datenaissance: 130,
    adresse: 260,
    cp: 80,
    codepostal: 80,
    ville: 140,
    mode: 160,
    statut: 120,
    montant: 95,
    detail: 200,
    datepaiement: 130,
    droitimage: 115,
    qssport: 140,
    source: 120,
    notes: 300,
    datedemande: 130,
  };
  if (exact[n]) return exact[n];
  return 130;
}

function widthRequests(gid, headers) {
  return headers.map((h, i) => ({
    updateDimensionProperties: {
      range: {
        sheetId: gid,
        dimension: 'COLUMNS',
        startIndex: i,
        endIndex: i + 1,
      },
      properties: { pixelSize: columnWidthPx(h) },
      fields: 'pixelSize',
    },
  }));
}

function wrapColumnRequest(gid, colIdx, headerRow) {
  if (colIdx < 0) return null;
  return {
    repeatCell: {
      range: {
        sheetId: gid,
        startRowIndex: headerRow + 1,
        endRowIndex: LAST_DATA_ROW,
        startColumnIndex: colIdx,
        endColumnIndex: colIdx + 1,
      },
      cell: {
        userEnteredFormat: {
          wrapStrategy: 'WRAP',
          verticalAlignment: 'TOP',
        },
      },
      fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
    },
  };
}

function validationRequest(gid, colIdx, values, headerRow) {
  if (colIdx < 0) return null;
  return {
    setDataValidation: {
      range: {
        sheetId: gid,
        startRowIndex: headerRow + 1,
        endRowIndex: LAST_DATA_ROW,
        startColumnIndex: colIdx,
        endColumnIndex: colIdx + 1,
      },
      rule: listRule(values),
    },
  };
}

function deleteExistingCf(sheet) {
  const gid = sheet.properties.sheetId;
  const n = (sheet.conditionalFormats || []).length;
  const reqs = [];
  for (let i = n - 1; i >= 0; i--) {
    reqs.push({ deleteConditionalFormatRule: { sheetId: gid, index: i } });
  }
  return reqs;
}

function findSheet(meta, title) {
  const wanted = norm(title);
  return (meta.data.sheets || []).find((s) => norm(s.properties.title) === wanted);
}

function looksLikeHeader(row) {
  const n = (row || []).map(norm);
  const hasName = n.some((c) => c.includes('prenom') || c === 'nom');
  const hasTel = n.some((c) => c.includes('tel') || c.includes('telephone'));
  return hasName && hasTel;
}

async function formatTab(sheets, spreadsheetId, meta, title, kind) {
  const sheet = findSheet(meta, title);
  if (!sheet) {
    console.log(`  skip : onglet « ${title} » introuvable`);
    return;
  }
  const gid = sheet.properties.sheetId;
  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A1:Z12`,
  });
  const preview = valuesRes.data.values || [];
  let headerRow = 0;
  for (let i = 0; i < preview.length; i++) {
    if (looksLikeHeader(preview[i])) {
      headerRow = i;
      break;
    }
  }
  const rawHeaders = (preview[headerRow] || []).map((h) => String(h || '').trim());
  let headers = rawHeaders;
  if (kind === 'adherents') {
    const cut = headers.findIndex((h) => String(h).replace(/\s+/g, '_').toUpperCase() === 'DATE_DEMANDE');
    if (cut >= 0) headers = headers.slice(0, cut + 1);
  }
  if (headers.length < 3 || !looksLikeHeader(headers)) {
    console.log(`  skip : « ${title} » — en-têtes insuffisants`);
    return;
  }
  const colCount = Math.max(headers.length, 8);
  console.log(`  ${title} (gid ${gid}) l.${headerRow + 1} : ${headers.join(' | ')}`);

  const adh = kind === 'adherents';
  const requests = [
    ...deleteExistingCf(sheet),
    ...bodyTextRequests(
      gid,
      colCount,
      headerRow,
      adh ? ADH_BODY_BG : BODY_BG,
      adh ? ADH_HEADER_FG : BODY_FG,
    ),
    ...headerRequests(
      gid,
      colCount,
      headerRow,
      adh ? { headerBg: ADH_BODY_BG, headerFg: ADH_HEADER_FG, freezeCols: 2 } : {},
    ),
  ];

  if (kind === 'adherents') {
    requests.push(...widthRequests(gid, headers));
    for (const wrap of [
      wrapColumnRequest(gid, colIndex(headers, 'ADRESSE', 'Adresse'), headerRow),
      wrapColumnRequest(gid, colIndex(headers, 'NOTES', 'Notes'), headerRow),
      wrapColumnRequest(gid, colIndex(headers, 'MAIL', 'Email', 'Mail'), headerRow),
      wrapColumnRequest(gid, colIndex(headers, 'DETAIL', 'Détail', 'Detail'), headerRow),
    ]) {
      if (wrap) requests.push(wrap);
    }
  } else {
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId: gid,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: colCount,
        },
      },
    });
  }

  const statutCol =
    kind === 'forum'
      ? colIndex(headers, 'Relance', 'Statut', 'STATUT')
      : colIndex(headers, 'STATUT', 'Statut', 'Relance');

  const colors = kind === 'adherents' ? ADH_COLORS : ESSAI_COLORS;
  if (statutCol >= 0) {
    let cfIndex = 0;
    for (const [value, color] of Object.entries(colors)) {
      requests.push(cfFormula(gid, statutCol, value, color, colCount, cfIndex, headerRow));
      cfIndex += 1;
    }
  }

  const validations = [];
  if (kind === 'adherents') {
    validations.push(
      validationRequest(gid, colIndex(headers, 'MODE', 'Mode'), MODES, headerRow),
      validationRequest(gid, colIndex(headers, 'STATUT', 'Statut'), ADH_STATUTS, headerRow),
      validationRequest(gid, colIndex(headers, 'SOURCE', 'Source'), SOURCES, headerRow),
      validationRequest(gid, colIndex(headers, 'DROIT_IMAGE', 'Droit image'), ['Oui', 'Non', 'À demander'], headerRow),
      validationRequest(
        gid,
        colIndex(headers, 'QS_SPORT', 'Qs sport'),
        ['Oui', 'Non', 'OK', 'Certificat demandé', 'Non renseigné'],
        headerRow,
      ),
    );
  } else if (kind === 'essais') {
    validations.push(
      validationRequest(gid, colIndex(headers, 'Cours', 'Cours souhaité'), COURSES, headerRow),
      validationRequest(gid, colIndex(headers, 'N essai', 'N° essai'), NUM_ESSAI, headerRow),
      validationRequest(gid, colIndex(headers, 'Présent', 'Present'), OUI_NON, headerRow),
      validationRequest(
        gid,
        colIndex(headers, 'Statut', 'STATUT', 'Relance'),
        [...ESSAI_STATUTS, ...EXTRA_ESSAI_STATUTS],
        headerRow,
      ),
      validationRequest(gid, colIndex(headers, 'Adhésion', 'Adhesion'), OUI_NON, headerRow),
      validationRequest(gid, colIndex(headers, 'Mode paiement', 'MODE'), MODES, headerRow),
    );
  } else if (kind === 'forum') {
    validations.push(
      validationRequest(gid, colIndex(headers, 'Cours souhaité', 'Cours'), COURSES, headerRow),
      validationRequest(gid, colIndex(headers, 'Adhésion stand', 'Adhesion stand'), ['Oui', 'Non', 'Plus tard'], headerRow),
      validationRequest(gid, colIndex(headers, 'Mode paiement', 'MODE'), MODES, headerRow),
      validationRequest(gid, colIndex(headers, 'Relance', 'Statut'), ESSAI_STATUTS, headerRow),
    );
  }

  for (const v of validations) {
    if (v) requests.push(v);
  }

  const telCol = colIndex(headers, 'TEL', 'Tel', 'Téléphone', 'Telephone');
  if (telCol >= 0) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: gid,
          startRowIndex: headerRow + 1,
          endRowIndex: LAST_DATA_ROW,
          startColumnIndex: telCol,
          endColumnIndex: telCol + 1,
        },
        cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  }

  const tabColor =
    kind === 'adherents' ? hex('#3D4A2A') : kind === 'forum' ? hex('#C45C26') : hex('#6B7B4A');
  requests.push({
    updateSheetProperties: {
      properties: { sheetId: gid, tabColor },
      fields: 'tabColor',
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  console.log(`  OK formaté`);
}

function pickTitle(meta, ...candidates) {
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);
  for (const c of candidates) {
    const exact = titles.find((t) => norm(t) === norm(c));
    if (exact) return exact;
  }
  for (const c of candidates) {
    const partial = titles.find((t) => norm(t).includes(norm(c)) || norm(c).includes(norm(t)));
    if (partial) return partial;
  }
  return null;
}

async function main() {
  loadEnv();
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON manquante (.env ou Netlify)');
  }

  const { getSheets, getAdherentsSheetId, getAdherentsTab, getEssaisSheetId, getEssaisTab } =
    await import('../netlify/functions/_bureau-lib.mjs');

  const sheets = await getSheets();
  const adherentsId = getAdherentsSheetId();
  const essaisId = getEssaisSheetId();
  const adhTab = getAdherentsTab();
  const essaiTab = getEssaisTab();

  console.log(`Adhérents → onglet « ${adhTab} »`);
  const adhMeta = await sheets.spreadsheets.get({
    spreadsheetId: adherentsId,
    fields: 'sheets(properties,conditionalFormats)',
  });
  await formatTab(sheets, adherentsId, adhMeta, adhTab, 'adherents');

  const essaisMeta = await sheets.spreadsheets.get({
    spreadsheetId: essaisId,
    fields: 'sheets(properties,conditionalFormats)',
  });
  const tabNames = (essaisMeta.data.sheets || []).map((s) => s.properties.title);
  console.log(`Essais classeur onglets : ${tabNames.join(' · ')}`);
  const essaiTitle = pickTitle(essaisMeta, essaiTab, 'Essais') || essaiTab;
  const forumTitle = pickTitle(essaisMeta, 'Forum 6 sept', 'Forum');
  if (essaiTitle) {
    console.log(`Essais → « ${essaiTitle} »`);
    await formatTab(sheets, essaisId, essaisMeta, essaiTitle, 'essais');
  }
  if (forumTitle) {
    const forumMeta = await sheets.spreadsheets.get({
      spreadsheetId: essaisId,
      fields: 'sheets(properties,conditionalFormats)',
    });
    console.log(`Forum → « ${forumTitle} »`);
    await formatTab(sheets, essaisId, forumMeta, forumTitle, 'forum');
  }

  console.log('Terminé. Rafraîchir Google Sheets dans le navigateur.');
}

main().catch((err) => {
  console.error('Échec formatage :', err?.message || err);
  process.exit(1);
});
