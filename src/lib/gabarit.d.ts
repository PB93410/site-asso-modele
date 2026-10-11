import type { AssoConfig } from '../../asso.config';

export type ValeursTexte = Record<string, string>;
export declare function valeursTexte(asso: AssoConfig, nbCours?: number): ValeursTexte;
export declare function remplir(texte: string, valeurs: ValeursTexte): string;
