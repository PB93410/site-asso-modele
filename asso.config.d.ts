export interface AssoLieu {
  id: string;
  nom: string;
  rue: string;
  acces?: string;
}

export interface AssoConfig {
  nom: string;
  nomCourt: string;
  sigle: string;
  accroche: string;
  slogan: string;
  anneeCreation: string;
  statut: string;
  rna: string;
  siret: string;
  siege: string;
  responsablePublication: string;
  assureur: string;
  ville: string;
  codePostal: string;
  departement: string;
  region: string;
  communesVoisines: string[];
  lieux: AssoLieu[];
  siteUrl: string;
  email: string;
  telephone: string;
  whatsapp: string;
  reseaux: { instagram: string; facebook: string; avisGoogle: string };
  federation: { nom: string; sigle: string; url: string; logo: string };
  adhesion: {
    tarif: number;
    inclus: string;
    essais: number;
    paiementNom: string;
    paiementUrl: string;
    autresPaiements: string[];
  };
  saison: { label: string; reprise: string; finCampagneEssai: string };
  couleurs: { primaire: string; primaireHover: string; secondaire: string; secondaireHover: string };
  logo: string;
  heroImage: string;
  heroAlt: string;
}

declare const ASSO: AssoConfig;
export default ASSO;
