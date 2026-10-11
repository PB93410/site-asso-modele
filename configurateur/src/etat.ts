/** Copie modifiée d'un objet par chemin « association.nom » ou « lieux.0.rue ». */
export function avec<T>(obj: T, chemin: string, valeur: unknown): T {
  const [tete, ...reste] = chemin.split('.');
  const src = obj as Record<string, unknown>;
  const copie = (Array.isArray(obj) ? [...(obj as unknown[])] : { ...src }) as Record<string, unknown>;
  copie[tete] = reste.length ? avec(src[tete], reste.join('.'), valeur) : valeur;
  return copie as T;
}
