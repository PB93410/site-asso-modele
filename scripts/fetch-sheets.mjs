/**
 * Télécharge les CSV Google Sheets publiés au moment du build → dist/data/*.csv
 *
 * URLs « Fichier → Partager → Publier sur le Web → CSV » de chaque onglet,
 * dans les variables d’environnement (Netlify ou .env) :
 *   SHEET_CSV_COACHS, SHEET_CSV_EVENEMENTS, SHEET_CSV_PLANNING
 * Sans URL : on garde public/data/*.csv (ou src/data/siteData.ts si absent).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distData = path.join(root, 'dist', 'data');
const publicData = path.join(root, 'public', 'data');

const TABS = {
  coachs: process.env.SHEET_CSV_COACHS || '',
  evenements: process.env.SHEET_CSV_EVENEMENTS || '',
  planning: process.env.SHEET_CSV_PLANNING || '',
};

async function fetchTab(name, url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { Accept: 'text/csv,text/plain,*/*' },
  });
  const text = await res.text();
  const head = text.slice(0, 300).toLowerCase();
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  if (head.includes('<!doctype') || head.includes('<html')) {
    throw new Error(`${name}: HTML reçu au lieu de CSV (publication Sheet ?)`);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

async function main() {
  fs.mkdirSync(distData, { recursive: true });
  console.log('[sheets] CSV Google…');

  for (const [name, url] of Object.entries(TABS)) {
    const file = `${name}.csv`;
    if (!url) {
      console.log(`[sheets] ${name} : pas d’URL publiée → public/data/${file}`);
      continue;
    }
    try {
      const csv = await fetchTab(name, url);
      fs.writeFileSync(path.join(distData, file), csv, 'utf8');
      fs.writeFileSync(path.join(publicData, file), csv, 'utf8');
      const lines = csv.split(/\r?\n/).filter((l) => l.trim()).length;
      console.log(`[sheets] OK ${file} (${lines} lignes)`);
    } catch (err) {
      console.warn(`[sheets] ÉCHEC ${name}:`, err.message || err);
      console.warn(`[sheets] → on garde public/data/${file}`);
    }
  }
  console.log('[sheets] done');
}

main();
