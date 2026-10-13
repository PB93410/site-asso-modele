export function prochainCours(
  planning: { day?: string; jour?: string; time?: string; horaire?: string; course?: string; cours?: string }[],
  maintenant?: Date,
): string;
export function champsPass(p: {
  asso: { nom: string; nomCourt?: string };
  prenom?: string;
  nom?: string;
  numero?: string;
  prochain?: string;
  alerte?: string;
}): Record<string, unknown>;
export function fabriquerPkpass(pass: Record<string, unknown>, opts?: { signe?: boolean }): Buffer;
export function googleSaveUrl(jwt: string): string;
