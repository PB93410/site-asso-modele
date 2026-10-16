/**
 * Checklists de saison du bureau (modules.checklists). Une case cochée est partagée par tous les bénévoles
 * (API /api/checklists) et repart de zéro à chaque saison. Les identifiants (id) ne changent jamais : ils servent de clé.
 * « référent » = étape technique, à faire par la personne qui gère le site (docs/CHANGEMENT-SAISON.md).
 * Une association peut écrire ses propres listes dans asso.config.js → checklists.
 */

import type { AssoChecklist } from '../../asso.config';
import { ASSO } from './asso';

export type Checklist = AssoChecklist;
export type EtapeChecklist = AssoChecklist['etapes'][number];

export const CHECKLISTS_DEFAUT: Checklist[] = [
  {
    id: 'rentree',
    titre: 'Rentrée',
    quand: 'Fin août, septembre',
    etapes: [
      { id: 'horaires', texte: 'Horaires de la saison à jour', qui: 'bureau', ou: 'Autre → Horaires' },
      { id: 'vacances', texte: 'Dates de reprise et de vacances vérifiées sur le site', qui: 'référent' },
      { id: 'affiche', texte: 'Affiche A4 du planning imprimée et distribuée', qui: 'bureau', ou: 'Autre → Aide → Affiche planning A4' },
      { id: 'qr', texte: 'QR code d’essai imprimé et posé', qui: 'bureau', ou: 'Autre → Aide' },
      { id: 'fin-essais', texte: 'Date de fin des essais décidée et réglée sur le site', qui: 'référent' },
      { id: 'verso', texte: 'Verso des cartes de la nouvelle saison prêt', qui: 'référent' },
    ],
  },
  {
    id: 'forum',
    titre: 'Forum des associations',
    quand: 'Début septembre',
    etapes: [
      { id: 'stand', texte: 'Stand prêt : QR, affiches, téléphone ou tablette chargé', qui: 'bureau' },
      { id: 'binome', texte: 'Bénévoles du stand prévenus, mode d’emploi relu', qui: 'bureau', ou: 'Autre → Aide' },
      { id: 'soir', texte: 'Le soir : essais du stand vérifiés, adhésions pointées', qui: 'bureau', ou: 'À payer' },
      { id: 'rappels', texte: 'Dans la semaine : essais du forum rappelés', qui: 'bureau', ou: 'Essais' },
    ],
  },
  {
    id: 'cartes',
    titre: 'Cartes d’adhérent',
    quand: 'Toute la saison',
    etapes: [
      { id: 'pointage', texte: 'Paiements pointés, adhérents « À jour »', qui: 'bureau', ou: 'À payer' },
      { id: 'envoi', texte: 'Cartes envoyées aux adhérents à jour', qui: 'bureau', ou: 'Autre → Cartes adhérents' },
      { id: 'controle', texte: 'Pas d’alerte « numéros décalés » dans la boîte de l’asso', qui: 'bureau' },
    ],
  },
  {
    id: 'reinscriptions',
    titre: 'Réinscriptions',
    quand: 'Juin',
    etapes: [
      { id: 'ouverture', texte: 'Réinscriptions ouvertes le 1er juin (espace adhérent)', qui: 'bureau' },
      { id: 'annonce', texte: 'Adhérents prévenus : mail, WhatsApp, affiche', qui: 'bureau' },
      { id: 'relance', texte: 'Adhérents sans réponse relancés, mi-juin', qui: 'bureau' },
      { id: 'liste', texte: 'Liste des réinscrits vérifiée', qui: 'bureau', ou: 'Autre → Réinscriptions' },
      { id: 'paiements', texte: 'Paiements de la rentrée pointés', qui: 'bureau', ou: 'À payer' },
    ],
  },
  {
    id: 'changement',
    titre: 'Changement de saison',
    quand: 'Fin juin, juillet',
    etapes: [
      { id: 'onglet', texte: 'Tableau des adhérents de la nouvelle saison prêt, en-têtes vérifiés', qui: 'référent' },
      { id: 'config', texte: 'Saison, dates et verso des cartes mis à jour dans asso.config.js, puis site publié', qui: 'référent' },
      { id: 'netlify', texte: 'Variables Netlify mises à jour (onglet et préfixe des numéros), si Google Sheets', qui: 'référent' },
      { id: 'archivage', texte: 'Anciens essais archivés (aperçu d’abord, sauvegarde gardée un mois)', qui: 'référent' },
      { id: 'reinscrits', texte: 'Réinscrits de l’ancienne saison traités', qui: 'référent' },
    ],
  },
];

/** Les listes de l'association, sinon celles par défaut. */
export const CHECKLISTS: Checklist[] = ASSO.checklists?.length ? ASSO.checklists : CHECKLISTS_DEFAUT;
