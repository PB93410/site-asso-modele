/**
 * Envoie les PNG de tmp/cartes dans le coffre Netlify (privé).
 *   node scripts/upload-cartes-blobs.mjs
 * N’affiche pas le jeton. Ne publie pas les images sur le site.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '@netlify/blobs';
import { CARTES_STORE, SEASON_PREFIX, isCarteImageNumero } from '../netlify/functions/_cartes-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ID = '8f894d3d-556c-4cbb-9d03-22e782ec2c96';

function cliToken() {
  const file = path.join(os.homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const token = cfg?.users?.[cfg.userId]?.auth?.token;
  if (!token || typeof token !== 'string') throw new Error('Jeton Netlify introuvable dans la session CLI.');
  return token;
}

async function main() {
  const dir = path.join(ROOT, 'tmp', 'cartes');
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.png'))
    .map((name) => ({ name, numero: name.replace(/\.png$/i, '') }))
    .filter((f) => isCarteImageNumero(f.numero));

  if (files.length === 0) throw new Error(`Aucun PNG ${SEASON_PREFIX}xxx dans tmp/cartes`);

  const store = getStore({
    name: CARTES_STORE,
    siteID: SITE_ID,
    token: cliToken(),
    consistency: 'strong',
  });

  let ok = 0;
  for (const file of files) {
    const buf = fs.readFileSync(path.join(dir, file.name));
    await store.set(file.numero, new Blob([buf], { type: 'image/png' }), {
      metadata: { contentType: 'image/png' },
    });
    ok += 1;
    if (ok % 10 === 0) console.log(`${ok}/${files.length}`);
  }

  const sample = files[0];
  const back = await store.get(sample.numero, { type: 'arrayBuffer' });
  const local = fs.statSync(path.join(dir, sample.name)).size;
  const remote = back ? back.byteLength : 0;
  if (remote !== local) {
    throw new Error(`Taille différente pour ${sample.numero} : local ${local}, coffre ${remote}`);
  }

  const listed = await store.list();
  const keys = (listed.blobs || []).map((b) => b.key).filter((k) => isCarteImageNumero(k));
  console.log(`Coffre « ${CARTES_STORE} » : ${ok} envoyés, ${keys.length} clés, contrôle ${sample.numero} ${remote} octets.`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
