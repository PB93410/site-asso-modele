/**
 * Registre des numéros d'adhérent (stockage Netlify, store « numeros ») : pour chaque numéro,
 * l'empreinte de la personne qui l'a reçu. Empreinte = HMAC du téléphone (9 chiffres) et du prénom
 * plié, avec BUREAU_SECRET : aucune donnée lisible n'est gardée, on ne peut que comparer.
 *
 * Sert au contrôle du matin (controle-numeros.mjs) quand les adhérents sont dans Google Sheets :
 * un tri du classeur qui oublie la colonne NUMERO (S) donne les numéros à d'autres personnes,
 * alors que les cartes déjà envoyées portent l'ancien. Le contrôle le voit le lendemain.
 */

import { createHmac } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { adherentAJourKey } from './_bureau-lib.mjs';
import { isCarteImageNumero } from './_cartes-store.mjs';

export const STORE_NUMEROS = 'numeros';
const CLE_REGISTRE = 'registre';

/** Repère du secret utilisé (changer BUREAU_SECRET relance l'amorçage au lieu d'alerter). */
export function repereSecret(secret) {
  return createHmac('sha256', String(secret || '')).update('registre-numeros').digest('hex').slice(0, 12);
}

/** Empreinte de la personne (téléphone + prénom), vide si l'un manque. */
export function empreinte(tel, prenom, secret) {
  const cle = adherentAJourKey(tel, prenom);
  if (!cle || !secret) return '';
  return createHmac('sha256', String(secret)).update(`numero:${cle}`).digest('hex').slice(0, 24);
}

/**
 * Compare le classeur au registre. Les numéros jamais vus sont ajoutés (amorçage), jamais signalés.
 * @param {{ ligne: number, numero: string, tel: string, prenom: string }[]} fiches
 * @param {{ repere?: string, numeros?: Record<string, string> } | null} registre
 */
export function controlerRegistre(fiches, registre, secret) {
  const repere = repereSecret(secret);
  const amorcage = !registre || registre.repere !== repere;
  const numeros = amorcage ? {} : { ...(registre.numeros || {}) };
  const decales = [];
  const nouveaux = [];
  const parNumero = new Map();
  for (const f of fiches) {
    const numero = String(f.numero || '').trim().toUpperCase();
    if (!isCarteImageNumero(numero)) continue;
    const e = empreinte(f.tel, f.prenom, secret);
    if (!parNumero.has(numero)) parNumero.set(numero, []);
    parNumero.get(numero).push({ ligne: f.ligne, e });
    if (!e) continue;
    if (!numeros[numero]) {
      numeros[numero] = e;
      nouveaux.push(numero);
    } else if (numeros[numero] !== e && !amorcage) {
      decales.push({ numero, ligne: f.ligne });
    }
  }
  // Un numéro porté par deux personnes différentes (une fiche en double de la même personne ne compte pas).
  const doublons = [];
  for (const [numero, lignes] of parNumero) {
    if (new Set(lignes.map((l) => l.e).filter(Boolean)).size > 1) doublons.push({ numero, lignes: lignes.map((l) => l.ligne) });
  }
  // Un numéro déjà enregistré n'est jamais réécrit : le registre garde la première personne.
  for (const d of decales) numeros[d.numero] = registre.numeros[d.numero];
  return { amorcage, decales, doublons, nouveaux, registre: { repere, numeros, maj: new Date().toISOString() } };
}

export function texteAlerte({ decales, doublons }, onglet) {
  const lignes = [
    'Bonjour,',
    '',
    `Le contrôle du matin a trouvé un décalage dans l’onglet « ${onglet} » du classeur des adhérents.`,
    'Cause habituelle : un tri du classeur qui n’a pas emporté la colonne NUMERO (S).',
    '',
  ];
  if (decales.length) {
    lignes.push(`${decales.length} numéro(s) sur la fiche d’une autre personne que celle qui l’a reçu :`);
    for (const d of decales.slice(0, 60)) lignes.push(`  - ${d.numero} (ligne ${d.ligne})`);
    if (decales.length > 60) lignes.push(`  … et ${decales.length - 60} autre(s).`);
    lignes.push('');
  }
  if (doublons.length) {
    lignes.push('Numéro porté par deux personnes différentes :');
    for (const d of doublons) lignes.push(`  - ${d.numero} (lignes ${d.lignes.join(', ')})`);
    lignes.push('');
  }
  lignes.push(
    'Ces adhérents ont une carte qui ne correspond plus à leur fiche.',
    'À faire : dans Google Sheets, Fichier → Historique des versions, revenir à la version d’avant le tri. Ne rien renuméroter à la main.',
    'Pour trier sans risque : Données → Créer une vue filtrée.',
    '',
    'Le site',
  );
  return lignes.join('\n');
}

export const storeNumeros = () => getStore({ name: STORE_NUMEROS, consistency: 'strong' });

export async function lireRegistre(store = storeNumeros()) {
  return store.get(CLE_REGISTRE, { type: 'json' });
}

export async function ecrireRegistre(registre, store = storeNumeros()) {
  await store.setJSON(CLE_REGISTRE, registre);
}
