export const LISTE_ATTENTE_HEADERS: string[];
export const ONGLET_LISTE_ATTENTE: string;
export const STATUTS_OCCUPE_ESSAI: string[];
export const STATUTS_FILE: string[];

export function slugFile(s: string): string;
export function cleFile(type: string, cours: string, creneau?: string): string;
export function capaciteDefaut(asso: { listeAttente?: { capaciteDefaut?: number } }): number;
export function delaiHeures(asso: { listeAttente?: { delaiReponseHeures?: number } }): number;
export function foldCreneau(s: string): string;
export function memeCreneau(a: string, b: string): boolean;
export function occupesEssai(essais: Record<string, string>[], cours: string, creneau?: string): Record<string, string>[];
export function occupesAdhesion(adherents: Record<string, string>[], cours: string): Record<string, string>[];
export function filePour(
  lignes: Record<string, string>[],
  type: string,
  cours: string,
  creneau?: string,
): Record<string, string>[];
export function secretListe(env?: NodeJS.ProcessEnv): string;
export function nouvelId(): string;
export function signerClaim(id: string, secret: string): string;
export function verifierClaim(id: string, token: string, secret: string): boolean;
export function urlClaim(siteUrl: string, token: string): string;
export function expireLe(heures: number, maintenant?: Date): string;
export function claimEncoreValable(ligne: Record<string, string>, maintenant?: Date): boolean;
export function texteNotif(
  asso: { nom: string; nomCourt?: string },
  personne: { prenom?: string; PRENOM?: string; cours?: string; COURS?: string },
  url: string,
  heures: number,
): { subject: string; text: string };
export function waHref(tel: string, texte: string): string;
export function estComplet(p: { occupes: number; file: number; capacite: number }): boolean;
