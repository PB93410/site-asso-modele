/**
 * Reprise d’un fichier Excel / CSV dans le questionnaire :
 * planning (horaires) et/ou liste d’adhérents, avec correspondance de colonnes.
 * Les fiches d’adhérents restent dans le dossier (navigateur, envoi, tmp/) :
 * jamais dans contenu/ ni dans le dépôt.
 */

import { JOURS, normaliserDossier } from './dossier.js';
import { lireXlsxPortable } from './xlsx-lire.js';

/** Mêmes colonnes que netlify/functions/_bureau-lib.mjs → ADHERENTS_HEADERS (un test le vérifie). */
export const COLONNES_ADHERENTS = [
  'NOM',
  'PRENOM',
  'TEL',
  'MAIL',
  'DATE_NAISSANCE',
  'ADRESSE',
  'CP',
  'VILLE',
  'MODE',
  'STATUT',
  'MONTANT',
  'DETAIL',
  'DATE_PAIEMENT',
  'DROIT_IMAGE',
  'QS_SPORT',
  'SOURCE',
  'NOTES',
  'DATE_DEMANDE',
];

export const CHAMPS_PLANNING = [
  { id: 'jour', label: 'Jour' },
  { id: 'horaire', label: 'Horaire (début – fin)' },
  { id: 'debut', label: 'Heure de début' },
  { id: 'fin', label: 'Heure de fin' },
  { id: 'cours', label: 'Cours' },
  { id: 'lieu', label: 'Salle' },
  { id: 'note', label: 'Note' },
];

export const CHAMPS_ADHERENTS = COLONNES_ADHERENTS.map((id) => ({
  id,
  label:
    {
      NOM: 'Nom',
      PRENOM: 'Prénom',
      TEL: 'Téléphone',
      MAIL: 'E-mail',
      DATE_NAISSANCE: 'Date de naissance',
      ADRESSE: 'Adresse',
      CP: 'Code postal',
      VILLE: 'Ville',
      MODE: 'Mode de paiement',
      STATUT: 'Statut',
      MONTANT: 'Montant',
      DETAIL: 'Détail',
      DATE_PAIEMENT: 'Date de paiement',
      DROIT_IMAGE: 'Droit à l’image',
      QS_SPORT: 'QS-SPORT',
      SOURCE: 'Source',
      NOTES: 'Notes',
      DATE_DEMANDE: 'Date de la demande',
    }[id] || id,
}));

const MOTS_PLANNING = {
  jour: ['jour', 'day', 'weekday', 'joursemaine'],
  horaire: ['horaire', 'time', 'heure', 'heures', 'creneau', 'plage', 'horaires'],
  debut: ['debut', 'start', 'heuredebut', 'from', 'begin', 'commence'],
  fin: ['fin', 'end', 'heurefin', 'jusqua', 'termine'],
  cours: ['cours', 'course', 'activite', 'seance', 'discipline', 'atelier', 'activites'],
  lieu: ['lieu', 'location', 'salle', 'site', 'endroit', 'gymnase'],
  note: ['note', 'notes', 'commentaire', 'remarque', 'remarques'],
};

const MOTS_ADHERENTS = {
  NOM: ['nom', 'name', 'lastname', 'nomdefamille', 'familyname', 'nomfamille'],
  PRENOM: ['prenom', 'firstname', 'givenname', 'prenoms'],
  TEL: ['tel', 'telephone', 'phone', 'portable', 'mobile', 'telportable'],
  MAIL: ['mail', 'email', 'courriel', 'e-mail', 'adresseemail', 'mel'],
  DATE_NAISSANCE: ['datenaissance', 'naissance', 'birthday', 'datenais', 'nee', 'ne', 'ddn'],
  ADRESSE: ['adresse', 'address', 'rue', 'adr'],
  CP: ['cp', 'codepostal', 'postal', 'zip', 'codepost'],
  VILLE: ['ville', 'city', 'commune', 'localite'],
  MODE: ['mode', 'paiement', 'modepaiement', 'reglement'],
  STATUT: ['statut', 'status', 'etat'],
  MONTANT: ['montant', 'tarif', 'cotisation', 'somme'],
  DETAIL: ['detail', 'details'],
  DATE_PAIEMENT: ['datepaiement', 'paye', 'reglele'],
  DROIT_IMAGE: ['droitimage', 'image', 'autorisationimage'],
  QS_SPORT: ['qssport', 'qs', 'certificat', 'certificatmedical'],
  SOURCE: ['source', 'origine'],
  NOTES: ['notes', 'commentaire', 'remarque', 'observations'],
  DATE_DEMANDE: ['datedemande', 'inscription', 'datesaisie', 'dateentree'],
};

export function normaliserEnTete(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function choisirAlias(enTetes, mots) {
  const norms = enTetes.map((h, i) => ({ i, n: normaliserEnTete(h) }));
  const out = {};
  for (const [id, alias] of Object.entries(mots)) {
    const hit = norms.find(
      (x) => x.n && alias.some((a) => x.n === a || (a.length >= 4 && (x.n.startsWith(a) || a.startsWith(x.n) && x.n.length >= 4))),
    );
    out[id] = hit ? enTetes[hit.i] : '';
  }
  return out;
}

export function correspondancePlanning(enTetes) {
  return choisirAlias(enTetes, MOTS_PLANNING);
}

export function correspondanceAdherents(enTetes) {
  return choisirAlias(enTetes, MOTS_ADHERENTS);
}

export function detecterGenre(enTetes) {
  const p = correspondancePlanning(enTetes);
  const a = correspondanceAdherents(enTetes);
  const scoreP = ['jour', 'cours', 'horaire', 'debut'].filter((k) => p[k]).length;
  const scoreA = ['NOM', 'PRENOM', 'MAIL', 'TEL'].filter((k) => a[k]).length;
  if (scoreA >= 2 && scoreA >= scoreP) return 'adherents';
  if (scoreP >= 2) return 'planning';
  return 'inconnu';
}

/** CSV : virgule, point-virgule (Excel français) ou tabulation. BOM ignoré. */
export function parseCsv(texte) {
  let s = String(texte || '').replace(/^\uFEFF/, '');
  const premiere = s.split(/\r?\n/, 1)[0] || '';
  const virgules = (premiere.match(/,/g) || []).length;
  const points = (premiere.match(/;/g) || []).length;
  const tabs = (premiere.match(/\t/g) || []).length;
  const sep = tabs > virgules && tabs > points ? '\t' : points > virgules ? ';' : ',';
  const lignes = [];
  let ligne = [];
  let cellule = '';
  let quotes = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cellule += '"';
          i += 1;
        } else quotes = false;
      } else cellule += c;
    } else if (c === '"') quotes = true;
    else if (c === sep) {
      ligne.push(cellule);
      cellule = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      ligne.push(cellule);
      if (ligne.some((x) => String(x).trim())) lignes.push(ligne);
      ligne = [];
      cellule = '';
    } else cellule += c;
  }
  if (cellule.length || ligne.length) {
    ligne.push(cellule);
    if (ligne.some((x) => String(x).trim())) lignes.push(ligne);
  }
  return lignes;
}

export function estCsv(nom) {
  return /\.(csv|txt)$/i.test(String(nom || ''));
}

export function estExcel(nom) {
  return /\.xlsx$/i.test(String(nom || ''));
}

function decoderTexte(octets) {
  const b = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b);
  return new TextDecoder('utf-8').decode(b);
}

/** @returns {Promise<{ nom: string, lignes: string[][] }[]>} */
export async function tableauxDepuisOctets(octets, nomFichier) {
  const nom = String(nomFichier || 'fichier');
  if (estExcel(nom)) return lireXlsxPortable(octets);
  return [{ nom, lignes: parseCsv(decoderTexte(octets)) }];
}

export function enTetesEtLignes(lignes) {
  const propres = (lignes || []).filter((l) => (l || []).some((c) => String(c ?? '').trim()));
  if (!propres.length) return { enTetes: [], corps: [] };
  return { enTetes: propres[0].map((c) => String(c ?? '').trim()), corps: propres.slice(1) };
}

const JOURS_ALIAS = Object.fromEntries(
  JOURS.flatMap((j, i) => {
    const n = normaliserEnTete(j);
    const courts = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
    const en = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return [
      [n, j],
      [n.slice(0, 3), j],
      [courts[i], j],
      [en[i], j],
    ];
  }),
);

export function normaliserJour(raw) {
  const n = normaliserEnTete(raw);
  if (JOURS_ALIAS[n]) return JOURS_ALIAS[n];
  const chiffre = Number(raw);
  if (chiffre >= 1 && chiffre <= 7) return JOURS[chiffre - 1];
  return '';
}

/** « 14h00 », « 14:00 », « 9h30 », fraction Excel (0,583). */
export function parserHeure(raw) {
  const s = excelVersTexte(raw).trim();
  const m = s.match(/^(\d{1,2})\s*(?:h|:)?\s*(\d{2})?(?:\s*:\s*\d{2})?$/i);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parserPlage(raw) {
  const s = excelVersTexte(raw).trim();
  const parts = s.split(/\s*[-–—à]\s*/i).filter(Boolean);
  if (parts.length >= 2) return { debut: parserHeure(parts[0]), fin: parserHeure(parts[1]) };
  return { debut: parserHeure(s), fin: '' };
}

/** Dates et heures stockées par Excel comme nombres. Autre texte inchangé. */
export function excelVersTexte(raw) {
  const s = String(raw ?? '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return s;
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n > 0 && n < 1) {
    const minutes = Math.round(n * 24 * 60);
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (n >= 20000 && n < 80000) {
    const jours = Math.floor(n);
    const frac = n - jours;
    const utc = Date.UTC(1899, 11, 30) + jours * 86400000;
    const d = new Date(utc);
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (frac > 0.0007) {
      const minutes = Math.round(frac * 24 * 60);
      const h = Math.floor(minutes / 60) % 24;
      const min = minutes % 60;
      return `${ymd} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    return ymd;
  }
  return s;
}

function valeurMappee(ligne, enTetes, nomColonne) {
  if (!nomColonne) return '';
  const i = enTetes.findIndex((h) => h === nomColonne);
  if (i < 0) return '';
  return excelVersTexte(ligne[i] ?? '');
}

export function creneauxDepuisLignes(lignes, mapping) {
  const { enTetes, corps } = enTetesEtLignes(lignes);
  const out = [];
  for (const ligne of corps) {
    const get = (id) => valeurMappee(ligne, enTetes, mapping[id]);
    const jour = normaliserJour(get('jour'));
    let debut = parserHeure(get('debut'));
    let fin = parserHeure(get('fin'));
    if ((!debut || !fin) && get('horaire')) {
      const p = parserPlage(get('horaire'));
      debut = debut || p.debut;
      fin = fin || p.fin;
    }
    const cours = get('cours').trim();
    if (!jour && !debut && !cours) continue;
    out.push({
      jour: jour || 'Lundi',
      debut,
      fin,
      cours,
      lieu: get('lieu').trim(),
      note: get('note').trim(),
    });
  }
  return out;
}

export function fichesDepuisLignes(lignes, mapping) {
  const { enTetes, corps } = enTetesEtLignes(lignes);
  const out = [];
  for (const ligne of corps) {
    const fiche = {};
    let utile = false;
    for (const id of COLONNES_ADHERENTS) {
      const v = valeurMappee(ligne, enTetes, mapping[id]).trim();
      fiche[id] = v;
      if (v && (id === 'NOM' || id === 'PRENOM' || id === 'MAIL' || id === 'TEL')) utile = true;
    }
    if (utile) out.push(fiche);
  }
  return out;
}

export function integrerPlanning(dossier, creneaux, { remplacer = false } = {}) {
  const d = normaliserDossier(dossier);
  const noms = new Set(d.cours.map((c) => String(c.nom || '').trim().toLowerCase()).filter(Boolean));
  const ajoutCours = [];
  for (const p of creneaux) {
    const n = String(p.cours || '').trim();
    if (n && !noms.has(n.toLowerCase())) {
      noms.add(n.toLowerCase());
      ajoutCours.push({ nom: n, description: '', niveau: 'Tous niveaux', animateur: '', bienfaits: [] });
    }
  }
  return {
    ...d,
    cours: [...d.cours, ...ajoutCours],
    planning: remplacer ? [...creneaux] : [...d.planning, ...creneaux],
  };
}

export function integrerAdherents(dossier, fiches, source = '') {
  const d = normaliserDossier(dossier);
  const nom = String(source || '').replace(/^.*[/\\]/, '').slice(0, 80);
  return {
    ...d,
    adherentsImport: {
      source: nom,
      importeLe: new Date().toISOString(),
      fiches: fiches.map((f) => {
        const row = {};
        for (const k of COLONNES_ADHERENTS) row[k] = String(f[k] || '').trim();
        return row;
      }),
    },
  };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV aux colonnes du bureau, pour tmp/ (jamais commité). */
export function csvAdherents(fiches) {
  if (!fiches?.length) return '';
  return [COLONNES_ADHERENTS.join(','), ...fiches.map((f) => COLONNES_ADHERENTS.map((k) => csvCell(f[k])).join(','))].join('\n') + '\n';
}
