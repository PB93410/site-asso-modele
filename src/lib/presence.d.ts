export const PRESENCES_HEADERS: string[];
export const ONGLET_PRESENCES: string;
export const SEMAINES_INACTIF_DEFAUT: number;
export function slugSession(s: string): string;
export function sessionId(jour: string, horaire: string, cours: string): string;
export function parisYmd(date?: Date): string;
export function parisJour(date?: Date): string;
export function jourDeYmd(ymd: string): string;
export function ajouterJoursYmd(ymd: string, n: number): string;
export function secretPresence(env?: NodeJS.ProcessEnv): string;
export function signerPresence(session: string, ymd: string, secret: string): string;
export function verifierJetonPresence(session: string, ymd: string, token: string, secret: string): boolean;
export function urlPresence(siteUrl: string, session: string, token: string): string;
export function identifiantPointage(numero?: string, mail?: string): string;
export function clePointage(ymd: string, session: string, numero?: string, mail?: string): string;
export function lignesDepuisValeurs(
  values: unknown[][],
  headersAttendus?: string[],
): { headers: string[]; lignes: Record<string, string | number>[] };
export function dejaPointe(
  lignes: { DATE?: string; SESSION?: string; NUMERO?: string; MAIL?: string }[],
  ymd: string,
  session: string,
  numero?: string,
  mail?: string,
): boolean;
export function sessionsDuJour(
  planning: { day?: string; jour?: string; time?: string; horaire?: string; course?: string; cours?: string; location?: string; lieu?: string }[],
  ymd: string,
): { id: string; jour: string; horaire: string; cours: string; lieu: string }[];
export function statsPresences(
  lignes: { DATE?: string; SESSION?: string; COURS?: string; HORAIRE?: string }[],
  opts?: { from?: string; to?: string },
): {
  sessions: { session: string; cours: string; horaire: string; total: number; seances: number }[];
  cours: { cours: string; total: number }[];
  total: number;
};
export function inactifs(
  adherents: Record<string, string>[],
  presences: { DATE?: string; NUMERO?: string; MAIL?: string }[],
  opts?: { semaines?: number; aujourdHui?: string },
): { prenom: string; nom: string; mail: string; numero: string; derniere: string; semaines: number | null }[];
export function texteRelance(
  asso: { nom?: string; nomCourt?: string },
  personne: { prenom?: string; semaines?: number | null },
  semaines?: number,
): { subject: string; text: string };
