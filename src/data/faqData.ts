/** FAQ affichée sur /faq — source unique pour l’UI et le JSON-LD. */
import { ASSO, COURS_ESSAI_LABEL, NB_ESSAIS, TARIF_LABEL } from './asso';
import { ACTIVITIES } from './siteData';

export type FaqItem = {
  question: string;
  answer: string;
  popular?: boolean;
};

export const faqs: FaqItem[] = [
  {
    question: 'On est combien dans un cours ?',
    answer:
      "Une vingtaine de personnes en moyenne. Assez pour l'ambiance, pas trop pour que le coach puisse corriger chacun. Les cours du soir sont les plus fréquentés, ceux de journée plus calmes.",
    popular: true,
  },
  {
    question: "Je peux m'inscrire en cours d'année ?",
    answer:
      `Oui, à tout moment de la saison. L'adhésion est de ${TARIF_LABEL} pour l'année en cours, quel que soit le moment de l'inscription.${NB_ESSAIS > 0 ? ` Vous pouvez faire vos ${COURS_ESSAI_LABEL} gratuits quelle que soit la période de l'année.` : ''}`,
  },
  {
    question: "Je peux changer de cours en cours d'année ?",
    answer:
      `Oui, librement. La cotisation unique donne accès aux ${ACTIVITIES.length} cours de la semaine. Vous pouvez changer en cours d'année sans rien redemander à personne et sans supplément.`,
    popular: true,
  },
  {
    question: 'Si je rate des cours, je perds mon argent ?',
    answer:
      'Non. La cotisation donne accès à tous les cours de la saison, sans obligation de présence ni de régularité. Vous venez quand vous pouvez.',
  },
  {
    question: 'Je dois venir toutes les semaines ?',
    answer:
      "Non. Certains adhérents viennent trois fois par semaine, d'autres une fois tous les quinze jours. Il n'y a ni pointage, ni engagement de présence.",
  },
  {
    question: "Qu'est-ce que la cotisation comprend exactement ?",
    answer:
      `Les ${TARIF_LABEL} couvrent l'accès à l'ensemble des cours de la saison (septembre à juin)${ASSO.federation.nom ? ` et la licence ${ASSO.federation.nom}${ASSO.federation.sigle ? ` (${ASSO.federation.sigle})` : ''}, qui inclut votre couverture d'assurance pendant les activités` : ''}. Il n'y a aucun frais supplémentaire.`,
  },
  {
    question: 'Je ne connais personne, ça se passe comment ?',
    answer:
      "C'est le cas de la plupart des gens qui poussent la porte. Quelqu'un vous accueille à l'entrée et vous présente au coach. Les cours collectifs ont ça de pratique : au bout de trois séances, vous reconnaissez les visages.",
  },
  {
    question: "Je n'ai pas fait de sport depuis longtemps, c'est pour moi ?",
    answer:
      "Oui. Nos coachs sont formés pour adapter les mouvements à chacun. Si un exercice ne vous convient pas, on vous en propose un autre : c'est normal et ça arrive à chaque séance. Le cours de gym douce est particulièrement adapté à une reprise.",
  },
  {
    question: "Faut-il un certificat médical pour s'inscrire ?",
    answer:
      "Non, le certificat médical n'est plus obligatoire pour la pratique de loisir depuis 2022. Nous demandons simplement le questionnaire de santé QS-SPORT au moment de l'inscription. Si une réponse est positive, un certificat médical vous sera demandé.",
    popular: true,
  },
  {
    question: `Je n’habite pas ${ASSO.ville}, je peux venir ?`,
    answer: `Oui. Les cours sont à ${ASSO.ville} (${ASSO.lieux.map((l) => l.nom).join(' et ')}). Des personnes viennent de ${ASSO.communesVoisines.join(', ')}.`,
  },
  {
    question: "Mon enfant peut-il s'inscrire ?",
    answer:
      "Non en dessous de 16 ans : l'association n'accepte pas les mineurs de moins de 16 ans. À partir de 16 ans, l'inscription est possible avec une autorisation parentale écrite signée par le représentant légal.",
  },
];
