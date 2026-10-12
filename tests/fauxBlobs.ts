/** Faux Netlify Blobs en mémoire, mêmes règles de version (etag) que le vrai store. */
type Entree = { data: unknown; etag: string };

export function fauxBlobs() {
  const memoire = new Map<string, Entree>();
  let version = 0;
  const store = {
    async get(cle: string) {
      return memoire.get(cle)?.data ?? null;
    },
    async getWithMetadata(cle: string) {
      const e = memoire.get(cle);
      return e ? { data: e.data, etag: e.etag, metadata: {} } : null;
    },
    async setJSON(cle: string, valeur: unknown, opts: { onlyIfMatch?: string; onlyIfNew?: boolean } = {}) {
      const e = memoire.get(cle);
      if (opts.onlyIfNew && e) return { modified: false };
      if (opts.onlyIfMatch && e?.etag !== opts.onlyIfMatch) return { modified: false };
      version += 1;
      memoire.set(cle, { data: JSON.parse(JSON.stringify(valeur)), etag: `"v${version}"` });
      return { modified: true, etag: `"v${version}"` };
    },
    async delete(cle: string) {
      memoire.delete(cle);
    },
  };
  return { memoire, store, module: { getStore: () => store, connectLambda: () => {} } };
}
