/**
 * La salle d'un cours à partir du lieu écrit dans le planning (nom ou id d'un lieu de asso.config.js → lieux),
 * avec son adresse et un itinéraire Google Maps vers elle. Le site n'annonce aucun temps de trajet.
 */
import type { AssoLieu } from '../data/asso';
import { ASSO, lieuAdresse } from '../data/asso';

export type Salle = { nom: string; adresse: string; itineraire: string };

const plier = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Salle reconnue dans le lieu du planning, ou null (lieu vide ou inconnu : on n'invente rien). */
export function salleDuCours(lieu?: string, lieux: AssoLieu[] = ASSO.lieux): Salle | null {
  const l = plier(lieu || '');
  if (!l) return null;
  const trouve =
    lieux.find((x) => plier(x.nom) === l || plier(x.id) === l) || lieux.find((x) => plier(x.nom) && l.includes(plier(x.nom)));
  if (!trouve || !String(trouve.rue || '').trim()) return null;
  const adresse = lieuAdresse(trouve);
  return {
    nom: trouve.nom,
    adresse,
    itineraire: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: `${trouve.nom}, ${adresse}` }).toString()}`,
  };
}
