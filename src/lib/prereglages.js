/**
 * Préréglages du questionnaire : un fichier JSON par type d’association.
 * Pour en ajouter un : créez src/lib/prereglages/<id>.json (voir un fichier existant)
 * et importez-le dans PRESETS ci-dessous.
 */

import gymVolontaire from './prereglages/gym-volontaire.json' with { type: 'json' };
import yoga from './prereglages/yoga.json' with { type: 'json' };
import chorale from './prereglages/chorale.json' with { type: 'json' };
import danse from './prereglages/danse.json' with { type: 'json' };
import omnisport from './prereglages/omnisport.json' with { type: 'json' };
import { dossierVide, normaliserDossier } from './dossier.js';

/** Types proposés, dans l’ordre d’affichage. */
export const PRESETS = [gymVolontaire, yoga, chorale, danse, omnisport];

export const PRESET_AUCUN = {
  id: '',
  titre: 'Autre / aucun',
  resume: 'Je remplis les cours et la FAQ moi-même.',
};

export const IDS_PREREGLAGES = PRESETS.map((p) => p.id);

export function prereglageParId(id) {
  const cle = String(id || '').trim();
  if (!cle) return PRESET_AUCUN;
  return PRESETS.find((p) => p.id === cle) || null;
}

export function listePrereglages() {
  return [...PRESETS, PRESET_AUCUN];
}

export function couleursProposees() {
  return [...new Set(PRESETS.map((p) => String(p.couleurs?.primaire || '').toUpperCase()).filter(Boolean))];
}

function coursDepuis(preset) {
  return (preset.cours || []).map((c) => ({
    nom: String(c.nom || '').trim(),
    description: String(c.description || '').trim(),
    niveau: String(c.niveau || '').trim() || 'Tous niveaux',
    animateur: '',
    bienfaits: (c.bienfaits || []).map((b) => String(b).trim()).filter(Boolean).slice(0, 3),
  }));
}

function faqDepuis(preset) {
  return (preset.faq || []).map((f) => ({
    question: String(f.question || '').trim(),
    reponse: String(f.reponse || '').trim(),
    ...(f.populaire ? { populaire: true } : {}),
  }));
}

/**
 * Applique un préréglage : cours, FAQ, fédération, couleurs, modules conseillés.
 * Le nom, les salles, les contacts, le planning importé et la liste d’adhérents restent.
 * Tout reste modifiable ensuite. `id` vide = « Autre / aucun » (on ne touche qu’au type).
 */
export function appliquerPrereglage(dossier, id) {
  const d = normaliserDossier(dossier);
  const preset = prereglageParId(id);
  if (!preset || !preset.id) {
    return { ...d, typeAsso: '' };
  }
  const base = dossierVide();
  return {
    ...d,
    typeAsso: preset.id,
    association: {
      ...d.association,
      accroche: preset.accroche || d.association.accroche,
      slogan: preset.slogan || d.association.slogan,
    },
    federation: {
      nom: String(preset.federation?.nom || ''),
      sigle: String(preset.federation?.sigle || ''),
      url: String(preset.federation?.url || ''),
    },
    adhesion: {
      ...d.adhesion,
      inclus: preset.inclus || d.adhesion.inclus,
    },
    apparence: {
      ...d.apparence,
      couleur: preset.couleurs?.primaire || d.apparence.couleur,
      secondaire: preset.couleurs?.secondaire || d.apparence.secondaire,
    },
    modules: { ...base.modules, ...d.modules, ...(preset.modules || {}) },
    cours: coursDepuis(preset),
    faq: faqDepuis(preset),
  };
}
