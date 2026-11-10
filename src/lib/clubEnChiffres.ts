/** Page publique « Le club en chiffres » (modules.clubEnChiffres) : ce qui ne dépend pas du registre. */

import { ASSO } from '../data/asso';

/** Nombre d'années depuis la création, à l'année près (0 si l'année n'est pas renseignée). */
export function anciennete(aujourdhui: Date, creation: string = ASSO.anneeCreation): number {
  const an = Number(String(creation || '').match(/\d{4}/)?.[0]);
  return an ? Math.max(0, aujourdhui.getFullYear() - an) : 0;
}

export const SEUIL_AFFICHE = 10;

export type ChiffresPublics = {
  ok: boolean;
  saison: string;
  adherentsPlusDe: number;
  parAge: { tranche: string; pct: number }[];
  communes: { nom: string; plusDe: number }[];
  nbCommunes: number;
};

function repliAdherents(): string {
  if (ASSO.club && 'repliAdherents' in ASSO.club) return String(ASSO.club.repliAdherents || '').trim();
  return 'plus d’une centaine';
}

/** « plus de 115 » si le registre répond et qu'on a au moins 10 personnes ; sinon la phrase de `club.repliAdherents`. */
export function libelleEffectif(plusDe: number, live: boolean, repli = repliAdherents()): string | null {
  if (live) return plusDe >= SEUIL_AFFICHE ? `plus de ${Math.floor(plusDe)}` : null;
  return repli || null;
}

/** « plus de 115 adhérents » / « plus d’une centaine d’adhérents » / « des adhérents ». */
export function libelleAdherents(plusDe: number, live: boolean, repli = repliAdherents()): string {
  const n = libelleEffectif(plusDe, live, repli);
  if (!n) return 'des adhérents';
  return live ? `${n} adhérents` : `${n} d’adhérents`;
}

function trancheOk(x: unknown): x is { tranche: string; pct: number } {
  if (!x || typeof x !== 'object') return false;
  const t = x as { tranche?: unknown; pct?: unknown };
  return typeof t.tranche === 'string' && Number.isFinite(Number(t.pct));
}

function communeOk(x: unknown): x is { nom: string; plusDe: number } {
  if (!x || typeof x !== 'object') return false;
  const t = x as { nom?: unknown; plusDe?: unknown };
  return typeof t.nom === 'string' && Number.isFinite(Number(t.plusDe));
}

export function chiffresDepuisApi(d: unknown): ChiffresPublics | null {
  if (!d || typeof d !== 'object') return null;
  const t = d as Record<string, unknown>;
  if (t.ok !== true) return null;
  const n = Number(t.adherentsPlusDe);
  if (!Number.isFinite(n) || n < 0) return null;
  return {
    ok: true,
    saison: String(t.saison || ''),
    adherentsPlusDe: n,
    parAge: Array.isArray(t.parAge) ? t.parAge.filter(trancheOk) : [],
    communes: Array.isArray(t.communes) ? t.communes.filter(communeOk) : [],
    nbCommunes: Number(t.nbCommunes) || 0,
  };
}

let pending: Promise<{ chiffres: ChiffresPublics; live: boolean }> | null = null;

/** Une seule lecture pour l’accueil et la page « Le club en chiffres ». */
export function chargerChiffresPublics(): Promise<{ chiffres: ChiffresPublics; live: boolean }> {
  if (pending) return pending;
  const vide: ChiffresPublics = { ok: false, saison: '', adherentsPlusDe: 0, parAge: [], communes: [], nbCommunes: 0 };
  pending = fetch('/api/club-chiffres')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const chiffres = chiffresDepuisApi(d);
      return chiffres ? { chiffres, live: true } : { chiffres: vide, live: false };
    })
    .catch(() => ({ chiffres: vide, live: false }));
  return pending;
}
