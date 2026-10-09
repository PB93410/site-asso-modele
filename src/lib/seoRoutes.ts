/**
 * Source unique des routes indexables (sitemap + HTML pré-généré par scripts/postbuild-seo.mjs).
 * Construit depuis asso.config.js, les activités et le blog : rien à maintenir à la main.
 * Ne pas y mettre /bureau (noindex).
 */
import { ACTIVITY_PAGES } from '../data/activityPages';
import { BLOG_ARTICLES_LIVE } from '../data/blogLive';
import { ASSO, AUTOUR_PATH, ESSAIS_LABEL, PAYMENT_MODES, SITE_URL, TARIF_LABEL } from '../data/asso';
import { SEASON_LABEL } from '../data/CONFIG';
import { HOME_DESCRIPTION, HOME_TITLE } from './seoText';

export type SeoRoute = {
  path: string;
  title: string;
  description: string;
  priority: string;
  changefreq: 'weekly' | 'monthly' | 'yearly';
  images?: { loc: string; title: string; caption: string }[];
};

const essais = ESSAIS_LABEL ? `, ${ESSAIS_LABEL}` : '';

export const ROUTES: SeoRoute[] = [
  {
    path: '/',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    priority: '1.0',
    changefreq: 'weekly',
    images: [
      {
        loc: `${SITE_URL}/assets/og-image.png`,
        title: ASSO.nom,
        caption: `${ASSO.accroche} à ${ASSO.ville}`,
      },
    ],
  },
  {
    path: '/blog',
    title: `Blog — ${ASSO.nom}`,
    description: `Articles de ${ASSO.nom} à ${ASSO.ville} : essai, adhésion, premier cours, choix du cours.`,
    priority: '0.8',
    changefreq: 'weekly',
  },
  ...BLOG_ARTICLES_LIVE.map(
    (a): SeoRoute => ({
      path: `/blog/${a.slug}`,
      title: a.metaTitle,
      description: a.metaDescription,
      priority: '0.7',
      changefreq: 'monthly',
      images: [{ loc: `${SITE_URL}${a.image}`, title: a.title, caption: a.excerpt }],
    }),
  ),
  ...ACTIVITY_PAGES.map(
    (a): SeoRoute => ({
      path: `/${a.slug}`,
      title: a.metaTitle,
      description: a.metaDescription,
      priority: '0.8',
      changefreq: 'monthly',
    }),
  ),
  {
    path: '/faq',
    title: `FAQ ${ASSO.nom} — tarif, essais, certificat`,
    description: `FAQ ${ASSO.nom} (${ASSO.ville}) : tarif ${TARIF_LABEL}/an${essais}, certificat médical, planning.`,
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    path: AUTOUR_PATH,
    title: `${ASSO.accroche} près de ${ASSO.communesVoisines.join(', ')} — ${ASSO.ville}`,
    description: `${ASSO.accroche} à ${ASSO.ville}, à quelques minutes de ${ASSO.communesVoisines.join(', ')}. ${TARIF_LABEL}/an${essais}.`,
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    path: '/essai',
    title: `Essai gratuit à ${ASSO.ville} (${ASSO.codePostal}) — ${ASSO.nom}`,
    description: `Réservez un essai gratuit à ${ASSO.ville} (${ASSO.codePostal}), sans engagement. ${ASSO.accroche}. Le créneau s’affiche tout de suite.`,
    priority: '0.8',
    changefreq: 'weekly',
  },
  {
    path: '/tarifs',
    title: `Tarifs et adhésion — ${ASSO.nom} ${TARIF_LABEL}/an`,
    description: `Cotisation ${TARIF_LABEL}/an à ${ASSO.ville} (${ASSO.codePostal}), ${ASSO.adhesion.inclus}${essais}. Paiement : ${PAYMENT_MODES.join(', ')}.`,
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/inscription',
    title: `Inscription ${ASSO.nom} ${SEASON_LABEL} — ${TARIF_LABEL}/an`,
    description: `Inscrivez-vous à ${ASSO.nom} (${ASSO.ville}, ${ASSO.codePostal}). Cotisation ${TARIF_LABEL}/an${essais}. Paiement : ${PAYMENT_MODES.join(', ')}.`,
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/mentions-legales',
    title: `Mentions légales — ${ASSO.nom}`,
    description: `Mentions légales de ${ASSO.nom} (${ASSO.statut}) : éditeur, hébergeur, responsable de publication.`,
    priority: '0.3',
    changefreq: 'yearly',
  },
  {
    path: '/confidentialite',
    title: `Politique de confidentialité — ${ASSO.nom}`,
    description: `Politique de confidentialité RGPD de ${ASSO.nom} : essais et inscription, durées de conservation et exercice des droits.`,
    priority: '0.3',
    changefreq: 'yearly',
  },
];
