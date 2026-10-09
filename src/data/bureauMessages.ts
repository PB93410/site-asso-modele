import { REPRISE_AT } from './CONFIG';
import {
  ASSO,
  ESSAIS_LABEL,
  NB_ESSAIS,
  PAIEMENTS_BUREAU,
  PAIEMENT_NOM,
  SITE_URL,
  TARIF_LABEL,
} from './asso';
import { ACTIVITIES } from './siteData';
/** Textes prêts à copier — espace bureau (diffusion WhatsApp, mairie, etc.) */

export type BureauMessage = {
  id: string;
  title: string;
  when: string;
  body: string;
};

const SIGNATURE = `${ASSO.nom}
${ASSO.telephone}`;
const BOITE = `Boîte ${ASSO.email}`;
const REPRISE_LABEL = new Date(REPRISE_AT).toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
});

export const BUREAU_MESSAGES: BureauMessage[] = [
  {
    id: 'mail-essai',
    title: 'Réponse mail — essai',
    when: BOITE,
    body: `Bonjour,
Pour un essai gratuit : ${SITE_URL}/essai
${SIGNATURE}`,
  },
  ...(ASSO.adhesion.paiementUrl
    ? [
        {
          id: 'mail-cb',
          title: 'Réponse mail — paiement carte / reçu',
          when: BOITE,
          body: `Bonjour,
Le paiement carte se fait sur ${PAIEMENT_NOM}. La confirmation (et le reçu) part par e-mail ${PAIEMENT_NOM} — pensez aux indésirables.
Le bureau valide ensuite dans nos listes.
${SIGNATURE}`,
        },
      ]
    : []),
  {
    id: 'mail-cheque',
    title: `Réponse mail — ${PAIEMENTS_BUREAU}`,
    when: BOITE,
    body: `Bonjour,
Vous pouvez régler ${TARIF_LABEL} au bureau (${PAIEMENTS_BUREAU}). Formulaire : ${SITE_URL}/inscription
${SIGNATURE}`,
  },
  {
    id: 'reprise',
    title: 'Reprise des cours',
    when: `Autour du ${REPRISE_LABEL}`,
    body: `Bonjour,
Les cours reprennent le ${REPRISE_LABEL} chez ${ASSO.nom}.
${ESSAIS_LABEL ? `${ESSAIS_LABEL[0].toUpperCase()}${ESSAIS_LABEL.slice(1)} possibles — indiquez-nous le créneau qui vous intéresse.\n` : ''}Planning et infos : ${SITE_URL}
À bientôt,
${SIGNATURE}`,
  },
  {
    id: 'essai',
    title: 'Essais gratuits',
    when: 'Réponse à quelqu’un qui hésite',
    body: `Bonjour,
Vous pouvez tester ${NB_ESSAIS > 1 ? `${NB_ESSAIS} cours gratuits` : 'un cours gratuitement'}.
Réservez ici : ${SITE_URL}/essai
Ou dites-nous le créneau qui vous intéresse.
${TARIF_LABEL}/an si vous adhérez ensuite.
${SIGNATURE}`,
  },
  {
    id: 'relance-essai',
    title: 'Après un essai',
    when: '2 ou 3 jours après le cours',
    body: `Bonjour [prénom],
Merci d’être venu(e) au cours de [cours].
Si ça vous a convenu, vous pouvez adhérer (${TARIF_LABEL}/an) :
${ASSO.adhesion.paiementUrl ? `• carte : ${PAIEMENT_NOM} (lien du site)\n` : ''}• ${PAIEMENTS_BUREAU} : au bureau ou ${SITE_URL}/inscription
Des questions ? Répondez ici.
${ASSO.nom}`,
  },
  {
    id: 'rappel-creneau',
    title: 'Rappel d’un cours',
    when: 'La veille — remplacez les crochets',
    body: `Bonjour,
Petit rappel : cours de [NOM DU COURS] demain à [HEURE] — [LIEU].
À bientôt,
${ASSO.nom}`,
  },
  {
    id: 'google-business',
    title: 'Annonce Google / mairie',
    when: 'À coller hors WhatsApp',
    body: `Saison ${ASSO.saison.label} chez ${ASSO.nom} (${ASSO.ville}) !
${ACTIVITIES.length} cours · tous niveaux${ESSAIS_LABEL ? ` · ${ESSAIS_LABEL}` : ''} · ${TARIF_LABEL}/an.
${ASSO.telephone}
${SITE_URL}`,
  },
];
