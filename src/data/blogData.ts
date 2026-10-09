// ============================================
// ARTICLES DU BLOG
// ============================================
// Un article = un bloc { ... }. Le contenu est du HTML simple (p, h2, ul, strong, a).
// Images : /public/assets/. Les textes utilisent asso.config.js pour rester à jour.

import { ASSO, COURS_ESSAI_LABEL, NB_ESSAIS, PAYMENT_MODES, TARIF_LABEL, VILLE_SLUG } from './asso';

export interface BlogArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  image: string;
  date: string;
  dateModified?: string;
  readTime: number;
  category: string;
  /** Affiche portrait : on la montre entière, sans la recadrer en bandeau. */
  poster?: boolean;
  content: string[];
  ctaCourse?: { name: string; slug: string };
  faq: { question: string; answer: string }[];
}

const ESSAI_PHRASE =
  NB_ESSAIS > 0
    ? `Les <strong>${COURS_ESSAI_LABEL}</strong> sont gratuits et sans engagement : on ne signe rien le jour J.`
    : 'Vous pouvez venir voir un cours avant de vous décider.';

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'premier-cours-comment-ca-se-passe',
    title: 'Votre premier cours : comment ça se passe ?',
    metaTitle: `Premier cours à ${ASSO.ville} : comment ça se passe | ${ASSO.nomCourt}`,
    metaDescription: `Arrivée, tenue, matériel, déroulé de la séance : tout ce qu’il faut savoir avant votre premier cours avec ${ASSO.nom}.`,
    excerpt: 'Arrivée, tenue, déroulé : ce qui vous attend la première fois, pour venir sans appréhension.',
    image: '/assets/act-stretch.svg',
    date: '2026-09-01',
    readTime: 3,
    category: 'Pratique',
    ctaCourse: { name: 'Gym Douce', slug: `cours-gym-douce-${VILLE_SLUG}` },
    content: [
      `<p class="lead">Pousser la porte d’un cours collectif pour la première fois, ça peut impressionner. Voici comment se passe une première séance chez ${ASSO.nom}.</p>`,
      '<h2>En arrivant</h2>',
      '<p>Arrivez 10 minutes avant le début. Quelqu’un vous accueille et vous présente au coach. Signalez-lui si vous avez une gêne (dos, genou, épaule) : il adaptera les exercices.</p>',
      '<h2>La tenue</h2>',
      '<ul><li>une tenue souple dans laquelle vous êtes à l’aise ;</li><li>des baskets propres (réservées à la salle) ;</li><li>une bouteille d’eau et une petite serviette.</li></ul>',
      '<h2>Pendant la séance</h2>',
      '<p>Échauffement, partie principale, retour au calme. Le coach montre chaque mouvement et propose une version plus douce. Personne ne vous regarde : chacun est concentré sur sa séance.</p>',
      '<h2>Et après ?</h2>',
      `<p>${ESSAI_PHRASE} Si le cours vous plaît, l’adhésion est de <strong>${TARIF_LABEL} l’année</strong>.</p>`,
    ],
    faq: [
      {
        question: 'Je n’ai pas fait de sport depuis des années, c’est un problème ?',
        answer: 'Non. Les cours sont ouverts à tous les niveaux et le coach adapte les exercices.',
      },
      {
        question: 'Faut-il apporter un tapis ?',
        answer: 'Non, le matériel est fourni par l’association.',
      },
    ],
  },
  {
    slug: 'combien-coute-l-adhesion',
    title: `Combien coûte l’adhésion ? ${TARIF_LABEL} l’année, tout compris`,
    metaTitle: `Adhésion ${TARIF_LABEL}/an — ce qui est compris | ${ASSO.nomCourt}`,
    metaDescription: `Cotisation ${TARIF_LABEL} l’année à ${ASSO.ville} : tous les cours, ${ASSO.adhesion.inclus}. Moyens de paiement et inscription en cours de saison.`,
    excerpt: `Un seul tarif, ${TARIF_LABEL} l’année : ce qu’il comprend, comment payer, et ce qui se passe si vous arrivez en cours de saison.`,
    image: '/assets/act-renfo.svg',
    date: '2026-09-02',
    readTime: 2,
    category: 'Adhésion',
    content: [
      `<p class="lead">Chez ${ASSO.nom}, il n’y a qu’un tarif : <strong>${TARIF_LABEL} pour la saison</strong>, ${ASSO.adhesion.inclus}.</p>`,
      '<h2>Ce qui est compris</h2>',
      `<ul><li>l’accès à tous les cours de la semaine, sans limite ;</li><li>${ASSO.adhesion.inclus} ;</li><li>le matériel pendant les séances.</li></ul>`,
      '<h2>Comment payer</h2>',
      `<p>Vous remplissez le <a href="/inscription">formulaire d’inscription</a>, puis vous réglez : ${PAYMENT_MODES.join(', ').toLowerCase()}.</p>`,
      '<h2>Et si j’arrive en cours d’année ?</h2>',
      `<p>Le tarif reste le même. ${ESSAI_PHRASE}</p>`,
    ],
    faq: [
      {
        question: 'Puis-je payer en plusieurs fois ?',
        answer: 'Parlez-en au bureau : une solution est souvent possible.',
      },
    ],
  },
  {
    slug: 'choisir-son-cours',
    title: 'Pilates, Zumba, Gym douce… quel cours choisir ?',
    metaTitle: `Quel cours choisir à ${ASSO.ville} ? | ${ASSO.nomCourt}`,
    metaDescription: `Reprise en douceur, renforcement, cardio en musique : un guide simple pour choisir votre cours chez ${ASSO.nom}.`,
    excerpt: 'Reprise en douceur, renforcement ou cardio en musique : un guide simple pour trouver votre cours.',
    image: '/assets/act-zumba.svg',
    date: '2026-09-03',
    readTime: 3,
    category: 'Cours',
    ctaCourse: { name: 'Pilates', slug: `cours-pilates-${VILLE_SLUG}` },
    content: [
      '<p class="lead">Vous hésitez entre plusieurs cours ? Partez de ce que vous cherchez, pas du nom du cours.</p>',
      '<h2>Vous reprenez après une longue pause</h2>',
      '<p>La <strong>Gym douce</strong> et le <strong>Stretching</strong> : rythme calme, mobilité, équilibre.</p>',
      '<h2>Vous voulez tenir votre dos</h2>',
      '<p>Le <strong>Pilates</strong> et le <strong>Renforcement musculaire</strong> : gainage, posture, renforcement sans machines.</p>',
      '<h2>Vous aimez bouger en musique</h2>',
      '<p>La <strong>Zumba</strong> et le <strong>Cardio</strong> : souffle, énergie, bonne humeur.</p>',
      `<p>Le plus simple reste d’essayer. ${ESSAI_PHRASE}</p>`,
    ],
    faq: [
      {
        question: 'Puis-je faire plusieurs cours ?',
        answer: 'Oui, la cotisation donne accès à tous les cours de la semaine.',
      },
    ],
  },
];

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}
