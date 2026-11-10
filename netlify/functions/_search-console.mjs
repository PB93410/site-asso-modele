/**
 * Recherches Google (Search Console) : les 28 jours glissants, sans donnée personnelle.
 * Le compte Google de l’asso doit avoir la propriété du site.
 */

import { ASSO, SITE_URL } from '../../asso.derive.js';
import { searchConsoleApi } from './_google-user.mjs';

const JOUR = 24 * 60 * 60 * 1000;

function ymdUtc(d) {
  return d.toISOString().slice(0, 10);
}

/** Fenêtre des 4 dernières semaines, en laissant 3 jours à Google pour consolider. */
export function periodeRecherche(now = new Date()) {
  const fin = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3));
  const debut = new Date(fin.getTime() - 27 * JOUR);
  return { debut: ymdUtc(debut), fin: ymdUtc(fin) };
}

export function siteSearchConsole(url = SITE_URL) {
  const u = String(url || '').replace(/\/+$/, '');
  return u.startsWith('http') ? `${u}/` : '';
}

function lignes(rows, max = 8) {
  return (rows || [])
    .slice(0, max)
    .map((r) => ({
      libelle: String(r.keys?.[0] || '').trim(),
      clics: Math.round(Number(r.clicks) || 0),
      impressions: Math.round(Number(r.impressions) || 0),
      position: Number(r.position) || 0,
    }))
    .filter((l) => l.libelle);
}

function totaux(rows) {
  let clics = 0;
  let impressions = 0;
  let pond = 0;
  for (const r of rows || []) {
    const c = Number(r.clicks) || 0;
    const i = Number(r.impressions) || 0;
    const p = Number(r.position) || 0;
    clics += c;
    impressions += i;
    pond += p * i;
  }
  return {
    clics: Math.round(clics),
    impressions: Math.round(impressions),
    position: impressions ? pond / impressions : 0,
  };
}

function cheminPage(url) {
  try {
    const u = new URL(url);
    return u.pathname === '/' ? '/' : u.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return url;
  }
}

export function presenter(queryRows, pageRows, periode, site) {
  const t = totaux(queryRows);
  return {
    ok: true,
    site,
    periode,
    clics: t.clics,
    impressions: t.impressions,
    position: t.position,
    recherches: lignes(queryRows),
    pages: lignes(pageRows).map((l) => ({ ...l, libelle: cheminPage(l.libelle) })),
  };
}

async function requete(sc, siteUrl, periode, dimension) {
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: periode.debut,
      endDate: periode.fin,
      dimensions: [dimension],
      rowLimit: 10,
    },
  });
  return res?.data?.rows || [];
}

/**
 * @returns {Promise<{ ok: true, site: string, periode: { debut: string, fin: string }, clics: number, impressions: number, position: number, recherches: object[], pages: object[] }>}
 */
export async function releveSearchConsole(now = new Date()) {
  const periode = periodeRecherche(now);
  const urlPrefix = siteSearchConsole();
  if (!urlPrefix) throw new Error('siteUrl manquant');
  const sc = searchConsoleApi();
  const candidats = [urlPrefix];
  try {
    const hote = new URL(urlPrefix).hostname.replace(/^www\./, '');
    if (hote) candidats.push(`sc-domain:${hote}`);
  } catch {
    /* ignore */
  }
  let dernier;
  for (const site of candidats) {
    try {
      const [queries, pages] = await Promise.all([
        requete(sc, site, periode, 'query'),
        requete(sc, site, periode, 'page'),
      ]);
      return presenter(queries, pages, periode, site);
    } catch (err) {
      dernier = err;
    }
  }
  throw dernier || new Error('Search Console injoignable');
}

export function texteMailReleve(r, asso = ASSO) {
  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
  const place = r.position ? ` Place moyenne : ${r.position.toFixed(1).replace('.', ',')}.` : '';
  const recherches = (r.recherches || [])
    .slice(0, 5)
    .map((l) => `• ${l.libelle} — ${fmt(l.clics)} visite${l.clics > 1 ? 's' : ''}`)
    .join('\n');
  const pages = (r.pages || [])
    .slice(0, 5)
    .map((l) => `• ${l.libelle} — ${fmt(l.clics)} visite${l.clics > 1 ? 's' : ''}`)
    .join('\n');
  return [
    'Bonjour,',
    '',
    `Voici le relevé Search Console de ${asso.nom} (du ${r.periode.debut} au ${r.periode.fin}).`,
    `Google met 2 à 3 jours à compléter ses chiffres.${place}`,
    '',
    `Visites venues de Google : ${fmt(r.clics)}`,
    `Fois où Google a montré le site : ${fmt(r.impressions)}`,
    '',
    'Ce que les gens tapent :',
    recherches || '• (aucune recherche sur la période)',
    '',
    'Pages ouvertes depuis Google :',
    pages || '• (aucune page sur la période)',
    '',
    'Le détail reste dans la Search Console.',
    '',
    'Le site',
  ].join('\n');
}

export function demoLignesSearchConsole(site = siteSearchConsole()) {
  return presenter(
    [
      { keys: ['association sportive'], clicks: 42, impressions: 210, position: 8.4 },
      { keys: ['cours essai'], clicks: 18, impressions: 90, position: 6.1 },
    ],
    [{ keys: [site], clicks: 40, impressions: 180, position: 7.2 }],
    periodeRecherche(new Date('2026-11-10T08:00:00Z')),
    site,
  );
}
