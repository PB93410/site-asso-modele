/**
 * Mini tableur : la partie de l'API Google Sheets utilisée par le site
 * (spreadsheets.values.get / append / update / batchUpdate / clear), sur des onglets
 * rangés ailleurs. Sert au mode démo (en mémoire) et au stockage Netlify (_stockage.mjs).
 *
 * Un onglet = tableau de lignes, chaque ligne = tableau de cellules (texte).
 */

function colIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** « 'Saison 2026-2027'!S12 » → { tab, col, row } (col et row à partir de 0, null si absents). */
export function parseA1(range) {
  const m = String(range).match(/^(?:'((?:[^']|'')+)'|([^!]+))!?([A-Z]*)(\d*)(?::([A-Z]*)(\d*))?$/);
  if (!m) throw new Error(`Plage invalide : ${range}`);
  return {
    tab: (m[1] ?? m[2]).replace(/''/g, "'"),
    col: m[3] ? colIndex(m[3]) : 0,
    row: m[4] ? Number(m[4]) - 1 : null,
  };
}

/** Saisie « USER_ENTERED » : l’apostrophe de tête force le texte et disparaît. */
const entered = (v) => {
  const s = String(v ?? '');
  return s.startsWith("'") ? s.slice(1) : s;
};

function writeCell(rows, r, c, value) {
  while (rows.length <= r) rows.push([]);
  const line = rows[r];
  while (line.length <= c) line.push('');
  line[c] = entered(value);
}

/**
 * @param {{
 *   lire: (id: string, tab: string) => Promise<string[][]>,
 *   modifier: <T>(id: string, tab: string, fn: (rows: string[][]) => T) => Promise<T>,
 * }} acces  `modifier` applique fn aux lignes (modifiables sur place) et enregistre, d'un seul tenant.
 */
export function tableurValues(acces) {
  const values = {
    async get({ spreadsheetId, range }) {
      const { tab } = parseA1(range);
      const rows = await acces.lire(spreadsheetId, tab);
      return { data: { values: rows.map((r) => [...r]) } };
    },
    async append({ spreadsheetId, range, requestBody }) {
      const { tab } = parseA1(range);
      const n = await acces.modifier(spreadsheetId, tab, (rows) => {
        for (const v of requestBody.values || []) rows.push(v.map(entered));
        return rows.length;
      });
      return { data: { updates: { updatedRange: `'${tab}'!A${n}:Z${n}` } } };
    },
    async update({ spreadsheetId, range, requestBody }) {
      const { tab, col, row } = parseA1(range);
      await acces.modifier(spreadsheetId, tab, (rows) => {
        (requestBody.values || []).forEach((v, i) => v.forEach((cell, j) => writeCell(rows, (row ?? 0) + i, col + j, cell)));
      });
      return { data: {} };
    },
    async batchUpdate({ spreadsheetId, requestBody }) {
      // Regroupé par onglet : toutes les cellules d'un onglet sont écrites ensemble.
      const parTab = new Map();
      for (const d of requestBody.data || []) {
        const a = parseA1(d.range);
        if (!parTab.has(a.tab)) parTab.set(a.tab, []);
        parTab.get(a.tab).push({ ...a, values: d.values || [] });
      }
      for (const [tab, ecritures] of parTab) {
        await acces.modifier(spreadsheetId, tab, (rows) => {
          for (const { col, row, values: vals } of ecritures) {
            vals.forEach((v, i) => v.forEach((cell, j) => writeCell(rows, (row ?? 0) + i, col + j, cell)));
          }
        });
      }
      return { data: {} };
    },
    async clear({ spreadsheetId, range }) {
      const { tab, row } = parseA1(range);
      await acces.modifier(spreadsheetId, tab, (rows) => {
        rows.length = Math.min(rows.length, row ?? 0);
      });
      return { data: {} };
    },
  };
  return { spreadsheets: { values } };
}
