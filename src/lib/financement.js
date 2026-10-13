/**
 * Aides à la cotisation (modules.financement).
 */

export function euros(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return v;
}

export function aidesProposees(financement = {}) {
  return {
    passSport: euros(financement.passSport),
    ancvMax: euros(financement.ancvMax),
    comiteEntreprise: euros(financement.comiteEntreprise),
  };
}

/**
 * @param {number} tarif
 * @param {{ passSport?: boolean, ancv?: number, ce?: number }} choix
 * @param {{ passSport?: number, ancvMax?: number, comiteEntreprise?: number }} plafonds
 */
export function calculerReste(tarif, choix = {}, plafonds = {}) {
  const p = aidesProposees(plafonds);
  const pass = choix.passSport && p.passSport ? p.passSport : 0;
  const ancv = Math.min(euros(choix.ancv), p.ancvMax);
  const ce = Math.min(euros(choix.ce), p.comiteEntreprise);
  const aides = pass + ancv + ce;
  const reste = Math.max(0, euros(tarif) - aides);
  return { pass, ancv, ce, aides, reste, tarif: euros(tarif) };
}

export function libelleAides({ pass, ancv, ce }) {
  const parts = [];
  if (pass) parts.push(`Pass'Sport ${pass} €`);
  if (ancv) parts.push(`ANCV ${ancv} €`);
  if (ce) parts.push(`Comité d’entreprise ${ce} €`);
  return parts.join(' + ');
}

export function notesFinancement(calc) {
  const l = libelleAides(calc);
  if (!l) return '';
  return `Aides: ${l} | Reste: ${calc.reste} €`;
}
