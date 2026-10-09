/** Contrôles publics /essai et /inscription — messages seniors, FR. */

export function foldName(s: string) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function nameError(label: string, raw: string): string | null {
  const s = foldName(raw);
  if (!s) return `Indiquez votre ${label.toLowerCase()}.`;
  if (s.length < 2) return `${label} trop court.`;
  if (s.length > 60) return `${label} trop long.`;
  if (/\d/.test(s)) return `${label} : pas de chiffre.`;
  return null;
}

/** 10 chiffres FR (06/07 idéal, fixe accepté). */
export function nationalFrDigits(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('33') && d.length >= 11) d = `0${d.slice(2)}`;
  if (d.startsWith('00') && d.length >= 13) d = d.slice(2);
  return d;
}

export function phoneError(raw: string): string | null {
  const d = nationalFrDigits(raw);
  if (!d) return 'Indiquez un numéro de téléphone.';
  if (d.length < 10) return 'Téléphone incomplet (10 chiffres, ex. 06 12 34 56 78).';
  if (d.length > 10) return 'Téléphone trop long. 10 chiffres suffisent.';
  if (!d.startsWith('0')) return 'Le numéro doit commencer par 0 (France).';
  if (d[1] === '0') return 'Ce numéro n’est pas un mobile ou un fixe français.';
  return null;
}

export function emailError(raw: string, required = false): string | null {
  const s = String(raw || '').trim();
  if (!s) return required ? 'Indiquez une adresse e-mail.' : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) {
    return 'E-mail incomplet (ex. marie@exemple.fr).';
  }
  return null;
}

export function postalCodeError(raw: string): string | null {
  const s = String(raw || '').replace(/\s/g, '');
  if (!s) return null;
  if (!/^\d{5}$/.test(s)) return 'Code postal : 5 chiffres (ex. 75001).';
  return null;
}

export function essaiFormError(prenom: string, nom: string, telephone: string): string | null {
  return nameError('Prénom', prenom) || nameError('Nom', nom) || phoneError(telephone);
}
