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
import { adherentAJourKey, foldStatut, telPersonKey } from './_bureau-lib.mjs';
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
 * Empreintes séparées du téléphone et du prénom (même secret, rien de lisible). Elles permettent de
 * reconnaître une fiche corrigée (même téléphone ou même prénom) sans jamais garder la saisie.
 * Vide si l'un des deux manque.
 */
export function empreintesParties(tel, prenom, secret) {
  const t = telPersonKey(tel);
  const p = foldStatut(prenom);
  if (!t || !p || !secret) return null;
  const h = (label, v) => createHmac('sha256', String(secret)).update(`${label}:${v}`).digest('hex').slice(0, 24);
  return { t: h('tel', t), p: h('prenom', p) };
}

/**
 * Fiche corrigée plutôt que numéro décalé : la personne du registre n'est sur aucune autre fiche, et la
 * fiche garde son téléphone (prénom corrigé) ou son prénom (téléphone corrigé). Sans les parties
 * enregistrées (registre d'avant cette version), on ne sait pas : décalé.
 * @returns {'tel' | 'prenom' | ''}
 */
export function champCorrige(avant, apres, personneAilleurs) {
  if (!avant || !apres || personneAilleurs) return '';
  if (avant.t === apres.t && avant.p !== apres.p) return 'prenom';
  if (avant.p === apres.p && avant.t !== apres.t) return 'tel';
  return '';
}

/**
 * Compare le classeur au registre. Les numéros jamais vus sont ajoutés (amorçage), jamais signalés.
 * @param {{ ligne: number, numero: string, tel: string, prenom: string }[]} fiches
 * @param {{ repere?: string, numeros?: Record<string, string>, parties?: Record<string, { t: string, p: string }> } | null} registre
 * Une fiche corrigée est prise en compte (le registre suit la fiche) et signalée à part, une seule fois.
 */
export function controlerRegistre(fiches, registre, secret) {
  const repere = repereSecret(secret);
  const amorcage = !registre || registre.repere !== repere;
  const numeros = amorcage ? {} : { ...(registre.numeros || {}) };
  const parties = amorcage ? {} : { ...(registre.parties || {}) };
  const tousE = new Set(fiches.map((f) => empreinte(f.tel, f.prenom, secret)).filter(Boolean));
  const decales = [];
  const corriges = [];
  const nouveaux = [];
  const parNumero = new Map();
  for (const f of fiches) {
    const numero = String(f.numero || '').trim().toUpperCase();
    if (!isCarteImageNumero(numero)) continue;
    const e = empreinte(f.tel, f.prenom, secret);
    if (!parNumero.has(numero)) parNumero.set(numero, []);
    parNumero.get(numero).push({ ligne: f.ligne, e });
    if (!e) continue;
    const p = empreintesParties(f.tel, f.prenom, secret);
    if (!numeros[numero]) {
      numeros[numero] = e;
      if (p) parties[numero] = p;
      nouveaux.push(numero);
    } else if (numeros[numero] === e) {
      if (p && !parties[numero]) parties[numero] = p;
    } else if (!amorcage) {
      const champ = champCorrige(parties[numero], p, tousE.has(numeros[numero]));
      if (champ) {
        corriges.push({ numero, ligne: f.ligne, champ });
        numeros[numero] = e;
        parties[numero] = p;
      } else {
        decales.push({ numero, ligne: f.ligne });
      }
    }
  }
  // Un numéro porté par deux personnes différentes (une fiche en double de la même personne ne compte pas).
  const doublons = [];
  for (const [numero, lignes] of parNumero) {
    if (new Set(lignes.map((l) => l.e).filter(Boolean)).size > 1) doublons.push({ numero, lignes: lignes.map((l) => l.ligne) });
  }
  // Un numéro déjà enregistré n'est jamais réécrit : le registre garde la première personne.
  for (const d of decales) numeros[d.numero] = registre.numeros[d.numero];
  return { amorcage, decales, corriges, doublons, nouveaux, registre: { repere, numeros, parties, maj: new Date().toISOString() } };
}

/** Objet du mail : « décalés » seulement s'il y a un vrai décalage ou un doublon. */
export function sujetAlerte({ decales, corriges = [], doublons }, sigle) {
  if (decales.length || doublons.length) {
    return `[${sigle}] Numéros d’adhérent décalés dans le classeur (${decales.length + doublons.length})`;
  }
  return `[${sigle}] Fiche(s) corrigée(s) dans le classeur (${corriges.length})`;
}

export function texteAlerte({ decales, corriges = [], doublons }, onglet) {
  const graves = decales.length || doublons.length;
  const lignes = ['Bonjour,', ''];
  if (graves) {
    lignes.push(
      `Le contrôle du matin a trouvé un décalage dans l’onglet « ${onglet} » du classeur des adhérents.`,
      'Cause habituelle : un tri du classeur qui n’a pas emporté la colonne NUMERO (S).',
      '',
    );
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
    );
  }
  if (corriges.length) {
    lignes.push(
      graves
        ? 'Par ailleurs, fiche(s) corrigée(s) (faute de frappe) :'
        : `Le contrôle du matin a trouvé ${corriges.length} fiche(s) corrigée(s) dans l’onglet « ${onglet} » (faute de frappe). Le numéro est sur la bonne personne :`,
    );
    for (const c of corriges) {
      lignes.push(
        c.champ === 'prenom'
          ? `  - ${c.numero} (ligne ${c.ligne}) : prénom corrigé`
          : `  - ${c.numero} (ligne ${c.ligne}) : téléphone corrigé`,
      );
    }
    lignes.push(
      '',
      'Le contrôle a pris la correction en compte : ce message ne reviendra pas. Si la carte de cette personne a déjà été envoyée avec l’ancienne saisie, la renvoyer.',
      'Ce n’est pas un tri : ne pas revenir à une ancienne version du classeur (la correction serait perdue).',
      '',
    );
  }
  lignes.push('Le site');
  return lignes.join('\n');
}

export const storeNumeros = () => getStore({ name: STORE_NUMEROS, consistency: 'strong' });

export async function lireRegistre(store = storeNumeros()) {
  return store.get(CLE_REGISTRE, { type: 'json' });
}

export async function ecrireRegistre(registre, store = storeNumeros()) {
  await store.setJSON(CLE_REGISTRE, registre);
}
