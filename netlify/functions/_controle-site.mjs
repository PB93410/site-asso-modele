/**
 * Contrôle de nuit : le site public répond-il encore ? Un build raté mis en ligne peut laisser des pages
 * en 404 sans que personne ne s'en aperçoive. Aucune donnée personnelle : des adresses, des codes HTTP,
 * un mot attendu. Lecture seule.
 */

import { ASSO, MODULES } from '../../asso.derive.js';

/**
 * Ce qui doit répondre, selon les modules activés. `contient` : mot attendu dans la page (une page
 * blanche en 200 est un problème). L'API d'essai ne sert que POST : un GET en 405 prouve qu'elle est en ligne.
 */
export function controlesDuSite(modules = MODULES, sigle = ASSO.sigle) {
  return [
    { nom: 'Accueil', chemin: '/', attendu: 200, contient: sigle },
    { nom: 'Tarifs', chemin: '/tarifs/', attendu: 200, contient: '' },
    modules.essais && { nom: 'Essai', chemin: '/essai/', attendu: 200, contient: '' },
    modules.adhesion && { nom: 'Inscription', chemin: '/inscription/', attendu: 200, contient: '' },
    modules.espace && { nom: 'Espace adhérent', chemin: '/espace', attendu: 200, contient: '' },
    { nom: 'Santé du serveur', chemin: '/.netlify/functions/health', attendu: 200, contient: '"status":"ok"' },
    modules.essais && { nom: 'Envoi des essais (API)', chemin: '/api/essai', attendu: 405, contient: '' },
  ].filter(Boolean);
}

/**
 * @param {typeof fetch} fetchFn
 * @param {string} base  site sans « / » final
 * @returns {Promise<{ nom: string, chemin: string, attendu: number, recu: string }[]>} les contrôles en échec
 */
export async function controlerSite(fetchFn, base, controles = controlesDuSite(), delaiMs = 15_000, pause = attendre) {
  let echecs = await passer(fetchFn, base, controles);
  if (echecs.length) {
    // Un déploiement ou un réseau capricieux peut tromper une fois : on revérifie les seuls échecs.
    await pause(delaiMs);
    echecs = await passer(fetchFn, base, controles.filter((c) => echecs.some((e) => e.chemin === c.chemin)));
  }
  return echecs;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function passer(fetchFn, base, controles) {
  const echecs = [];
  for (const c of controles) {
    const resultat = await verifier(fetchFn, base, c);
    if (resultat) echecs.push(resultat);
  }
  return echecs;
}

async function verifier(fetchFn, base, c) {
  const echec = (recu) => ({ nom: c.nom, chemin: c.chemin, attendu: c.attendu, recu });
  try {
    const res = await fetchFn(`${base}${c.chemin}`, {
      headers: { 'user-agent': 'controle-nuit' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status !== c.attendu) return echec(`code ${res.status}`);
    if (c.contient) {
      const texte = await res.text();
      if (!texte.includes(c.contient)) return echec('page vide ou inattendue');
    }
    return null;
  } catch (err) {
    return echec(err?.name === 'TimeoutError' ? 'pas de réponse (20 s)' : 'injoignable');
  }
}

export function sujetProbleme(echecs, sigle = ASSO.sigle) {
  return `[${sigle}] Le site a un problème (${echecs.length} page${echecs.length > 1 ? 's' : ''})`;
}

export function texteProbleme(echecs, base) {
  const lignes = [
    'Bonjour,',
    '',
    `Le contrôle de nuit n’a pas pu ouvrir correctement ${echecs.length > 1 ? 'ces pages' : 'cette page'} de ${base} (deux essais à 15 secondes d’écart) :`,
    '',
  ];
  for (const e of echecs) lignes.push(`  - ${e.nom} (${e.chemin}) : ${e.recu}, attendu ${e.attendu}`);
  lignes.push(
    '',
    'Que faire :',
    '  1. Ouvrir la page concernée dans le navigateur : si elle marche, c’était passager.',
    '  2. Sinon, prévenir la personne qui s’occupe du site. Si une mise en ligne vient d’avoir lieu, la cause est',
    '     probablement là : Netlify → Deploys → republier la version précédente (« Publish deploy »).',
    '',
    'Le site',
  );
  return lignes.join('\n');
}
