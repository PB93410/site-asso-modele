/**
 * Carte Wallet (modules.wallet).
 * GET action=apercu|pkpass|google
 */

import { ASSO, MODULES } from '../../asso.derive.js';
import { champsPass, fabriquerPkpass, googleSaveUrl, prochainCours } from '../../src/lib/wallet.js';
import { alerteActive, libelleType } from '../../src/lib/alertes.js';
import { parisYmd } from '../../src/lib/presence.js';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  getPlanningTab,
  getSiteSheetId,
  handleOptions,
  json,
  moduleOff,
  pickRow,
  readSheetAsObjects,
  readSheetValues,
  requireAuth,
} from './_bureau-lib.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { lireOngletSite } from './_onglet.mjs';
import { parseCsv, readProjectFile } from './_demo.mjs';

function planningDepuis(values) {
  const rows = Array.isArray(values) ? values : [];
  const start = rows[0] && /day|jour/i.test(String(rows[0][0] || '')) ? 1 : 0;
  return rows.slice(start).map((r) => ({
    day: String(r[0] || '').trim(),
    time: String(r[1] || '').trim(),
    course: String(r[2] || '').trim(),
  })).filter((p) => p.day && p.course);
}

/** Planning du site (tableur, sinon public/data/planning.csv). */
export async function lirePlanning() {
  try {
    const values = await readSheetValues(getSiteSheetId(), getPlanningTab());
    const p = planningDepuis(values);
    if (p.length) return p;
  } catch {
    // csv
  }
  return planningDepuis(parseCsv(readProjectFile('public/data/planning.csv')));
}

async function alerteTexte() {
  if (!MODULES.alertes) return '';
  try {
    const { lignes } = await lireOngletSite('ALERTES', ['ID', 'DATE', 'COURS', 'TYPE', 'MESSAGE', 'EXPIRE_LE']);
    const liste = lignes.filter((a) => alerteActive(a, parisYmd()));
    if (!liste.length) return '';
    const a = liste[0];
    return `${libelleType(a.TYPE || a.type)} ${a.COURS || a.cours || ''} — ${a.MESSAGE || a.message || ''}`.trim();
  } catch {
    return '';
  }
}

async function fiche(numero) {
  const { rows } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
  const n = String(numero || '').trim().toUpperCase();
  return rows.find((r) => String(pickRow(r, 'NUMERO', 'Numero') || '').trim().toUpperCase() === n) || null;
}

/** Contenu du pass : celui de l'adhérent `numero`, ou une carte d'exemple. */
export async function payloadPour(numero) {
  const planning = await lirePlanning();
  const f = numero ? await fiche(numero) : null;
  return champsPass({
    asso: ASSO,
    prenom: f ? pickRow(f, 'PRENOM', 'Prenom') : 'Marie',
    nom: f ? pickRow(f, 'NOM', 'Nom') : 'Exemple',
    numero: numero || `${ASSO.sigle}-apercu`,
    prochain: prochainCours(planning),
    alerte: await alerteTexte(),
  });
}

async function handler(event) {
  brancherStockage(event);
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  const off = moduleOff('wallet');
  if (off) return off;

  const q = event.queryStringParameters || {};
  const action = String(q.action || 'apercu').trim();
  const numero = String(q.numero || q.n || '').trim();

  // Une vraie carte (nom, prénom) : réservée au bureau. L'adhérent passe par son espace (/api/espace).
  if ((action === 'pkpass' || action === 'apercu') && numero) {
    const auth = requireAuth(event, { roles: ['admin', 'seance'] });
    if (!auth.ok) return auth.response;
  }

  if (action === 'apercu') {
    const pass = await payloadPour(numero);
    return json(200, {
      pass,
      demo: process.env.DEMO === '1' || !process.env.APPLE_PASS_CERT,
      google: Boolean(process.env.GOOGLE_WALLET_SA_JSON),
      prochain: pass.generic?.auxiliaryFields?.[0]?.value || '',
      alerte: pass.generic?.backFields?.find((c) => c.key === 'alerte')?.value || '',
    });
  }

  if (action === 'pkpass') {
    const pass = await payloadPour(numero);
    const bin = fabriquerPkpass(pass, { signe: Boolean(process.env.APPLE_PASS_CERT) && process.env.DEMO !== '1' });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${(numero || 'carte').replace(/[^\w.-]+/g, '_')}.pkpass"`,
        'Cache-Control': 'no-store',
      },
      body: bin.toString('base64'),
      isBase64Encoded: true,
    };
  }

  if (action === 'google') {
    const jwt = '';
    return json(200, {
      url: googleSaveUrl(jwt),
      demo: process.env.DEMO === '1' || !process.env.GOOGLE_WALLET_SA_JSON,
      message: 'En démo, Google Wallet n’est pas signé. Le bouton reste visible.',
    });
  }

  return json(400, { error: 'Action inconnue.' });
}

export { handler as traiter };
export default versV2(handler);
