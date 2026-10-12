/**
 * Parties testables de `npm run sheets:creer` : quels classeurs créer, et mise à jour du .env.
 */

import { ADHERENTS_HEADERS, ESSAIS_HEADERS } from '../netlify/functions/_bureau-lib.mjs';

/**
 * Classeurs à créer selon les fonctions activées.
 * @param {object} asso    asso.config.js
 * @param {{essais: boolean, adhesion: boolean, bureau: boolean}} modules
 * @param {{ planning: string[][], evenements: string[][] }} site  lignes CSV (en-têtes compris)
 * @param {Record<string, string>} env  pour les noms d'onglets personnalisés
 */
export function planClasseurs(asso, modules, site, env = {}) {
  const nom = asso.nomCourt || asso.nom;
  const plan = [];
  if (modules.essais || modules.bureau) {
    plan.push({
      cle: 'GOOGLE_SHEET_ESSAIS_ID',
      titre: `${nom} — Essais`,
      role: 'les demandes d’essai du site',
      onglets: [{ titre: env.GOOGLE_SHEET_ESSAIS_NAME || 'Essais', lignes: [ESSAIS_HEADERS] }],
    });
  }
  if (modules.adhesion || modules.bureau) {
    plan.push({
      cle: 'GOOGLE_SHEET_ID',
      titre: `${nom} — Adhérents ${asso.saison.label}`,
      role: 'les adhésions et les numéros de carte',
      // NUMERO (S) et CARTE (T) juste après DATE_DEMANDE (R) : le bureau y écrit.
      onglets: [{ titre: env.GOOGLE_SHEET_NAME || `Saison ${asso.saison.label}`, lignes: [[...ADHERENTS_HEADERS, 'NUMERO', 'CARTE']] }],
    });
  }
  if (modules.bureau) {
    const onglets = [
      { titre: env.GOOGLE_SITE_TAB_PLANNING || 'PLANNING', lignes: site.planning },
      { titre: env.GOOGLE_SITE_TAB_EVENTS || 'EVENEMENTS', lignes: site.evenements },
    ];
    if (modules.presences) {
      onglets.push({ titre: 'PRESENCES', lignes: [['DATE', 'SESSION', 'COURS', 'HORAIRE', 'NUMERO', 'PRENOM', 'NOM', 'MAIL', 'HEURE']] });
    }
    if (modules.alertes) {
      onglets.push({ titre: 'ALERTES', lignes: [['ID', 'DATE', 'SESSION', 'COURS', 'TYPE', 'MESSAGE', 'CREEE_LE', 'EXPIRE_LE']] });
      onglets.push({ titre: 'ALERTES_ABOS', lignes: [['MAIL', 'CONSENT', 'DATE', 'TOKEN', 'PUSH', 'ACTIF']] });
    }
    plan.push({
      cle: 'GOOGLE_SITE_SHEET_ID',
      titre: `${nom} — Contenu du site`,
      role: 'les horaires et événements modifiés depuis /bureau',
      onglets,
    });
  }
  return plan;
}

/** Met à jour (ou ajoute) des variables dans le texte d'un .env, sans toucher au reste. */
export function majEnv(texte, valeurs) {
  const lignes = String(texte || '').replace(/\r\n/g, '\n').split('\n');
  const restantes = { ...valeurs };
  const out = lignes.map((l) => {
    const m = l.match(/^\s*#?\s*([A-Z0-9_]+)\s*=/);
    if (m && m[1] in restantes) {
      const v = restantes[m[1]];
      delete restantes[m[1]];
      return `${m[1]}=${v}`;
    }
    return l;
  });
  while (out.length && out[out.length - 1] === '') out.pop();
  const ajouts = Object.entries(restantes).map(([k, v]) => `${k}=${v}`);
  if (ajouts.length) out.push('', '# Classeurs créés par npm run sheets:creer', ...ajouts);
  return `${out.join('\n')}\n`;
}
