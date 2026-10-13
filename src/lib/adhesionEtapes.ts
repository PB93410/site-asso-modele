/** Formulaire d'adhésion en étapes : liste des étapes et contrôles par étape. */
import { emailError, nameError, phoneError, postalCodeError } from './formValidation';

export const ETAPES_ADHESION = [
  { n: 1, cle: 'identite', label: 'Identité', titre: 'Faisons connaissance' },
  { n: 2, cle: 'contact', label: 'Contact', titre: 'Pour vous joindre' },
  { n: 3, cle: 'cours', label: 'Cours', titre: 'Vos cours' },
  { n: 4, cle: 'paiement', label: 'Aides et paiement', titre: 'La cotisation, à votre façon' },
  { n: 5, cle: 'recap', label: 'Récapitulatif', titre: 'On vérifie ensemble' },
] as const;

export const NB_ETAPES = ETAPES_ADHESION.length;

export type FormAdhesion = {
  prenom: string;
  nom: string;
  date_naissance: string;
  telephone: string;
  email: string;
  code_postal: string;
  droit_image: string;
  qs_sport: string;
  mode_paiement: string;
  numero_cheque?: string;
};

export function birthDateError(value: string, today: Date = new Date()): string | null {
  const raw = String(value || '').trim();
  if (!raw) return 'Indiquez votre date de naissance (jj/mm/aaaa).';
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 'La date de naissance doit être au format jj/mm/aaaa (ex. 14/03/1958).';
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return 'Cette date n’existe pas. Utilisez jj/mm/aaaa.';
  }
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  if (dt > t) return 'La date de naissance ne peut pas être dans le futur.';
  let age = t.getFullYear() - year;
  const hadBirthday = t.getMonth() > month - 1 || (t.getMonth() === month - 1 && t.getDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < 16) return 'L’association accueille à partir de 16 ans.';
  if (age > 120) return 'Vérifiez l’année (quatre chiffres), au format jj/mm/aaaa.';
  return null;
}

/** Erreur de l'étape `n` : `{ champ, message }` (champ = id à mettre en focus) ou null. */
export function erreurEtape(
  n: number,
  f: FormAdhesion,
  opts: { tarifLabel?: string; today?: Date } = {},
): { champ: string; message: string } | null {
  const e = (champ: string, message: string | null) => (message ? { champ, message } : null);
  if (n === 1) {
    return (
      e('prenom', nameError('Prénom', f.prenom)) ||
      e('nom', nameError('Nom', f.nom)) ||
      e('date_naissance', birthDateError(f.date_naissance, opts.today))
    );
  }
  if (n === 2) {
    return (
      e('telephone', phoneError(f.telephone)) ||
      e('email', emailError(f.email)) ||
      e('code_postal', postalCodeError(f.code_postal))
    );
  }
  if (n === 3) {
    if (!f.droit_image) return { champ: 'droit_image', message: 'Dites-nous si les photos de groupe vous conviennent.' };
    if (!f.qs_sport) return { champ: 'qs_sport', message: 'Répondez à la question sur le questionnaire santé.' };
    return null;
  }
  if (n === 4) {
    if (!f.mode_paiement) {
      return {
        champ: 'mode_paiement',
        message: `Choisissez comment vous souhaitez régler${opts.tarifLabel ? ` les ${opts.tarifLabel}` : ''}.`,
      };
    }
    // Le serveur refuse un chèque sans numéro (netlify/functions/adhesion.mjs).
    if (f.mode_paiement.startsWith('Chèque') && !String(f.numero_cheque || '').trim()) {
      return { champ: 'numero_cheque', message: 'Indiquez le n° du chèque, ou choisissez un autre moyen.' };
    }
    return null;
  }
  return null;
}

/** Première étape incomplète (avant l'envoi), ou null si tout est bon. */
export function premiereEtapeIncomplete(
  f: FormAdhesion,
  opts: { tarifLabel?: string; today?: Date } = {},
): { etape: number; champ: string; message: string } | null {
  for (let n = 1; n < NB_ETAPES; n += 1) {
    const err = erreurEtape(n, f, opts);
    if (err) return { etape: n, ...err };
  }
  return null;
}

/** Largeur de la barre de progression (0 à 100). */
export function progressionEtape(etape: number): number {
  const e = Math.min(Math.max(etape, 1), NB_ETAPES);
  return Math.round(((e - 1) / (NB_ETAPES - 1)) * 100);
}
