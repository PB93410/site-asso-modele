/**
 * « Le club en chiffres » (modules.clubEnChiffres) : ce que le public peut voir du registre, sans jamais
 * identifier personne. Reprend les totaux du rapport annuel (src/lib/rapport.js), puis les rend publiables :
 *   - le nombre d'adhérents est arrondi vers le bas à 5 (« plus de 115 ») : un chiffre exact, mis à jour
 *     à chaque adhésion, permettrait de deviner qui vient de s'inscrire ;
 *   - une tranche d'âge ou une commune de moins de 10 personnes n'est pas montrée ;
 *   - les parts sont arrondies à 5 % ;
 *   - aucun essai, aucun montant, aucun mode de paiement, aucune ligne de fiche.
 */

export const SEUIL = 10;

/** 118 → 115. */
export const arrondi5 = (n) => Math.floor(Math.max(0, Number(n) || 0) / 5) * 5;

const NON_RENSEIGNE = 'Non renseigné';
const PETITS_MOTS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'sous', 'en', 'et', 'aux', 'au', 'lès', 'les']);

const plier = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, ' ')
    .trim();

/** « VILLEXEMPLE-SUR-MER » → « Villexemple-sur-Mer » (la saisie des fiches est libre). */
function joliNom(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((m, i) => (i > 0 && PETITS_MOTS.has(m) ? m : m.charAt(0).toUpperCase() + m.slice(1)))
    .join('');
}

/** Regroupe les communes écrites de plusieurs façons (casse, accents, tirets). */
function regrouperCommunes(parCommune) {
  const groupes = new Map();
  for (const [nom, n] of Object.entries(parCommune || {})) {
    if (nom === NON_RENSEIGNE) continue;
    const cle = plier(nom);
    if (!cle) continue;
    const g = groupes.get(cle) || { nom: joliNom(nom), n: 0 };
    g.n += n;
    groupes.set(cle, g);
  }
  return [...groupes.values()].sort((a, b) => b.n - a.n);
}

/**
 * @param {{ saison: string, adhérentsAJour: number, parAge: Record<string, number>, parCommune: Record<string, number> }} r  résultat de calculerRapport
 * @returns {{ saison: string, adherentsPlusDe: number, parAge: { tranche: string, pct: number }[], communes: { nom: string, plusDe: number }[], nbCommunes: number }}
 */
export function publier(r) {
  const ages = Object.entries(r?.parAge || {}).filter(([t]) => t !== NON_RENSEIGNE);
  const connus = ages.reduce((s, [, n]) => s + n, 0);
  const communes = regrouperCommunes(r?.parCommune);
  return {
    saison: String(r?.saison || ''),
    adherentsPlusDe: arrondi5(r?.['adhérentsAJour']),
    parAge: ages
      .filter(([, n]) => n >= SEUIL)
      .map(([tranche, n]) => ({ tranche, pct: Math.round((n / connus) * 20) * 5 })),
    communes: communes.filter((c) => c.n >= SEUIL).map((c) => ({ nom: c.nom, plusDe: arrondi5(c.n) })),
    nbCommunes: communes.length,
  };
}
