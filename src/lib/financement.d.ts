export function euros(n: unknown): number;
export function aidesProposees(financement?: { passSport?: number; ancvMax?: number; comiteEntreprise?: number }): {
  passSport: number;
  ancvMax: number;
  comiteEntreprise: number;
};
export function calculerReste(
  tarif: number,
  choix?: { passSport?: boolean; ancv?: number | string; ce?: number | string },
  plafonds?: { passSport?: number; ancvMax?: number; comiteEntreprise?: number },
): { pass: number; ancv: number; ce: number; aides: number; reste: number; tarif: number };
export function libelleAides(calc: { pass?: number; ancv?: number; ce?: number }): string;
export function notesFinancement(calc: { pass?: number; ancv?: number; ce?: number; reste: number }): string;
