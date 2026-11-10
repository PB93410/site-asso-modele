/**
 * Tarif et fin des essais : overlay du bureau (onglet REGLAGES), sinon asso.config.js.
 * Si l’onglet est illisible ou ses colonnes ont bougé : on retombe sur la config, on ne casse pas le site.
 */

import { ASSO } from '../../asso.derive.js';
import { getSiteSheetId, getSheets } from './_bureau-lib.mjs';

export const ONGLET_REGLAGES = 'REGLAGES';
export const REGLAGES_HEADERS = ['TARIF', 'FIN_ESSAIS'];

export function reglagesConfig() {
  return {
    tarif: Number(ASSO.adhesion?.tarif) || 0,
    finEssais: String(ASSO.saison?.finEssais || ''),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** null si valides, sinon le message à montrer au bureau. */
export function erreurReglages(r) {
  const tarif = Number(r?.tarif);
  if (!Number.isInteger(tarif) || tarif <= 0 || tarif > 9999) {
    return 'Le tarif est un nombre entier d’euros, plus grand que zéro.';
  }
  const fin = String(r?.finEssais || '').trim();
  if (fin && !DATE.test(fin)) return 'La fin des essais est une date AAAA-MM-JJ, ou vide (toute l’année).';
  return null;
}

export function normaliserReglages(r) {
  return {
    tarif: Number(r?.tarif) || 0,
    finEssais: String(r?.finEssais || '').trim(),
  };
}

function plier(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Première ligne = TARIF, FIN_ESSAIS (ordre libre). */
export function lireLignesReglages(rows) {
  const lignes = Array.isArray(rows) ? rows : [];
  if (!lignes.length) return { ok: false, raison: 'vide' };
  const entetes = (lignes[0] || []).map((h) => plier(h));
  const iTarif = entetes.indexOf('tarif');
  const iFin = entetes.indexOf('finessais');
  if (iTarif < 0 || iFin < 0) {
    const rien = !(lignes[0] || []).some((c) => String(c || '').trim());
    return { ok: false, raison: rien ? 'vide' : 'entetes' };
  }
  const corps = lignes.slice(1).find((l) => (l || []).some((c) => String(c || '').trim()));
  if (!corps) return { ok: false, raison: 'vide' };
  const brut = { tarif: corps[iTarif], finEssais: corps[iFin] };
  const reglages = normaliserReglages(brut);
  if (erreurReglages(reglages)) return { ok: false, raison: 'valeurs', reglages };
  return { ok: true, reglages };
}

export function lignesReglages(r) {
  const n = normaliserReglages(r);
  return [REGLAGES_HEADERS, [String(n.tarif), n.finEssais]];
}

async function lignesOnglet() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSiteSheetId(),
    range: `'${ONGLET_REGLAGES}'!A:B`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data?.values || [];
}

/**
 * @returns {{ reglages: { tarif: number, finEssais: string }, source: 'config'|'stockage', etat: 'ok'|'incorrect'|'panne', enLigne: { tarif: number, finEssais: string } }}
 */
export async function lireReglages() {
  const enLigne = reglagesConfig();
  try {
    const lu = lireLignesReglages(await lignesOnglet());
    if (lu.ok) return { reglages: lu.reglages, source: 'stockage', etat: 'ok', enLigne };
    return { reglages: enLigne, source: 'config', etat: lu.raison === 'vide' ? 'ok' : 'incorrect', enLigne };
  } catch {
    return { reglages: enLigne, source: 'config', etat: 'panne', enLigne };
  }
}

export async function ecrireReglages(r) {
  const reglages = normaliserReglages(r);
  const err = erreurReglages(reglages);
  if (err) throw Object.assign(new Error(err), { code: 400 });
  const sheets = await getSheets();
  const id = getSiteSheetId();
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `'${ONGLET_REGLAGES}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: lignesReglages(reglages) },
  });
  await sheets.spreadsheets.values.clear({
    spreadsheetId: id,
    range: `'${ONGLET_REGLAGES}'!A3:B`,
  });
  return reglages;
}
