import { telDedupeKey } from './bureauSearch';

export type MailSheetPerson = {
  row: number;
  nom: string;
  prenom: string;
  tel: string;
  mail: string;
};

export type MatchHow = 'email' | 'tel' | 'nom' | 'nom-different' | null;

function fold(s: string) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEmail(s: string) {
  return String(s || '').trim().toLowerCase();
}

/** Premier mot, ou n’importe quel mot si le nom est écrit avant le prénom. */
function prenomDuMailCorrespond(name: string, person: MailSheetPerson) {
  const words = fold(name).split(' ').filter(Boolean);
  const prenom = fold(person.prenom);
  if (!words.length || !prenom) return false;
  if (words[0] === prenom) return true;
  const nom = fold(person.nom);
  const inverse = Boolean(nom && words[0] === nom);
  return inverse && words.some((word) => word === prenom);
}

function avecPrenom<T extends MailSheetPerson>(
  person: T,
  how: 'email' | 'tel',
  name: string,
): { person: T; how: MatchHow } {
  if (!fold(name)) return { person, how };
  if (!prenomDuMailCorrespond(name, person)) return { person, how: 'nom-different' };
  return { person, how };
}

/**
 * E-mail exact, puis téléphone (9 chiffres), puis prénom + nom exacts.
 * Plusieurs fiches au même niveau : pas de choix.
 */
export function matchSheetPerson<T extends MailSheetPerson>(
  name: string,
  emails: string[],
  phone: string,
  people: T[],
): { person: T | null; how: MatchHow } {
  const mailSet = new Set(emails.map(normalizeEmail).filter(Boolean));
  if (mailSet.size) {
    const hits = people.filter((p) => mailSet.has(normalizeEmail(p.mail)));
    if (hits.length === 1) return avecPrenom(hits[0], 'email', name);
    if (hits.length > 1) return { person: null, how: null };
  }

  const tel = telDedupeKey(phone);
  if (tel) {
    const hits = people.filter((p) => telDedupeKey(p.tel) === tel);
    if (hits.length === 1) return avecPrenom(hits[0], 'tel', name);
    if (hits.length > 1) return { person: null, how: null };
  }

  const n = fold(name);
  if (n) {
    const hits = people.filter((p) => {
      const straight = fold(`${p.prenom} ${p.nom}`);
      const swapped = fold(`${p.nom} ${p.prenom}`);
      return (straight && straight === n) || (swapped && swapped === n);
    });
    if (hits.length === 1) return { person: hits[0], how: 'nom' };
    if (hits.length > 1) return { person: null, how: null };
  }

  return { person: null, how: null };
}
