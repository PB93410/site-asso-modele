import { slugify, type Dossier } from '../../src/lib/dossier.js';

/** Envoi du dossier : formulaire Netlify « dossier-association », le .json en pièce jointe. */

const MAX_OCTETS = 7_500_000; // limite d'envoi des formulaires Netlify, avec une marge

export function nomFichier(d: Dossier) {
  const date = new Date().toISOString().slice(0, 10);
  return `dossier-${slugify(d.association.sigle || d.association.nom) || 'association'}-${date}.json`;
}

export function versJson(d: Dossier) {
  return JSON.stringify({ ...d, envoyeLe: new Date().toISOString() }, null, 2);
}

export function telecharger(d: Dossier) {
  const url = URL.createObjectURL(new Blob([versJson(d)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier(d);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function envoyer(d: Dossier): Promise<'envoye' | 'simule'> {
  const json = versJson(d);
  if (json.length > MAX_OCTETS) {
    throw new Error('Le dossier est trop lourd : choisissez une photo plus légère, ou téléchargez-le et envoyez-le par mail.');
  }
  // En local, pas de Netlify Forms : on fait comme si, le bouton « Télécharger » reste là.
  if (import.meta.env.DEV) return 'simule';
  const fd = new FormData();
  fd.append('form-name', 'dossier-association');
  fd.append('association', d.association.nom);
  fd.append('contact', `${d.contact.nom}${d.contact.role ? ` (${d.contact.role})` : ''}`);
  fd.append('email', d.contact.email);
  fd.append('dossier', new File([json], nomFichier(d), { type: 'application/json' }));
  const r = await fetch('/', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('L’envoi n’a pas abouti. Réessayez, ou téléchargez le dossier et envoyez-le par mail.');
  return 'envoye';
}
