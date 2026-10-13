export const ALERTES_HEADERS: string[];
export const ALERTES_ABOS_HEADERS: string[];
export const ONGLET_ALERTES: string;
export const ONGLET_ALERTES_ABOS: string;
export const TYPES_ALERTE: string[];
export function secretAlertes(env?: NodeJS.ProcessEnv): string;
export function nouvelIdAlerte(): string;
export function tokenDesabonnement(mail: string, secret: string): string;
export function verifierTokenDesabonnement(mail: string, token: string, secret: string): boolean;
export function expireLe(dateSeance: string): string;
export function alerteActive(alerte: Record<string, string>, aujourdHui: string): boolean;
export function typeAlerte(raw: string): string;
export function libelleType(type: string): string;
export function messageAlerteMail(
  asso: { nom?: string; nomCourt?: string },
  alerte: Record<string, string>,
  urlDesabo: string,
): { subject: string; text: string };
export function payloadPush(
  asso: { nom?: string; nomCourt?: string },
  alerte: Record<string, string>,
): { title: string; body: string; url: string };
export function emailValide(raw: string): boolean;
