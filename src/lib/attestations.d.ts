export const TYPES_ATTESTATION: string[];
export function foldMail(s: string): string;
export function foldNumero(s: string): string;
export function recuFiscalEligible(asso: { attestations?: { recuFiscal?: boolean } }): boolean;
export function typesDisponibles(asso: { attestations?: { recuFiscal?: boolean } }): string[];
export function libelleType(type: string): string;
export function secretAttestations(env?: NodeJS.ProcessEnv): string;
export function expireDans(heures: number, maintenant?: Date): string;
export function signerAcces(p: { numero: string; mail: string; exp: string | number }, secret: string): string;
export function verifierAcces(
  p: { numero: string; mail: string; exp: string | number; token: string },
  secret: string,
  maintenant?: Date,
): boolean;
export function urlMagique(
  siteUrl: string,
  p: { numero: string; mail: string; exp: string | number; token: string },
): string;
export function numeroRecu(asso: { sigle?: string; saison?: { label?: string } }, numero: string): string;
export function trouverAdherent(rows: Record<string, string>[], numero: string, mail: string): Record<string, string> | null;
export function estAJour(fiche: Record<string, string>): boolean;
export function montantPaye(fiche: Record<string, string>, asso: { adhesion?: { tarif?: number } }): number;
export function fabriquerPdf(p: { titre: string; lignes: string[] }): Buffer;
export function fichePublique(
  fiche: Record<string, string>,
  asso: { adhesion?: { tarif?: number }; saison?: { label?: string } },
): {
  prenom: string;
  nom: string;
  numero: string;
  mail: string;
  adresse: string;
  cp: string;
  ville: string;
  mode: string;
  datePaiement: string;
  montant: number;
  saison: string;
};
export function lignesAdhesion(asso: Record<string, unknown>, p: ReturnType<typeof fichePublique>, aujourdHui?: Date): string[];
export function lignesFiscal(asso: Record<string, unknown>, p: ReturnType<typeof fichePublique>, aujourdHui?: Date): string[];
export function lignesCe(asso: Record<string, unknown>, p: ReturnType<typeof fichePublique>, aujourdHui?: Date): string[];
export function attestationPdf(
  type: string,
  p: { asso: Record<string, unknown>; fiche: Record<string, string>; aujourdHui?: Date },
): Buffer;
export function nomFichier(type: string, numero: string): string;
