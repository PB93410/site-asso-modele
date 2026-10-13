import type { AssoModules } from '../../asso.config';
import type { Dossier, DossierCours } from './dossier';

export interface PrereglageFederation {
  nom: string;
  sigle: string;
  url: string;
}

export interface Prereglage {
  id: string;
  titre: string;
  resume: string;
  accroche?: string;
  slogan?: string;
  inclus?: string;
  federation?: PrereglageFederation;
  couleurs?: { primaire: string; secondaire: string };
  modules?: Partial<AssoModules>;
  cours?: DossierCours[];
  faq?: { question: string; reponse: string; populaire?: boolean }[];
}

export const PRESETS: Prereglage[];
export const PRESET_AUCUN: Pick<Prereglage, 'id' | 'titre' | 'resume'>;
export const IDS_PREREGLAGES: string[];
export function prereglageParId(id: string): Prereglage | Pick<Prereglage, 'id' | 'titre' | 'resume'> | null;
export function listePrereglages(): Array<Prereglage | Pick<Prereglage, 'id' | 'titre' | 'resume'>>;
export function couleursProposees(): string[];
export function appliquerPrereglage(dossier: unknown, id: string): Dossier;
