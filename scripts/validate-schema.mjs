/**
 * Valide le JSON-LD injecté dans chaque dist/.../index.html (après postbuild / prerender).
 * Pas d’appel Google, pas de dépendance npm.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSO } from '../asso.derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function walkIndexHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === 'bureau') continue;
      walkIndexHtml(full, out);
      continue;
    }
    if (name.name === 'index.html') out.push(full);
  }
  return out;
}

function routeFromFile(file) {
  const rel = path.relative(dist, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/\/index\.html$/, '')}`;
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script\s+type=["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

function nodesFromData(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data['@graph'])) return data['@graph'];
  if (data['@type']) return [data];
  return [];
}

function typeList(node) {
  const t = node?.['@type'];
  if (!t) return [];
  return Array.isArray(t) ? t.map(String) : [String(t)];
}

function hasType(nodes, name) {
  return nodes.some((n) => typeList(n).includes(name));
}

function flattenText(value, acc = []) {
  if (value == null) return acc;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    acc.push(String(value));
    return acc;
  }
  if (Array.isArray(value)) {
    for (const v of value) flattenText(v, acc);
    return acc;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) flattenText(v, acc);
  }
  return acc;
}

function validateRoute(route, nodes, rawJoined) {
  const fails = [];
  const blob = flattenText(nodes).join('\n');

  if (route === '/') {
    const orgOk =
      hasType(nodes, 'Organization') ||
      hasType(nodes, 'SportsOrganization') ||
      hasType(nodes, 'LocalBusiness');
    if (!orgOk) fails.push('manque Organization/SportsOrganization/LocalBusiness');
    if (ASSO.whatsapp && !rawJoined.includes(ASSO.whatsapp)) fails.push(`tél. sans ${ASSO.whatsapp}`);
    const price = String(ASSO.adhesion.tarif);
    const offerOk = nodes.some(
      (n) => typeList(n).includes('Offer') && String(n.price ?? '') === price,
    );
    if (!offerOk) fails.push(`Offer ${price} manquant`);
    if (!blob.includes(ASSO.nom)) fails.push('nom de l’association absent du graphe');
  }

  // Événements : seulement sur l’accueil, complets et pas déjà passés.
  const events = nodes.filter((n) => typeList(n).includes('Event'));
  if (events.length && route !== '/') fails.push('Event hors accueil');
  const today = new Date().toISOString().slice(0, 10);
  for (const ev of events) {
    const label = ev.name || '(sans nom)';
    if (!ev.name || !ev.startDate || !ev.location) fails.push(`Event incomplet : ${label}`);
    const end = String(ev.endDate || ev.startDate || '').slice(0, 10);
    if (end && end < today) fails.push(`Event passé : ${label}`);
  }

  if (/^\/cours-/.test(route)) {
    if (!hasType(nodes, 'Course')) fails.push('Course manquant');
    const instances = nodes.flatMap((n) => {
      const v = n.hasCourseInstance;
      return Array.isArray(v) ? v : v ? [v] : [];
    });
    const year = ASSO.saison.label.slice(0, 4);
    if (instances.some((i) => !String(i?.startDate || '').startsWith(year))) {
      fails.push(`startDate hors saison ${ASSO.saison.label}`);
    }
  }

  if (route === '/essai' || route === '/inscription') {
    if (!hasType(nodes, 'HowTo')) fails.push('HowTo manquant');
  }

  if (route === '/faq') {
    if (!hasType(nodes, 'FAQPage')) fails.push('FAQPage manquant');
  }

  if (route.startsWith('/blog/') && route !== '/blog') {
    if (!hasType(nodes, 'Article')) fails.push('Article manquant');
  }

  return fails;
}

function main() {
  if (!fs.existsSync(dist)) {
    console.error('[schema] dist/ introuvable — lancez le build avant');
    process.exit(1);
  }

  const files = walkIndexHtml(dist).sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    console.error('[schema] aucun index.html sous dist/');
    process.exit(1);
  }

  let failed = 0;

  for (const file of files) {
    const route = routeFromFile(file);
    const html = fs.readFileSync(file, 'utf8');
    const rawBlocks = extractJsonLd(html);
    const nodes = [];
    const parseErrors = [];

    for (let i = 0; i < rawBlocks.length; i++) {
      try {
        const data = JSON.parse(rawBlocks[i]);
        nodes.push(...nodesFromData(data));
      } catch (err) {
        parseErrors.push(`bloc ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (parseErrors.length) {
      failed += 1;
      console.log(`FAIL ${route} — JSON invalide (${parseErrors.join('; ')})`);
      continue;
    }

    const fails = validateRoute(route, nodes, rawBlocks.join('\n'));
    if (fails.length) {
      failed += 1;
      console.log(`FAIL ${route} — ${fails.join('; ')}`);
    } else {
      console.log(`OK   ${route}`);
    }
  }

  if (failed > 0) {
    console.error(`[schema] ${failed} page(s) en échec`);
    process.exit(1);
  }
  console.log(`[schema] ${files.length} page(s) OK`);
}

main();
