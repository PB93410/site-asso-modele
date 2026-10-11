/**
 * API publiques de l'État, gratuites et sans clé. Si elles ne répondent pas,
 * le questionnaire reste utilisable : on saisit à la main.
 */

export type AssociationTrouvee = {
  nom: string;
  siret: string;
  rna: string;
  anneeCreation: string;
  siege: string;
  rue: string;
  codePostal: string;
  ville: string;
};

export type AdresseTrouvee = {
  label: string;
  rue: string;
  codePostal: string;
  ville: string;
  departement: string;
  region: string;
  lat?: number;
  lon?: number;
};

/** « SPORT SANTE DES TILLEULS » → « Sport Sante des Tilleuls ». */
function casse(s: string) {
  const petits = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'd', 'l', 'à', 'au', 'aux', 'en', 'pour', 'sur']);
  return String(s || '')
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((m, i) => (i > 0 && petits.has(m) ? m : m.charAt(0).toUpperCase() + m.slice(1)))
    .join('');
}

async function getJson(url: string, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

type ResultatEntreprise = {
  nom_complet?: string;
  nom_raison_sociale?: string;
  date_creation?: string;
  nature_juridique?: string;
  siege?: { siret?: string; adresse?: string; code_postal?: string; libelle_commune?: string; numero_voie?: string; type_voie?: string; libelle_voie?: string };
  complements?: { identifiant_association?: string; est_association?: boolean };
};

async function rechercheBrute(q: string): Promise<ResultatEntreprise[]> {
  const data = await getJson(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=8`);
  return (Array.isArray(data?.results) ? data.results : []).filter(
    (r: ResultatEntreprise) => r.complements?.est_association || String(r.nature_juridique || '').startsWith('92'),
  );
}

/**
 * Recherche par nom (+ ville), numéro RNA (W…) ou SIRET. Associations seulement.
 * Les noms officiels sont souvent abrégés (« ASS GYMN VOLONTAIRE … ») : sans résultat
 * pour la phrase entière, on réessaie chaque mot avec le dernier (en général la ville).
 */
export async function chercherAssociation(q: string): Promise<AssociationTrouvee[]> {
  const terme = q.trim();
  if (terme.length < 3) return [];
  let results = await rechercheBrute(terme);
  const mots = terme.split(/\s+/).filter((m) => m.length > 2);
  if (!results.length && mots.length > 2) {
    const ville = mots[mots.length - 1];
    const essais = await Promise.all(mots.slice(0, -1).map((m) => rechercheBrute(`${m} ${ville}`).catch(() => [])));
    const vus = new Set<string>();
    results = essais.flat().filter((r) => {
      const cle = r.siege?.siret || r.nom_complet || '';
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
  }
  return results
    .slice(0, 8)
    .map((r) => {
      const s = r.siege || {};
      const rue = [s.numero_voie, s.type_voie, s.libelle_voie].filter(Boolean).join(' ');
      return {
        nom: casse(r.nom_complet || r.nom_raison_sociale || ''),
        siret: s.siret || '',
        rna: r.complements?.identifiant_association || '',
        anneeCreation: String(r.date_creation || '').slice(0, 4),
        siege: casse(s.adresse || '').replace(/\b(\d{5})\b/, '$1'),
        rue: casse(rue),
        codePostal: s.code_postal || '',
        ville: casse(s.libelle_commune || ''),
      };
    });
}

type FeatureAdresse = {
  properties?: { label?: string; name?: string; postcode?: string; city?: string; context?: string; type?: string };
  geometry?: { coordinates?: [number, number] };
};

const BAN = [
  'https://data.geopf.fr/geocodage/search', // Géoplateforme (IGN), successeur de la BAN
  'https://api-adresse.data.gouv.fr/search/',
];

/** Recherche d'adresse (ou de commune avec `communes`). */
export async function chercherAdresse(q: string, communes = false): Promise<AdresseTrouvee[]> {
  const terme = q.trim();
  if (terme.length < 3) return [];
  let data: { features?: FeatureAdresse[] } | null = null;
  for (const base of BAN) {
    try {
      data = await getJson(`${base}?q=${encodeURIComponent(terme)}&limit=6${communes ? '&type=municipality' : ''}`);
      break;
    } catch {
      // essai suivant
    }
  }
  if (!data) throw new Error('Recherche d’adresse indisponible');
  return (data.features || []).map((f) => {
    const p = f.properties || {};
    const [dep = '', depNom = '', region = ''] = String(p.context || '').split(',').map((x) => x.trim());
    const [lon, lat] = f.geometry?.coordinates || [];
    return {
      label: p.label || '',
      rue: communes ? '' : p.name || '',
      codePostal: p.postcode || '',
      ville: p.city || '',
      departement: depNom || dep,
      region,
      ...(typeof lat === 'number' && typeof lon === 'number' ? { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) } : {}),
    };
  });
}
