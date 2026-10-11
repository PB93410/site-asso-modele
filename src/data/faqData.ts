/** FAQ affichée sur /faq — source unique pour l’UI et le JSON-LD. Textes : contenu/faq.json. */
import { remplir } from '../lib/gabarit.js';
import { FAQ_CONTENU } from './contenu';
import { VALEURS_TEXTE } from './siteData';

export type FaqItem = {
  question: string;
  answer: string;
  popular?: boolean;
};

export const faqs: FaqItem[] = FAQ_CONTENU.map((f) => ({
  question: remplir(f.question, VALEURS_TEXTE),
  answer: remplir(f.reponse, VALEURS_TEXTE),
  ...(f.populaire ? { popular: true } : {}),
}));
