import type { AssoConfig, AssoModules } from './asso.config';

export declare const ASSO: AssoConfig;
export declare const MODULES: AssoModules;
export declare const SITE_URL: string;
export declare const SAISON_COURTE: string;
export declare const SEASON_PREFIX: string;
export declare function essaisOuverts(maintenant?: number, fin?: string): boolean;
export declare const MODE_CARTE: string;
export declare const PAYMENT_MODES: string[];
export declare function slugify(s: string): string;
export declare const VILLE_SLUG: string;
