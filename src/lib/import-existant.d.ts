import type { Dossier, DossierCreneau } from './dossier';

export const COLONNES_ADHERENTS: string[];
export const CHAMPS_PLANNING: { id: string; label: string }[];
export const CHAMPS_ADHERENTS: { id: string; label: string }[];

export type GenreTableau = 'planning' | 'adherents' | 'inconnu';
export type MappingColonnes = Record<string, string>;
export type FicheAdherent = Record<string, string>;

export function normaliserEnTete(s: string): string;
export function correspondancePlanning(enTetes: string[]): MappingColonnes;
export function correspondanceAdherents(enTetes: string[]): MappingColonnes;
export function detecterGenre(enTetes: string[]): GenreTableau;
export function parseCsv(texte: string): string[][];
export function estCsv(nom: string): boolean;
export function estExcel(nom: string): boolean;
export function tableauxDepuisOctets(octets: ArrayBuffer | Uint8Array, nomFichier: string): Promise<{ nom: string; lignes: string[][] }[]>;
export function enTetesEtLignes(lignes: string[][]): { enTetes: string[]; corps: string[][] };
export function normaliserJour(raw: string): string;
export function parserHeure(raw: string): string;
export function parserPlage(raw: string): { debut: string; fin: string };
export function excelVersTexte(raw: string | number): string;
export function creneauxDepuisLignes(lignes: string[][], mapping: MappingColonnes): DossierCreneau[];
export function fichesDepuisLignes(lignes: string[][], mapping: MappingColonnes): FicheAdherent[];
export function integrerPlanning(dossier: unknown, creneaux: DossierCreneau[], opts?: { remplacer?: boolean }): Dossier;
export function integrerAdherents(dossier: unknown, fiches: FicheAdherent[], source?: string): Dossier;
export function csvAdherents(fiches: FicheAdherent[] | undefined): string;
