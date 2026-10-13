/**
 * Réinscription en un clic (depuis l'espace adhérent).
 *
 * De juin à fin septembre, un adhérent de la saison qui se termine réserve sa place pour la suivante :
 * sa fiche est reprise (il corrige ce qui a changé), il choisit ses cours, répond aux questions de
 * la saison (photos, questionnaire santé). Il paie à la rentrée, comme d'habitude.
 *
 * La ligne part dans l'onglet de la saison suivante (« Saison 2027-2028 »), statut « En attente »,
 * sans numéro : le numéro et la carte viennent après le changement de saison, quand le bureau
 * confirme le paiement (docs/CHANGEMENT-SAISON.md).
 */

/** « 2026-2027 » → « 2027-2028 ». */
export function saisonSuivante(label) {
  const m = String(label || '').match(/^(\d{4})-(\d{4})$/);
  return m ? `${Number(m[1]) + 1}-${Number(m[2]) + 1}` : '';
}

export const ongletSaison = (label) => `Saison ${label}`;

const ymdParis = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);

/**
 * Période de réinscription : du 1er juin au 30 septembre de l'année où la saison se termine.
 * Une fois la saison suivante configurée (changement de saison), la période se referme d'elle-même.
 * `forcer` (variable REINSCRIPTION) : « ouverte » pour ouvrir plus tôt (assemblée générale…), « fermee » pour fermer.
 */
export function periodeReinscription(label, now = new Date(), forcer = '') {
  const suivante = saisonSuivante(label);
  if (!suivante) return { ouverte: false, suivante: '', du: '', au: '' };
  const fin = label.slice(5);
  const du = `${fin}-06-01`;
  const au = `${fin}-09-30`;
  const jour = ymdParis(now);
  const choix = String(forcer || '').trim().toLowerCase();
  const ouverte = choix === 'ouverte' ? true : choix === 'fermee' ? false : jour >= du && jour <= au;
  return { ouverte, suivante, du, au };
}

const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

/** Même personne : prénom, nom et e-mail (une famille partage souvent l'e-mail). */
export function memePersonne(a, b) {
  const cle = (r) => [r.PRENOM || r.Prenom, r.NOM || r.Nom, r.MAIL || r.Mail || r.EMAIL].map(fold).join('|');
  return cle(a) === cle(b) && Boolean(fold(a.PRENOM || a.Prenom));
}

/** Ligne déjà réinscrite pour cette fiche dans l'onglet de la saison suivante, ou null. */
export function dejaReinscrit(lignesSuivante, fiche) {
  return (lignesSuivante || []).find((r) => memePersonne(r, fiche)) || null;
}

const propre = (s, max = 120) =>
  String(s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Contrôle des réponses du formulaire. Coordonnées modifiables ; e-mail, nom, prénom et date
 * de naissance repris de la fiche (un changement se signale au bureau).
 * @returns {{ ok: true, champs: object } | { ok: false, erreur: string }}
 */
export function controlerReponses(reponses, { modes, coursConnus }) {
  const r = reponses || {};
  const tel = String(r.telephone || '').replace(/[\s.]/g, '');
  if (!/^0[1-9]\d{8}$/.test(tel)) return { ok: false, erreur: 'Téléphone : 10 chiffres.' };
  const cp = String(r.code_postal || '').replace(/\s/g, '');
  if (cp && !/^\d{5}$/.test(cp)) return { ok: false, erreur: 'Code postal : 5 chiffres.' };
  const cours = (Array.isArray(r.cours) ? r.cours : [])
    .map((c) => propre(c, 60))
    .filter((c) => c && (!coursConnus?.length || coursConnus.includes(c)));
  if (!cours.length) return { ok: false, erreur: 'Choisissez au moins un cours.' };
  if (!modes.includes(r.mode_paiement)) return { ok: false, erreur: 'Choisissez comment vous paierez à la rentrée.' };
  if (!['Oui', 'Non'].includes(r.droit_image)) return { ok: false, erreur: 'Répondez à la question des photos.' };
  if (!['Oui', 'Non'].includes(r.qs_sport)) return { ok: false, erreur: 'Répondez à la question du questionnaire santé.' };
  return {
    ok: true,
    champs: {
      telephone: tel,
      adresse: propre(r.adresse),
      code_postal: cp,
      ville: propre(r.ville, 60),
      cours: [...new Set(cours)].slice(0, 8),
      mode_paiement: r.mode_paiement,
      droit_image: r.droit_image,
      qs_sport: r.qs_sport,
      message: propre(r.message, 800),
    },
  };
}

const pick = (f, ...cles) => {
  for (const c of cles) if (f?.[c] != null && String(f[c]).trim()) return String(f[c]).trim();
  return '';
};

/**
 * Ligne de l'onglet Adhérents (colonnes A→R) pour la saison suivante.
 * Identité reprise de la fiche ; coordonnées et réponses du formulaire.
 */
export function ligneReinscription(fiche, champs, { tarif, date, reference, ancienNumero }) {
  const notes = [
    `Cours: ${champs.cours.join(', ')}`,
    ancienNumero ? `Ancien n° ${ancienNumero}` : '',
    champs.message ? `Message: ${champs.message}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  return [
    pick(fiche, 'NOM', 'Nom'),
    pick(fiche, 'PRENOM', 'Prénom', 'Prenom'),
    champs.telephone,
    pick(fiche, 'MAIL', 'Mail', 'EMAIL'),
    pick(fiche, 'DATE_NAISSANCE'),
    champs.adresse,
    champs.code_postal,
    champs.ville,
    champs.mode_paiement,
    'En attente',
    String(tarif),
    reference ? `Réinscription · Réf. ${reference}` : 'Réinscription',
    '',
    champs.droit_image,
    champs.qs_sport,
    'Réinscription',
    notes,
    date,
  ];
}
