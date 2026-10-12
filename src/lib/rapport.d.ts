export function ageAu(dateNaissance: string, au?: Date): number | null;
export function trancheAge(age: number | null): string;
export function calculerRapport(
  data: { adherents?: Record<string, string>[]; essais?: Record<string, string>[]; presences?: Record<string, string>[] },
  maintenant?: Date,
): {
  saison: string;
  adhérentsAJour: number;
  adhesionsEnAttente: number;
  essais: number;
  essaisDevenusAdherents: number;
  conversionEssaiPct: number;
  presences: number;
  parAge: Record<string, number>;
  parCommune: Record<string, number>;
  parCours: Record<string, number>;
};
export function rapportCsv(r: ReturnType<typeof calculerRapport>): string;
export function rapportPdf(r: ReturnType<typeof calculerRapport>, asso: { nom?: string }): Buffer;
