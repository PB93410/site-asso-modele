/**
 * Dossier d'installation : ce que l'association décrit dans le questionnaire en ligne
 * (/configurer), et que `npm run installer` transforme en configuration du site.
 *
 * Un seul fichier JSON, images comprises (data URL) : pas de zip, pas de dépendance.
 * Ce module ne touche ni au disque ni au réseau : il sert au navigateur et à Node.
 */

export const DOSSIER_VERSION = 1;
export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

function rgb(hex) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const hex = ([r, g, b]) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

function luminance(color) {
  const c = rgb(color);
  if (!c) return null;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG (null si une couleur est invalide). */
export function contraste(a, b = '#ffffff') {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mélange vers le noir : 0 = inchangé, 1 = noir. */
export function assombrir(color, part) {
  const c = rgb(color);
  if (!c) return color;
  return hex(c.map((v) => v * (1 - part)));
}

/**
 * La même teinte, assombrie juste assez pour un texte blanc lisible (WCAG AA, 4,5:1).
 * Une couleur déjà lisible est rendue telle quelle.
 */
export function couleurLisible(color, min = 4.5) {
  if (!rgb(color)) return '';
  let out = hex(rgb(color));
  for (let part = 0.04; contraste(out) < min && part < 1; part += 0.04) out = assombrir(color, part);
  return out;
}

/** Couleur au survol : un peu plus foncée. */
export const couleurSurvol = (color) => assombrir(color, 0.17);

// ---------------------------------------------------------------------------
// Petits calculs pour préremplir
// ---------------------------------------------------------------------------

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'd', 'l', 'a', 'au', 'aux', 'en', 'pour', 'sur']);

/** « Gymnastique Volontaire de Vaujours » → « GVV ». */
export function sigleDepuis(nom) {
  const mots = String(nom || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((m) => m && !MOTS_VIDES.has(m.toLowerCase()));
  return mots
    .map((m) => m[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
}

export function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Saison sportive en cours ou à venir : à partir de juin, on prépare la suivante. */
export function saisonCourante(date = new Date()) {
  const y = date.getFullYear();
  return date.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Chiffres d'un téléphone français, en 10 chiffres (0…). */
function tel10(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0033')) d = `0${d.slice(4)}`;
  else if (d.startsWith('33') && d.length === 11) d = `0${d.slice(2)}`;
  return d.length === 10 && d.startsWith('0') ? d : '';
}

/** « 0612345678 » → « 06 12 34 56 78 » (inchangé si ce n'est pas un numéro français). */
export function telAffiche(raw) {
  const d = tel10(raw);
  return d ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : String(raw || '').trim();
}

/** Numéro WhatsApp (international, sans +) si c'est un mobile 06 / 07, sinon ''. */
export function whatsappDepuis(raw) {
  const d = tel10(raw);
  return /^0[67]/.test(d) ? `33${d.slice(1)}` : '';
}

/** « 13:30 » et « 14:30 » → « 13h30 – 14h30 ». */
export function plageHoraire(debut, fin) {
  const h = (t) => String(t || '').trim().replace(/^(\d{1,2}):(\d{2})$/, (_, a, b) => `${a.padStart(2, '0')}h${b}`);
  return [h(debut), h(fin)].filter(Boolean).join(' – ');
}

// ---------------------------------------------------------------------------
// Le dossier
// ---------------------------------------------------------------------------

export function dossierVide(date = new Date()) {
  const saison = saisonCourante(date);
  const an = saison.slice(0, 4);
  return {
    version: DOSSIER_VERSION,
    envoyeLe: '',
    contact: { nom: '', role: '', email: '', telephone: '' },
    association: {
      nom: '',
      nomCourt: '',
      sigle: '',
      accroche: '',
      slogan: '',
      anneeCreation: '',
      rna: '',
      siret: '',
      siege: '',
      responsablePublication: '',
      assureur: '',
      ville: '',
      codePostal: '',
      departement: '',
      region: '',
      communesVoisines: [],
    },
    lieux: [],
    contacts: { email: '', telephone: '', whatsapp: true, siteSouhaite: '', instagram: '', facebook: '', avisGoogle: '' },
    typeAsso: '',
    federation: { nom: '', sigle: '', url: '' },
    adhesion: { tarif: 0, inclus: '', essais: 2, paiementNom: '', paiementUrl: '', autresPaiements: ['chèque', 'espèces'], iban: '' },
    saison: { label: saison, reprise: `${an}-09-07` },
    cours: [],
    planning: [],
    coachs: [],
    faq: [],
    apparence: { couleur: '#C45309', secondaire: '#5C6B4A', logo: '', hero: '', heroAlt: '' },
    modules: { essais: true, adhesion: false, bureau: false, mail: false, presences: false, quiz: false, alertes: false, listeAttente: false, wallet: false, financement: false, rapport: false, attestations: false, espace: false, parrainage: false, sondageEssai: false, clubEnChiffres: false, checklists: false, tablette: false, carteHorsLigne: false },
    listeAttente: { capaciteDefaut: 20, delaiReponseHeures: 48 },
    financement: { passSport: 50, ancvMax: 40, comiteEntreprise: 30 },
    attestations: { recuFiscal: false, objet: '' },
    remarques: '',
  };
}

/** Complète un dossier (ancien, partiel ou tapé à la main) avec les valeurs par défaut. */
export function normaliserDossier(raw) {
  const base = dossierVide();
  const d = raw && typeof raw === 'object' ? { ...raw } : {};
  // Ancienne version du questionnaire : une liste d’adhérents importée n’est ni gardée ni envoyée.
  delete d.adherentsImport;
  const merge = (a, b) => ({ ...a, ...(b && typeof b === 'object' ? b : {}) });
  return {
    ...base,
    ...d,
    version: Number(d.version) || DOSSIER_VERSION,
    contact: merge(base.contact, d.contact),
    association: merge(base.association, d.association),
    contacts: merge(base.contacts, d.contacts),
    typeAsso: String(d.typeAsso ?? base.typeAsso ?? ''),
    federation: merge(base.federation, d.federation),
    adhesion: merge(base.adhesion, d.adhesion),
    saison: merge(base.saison, d.saison),
    apparence: merge(base.apparence, d.apparence),
    modules: merge(base.modules, d.modules),
    listeAttente: merge(base.listeAttente, d.listeAttente),
    financement: merge(base.financement, d.financement),
    attestations: merge(base.attestations, d.attestations),
    lieux: Array.isArray(d.lieux) ? d.lieux : [],
    cours: Array.isArray(d.cours) ? d.cours : [],
    planning: Array.isArray(d.planning) ? d.planning : [],
    coachs: Array.isArray(d.coachs) ? d.coachs : [],
    faq: Array.isArray(d.faq) ? d.faq : [],
  };
}

const vide = (v) => !String(v ?? '').trim();
const IMAGE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Ce qui manque ou ne va pas, par étape du questionnaire.
 * @returns {{ etape: string, champ: string, message: string }[]}
 */
export function erreursDossier(dossier) {
  const d = normaliserDossier(dossier);
  const e = [];
  const add = (etape, champ, message) => e.push({ etape, champ, message });
  const a = d.association;

  if (d.version > DOSSIER_VERSION) add('association', 'version', 'Dossier plus récent que cet outil : mettez le modèle à jour.');
  if (vide(a.nom)) add('association', 'association.nom', 'Le nom de l’association est obligatoire.');
  if (!/^[A-Z0-9]{2,8}$/.test(a.sigle)) add('association', 'association.sigle', 'Sigle : 2 à 8 lettres majuscules ou chiffres (ex. ASV).');
  if (vide(a.accroche)) add('association', 'association.accroche', 'Indiquez vos activités en quelques mots (ex. Gym, Pilates, Yoga).');
  if (vide(a.ville)) add('association', 'association.ville', 'La ville est obligatoire.');
  if (!/^\d{5}$/.test(a.codePostal)) add('association', 'association.codePostal', 'Code postal : 5 chiffres.');
  if (a.anneeCreation && !/^\d{4}$/.test(a.anneeCreation)) add('association', 'association.anneeCreation', 'Année de création : 4 chiffres.');

  if (!d.lieux.length) add('lieux', 'lieux', 'Ajoutez au moins une salle.');
  d.lieux.forEach((l, i) => {
    if (vide(l.nom) || vide(l.rue)) add('lieux', `lieux[${i}]`, `Salle ${i + 1} : nom et adresse obligatoires.`);
  });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contacts.email)) add('contacts', 'contacts.email', 'Adresse e-mail de l’association invalide.');
  if (vide(d.contacts.telephone)) add('contacts', 'contacts.telephone', 'Un numéro de téléphone est obligatoire.');

  if (!(Number(d.adhesion.tarif) > 0)) add('adhesion', 'adhesion.tarif', 'Indiquez le tarif annuel.');
  if (!(Number(d.adhesion.essais) >= 0 && Number(d.adhesion.essais) <= 10)) add('adhesion', 'adhesion.essais', 'Nombre d’essais gratuits : de 0 à 10.');
  if (d.adhesion.paiementUrl && !/^https:\/\//.test(d.adhesion.paiementUrl)) add('adhesion', 'adhesion.paiementUrl', 'Le lien de paiement doit commencer par https://');
  const iban = String(d.adhesion.iban || '').replace(/\s+/g, '');
  if (iban && !/^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/.test(iban)) add('adhesion', 'adhesion.iban', 'IBAN incomplet : 2 lettres, 2 chiffres, puis le reste (ex. FR76 …).');

  if (!/^(\d{4})-(\d{4})$/.test(d.saison.label) || Number(d.saison.label.slice(5)) !== Number(d.saison.label.slice(0, 4)) + 1) {
    add('cours', 'saison.label', 'Saison : format 2026-2027.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.saison.reprise)) add('cours', 'saison.reprise', 'Date de reprise des cours manquante.');
  if (!d.cours.length) add('cours', 'cours', 'Ajoutez au moins un cours.');
  const nomsCours = new Set(d.cours.map((c) => String(c.nom || '').trim().toLowerCase()));
  const nomsLieux = new Set(d.lieux.map((l) => String(l.nom || '').trim().toLowerCase()));
  d.planning.forEach((p, i) => {
    const n = `Créneau ${i + 1}`;
    if (!JOURS.includes(p.jour)) add('cours', `planning[${i}]`, `${n} : jour manquant.`);
    if (!/^\d{1,2}:\d{2}$/.test(p.debut || '')) add('cours', `planning[${i}]`, `${n} : heure de début manquante.`);
    if (!nomsCours.has(String(p.cours || '').trim().toLowerCase())) add('cours', `planning[${i}]`, `${n} : choisissez un cours de la liste.`);
    if (p.lieu && !nomsLieux.has(String(p.lieu).trim().toLowerCase())) add('cours', `planning[${i}]`, `${n} : choisissez une salle de la liste.`);
  });

  d.coachs.forEach((c, i) => {
    if (vide(c.prenom)) add('animateurs', `coachs[${i}]`, `Animateur ${i + 1} : prénom manquant.`);
    if (c.photo && !c.accord) add('animateurs', `coachs[${i}]`, `${c.prenom || `Animateur ${i + 1}`} : cochez son accord pour publier sa photo, ou retirez-la.`);
    if (c.photo && !IMAGE.test(c.photo)) add('animateurs', `coachs[${i}]`, 'Photo illisible : reprenez un fichier JPEG, PNG ou WebP.');
  });
  d.faq.forEach((f, i) => {
    if (vide(f.question) || vide(f.reponse)) add('faq', `faq[${i}]`, `Question ${i + 1} : la question et la réponse sont obligatoires.`);
  });

  if (!rgb(d.apparence.couleur)) add('apparence', 'apparence.couleur', 'Choisissez une couleur.');
  for (const k of ['logo', 'hero']) {
    if (d.apparence[k] && !IMAGE.test(d.apparence[k])) add('apparence', `apparence.${k}`, 'Image illisible : reprenez un fichier PNG, JPEG, WebP ou SVG.');
  }

  if (vide(d.contact.nom)) add('envoi', 'contact.nom', 'Indiquez votre nom.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact.email)) add('envoi', 'contact.email', 'Votre adresse e-mail est invalide.');
  return e;
}

const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp', 'svg+xml': 'svg' };

/** Images du dossier à écrire dans public/ : logo, photo d'accueil, photos des animateurs (avec accord). */
export function imagesDossier(dossier) {
  const d = normaliserDossier(dossier);
  const out = [];
  // Noms distincts des images générées (logo.svg, hero.svg) : npm run identite ne les écrase pas.
  for (const [k, nom] of [
    ['logo', 'logo-asso'],
    ['hero', 'hero-asso'],
  ]) {
    const m = String(d.apparence[k] || '').match(/^data:image\/(png|jpeg|webp|svg\+xml);base64,/);
    if (m) out.push({ cle: k, chemin: `assets/${nom}.${EXT[m[1]]}`, dataUrl: d.apparence[k] });
  }
  d.coachs.forEach((c, i) => {
    const m = String(c.photo || '').match(/^data:image\/(png|jpeg|webp);base64,/);
    if (m && c.accord) out.push({ cle: `coach-${i}`, chemin: `assets/coach-${slugify(c.prenom) || i + 1}.${EXT[m[1]]}`, dataUrl: c.photo });
  });
  return out;
}

function siteUrl(souhaite, sigle) {
  const s = String(souhaite || '').trim().replace(/\/+$/, '');
  if (!s) return `https://${slugify(sigle) || 'association'}.netlify.app`;
  return /^https?:\/\//.test(s) ? s.replace(/^http:/, 'https:') : `https://${s}`;
}

/**
 * Configuration complète (forme de asso.config.js) à partir du dossier.
 * `base` (la configuration du modèle) fournit ce que le questionnaire ne demande pas.
 */
export function configDepuisDossier(dossier, base) {
  const d = normaliserDossier(dossier);
  const a = d.association;
  const images = Object.fromEntries(imagesDossier(d).map((i) => [i.cle, `/${i.chemin}`]));
  const ids = new Set();
  const lieux = d.lieux.map((l) => {
    let id = slugify(l.nom) || 'salle';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    const autreCommune = l.codePostal && (l.codePostal !== a.codePostal || (l.ville && l.ville !== a.ville));
    return {
      id,
      nom: String(l.nom).trim(),
      rue: String(l.rue).trim(),
      ...(String(l.acces || '').trim() ? { acces: String(l.acces).trim() } : {}),
      ...(autreCommune ? { codePostal: String(l.codePostal), ville: String(l.ville || '') } : {}),
      ...(Number.isFinite(l.lat) && Number.isFinite(l.lon) ? { lat: Number(l.lat), lon: Number(l.lon) } : {}),
    };
  });
  const primaire = couleurLisible(d.apparence.couleur) || base.couleurs.primaire;
  const secondaire = couleurLisible(d.apparence.secondaire) || base.couleurs.secondaire;
  const [an] = d.saison.label.split('-');
  const tel = telAffiche(d.contacts.telephone);
  return {
    modules: { ...d.modules },
    nom: a.nom.trim(),
    nomCourt: (a.nomCourt || a.sigle).trim(),
    sigle: a.sigle.trim(),
    typeAsso: String(d.typeAsso || '').trim(),
    accroche: a.accroche.trim(),
    slogan: a.slogan.trim() || base.slogan,
    anneeCreation: a.anneeCreation.trim(),
    statut: base.statut,
    rna: a.rna.trim(),
    siret: a.siret.trim(),
    siege: a.siege.trim() || `${lieux[0]?.rue || ''}, ${a.codePostal} ${a.ville}`.replace(/^, /, ''),
    responsablePublication: a.responsablePublication.trim() || base.responsablePublication,
    assureur: a.assureur.trim(),
    ville: a.ville.trim(),
    codePostal: a.codePostal.trim(),
    departement: a.departement.trim(),
    region: a.region.trim(),
    communesVoisines: a.communesVoisines.map((c) => String(c).trim()).filter(Boolean),
    lieux,
    siteUrl: siteUrl(d.contacts.siteSouhaite, a.sigle),
    email: d.contacts.email.trim(),
    telephone: tel,
    whatsapp: d.contacts.whatsapp ? whatsappDepuis(d.contacts.telephone) : '',
    reseaux: {
      instagram: d.contacts.instagram.trim(),
      facebook: d.contacts.facebook.trim(),
      avisGoogle: d.contacts.avisGoogle.trim(),
    },
    federation: {
      nom: d.federation.nom.trim(),
      sigle: d.federation.sigle.trim(),
      url: d.federation.url.trim(),
      logo: d.federation.nom.trim() ? '/assets/logo-federation.svg' : '',
    },
    adhesion: {
      tarif: Number(d.adhesion.tarif),
      inclus: d.adhesion.inclus.trim() || (d.federation.nom.trim() ? 'licence et assurance comprises' : 'assurance comprise'),
      essais: Number(d.adhesion.essais),
      paiementNom: d.adhesion.paiementUrl ? d.adhesion.paiementNom.trim() || 'paiement en ligne' : '',
      paiementUrl: d.adhesion.paiementUrl.trim(),
      autresPaiements: d.adhesion.autresPaiements.map((p) => String(p).trim()).filter(Boolean),
      iban: String(d.adhesion.iban || '').replace(/\s+/g, '').toUpperCase(),
    },
    listeAttente: {
      capaciteDefaut: Number(d.listeAttente?.capaciteDefaut) || base.listeAttente?.capaciteDefaut || 20,
      delaiReponseHeures: Number(d.listeAttente?.delaiReponseHeures) || base.listeAttente?.delaiReponseHeures || 48,
    },
    financement: {
      passSport: Number(d.financement?.passSport ?? base.financement?.passSport ?? 50),
      ancvMax: Number(d.financement?.ancvMax ?? base.financement?.ancvMax ?? 40),
      comiteEntreprise: Number(d.financement?.comiteEntreprise ?? base.financement?.comiteEntreprise ?? 30),
    },
    attestations: {
      recuFiscal: d.attestations?.recuFiscal === true,
      objet: String(d.attestations?.objet || '').trim(),
    },
    saison: {
      label: d.saison.label,
      reprise: d.saison.reprise,
      finCampagneEssai: `${an}-10-31`,
      finEssais: '',
      fin: '',
      pauses: [],
      feriesAvecCours: [],
    },
    couleurs: {
      primaire,
      primaireHover: couleurSurvol(primaire),
      secondaire,
      secondaireHover: couleurSurvol(secondaire),
    },
    logo: images.logo || '/assets/logo.svg',
    heroImage: images.hero || '/assets/hero.svg',
    heroAlt: d.apparence.heroAlt.trim() || `Séance de ${a.accroche.split(',')[0].trim().toLowerCase() || 'sport'} à ${a.ville}`,
  };
}

const csv = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** public/data/planning.csv, trié par jour puis heure. */
export function planningCsv(dossier) {
  const d = normaliserDossier(dossier);
  const lignes = [...d.planning].sort(
    (x, y) => JOURS.indexOf(x.jour) - JOURS.indexOf(y.jour) || String(x.debut).padStart(5, '0').localeCompare(String(y.debut).padStart(5, '0')),
  );
  return [
    'day,time,course,location,note',
    ...lignes.map((p) => [p.jour, plageHoraire(p.debut, p.fin), p.cours, p.lieu || d.lieux[0]?.nom || '', p.note || ''].map(csv).join(',')),
  ].join('\n') + '\n';
}

/** Première phrase, pour la ligne courte des cartes de cours. */
function premierePhrase(texte) {
  const t = String(texte || '').trim();
  const m = t.match(/^(.{20,140}?[.!?])(\s|$)/);
  return (m ? m[1] : t).replace(/[.!]$/, '');
}

/**
 * Fichiers du dossier contenu/ (cours, animateurs, FAQ, planning, événements).
 * `faq` vaut null quand l'association n'a rien changé : on garde la FAQ du modèle.
 */
export function contenuDepuisDossier(dossier) {
  const d = normaliserDossier(dossier);
  const images = Object.fromEntries(imagesDossier(d).map((i) => [i.cle, `/${i.chemin}`]));
  const coachs = d.coachs
    .filter((c) => String(c.prenom || '').trim())
    .map((c, i) => ({
      nom: String(c.prenom).trim(),
      specialites: (c.cours || []).filter(Boolean),
      image: images[`coach-${i}`] || `/assets/coach-${i + 1}.svg`,
      bio: String(c.bio || '').trim(),
    }));
  const animateurDe = (nom) => coachs.find((c) => c.specialites.includes(nom))?.nom || '';
  const cours = d.cours
    .filter((c) => String(c.nom || '').trim())
    .map((c) => {
      const nom = String(c.nom).trim();
      return {
        nom,
        niveau: String(c.niveau || '').trim() || 'Tous niveaux',
        resume: premierePhrase(c.description) || nom,
        animateur: String(c.animateur || '').trim() || animateurDe(nom),
        bienfaits: (c.bienfaits || []).map((b) => String(b).trim()).filter(Boolean).slice(0, 3),
        image: `/assets/act-${slugify(nom)}.svg`,
        texte: String(c.description || '').trim(),
      };
    });
  const lieu1 = d.lieux[0]?.nom || '';
  const planning = [...d.planning]
    .sort((x, y) => JOURS.indexOf(x.jour) - JOURS.indexOf(y.jour) || String(x.debut).padStart(5, '0').localeCompare(String(y.debut).padStart(5, '0')))
    .map((p) => ({ jour: p.jour, horaire: plageHoraire(p.debut, p.fin), cours: p.cours, lieu: p.lieu || lieu1, note: p.note || '' }));
  const faq = d.faq.length
    ? d.faq.map((f) => ({ question: String(f.question).trim(), reponse: String(f.reponse).trim(), ...(f.populaire ? { populaire: true } : {}) }))
    : null;
  return { cours, coachs, faq, planning, evenements: [] };
}
