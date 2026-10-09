/** Recherche bureau : prénom, nom, e-mail, morceau de téléphone. */

function fold(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function digits(s: string) {
  return (s || '').replace(/\D/g, '');
}

export function matchesPerson(
  query: string,
  person: { prenom?: string; nom?: string; tel?: string; mail?: string },
): boolean {
  const q = fold(query);
  if (!q) return true;
  const hay = fold(`${person.prenom || ''} ${person.nom || ''} ${person.mail || ''}`);
  if (hay.includes(q)) return true;
  const qd = digits(query);
  const td = digits(person.tel || '');
  if (qd.length >= 4 && td.includes(qd)) return true;
  return false;
}

export function adhesionNeedsMoney(statut: string) {
  return fold(statut) === 'en attente';
}

/** 10 chiffres nationaux 06… (gère 336…, 0033…, +33). */
export function nationalFrTel(raw: string) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  while (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('33') && d.length >= 11) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) return d;
  if (d.length === 9) return `0${d}`;
  if (d.length > 9) return `0${d.slice(-9)}`;
  return '';
}

export function formatTelFr(raw: string) {
  const n = nationalFrTel(raw);
  if (n.length === 10) return n.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return '';
}

export function telDedupeKey(raw: string) {
  const n = nationalFrTel(raw);
  return n.slice(-9);
}

/** Téléphone + prénom : un foyer qui partage un numéro ne se confond pas. */
export function adherentEssaiKey(tel: string, prenom: string) {
  const telKey = telDedupeKey(tel);
  if (!telKey) return '';
  return `${telKey}|${fold(prenom)}`;
}

export function isAdherentAJourForEssai(
  item: { tel?: string; prenom?: string },
  keys: ReadonlySet<string>,
) {
  const key = adherentEssaiKey(item.tel || '', item.prenom || '');
  return Boolean(key && keys.has(key));
}

/** Lignes de test exclues des compteurs : prénom « test » ou nom « test ». */
export function isTestPrenom(prenom: string, nom = '') {
  const p = fold(prenom);
  const n = fold(nom);
  return p === 'test' || n === 'test';
}
