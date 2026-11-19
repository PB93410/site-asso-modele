/**
 * Captures après retouches design : /bureau (connexion) et /tarifs.
 * Résolutions 1440×900 et 390×900.
 * Usage : npm run build && node scripts/shot-retouches.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'docs', 'captures', 'retouches-design');
const BASE = 'http://localhost:4173';

function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', '4173'], {
      cwd: path.resolve(__dirname, '..'),
      shell: true,
    });
    const timeout = setTimeout(() => reject(new Error('vite preview timeout')), 20_000);
    const ready = (d) => {
      if (String(d).includes('4173')) {
        clearTimeout(timeout);
        resolve(proc);
      }
    };
    proc.stdout.on('data', ready);
    proc.stderr.on('data', ready);
    proc.on('error', reject);
  });
}

async function capture(page, url, file, width) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
  await page.waitForSelector('h1, form', { timeout: 10_000 });
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓  ${path.relative(path.resolve(__dirname, '..'), file)}`);
}

async function main() {
  console.log('Démarrage de vite preview…');
  const server = await startPreview();

  const browser = await puppeteer.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const [route, prefix] of [
      ['/bureau', 'bureau'],
      ['/tarifs', 'tarifs'],
    ]) {
      console.log(`\nCapture ${route}…`);
      for (const [w, label] of [
        [1440, '1440'],
        [390, '390'],
      ]) {
        const page = await browser.newPage();
        await page.emulateTimezone('Europe/Paris');
        await page.evaluateOnNewDocument(() => {
          sessionStorage.clear();
          localStorage.clear();
        });
        await capture(page, `${BASE}${route}`, path.join(outDir, `${prefix}-${label}.png`), w);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.kill();
    console.log('\nCaptures terminées.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});